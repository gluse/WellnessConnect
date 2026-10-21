// Active only while a service editor registers a blocker. No draft data is stored.
type ExitBlocker = (proceed: () => unknown) => void;
let blocker: ExitBlocker | undefined;
export function registerServiceExitBlocker(next: ExitBlocker) {
  blocker = next;
  return () => { if (blocker === next) blocker = undefined; };
}
export function requestServiceEditorExit(proceed: () => unknown) {
  if (blocker) blocker(proceed);
  // Async action owners report failures through their existing mutation handlers.
  else void Promise.resolve(proceed()).catch(() => {});
}

/** Track same-document history from app mount so Back/Forward can be restored
 * before asking about an unsaved service. Preserve wouter's event wrappers. */
export function installServiceNavigationTracking() {
  const key = "__fitsServiceHistoryPosition";
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  let position = Number(window.history.state?.[key]) || 0;
  let restoring: (() => void) | undefined;
  let allowPop = false;
  const stateAt = (state: unknown, index: number) => ({ ...(state && typeof state === "object" ? state : {}), [key]: index });
  originalReplace.call(window.history, stateAt(window.history.state, position), "");
  const push: History["pushState"] = function (state, unused, url) {
    const proceed = () => { position += 1; originalPush.call(window.history, stateAt(state, position), unused, url); };
    if (blocker && url && new URL(String(url), window.location.href).pathname !== window.location.pathname) blocker(proceed);
    else proceed();
  };
  const replace: History["replaceState"] = function (state, unused, url) {
    const proceed = () => originalReplace.call(window.history, stateAt(state, position), unused, url);
    if (blocker && url && new URL(String(url), window.location.href).pathname !== window.location.pathname) blocker(proceed);
    else proceed();
  };
  const pop = (event: PopStateEvent) => {
    const target = event.state?.[key];
    if (restoring) {
      event.stopImmediatePropagation();
      const afterRestore = restoring; restoring = undefined; afterRestore(); return;
    }
    if (allowPop || !blocker || typeof target !== "number" || target === position) {
      allowPop = false;
      if (typeof target === "number") position = target;
      return;
    }
    event.stopImmediatePropagation();
    const delta = target - position;
    restoring = () => requestServiceEditorExit(() => { allowPop = true; window.history.go(delta); });
    window.history.go(-delta);
  };
  window.history.pushState = push;
  window.history.replaceState = replace;
  window.addEventListener("popstate", pop, true);
  return () => {
    window.removeEventListener("popstate", pop, true);
    if (window.history.pushState === push) window.history.pushState = originalPush;
    if (window.history.replaceState === replace) window.history.replaceState = originalReplace;
  };
}
