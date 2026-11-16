/** Restart transiently failed browser providers and reacquire on foreground return. */
export function watchBrowserLocation(
  onPosition: PositionCallback,
  onError: PositionErrorCallback,
  geo: Geolocation = navigator.geolocation,
) {
  let disposed = false;
  let generation = 0;
  let watch: number | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
  const clear = () => {
    if (watch !== null) geo.clearWatch(watch);
    watch = null;
    clearTimeout(retry);
  };
  const start = () => {
    if (disposed) return;
    clear();
    const current = ++generation;
    watch = geo.watchPosition(value => {
      if (disposed || current !== generation) return;
      clearTimeout(retry);
      onPosition(value);
    }, failure => {
      if (disposed || current !== generation) return;
      if (failure.code === 1) { dispose(); onError(failure); return; }
      ++generation;
      clear();
      retry = setTimeout(start, 2000);
      onError(failure);
    }, options);
  };
  const foreground = () => { if (document.visibilityState === 'visible') start(); };
  function dispose() {
    disposed = true;
    clear();
    document.removeEventListener('visibilitychange', foreground);
    window.removeEventListener('pageshow', foreground);
  }
  document.addEventListener('visibilitychange', foreground);
  window.addEventListener('pageshow', foreground);
  start();
  return dispose;
}
