import { t } from '../../utils/trpc';
import { addCategoryRoute } from './add-category';
import { deleteCategoryRoute } from './delete-category';
import { deletePermissionsRoute } from './delete-permissions';
import {
  onCategoryCreateRoute,
  onCategoryDeleteRoute,
  onCategoryUpdateRoute
} from './events';
import { getCategoryRoute } from './get-category';
import { getPermissionsRoute } from './get-permissions';
import { reorderCategoriesRoute } from './reorder-categories';
import { updateCategoryRoute } from './update-category';
import { updatePermissionsRoute } from './update-permission';

export const categoriesRouter = t.router({
  add: addCategoryRoute,
  update: updateCategoryRoute,
  delete: deleteCategoryRoute,
  get: getCategoryRoute,
  reorder: reorderCategoriesRoute,
  updatePermissions: updatePermissionsRoute,
  getPermissions: getPermissionsRoute,
  deletePermissions: deletePermissionsRoute,
  onCreate: onCategoryCreateRoute,
  onDelete: onCategoryDeleteRoute,
  onUpdate: onCategoryUpdateRoute
});
