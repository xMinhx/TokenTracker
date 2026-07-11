const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");

function configuredCharacterIds() {
  const source = fs.readFileSync(
    path.join(repoRoot, "dashboard/src/lib/pet-personality.js"),
    "utf8",
  );
  const match = source.match(/PET_CHARACTER_IDS\s*=\s*(\[[^;]+\])/);
  assert.ok(match, "PET_CHARACTER_IDS must remain a literal array so assets can be validated");
  return JSON.parse(match[1]);
}

test("every atlas-backed pet ships matching web and macOS assets", () => {
  const atlasCharacters = configuredCharacterIds().filter((id) => id !== "clawd");
  assert.deepEqual(atlasCharacters, ["sprout", "byte", "ember"]);

  for (const id of atlasCharacters) {
    const webPath = path.join(repoRoot, `dashboard/public/pets/${id}/spritesheet.webp`);
    const macPath = path.join(repoRoot, `TokenTrackerBar/TokenTrackerBar/PetSprites/pet-${id}.png`);
    assert.ok(fs.existsSync(webPath), `${id} web atlas is missing`);
    assert.ok(fs.existsSync(macPath), `${id} macOS atlas is missing`);

    const web = fs.readFileSync(webPath);
    assert.equal(web.subarray(0, 4).toString("ascii"), "RIFF", `${id} web atlas is not RIFF`);
    assert.equal(web.subarray(8, 12).toString("ascii"), "WEBP", `${id} web atlas is not WebP`);

    const png = fs.readFileSync(macPath);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1_536, `${id} macOS atlas width must be 1536`);
    assert.equal(png.readUInt32BE(20), 1_872, `${id} macOS atlas height must be 1872`);
  }
});
