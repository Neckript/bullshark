import { t } from '../../utils/trpc';
import { importToProfileRoute } from './import-to-profile';
import { searchGifsRoute } from './search';

export const gifsRouter = t.router({
  search: searchGifsRoute,
  importToProfile: importToProfileRoute
});
