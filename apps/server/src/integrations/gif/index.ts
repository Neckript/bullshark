import { getSettings } from '../../db/queries/server';
import { createKlipyProvider } from './klipy';
import type { GifProvider } from './types';

const getGifProvider = async (): Promise<GifProvider | null> => {
  const settings = await getSettings();
  if (!settings.klipyApiKey) return null;
  return createKlipyProvider(settings.klipyApiKey);
};

export type { GifProvider } from './types';
export { getGifProvider };
