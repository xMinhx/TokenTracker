const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  repairCodexRescanInflation,
  CODEX_RESCAN_DEDUP_REPAIR_KEY,
} = require("../src/commands/sync");

async function makeTempHome() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "tokentracker-codexrepair-"));
}

function tokenCountLine({ ts, last, total }) {
  return JSON.stringify({
    type: "event_msg",
    timestamp: ts,
    payload: { type: "token_count", info: { last_token_usage: last, total_token_usage: total } },
  });
}

// Two cumulative events in one half-hour: deltas 100 + 150 → true codex total 250.
const U1 = { input_tokens: 60, cached_input_tokens: 0, output_tokens: 40, reasoning_output_tokens: 0, total_tokens: 100 };
const T2 = { input_tokens: 150, cached_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 0, total_tokens: 250 };
const U2 = { input_tokens: 90, cached_input_tokens: 0, output_tokens: 60, reasoning_output_tokens: 0, total_tokens: 150 };
const TRUE_CODEX_TOTAL = 250;

async function writeCodexFile(home, uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee") {
  const dir = path.join(home, ".codex", "sessions", "2025", "12", "17");
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, `rollout-2025-12-17T00-00-00-${uuid}.jsonl`);
  await fs.writeFile(
    fp,
    [
      tokenCountLine({ ts: "2025-12-17T00:00:00.000Z", last: U1, total: U1 }),
      tokenCountLine({ ts: "2025-12-17T00:00:01.000Z", last: U2, total: T2 }),
    ].join("\n") + "\n",
    "utf8",
  );
  return fp;
}

const codexBucketTotal = (cursors) =>
  Object.entries(cursors.hourly?.buckets || {})
    .filter(([k]) => k.startsWith("codex|"))
    .reduce((s, [, v]) => s + Number(v.totals?.total_tokens || 0), 0);

const queueRowsBySource = async (queuePath) => {
  const raw = await fs.readFile(queuePath, "utf8");
  const m = {};
  for (const l of raw.split("\n")) {
    if (!l.trim()) continue;
    const r = JSON.parse(l);
    m[r.source] = m[r.source] || { rows: 0, total: 0 };
    m[r.source].rows += 1;
    m[r.source].total += Number(r.total_tokens || 0);
  }
  return m;
};

