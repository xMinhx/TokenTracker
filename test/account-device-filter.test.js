"use strict";

// The six account-* edge endpoints must each honor an optional ?device_id=
// query param by narrowing activeDeviceIds to that one device — but ONLY when
// the id belongs to the JWT-verified user (the includes() guard). This is a
// static source check (the endpoints are Deno + InsForge SDK and can't run
// under node --test); it guarantees all six got the identical guarded narrow.

const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert");

const ROOT = path.join(__dirname, "..");
const EDGE_DIR = "dashboard/edge-patches";

const ENDPOINTS = [
  "tokentracker-account-daily.ts",
  "tokentracker-account-summary.ts",
  "tokentracker-account-hourly.ts",
  "tokentracker-account-monthly.ts",
  "tokentracker-account-heatmap.ts",
  "tokentracker-account-model-breakdown.ts",
];

function readEdge(name) {
  return fs.readFileSync(path.join(ROOT, EDGE_DIR, name), "utf8");
}

test("every account-* endpoint reads device_id and guards it with includes()", () => {
  for (const name of ENDPOINTS) {
    const src = readEdge(name);
    assert.ok(
      src.includes('url.searchParams.get("device_id")'),
      `${name}: does not read the device_id query param`,
    );
    assert.ok(
      /activeDeviceIds\.includes\(\s*requestedDeviceId\s*\)/.test(src),
      `${name}: missing the includes(requestedDeviceId) ownership guard`,
    );
    assert.ok(
      /activeDeviceIds\s*=\s*\[\s*requestedDeviceId\s*\]/.test(src),
      `${name}: does not narrow activeDeviceIds to [requestedDeviceId]`,
    );
  }
});
