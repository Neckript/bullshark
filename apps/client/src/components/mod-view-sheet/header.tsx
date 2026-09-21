import { UserAvatar } from '@/components/user-avatar';
import { setModViewOpen } from '@/features/app/actions';
import {
  openDialog,
  requestConfirmation,
  requestTextInput
} from '@/features/dialogs/actions';
import { useUserRoles } from '@/features/server/hooks';
import { useOwnUserId, useUserStatus } from '@/features/server/users/hooks';
import { useDateLocale } from '@/hooks/use-date-locale';
import { getTRPCClient } from '@/lib/trpc';
import {
  DELETED_USER_IDENTITY_AND_NAME,
  getTrpcError,
  UserStatus
} from '@bullshark/shared';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@bullshark/ui';
import { format } from 'date-fns';
import { Clock, Gavel, Plus, Trash, UserMinus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog } from '../dialogs/dialogs';
import { RoleBadge } from '../role-badge';
import { useModViewContext } from './context';

const TIMEOUT_DURATIONS: { seconds: number; labelKey: string }[] = [
  { seconds: 60, labelKey: 'timeoutDuration1m' },
  { seconds: 300, labelKey: 'timeoutDuration5m' },
  { seconds: 600, labelKey: 'timeoutDuration10m' },
  { seconds: 3600, labelKey: 'timeoutDuration1h' },
  { seconds: 86400, labelKey: 'timeoutDuration1d' },
  { seconds: 604800, labelKey: 'timeoutDuration1w' }
];

const Header = memo(() => {
  const { t } = useTranslation('settings');
  const dateLocale = useDateLocale();
  const ownUserId = useOwnUserId();
  const { user, refetch } = useModViewContext();
  const status = useUserStatus(user.id);
  const userRoles = useUserRoles(user.id);
  const isDeletedUser = user.identity === DELETED_USER_IDENTITY_AND_NAME;
  const isOwnUser = user.id === ownUserId;
  const isTimedOut = !!user.mutedUntil && user.mutedUntil > Date.now();

  const onRemoveRole = useCallback(
    async (roleId: number, roleName: string) => {
      const answer = await requestConfirmation({
        title: t('removeRoleTitle'),
        message: t('removeRoleMsg', { roleName }),
        confirmLabel: t('removeRoleConfirm')
      });

      if (!answer) {
        return;
      }

      const trpc = getTRPCClient();

      try {
        await trpc.users.removeRole.mutate({
          userId: user.id,
          roleId
        });
        toast.success(t('roleRemovedSuccess'));
      } catch (error) {
        toast.error(getTrpcError(error, t('failedRemoveRole')));
      } finally {
        refetch();
      }
    },
    [user.id, refetch, t]
  );

  const onKick = useCallback(async () => {
    const reason = await requestTextInput({
      title: t('kickTitle'),
      message: t('kickMsg'),
      confirmLabel: t('kickConfirm'),
      allowEmpty: true
    });

    if (reason === null) {
      return;
    }

    const trpc = getTRPCClient();

    try {
      await trpc.users.kick.mutate({
        userId: user.id,
        reason
      });
      toast.success(t('kickedSuccess'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedKick')));
    } finally {
      refetch();
    }
  }, [user.id, refetch, t]);

  const onBan = useCallback(async () => {
    if (isDeletedUser) {
      toast.error(t('cannotBanDeletedUser'));
      return;
    }

    const trpc = getTRPCClient();

    const reason = await requestTextInput({
      title: t('banTitle'),
      message: t('banMsg'),
      confirmLabel: t('banConfirm'),
      allowEmpty: true
    });

    if (reason === null) {
      return;
    }

    try {
      await trpc.users.ban.mutate({
        userId: user.id,
        reason
      });
      toast.success(t('bannedSuccess'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedBan')));
    } finally {
      refetch();
    }
  }, [user.id, refetch, isDeletedUser, t]);

  const onUnban = useCallback(async () => {
    if (isDeletedUser) {
      toast.error(t('cannotBanDeletedUser'));
      return;
    }

    const trpc = getTRPCClient();

    const answer = await requestConfirmation({
      title: t('unbanTitle'),
      message: t('unbanMsg'),
      confirmLabel: t('unbanConfirm')
    });

    if (!answer) {
      return;
    }

    try {
      await trpc.users.unban.mutate({
        userId: user.id
      });
      toast.success(t('unbannedSuccess'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUnban')));
    } finally {
      refetch();
    }
  }, [user.id, refetch, isDeletedUser, t]);

  const onTimeout = useCallback(
    async (durationSeconds: number) => {
      const reason = await requestTextInput({
        title: t('timeoutReasonTitle'),
        message: t('timeoutReasonMsg'),
        confirmLabel: t('timeoutReasonConfirm'),
        allowEmpty: true
      });

      if (reason === null) {
        return;
      }

      const trpc = getTRPCClient();

      try {
        await trpc.users.timeout.mutate({
          userId: user.id,
          durationSeconds,
          reason
        });
        toast.success(t('timeoutSuccess'));
      } catch (error) {
        toast.error(getTrpcError(error, t('failedTimeout')));
      } finally {
        refetch();
      }
    },
    [user.id, refetch, t]
  );

  const onRemoveTimeout = useCallback(async () => {
    const trpc = getTRPCClient();

    try {
      await trpc.users.removeTimeout.mutate({ userId: user.id });
      toast.success(t('timeoutRemovedSuccess'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedRemoveTimeout')));
    } finally {
      refetch();
    }
  }, [user.id, refetch, t]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar userId={user.id} className="h-12 w-12" />
        <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
      </div>

      {isTimedOut && (
        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {t('timeoutActiveStatus', {
            date: format(new Date(user.mutedUntil!), 'PPp', {
              locale: dateLocale
            })
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onKick}
          disabled={status === UserStatus.OFFLINE}
        >
          <UserMinus className="h-4 w-4" />
          {t('kickBtn')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (user.banned ? onUnban() : onBan())}
          disabled={isOwnUser || isDeletedUser}
        >
          <Gavel className="h-4 w-4" />
          {user.banned ? t('unbanBtn') : t('banBtn')}
        </Button>
        {isTimedOut ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemoveTimeout}
            disabled={isOwnUser || isDeletedUser}
          >
            <Clock className="h-4 w-4" />
            {t('removeTimeoutBtn')}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isOwnUser || isDeletedUser}
              >
                <Clock className="h-4 w-4" />
                {t('timeoutBtn')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {TIMEOUT_DURATIONS.map((duration) => (
                <DropdownMenuItem
                  key={duration.seconds}
                  onSelect={() => onTimeout(duration.seconds)}
                >
                  {t(duration.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openDialog(Dialog.DELETE_USER, {
              user,
              refetch,
              onDelete: () => setModViewOpen(false)
            })
          }
          disabled={isOwnUser || isDeletedUser}
        >
          <Trash className="h-4 w-4" />
          {t('deleteBtn')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {userRoles.map((role) => (
          <RoleBadge key={role.id} role={role} onRemoveRole={onRemoveRole} />
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={isDeletedUser}
          onClick={() => openDialog(Dialog.ASSIGN_ROLE, { user, refetch })}
        >
          <Plus className="h-3 w-3" />
          {t('modViewAssignRoleBtn')}
        </Button>
      </div>
    </div>
  );
});

export { Header };
