import type {
  TGifSearchPage,
  TGifSearchParams,
  TGifSearchResult
} from '@sharkord/shared';

export type { TGifSearchPage, TGifSearchParams, TGifSearchResult };

export interface GifProvider {
  search(params: TGifSearchParams): Promise<TGifSearchPage>;
  resolveMediaUrl(id: string): Promise<string>;
  /** Hostnames allowed for server-side media download (anti-SSRF). */
  readonly allowedMediaHosts: string[];
}
