import { t } from '../../utils/trpc';
import { addRoleRoute } from './add-role';
import { changeIconRoute } from './change-icon';
import { deleteRoleRoute } from './delete-role';
import {
  onRoleCreateRoute,
  onRoleDeleteRoute,
  onRoleUpdateRoute
} from './events';
import { getRolesRouter } from './get-roles';
import { reorderRoute } from './reorder';
import { setDefaultRoleRoute } from './set-default-role';
import { updateRoleRoute } from './update-role';

export const rolesRouter = t.router({
  add: addRoleRoute,
  update: updateRoleRoute,
  changeIcon: changeIconRoute,
  delete: deleteRoleRoute,
  reorder: reorderRoute,
  setDefault: setDefaultRoleRoute,
  getAll: getRolesRouter,
  onCreate: onRoleCreateRoute,
  onDelete: onRoleDeleteRoute,
  onUpdate: onRoleUpdateRoute
});
