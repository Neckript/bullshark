import { store } from '@/features/store';
import type { TJoinedRole } from '@bullshark/shared';
import { serverSliceActions } from '../slice';

export const setRoles = (roles: TJoinedRole[]) =>
  store.dispatch(serverSliceActions.setRoles(roles));

export const addRole = (role: TJoinedRole) =>
  store.dispatch(serverSliceActions.addRole(role));

export const updateRole = (roleId: number, role: Partial<TJoinedRole>) =>
  store.dispatch(serverSliceActions.updateRole({ roleId, role }));

export const removeRole = (roleId: number) =>
  store.dispatch(serverSliceActions.removeRole({ roleId }));
