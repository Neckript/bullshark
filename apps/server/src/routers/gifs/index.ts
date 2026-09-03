import { t } from '../../utils/trpc';
import { importToMessageRoute } from './import-to-message';
import { importToProfileRoute } from './import-to-profile';
import { searchGifsRoute } from './search';

export const gifsRouter = t.router({
  search: searchGifsRoute,
  importToProfile: importToProfileRoute,
  importToMessage: importToMessageRoute
});
