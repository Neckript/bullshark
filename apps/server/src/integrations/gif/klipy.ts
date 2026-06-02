import { logger } from '../../logger';
import type {
  GifProvider,
  TGifSearchPage,
  TGifSearchParams,
  TGifSearchResult
} from './types';

const KLIPY_BASE = 'https://api.klipy.com/api/v1';
const ALLOWED_MEDIA_HOSTS = ['klipy.com'];

type TKlipyItem = {
  slug?: string;
  id?: string | number;
  title?: string;
  file?: { gif?: { url?: string; width?: number; height?: number } };
  files?: { gif_url?: string; thumbnail_url?: string };
  width?: number;
  height?: number;
};

const mapItem = (item: TKlipyItem): TGifSearchResult | null => {
  const id = String(item.slug ?? item.id ?? '');
  const previewUrl =
    item.files?.thumbnail_url ?? item.file?.gif?.url ?? item.files?.gif_url;
  if (!id || !previewUrl) return null;
  return {
    id,
    title: item.title ?? '',
    previewUrl,
    width: item.file?.gif?.width ?? item.width ?? 0,
    height: item.file?.gif?.height ?? item.height ?? 0
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
    const mediaUrl = body.data?.file?.gif?.url ?? body.data?.files?.gif_url;
    if (!mediaUrl) throw new Error('GIF media URL not found');
    return mediaUrl;
  }
});

export { createKlipyProvider };
