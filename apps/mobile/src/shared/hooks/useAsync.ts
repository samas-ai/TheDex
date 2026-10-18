import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  readonly data: T | undefined;
  readonly error: Error | null;
  readonly loading: boolean;
  readonly reload: () => void;
}

/**
 * Runs an async loader whenever `deps` change, ignoring stale results. The previous data is
 * kept while reloading so lists do not flash empty between filter changes.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let current = true;
    setLoading(true);
    loadRef
      .current()
      .then((result) => {
        if (!current) return;
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
    // `deps` are the caller's: the loader is read from a ref so it never re-triggers by itself.
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
