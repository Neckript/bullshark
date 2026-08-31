import {
  type TMarketplaceEntry,
  type TMarketplacePluginVersion,
  zMarketplaceEntry
} from '@sharkord/shared';
import { config } from '../config';
import { logger } from '../logger';
import { invariant } from '../utils/invariant';

const CACHE_TTL_MS = 5 * 60_000;

let cachedRegistry: TMarketplaceEntry[] | null = null;
let cachedAt = 0;

const parseRegistryBody = (body: unknown): TMarketplaceEntry[] => {
  invariant(
    Array.isArray(body),
    'Marketplace registry response is not an array'
  );

  const entries: TMarketplaceEntry[] = [];

  for (const rawEntry of body) {
    const result = zMarketplaceEntry.safeParse(rawEntry);

    if (!result.success) {
      logger.warn(
        `[Marketplace] Discarding invalid marketplace registry entry: ${result.error.message}`
      );

      continue;
    }

    entries.push(result.data);
  }

  return entries;
};

const fetchMarketplaceRegistry = async (options?: {
  refresh?: boolean;
}): Promise<TMarketplaceEntry[]> => {
  const { marketplaceRegistryUrl } = config.plugins;

  if (!marketplaceRegistryUrl) {
    return [];
  }

  if (
    !options?.refresh &&
    cachedRegistry &&
    Date.now() - cachedAt < CACHE_TTL_MS
  ) {
    return cachedRegistry;
  }

  const response = await fetch(marketplaceRegistryUrl);

  invariant(
    response.ok,
    `Failed to fetch marketplace registry: HTTP ${response.status}`
  );

  const body = await response.json();
  const entries = parseRegistryBody(body);

  cachedRegistry = entries;
  cachedAt = Date.now();

  return entries;
};

const fetchMarketplaceVersion = async (
  pluginId: string,
  version: string
): Promise<TMarketplacePluginVersion> => {
  const entries = await fetchMarketplaceRegistry();
  const entry = entries.find((e) => e.plugin.id === pluginId);

  invariant(entry, `Plugin '${pluginId}' not found in marketplace`);

  const versionData = entry.versions.find((v) => v.version === version);

  invariant(
    versionData,
    `Version '${version}' not found for plugin '${pluginId}'`
  );

  return versionData;
};

export { fetchMarketplaceRegistry, fetchMarketplaceVersion };
