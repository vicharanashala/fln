import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; reload: () => void }

/** Runs a loader when the key changes; a 401 sends the person back to the login screen. */
export function useLoad<T>(load: () => Promise<T>, key: string, onUnauthorized: () => void): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  // Keep the latest closures in refs so the effect re-runs only when `key` or a manual reload says so.
  const loadRef = useRef(load);
  const unauthorizedRef = useRef(onUnauthorized);
  loadRef.current = load;
  unauthorizedRef.current = onUnauthorized;
  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null }));
    loadRef.current().then(
      data => { if (alive) setState({ data, error: null, loading: false }); },
      (e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) { unauthorizedRef.current(); return; }
        setState({ data: null, error: e instanceof Error ? e.message : 'Something went wrong.', loading: false });
      },
    );
    return () => { alive = false; };
  }, [key, tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);
  return { ...state, reload };
}
