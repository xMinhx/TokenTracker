/**
 * Tokentracker profile likes (装饰性 like counter).
 *
 * Storage: `tokentracker_user_settings.profile_likes` (int, default 0).
 * Single counter per target user — no liker identity recorded, no edge table.
 * Allows anonymous likes (no JWT required). Per-device dedup lives client-side
 * in localStorage; this endpoint trusts the {delta: ±1} payload.
 *
 * Endpoints:
 *   GET  ?user_id=X            → { count }
 *   POST { user_id, delta }    → { count } (delta must be 1 or -1)
 *
 * Behaviour notes:
 *   - target in LEADERBOARD_BLOCKED_USER_IDS → 404 (consistent with profile/leaderboard).
 *   - Self-like is allowed (per product decision).
 *   - Race on concurrent +1s is accepted — this is a decorative counter, not money.
 *   - We require the target row to exist in tokentracker_user_settings; missing
 *     rows return 404 to avoid silently creating settings for non-public users.
 */
import { createClient } from "npm:@insforge/sdk";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const BLOCKED_LEADERBOARD_USER_IDS = new Set(
  (Deno.env.get("LEADERBOARD_BLOCKED_USER_IDS") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getClient() {
  const serviceRoleKey = Deno.env.get("INSFORGE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("INSFORGE_ANON_KEY") ?? Deno.env.get("ANON_KEY");
  return createClient({
    baseUrl: Deno.env.get("INSFORGE_BASE_URL")!,
    edgeFunctionToken: serviceRoleKey,
    anonKey: anonKey ?? undefined,
    isServerMode: true,
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
async function readCount(client: any, userId: string): Promise<number | null> {
  const { data, error } = await client.database
    .from("tokentracker_user_settings")
    .select("profile_likes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return Number((data as { profile_likes?: number }).profile_likes) || 0;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const client = getClient();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    if (!userId || !UUID_RE.test(userId)) return json({ error: "user_id is required" }, 400);
    if (BLOCKED_LEADERBOARD_USER_IDS.has(userId)) return json({ error: "Not found" }, 404);
    try {
      const count = await readCount(client, userId);
      if (count === null) return json({ error: "Not found" }, 404);
      return json({ count });
    } catch (e) {
      return json({ error: (e as Error).message || "read failed" }, 500);
    }
  }

  if (req.method === "POST") {
    let body: { user_id?: string; delta?: number };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const userId = body.user_id;
    const delta = body.delta;
    if (!userId || !UUID_RE.test(userId)) return json({ error: "user_id is required" }, 400);
    if (delta !== 1 && delta !== -1) return json({ error: "delta must be 1 or -1" }, 400);
    if (BLOCKED_LEADERBOARD_USER_IDS.has(userId)) return json({ error: "Not found" }, 404);

    try {
      const current = await readCount(client, userId);
      if (current === null) return json({ error: "Not found" }, 404);
      // Clamp at 0 — never expose negative counts even if client mis-tracks state.
      const next = Math.max(0, current + delta);
      const { error: updErr } = await client.database
        .from("tokentracker_user_settings")
        .update({ profile_likes: next })
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message);
      return json({ count: next });
    } catch (e) {
      return json({ error: (e as Error).message || "update failed" }, 500);
    }
  }

  return json({ error: "Method not allowed" }, 405);
}
