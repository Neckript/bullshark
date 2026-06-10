import { OWNER_ROLE_POSITION } from '@sharkord/shared';
import { getRolePosition, getUserTopPosition } from '../db/queries/roles';
import { invariant } from '../utils/invariant';

/** Actor may act on a role only if their top rank is strictly higher. */
const assertOutranksRole = async (actorUserId: number, roleId: number) => {
  const actorTop = await getUserTopPosition(actorUserId);

  // The owner bypasses the hierarchy entirely.
  if (actorTop === OWNER_ROLE_POSITION) return;

  const rolePosition = await getRolePosition(roleId);

  invariant(actorTop > rolePosition, {
    code: 'FORBIDDEN',
    message: 'You cannot manage a role ranked equal to or above your own'
  });
};

/** Actor may moderate a target user only if their top rank is strictly higher. */
const assertOutranksUser = async (
  actorUserId: number,
  targetUserId: number
) => {
  const actorTop = await getUserTopPosition(actorUserId);

  // The owner bypasses the hierarchy entirely.
  if (actorTop === OWNER_ROLE_POSITION) return;

  const targetTop = await getUserTopPosition(targetUserId);

  invariant(actorTop > targetTop, {
    code: 'FORBIDDEN',
    message: 'You cannot moderate a user ranked equal to or above your own'
  });
};

export { assertOutranksRole, assertOutranksUser };
