import { getTRPCClient } from '@/lib/trpc';
import type { TMarketplaceEntry } from '@bullshark/shared';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';

const getLatestTimestamp = (entry: TMarketplaceEntry) => {
  return entry.versions[0]?.timestamp ?? 0;
};

const useMarketplaceData = (t: TFunction<'settings'>) => {
  const [entries, setEntries] = useState<TMarketplaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMarketplace = useCallback(
    async (refresh?: boolean) => {
      setError(null);

      try {
        const trpc = getTRPCClient();
        const data = await trpc.plugins.getMarketplace.query({ refresh });

        const sortedEntries = data
          .map((entry) => ({
            ...entry,
            versions: [...entry.versions].sort(
              (left, right) => right.timestamp - left.timestamp
            )
          }))
          .sort(
            (left, right) =>
              getLatestTimestamp(right) - getLatestTimestamp(left)
          );

        setEntries(sortedEntries);
      } catch {
        setError(t('marketplaceFetchError'));
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMarketplace(true);
  }, [fetchMarketplace]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;

    const query = search.toLowerCase().trim();

    return entries.filter((entry) => {
      const { plugin } = entry;

      return (
        plugin.name.toLowerCase().includes(query) ||
        plugin.description.toLowerCase().includes(query) ||
        plugin.author.toLowerCase().includes(query) ||
        plugin.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        plugin.categories?.some((cat) => cat.toLowerCase().includes(query))
      );
    });
  }, [entries, search]);

  return {
    entries,
    filtered,
    loading,
    error,
    search,
    setSearch,
    isRefreshing,
    refresh
  };
};

export { useMarketplaceData };
