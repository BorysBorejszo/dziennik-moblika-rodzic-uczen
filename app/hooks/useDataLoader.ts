import { useCallback, useEffect, useRef, useState } from 'react';

export interface DataLoaderResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDataLoader<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): DataLoaderResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcherRef.current()
      .then(result => {
        if (!cancelled) { setData(result); setLoading(false); }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const isAbort = err instanceof Error && err.name === 'AbortError';
          setError(isAbort
            ? 'Przekroczono czas oczekiwania. Spróbuj ponownie.'
            : ((err instanceof Error ? err.message : null) ?? 'Nie udało się pobrać danych. Sprawdź połączenie z internetem.'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  return { data, loading, error, reload };
}
