// Small browser helpers for a lecture session: keep the screen awake, and warn before leaving.
// Both fail quietly where unsupported. See spec.md > Device Helpers.

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Keeps the screen on while listening; re-acquires the lock when the page becomes visible again. Returns a cleanup. */
export function keepScreenAwake(): () => void {
  let lock: WakeLockSentinelLike | null = null;
  let active = true;

  const request = async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } })
        .wakeLock;
      if (active && wl && document.visibilityState === "visible") lock = await wl.request("screen");
    } catch {
      // Not supported or not allowed (e.g. low battery mode) — the session still works.
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void request();
  };

  void request();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => {});
    lock = null;
  };
}

/** Asks the browser to confirm before closing or reloading the page. Returns a cleanup. */
export function warnBeforeLeaving(): () => void {
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}
