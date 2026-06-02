export type TGifSearchResult = {
  id: string;
  title: string;
  previewUrl: string;
  width: number;
  height: number;
};

export type TGifSearchPage = {
  results: TGifSearchResult[];
  page: number;
  hasNext: boolean;
};

export type TGifSearchParams = {
  query: string;
  page: number;
  perPage: number;
  locale?: string;
};
