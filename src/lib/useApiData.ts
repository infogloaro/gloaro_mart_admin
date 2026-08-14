import { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from './api';

export function useApiData<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    // An empty path means "nothing to fetch yet" — callers use it for conditional loads.
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { data, loading, error, reload };
}
