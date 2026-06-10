import { t } from '../../utils/trpc';
import { deleteRoute } from './delete';
import { getAllRoute } from './get-all';
import { setRoute } from './set';

export const settingsRouter = t.router({
  getAll: getAllRoute,
  set: setRoute,
  delete: deleteRoute
});
