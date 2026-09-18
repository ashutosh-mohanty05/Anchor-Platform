import { useEffect, useRef } from "react";

/**
 * Re-runs `load` on an interval, but only while the tab is actually visible
 * (so we're not silently spamming the API in a background tab), and
 * immediately again the instant the tab regains focus/visibility — so data
 * changed elsewhere (another tab, another device, the phone app) shows up
 * here without the user having to hit refresh.
 *
 * `load` is stashed in a ref and read fresh on every tick, so callers whose
 * `load` closes over changing state (e.g. a visible date range) don't get
 * stuck calling a stale, outdated version of it.
 */
export function useAutoRefresh(load: () => void, intervalMs = 20000) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") loadRef.current(); };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
