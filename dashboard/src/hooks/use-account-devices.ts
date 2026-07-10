import { useCallback, useEffect, useState } from "react";
import { resolveAuthAccessToken } from "../lib/auth-token";
import { fetchAccountDevices } from "../lib/api";

/**
 * Lists the signed-in account's active devices with per-device usage totals
 * for [from, to]. Only fetches in account view (cross-device cloud reads);
 * outside it the dashboard is single-device and there is nothing to compare.
 */
export function useAccountDevices({
  from,
  to,
  timeZone,
  tzOffsetMinutes,
  accountView = false,
  accountAccessToken = null,
  accountRevision = 0,
}: any = {}) {
  const enabled = Boolean(accountView && accountAccessToken);
  const [devices, setDevices] = useState<any[]>([]);
  // Account-level sources (e.g. Cursor) have no device attribution; the edge
  // returns their account-wide totals separately so the card can still show
  // them (otherwise its total is short of the dashboard total by their share).
  const [accountSources, setAccountSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setDevices([]);
      setAccountSources([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await resolveAuthAccessToken(accountAccessToken);
      const res = await fetchAccountDevices({ from, to, timeZone, tzOffsetMinutes, accessToken: token });
      setDevices(Array.isArray(res?.devices) ? res.devices : []);
      setAccountSources(Array.isArray(res?.account_sources) ? res.account_sources : []);
    } catch (e: any) {
      setError(e?.message || String(e));
      setDevices([]);
      setAccountSources([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, accountAccessToken, from, to, timeZone, tzOffsetMinutes, accountRevision]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { devices, accountSources, loading, error, refresh };
}
