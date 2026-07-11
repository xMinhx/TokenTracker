const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

// The pet's usage-driven ambient thresholds and the sprite-atlas timing tables are
// hand-mirrored between the web/Windows implementation (JS) and the macOS one
// (Swift). These shape-locked tests pin the two copies to each other so a tweak on
// one side can't silently make the platforms react differently to the same usage.

const repoRoot = path.join(__dirname, "..");

const personalitySource = fs.readFileSync(
  path.join(repoRoot, "dashboard/src/lib/pet-personality.js"),
  "utf8",
);
const companionSource = fs.readFileSync(
  path.join(repoRoot, "TokenTrackerBar/TokenTrackerBar/Views/ClawdCompanionView.swift"),
  "utf8",
);
const atlasJsSource = fs.readFileSync(
  path.join(repoRoot, "dashboard/src/ui/foundation/PetAtlasAnimated.jsx"),
  "utf8",
);
const atlasSwiftSource = fs.readFileSync(
  path.join(repoRoot, "TokenTrackerBar/TokenTrackerBar/Views/PetAtlasSpriteView.swift"),
  "utf8",
);

// "workingThinking" → "working-thinking", so the two sides compare directly.
function kebab(swiftCase) {
  return swiftCase.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function jsAmbientRules() {
  const rules = [];
  for (const m of personalitySource.matchAll(
    /if \(tokens >= ([\d_]+)\) choices\.push\(([^)]+)\);/g,
  )) {
    for (const state of m[2].matchAll(/"([a-z-]+)"/g)) {
      rules.push({ trigger: `tokens>=${m[1]}`, state: state[1] });
    }
  }
  const models = personalitySource.match(
    /topModels\?\.length \|\| 0\) >= (\d+)\) choices\.push\("([a-z-]+)"\)/,
  );
  assert.ok(models, "pet-personality.js topModels ambient rule must stay regex-parsable");
  rules.push({ trigger: `topModels>=${models[1]}`, state: models[2] });
  const streak = personalitySource.match(
    /streakDays\) \|\| 0\) >= (\d+)\) choices\.push\("([a-z-]+)"\)/,
  );
  assert.ok(streak, "pet-personality.js streak ambient rule must stay regex-parsable");
  rules.push({ trigger: `streak>=${streak[1]}`, state: streak[2] });
  return rules;
}

function swiftAmbientRules() {
  const loop = companionSource.match(
    /private func startIdleVariantLoop\(\) \{[\s\S]*?\n    \}/,
  );
  assert.ok(loop, "ClawdCompanionView.swift startIdleVariantLoop must exist");
  const body = loop[0];
  const rules = [];
  for (const m of body.matchAll(
    /if tokens >= ([\d_]+) \{ variants(?:\.append\(\.(\w+)\)|\s*\+=\s*\[([^\]]+)\]) \}/g,
  )) {
    const states = m[2] ? [m[2]] : [...m[3].matchAll(/\.(\w+)/g)].map((s) => s[1]);
    for (const state of states) {
      rules.push({ trigger: `tokens>=${m[1]}`, state: kebab(state) });
    }
  }
  const models = body.match(/topModels\.count >= (\d+) \{ variants\.append\(\.(\w+)\) \}/);
  assert.ok(models, "startIdleVariantLoop topModels rule must stay regex-parsable");
  rules.push({ trigger: `topModels>=${models[1]}`, state: kebab(models[2]) });
  const streak = body.match(/streakDays \?\? 0\) >= (\d+) \{ variants\.append\(\.(\w+)\) \}/);
  assert.ok(streak, "startIdleVariantLoop streak rule must stay regex-parsable");
  rules.push({ trigger: `streak>=${streak[1]}`, state: kebab(streak[2]) });
  return rules;
}

test("ambient usage thresholds match between pet-personality.js and ClawdCompanionView.swift", () => {
  const js = jsAmbientRules();
  assert.ok(js.length >= 5, "expected at least 5 JS ambient rules");
  assert.deepEqual(swiftAmbientRules(), js);
});

test("the overheated pose never re-enters an ambient pool (it reuses the error visuals)", () => {
  const jsAmbient = personalitySource.match(
    /function pickPetAmbientState[\s\S]*?\n\}/,
  )[0];
  assert.ok(!jsAmbient.includes('choices.push("working-overheated"'),
    "working-overheated must not be an ambient choice");
  const swiftLoop = companionSource.match(
    /private func startIdleVariantLoop\(\) \{[\s\S]*?\n    \}/,
  )[0];
  assert.ok(!/variants(?:\.append\(\.workingOverheated\)|[^\n]*\.workingOverheated)/.test(swiftLoop),
    ".workingOverheated must not be an idle variant");
});

function jsAtlasRows() {
  const block = atlasJsSource.match(/const ROWS = \{([\s\S]*?)\n\};/);
  assert.ok(block, "PetAtlasAnimated.jsx ROWS must stay a literal object");
  const rows = new Map();
  for (const m of block[1].matchAll(
    /(?:"([\w-]+)"|([\w-]+)):\s*\{ row: (\d+), durations: \[([\d, ]+)\] \}/g,
  )) {
    rows.set(Number(m[3]), m[4].split(",").map((n) => Number(n.trim())));
  }
  return rows;
}

function swiftAtlasRows() {
  const rows = new Map();
  for (const m of atlasSwiftSource.matchAll(
    /AnimationSpec\(row: (\d+), durations: \[([\d, ]+)\]\)/g,
  )) {
    rows.set(Number(m[1]), m[2].split(",").map((n) => Number(n.trim())));
  }
  return rows;
}

test("atlas row timings match between PetAtlasAnimated.jsx and PetAtlasSpriteView.swift", () => {
  const js = jsAtlasRows();
  const swift = swiftAtlasRows();
  assert.ok(js.size >= 9, "expected the full 9-row JS table");
  assert.ok(swift.size >= 7, "expected the Swift AnimationSpec switch to cover 7 rows");
  // The web table additionally carries the directional running rows (1/2) that macOS
  // does not use; every row macOS renders must tick with the web's exact durations.
  for (const [row, durations] of swift) {
    assert.deepEqual(
      durations,
      js.get(row),
      `row ${row} durations diverge between Swift and JS`,
    );
  }
});