describe("repairCodexRescanInflation (#187) — atomic guarded rebuild", () => {
  it("rebuilds inflated codex to the true value, preserves other sources, strips+rebuilds the queue, resets the offset", async () => {
    const home = await makeTempHome();
    try {
      const codexFile = await writeCodexFile(home);
      const queuePath = path.join(home, "queue.jsonl");
      const queueStatePath = path.join(home, "queue.state.json");

      // INFLATED state (as if inode re-scans tripled codex): bucket 750, queue carries old-high codex rows.
      await fs.writeFile(
        queuePath,
        [
          JSON.stringify({ source: "codex", model: "unknown", hour_start: "2025-12-17T00:00:00.000Z", total_tokens: 250 }),
          JSON.stringify({ source: "codex", model: "unknown", hour_start: "2025-12-17T00:00:00.000Z", total_tokens: 750 }),
          JSON.stringify({ source: "claude", model: "opus", hour_start: "2025-12-17T00:00:00.000Z", total_tokens: 5000 }),
        ].join("\n") + "\n",
        "utf8",
      );
      await fs.writeFile(queueStatePath, JSON.stringify({ offset: 99999 }), "utf8");

      const cursors = {
        hourly: {
          buckets: {
            "codex|unknown|2025-12-17T00:00:00.000Z": { totals: { total_tokens: 750 } }, // 3x inflated
            "claude|opus|2025-12-17T00:00:00.000Z": { totals: { total_tokens: 5000 } },
          },
          groupQueued: {},
        },
        files: { [codexFile]: { inode: 1, offset: 5, lastTotal: { total_tokens: 750 } } },
        codexHashes: ["stale:key"],
        migrations: {},
      };

      const ran = await repairCodexRescanInflation({
        cursors,
        queuePath,
        queueStatePath,
        rolloutFiles: [{ path: codexFile, source: "codex" }],
      });
      assert.equal(ran, true);

      // codex rebuilt to TRUE value (not the 750 inflation, not 0)
      assert.equal(codexBucketTotal(cursors), TRUE_CODEX_TOTAL);

      // other sources untouched
      assert.equal(cursors.hourly.buckets["claude|opus|2025-12-17T00:00:00.000Z"].totals.total_tokens, 5000);

      // queue: codex rows replaced with clean total, claude row preserved
      const q = await queueRowsBySource(queuePath);
      assert.equal(q.codex.total, TRUE_CODEX_TOTAL, "queue codex rebuilt to true total");
      assert.equal(q.claude.rows, 1);
      assert.equal(q.claude.total, 5000);

      // offset reset, codexHashes rebuilt (2 events), file cursor reinstalled at EOF, key set
      assert.equal(JSON.parse(await fs.readFile(queueStatePath, "utf8")).offset, 0);
      assert.equal(cursors.codexHashes.length, 2);
      assert.ok(cursors.files[codexFile] && cursors.files[codexFile].offset > 5);
      assert.ok(cursors.migrations[CODEX_RESCAN_DEDUP_REPAIR_KEY]);

      // idempotent: second call is a no-op
      assert.equal(
        await repairCodexRescanInflation({ cursors, queuePath, queueStatePath, rolloutFiles: [{ path: codexFile, source: "codex" }] }),
        false,
      );
      assert.equal(codexBucketTotal(cursors), TRUE_CODEX_TOTAL);
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });

  it("GUARD: skips with zero mutation when a contributing codex file is missing from disk", async () => {
    const home = await makeTempHome();
    try {
      const codexFile = await writeCodexFile(home);
      const queuePath = path.join(home, "queue.jsonl");
      const queueStatePath = path.join(home, "queue.state.json");
      await fs.writeFile(queuePath, JSON.stringify({ source: "codex", model: "unknown", hour_start: "2025-12-17T00:00:00.000Z", total_tokens: 750 }) + "\n", "utf8");
      await fs.writeFile(queueStatePath, JSON.stringify({ offset: 42 }), "utf8");

      const goneFile = path.join(home, ".codex", "sessions", "2025", "12", "16", "rollout-GONE-uuid.jsonl");
      const cursors = {
        hourly: { buckets: { "codex|unknown|2025-12-17T00:00:00.000Z": { totals: { total_tokens: 750 } } }, groupQueued: {} },
        files: { [codexFile]: { inode: 1, offset: 5 }, [goneFile]: { inode: 2, offset: 5 } }, // goneFile not on disk
        codexHashes: ["keep:me"],
        migrations: {},
      };

      const ran = await repairCodexRescanInflation({
        cursors,
        queuePath,
        queueStatePath,
        rolloutFiles: [{ path: codexFile, source: "codex" }], // goneFile also absent from scan
      });
      assert.equal(ran, false);

      // nothing destroyed
      assert.equal(codexBucketTotal(cursors), 750);
      assert.equal((await queueRowsBySource(queuePath)).codex.total, 750);
      assert.equal(JSON.parse(await fs.readFile(queueStatePath, "utf8")).offset, 42);
      assert.deepEqual(cursors.codexHashes, ["keep:me"]);
      assert.equal(cursors.migrations[CODEX_RESCAN_DEDUP_REPAIR_KEY].skipped, true);
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });

  it("SANITY: skips without setting the key (no clear) when files exist but rebuild yields 0 codex buckets", async () => {
    const home = await makeTempHome();
    try {
      // A codex file with NO token_count events → rebuild produces 0 codex buckets.
      const dir = path.join(home, ".codex", "sessions", "2025", "12", "17");
      await fs.mkdir(dir, { recursive: true });
      const emptyFile = path.join(dir, "rollout-2025-12-17T00-00-00-ffffffff-0000-0000-0000-000000000000.jsonl");
      await fs.writeFile(emptyFile, JSON.stringify({ type: "session_meta", payload: { id: "x" } }) + "\n", "utf8");

      const queuePath = path.join(home, "queue.jsonl");
      const queueStatePath = path.join(home, "queue.state.json");
      await fs.writeFile(queuePath, JSON.stringify({ source: "codex", model: "unknown", hour_start: "2025-12-17T00:00:00.000Z", total_tokens: 750 }) + "\n", "utf8");
      await fs.writeFile(queueStatePath, JSON.stringify({ offset: 7 }), "utf8");

      const cursors = {
        hourly: { buckets: { "codex|unknown|2025-12-17T00:00:00.000Z": { totals: { total_tokens: 750 } } }, groupQueued: {} },
        files: { [emptyFile]: { inode: 1, offset: 5 } },
        codexHashes: [],
        migrations: {},
      };

      const ran = await repairCodexRescanInflation({
        cursors,
        queuePath,
        queueStatePath,
        rolloutFiles: [{ path: emptyFile, source: "codex" }],
      });
      assert.equal(ran, false);

      // live data untouched, key NOT set (so it retries once the file has real data)
      assert.equal(codexBucketTotal(cursors), 750);
      assert.equal(JSON.parse(await fs.readFile(queueStatePath, "utf8")).offset, 7);
      assert.equal(cursors.migrations[CODEX_RESCAN_DEDUP_REPAIR_KEY], undefined);
    } finally {
      await fs.rm(home, { recursive: true, force: true });
    }
  });
});
