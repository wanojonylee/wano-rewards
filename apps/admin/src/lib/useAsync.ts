import { useCallback, useEffect, useState } from 'react';
import { translateCurrent, useI18n } from './i18n';

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { locale } = useI18n();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    loader()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : translateCurrent('error.unexpected')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, locale]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
