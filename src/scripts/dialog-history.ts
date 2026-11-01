type Entry = { id: string };
type Snapshot<T> = { version: 1; depth: number; dialogs: T[] };

/** One history entry per opened layer. Tabs replace that layer, not its parent. */
export function createDialogHistory<T extends Entry>(options: {
  key: string;
  capture: () => T[];
  restore: (dialogs: T[]) => void;
  fromURL: () => T[];
  url: (dialogs: T[]) => URL;
  navigate: () => void;
}) {
  let restoring = false, ready = false, pending = false;
  let depth = 0, hash = location.hash;
  let afterClose: (() => void) | undefined;
  const deferred: Array<() => void> = [];
  const read = (state: unknown): Snapshot<T> | undefined => {
    const value = (state as Record<string, Snapshot<T>> | null)?.[options.key];
    return value?.version === 1 && Number.isInteger(value.depth) && value.depth >= 0 && Array.isArray(value.dialogs) ? value : undefined;
  };
  function write(dialogs: T[], push = false) {
    const state = { ...(history.state || {}), [options.key]: { version: 1, depth, dialogs } };
    history[push ? 'pushState' : 'replaceState'](state, '', options.url(dialogs));
    hash = location.hash;
  }
  function apply(dialogs: T[]) {
    restoring = true;
    try { options.restore(dialogs); } finally { restoring = false; }
  }
  function record(opened: boolean) {
    if (!ready || restoring || pending) return;
    if (opened) depth++;
    write(options.capture(), opened);
  }
  function close(after?: () => void) {
    if (pending) return;
    const dialogs = options.capture();
    if (!dialogs.length) { after?.(); return; }
    if (depth > 0) {
      pending = true;
      afterClose = after;
      history.back();
    } else {
      // A directly opened deep link has no owned predecessor to consume.
      apply(dialogs.slice(0, -1));
      write(options.capture());
      after?.();
    }
  }
  function navigate(url: URL, action: () => void) {
    const run = () => {
      depth = 0;
      history.pushState({ ...(history.state || {}), [options.key]: { version: 1, depth, dialogs: [] } }, '', url);
      hash = location.hash;
      action();
    };
    if (options.capture().length) close(run); else run();
  }
  window.addEventListener('popstate', () => {
    const state = read(history.state), changedHash = hash !== location.hash;
    depth = state?.depth || 0;
    pending = false;
    apply(state?.dialogs || options.fromURL());
    if (!state) write(options.capture());
    hash = location.hash;
    if (changedHash) options.navigate();
    const callback = afterClose;
    afterClose = undefined;
    // Run menu navigation after the browser has restored the previous entry.
    const actions = deferred.splice(0);
    if (callback || actions.length) window.setTimeout(() => { callback?.(); actions.forEach(action => action()); }, 0);
  });
  return {
    get restoring() { return restoring; },
    get pending() { return pending; },
    record, close, navigate,
    defer(action: () => void) { if (pending) deferred.push(action); else action(); },
    initialize() {
      const state = read(history.state);
      depth = state?.depth || 0;
      if (state) apply(state.dialogs);
      write(options.capture());
      ready = true;
    },
  };
}
