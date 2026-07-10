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
    assert.ok(
      src.includes("let activeDeviceIds"),
      `${name}: activeDeviceIds must be declared 'let' (not const) so the narrow can re-assign it`,
    );
  }
});

test("account-devices endpoint exists, verifies JWT, queries devices, sums per-device", () => {
  const src = readEdge("tokentracker-account-devices.ts");
  assert.ok(src.includes("verifiedUserIdFromJwt"), "missing JWT verification");
  assert.ok(
    src.includes('.from("tokentracker_devices")'),
    "does not query tokentracker_devices",
  );
  assert.ok(
    src.includes('.select("id, device_name, platform, created_at")'),
    "account-devices must select id, device_name, platform, created_at",
  );
  assert.ok(src.includes('.is("revoked_at", null)'), "must filter revoked devices");
  assert.ok(src.includes('.eq("user_id"'), "must filter devices by user_id");
  assert.ok(src.includes("account_usage_grouped"), "does not sum usage via the RPC");
  assert.ok(src.includes("total_tokens"), "does not return per-device total_tokens");
});

// Two per-device summing invariants (both regressed in the shipped v0.61.0 card):
//   1. The UTC query window is widened ±1 day for TZ shifts, so the tz-local day
//      buckets the RPC returns MUST be trimmed back to [from, to] — otherwise a
//      single-day view sums ~3 days per device.
//   2. The RPC's account-level branch ignores p_device_ids, so account-level
//      sources (cursor) MUST be excluded from per-device sums — otherwise every
//      device gets the user's entire account-level total added (N identical
//      phantom-device rows).
test("account-devices trims day buckets to [from, to] and excludes account-level sources", () => {
  const src = readEdge("tokentracker-account-devices.ts");
  assert.ok(
    /day\s*<\s*fromDay\s*\|\|\s*day\s*>\s*toDay/.test(src),
    "per-device sum must skip buckets outside the requested [from, to] day range",
  );
  assert.ok(
    /ACCOUNT_LEVEL_SOURCES\.has\(/.test(src),
    "per-device sum must skip account-level sources (no device attribution)",
  );
});

// The account-level usage excluded from per-device sums must still be returned
// (as account_sources) so the card total reconciles with the dashboard total.
test("account-devices returns account-level source totals alongside devices", () => {
  const src = readEdge("tokentracker-account-devices.ts");
  assert.ok(
    /p_device_ids:\s*\[\]/.test(src),
    "account-source sum must call the RPC with an empty p_device_ids (account branch only)",
  );
  assert.ok(
    src.includes("account_sources: accountSources"),
    "response must include the account_sources array",
  );
});

test("account-devices is NOT in the pricing-parity mirror set (no MODEL_PRICING block)", () => {
  const src = readEdge("tokentracker-account-devices.ts");
  assert.ok(!src.includes("const MODEL_PRICING"), "account-devices must not embed a pricing block");
});
