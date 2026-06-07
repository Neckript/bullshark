import { logger } from '../../logger';
import type {
  GifProvider,
  TGifSearchPage,
  TGifSearchParams,
  TGifSearchResult
} from './types';

const KLIPY_BASE = 'https://api.klipy.com/api/v1';
const ALLOWED_MEDIA_HOSTS = ['klipy.com'];

// Klipy nests media by size (hd/md/sm/xs), each with format variants
// (gif/webp/jpg/mp4). e.g. item.file.md.gif.url. A legacy flat `file.gif`
// shape is kept as a last-resort fallback.
type TKlipyVariant = { url?: string; width?: number; height?: number };
type TKlipyFormats = {
  gif?: TKlipyVariant;
  webp?: TKlipyVariant;
  jpg?: TKlipyVariant;
  mp4?: TKlipyVariant;
};
type TKlipyFile = {
  hd?: TKlipyFormats;
  md?: TKlipyFormats;
  sm?: TKlipyFormats;
  xs?: TKlipyFormats;
  gif?: TKlipyVariant;
};
type TKlipyItem = {
  slug?: string;
  id?: string | number;
  title?: string;
  file?: TKlipyFile;
};

type TKlipySize = 'hd' | 'md' | 'sm' | 'xs';

// smaller sizes first for the grid preview; larger first when importing
const PREVIEW_SIZE_ORDER: readonly TKlipySize[] = ['sm', 'xs', 'md', 'hd'];
const MEDIA_SIZE_ORDER: readonly TKlipySize[] = ['md', 'sm', 'hd', 'xs'];

const pickGifVariant = (
  file: TKlipyFile | undefined,
  order: readonly TKlipySize[]
): TKlipyVariant | undefined => {
  if (!file) return undefined;
  for (const size of order) {
    const variant = file[size]?.gif;
    if (variant?.url) return variant;
  }
  // legacy flat fallback
  return file.gif?.url ? file.gif : undefined;
};

const mapItem = (item: TKlipyItem): TGifSearchResult | null => {
  const id = String(item.slug ?? item.id ?? '');
  const variant = pickGifVariant(item.file, PREVIEW_SIZE_ORDER);
  if (!id || !variant?.url) return null;
  return {
    id,
    title: item.title ?? '',
    previewUrl: variant.url,
    width: variant.width ?? 0,
    height: variant.height ?? 0
  };
};

const createKlipyProvider = (apiKey: string): GifProvider => ({
  allowedMediaHosts: ALLOWED_MEDIA_HOSTS,

  async search({
    query,
    page,
    perPage,
    locale
  }: TGifSearchParams): Promise<TGifSearchPage> {
    const url = new URL(`${KLIPY_BASE}/${apiKey}/gifs/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('rating', 'pg-13');
    if (locale) url.searchParams.set('locale', locale);

    const res = await fetch(url.toString());
    if (!res.ok) {
      logger.error('Klipy search failed: %s', res.status);
      throw new Error('GIF search failed');
    }

    const body = (await res.json()) as {
      data?: { data?: TKlipyItem[]; current_page?: number; has_next?: boolean };
    };

    const items = body.data?.data ?? [];
    const results = items
      .map(mapItem)
      .filter((r): r is TGifSearchResult => r !== null);

    return {
      results,
      page: body.data?.current_page ?? page,
      hasNext: Boolean(body.data?.has_next)
    };
  },

  async resolveMediaUrl(id: string): Promise<string> {
    const url = `${KLIPY_BASE}/${apiKey}/gifs/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Klipy resolve failed: %s', res.status);
      throw new Error('GIF not found');
    }
    const body = (await res.json()) as { data?: TKlipyItem };
    const variant = pickGifVariant(body.data?.file, MEDIA_SIZE_ORDER);
    if (!variant?.url) throw new Error('GIF media URL not found');
    return variant.url;
  }
});

export { createKlipyProvider };
