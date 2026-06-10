import { Override } from '@/components/server-screens/channel-settings/permissions/override';
import { OverridesList } from '@/components/server-screens/channel-settings/permissions/overrides-list';
import type {
  TChannelPermission,
  TPermissionActions
} from '@/components/server-screens/channel-settings/permissions/types';
import { requestConfirmation } from '@/features/dialogs/actions';
import { useAdminCategoryPermissions } from '@/features/server/admin/hooks';
import { getTRPCClient } from '@/lib/trpc';
import { ChannelPermission, getTrpcError } from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LoadingCard
} from '@sharkord/ui';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TCategoryPermissionsProps = {
  categoryId: number;
};

const CategoryPermissions = memo(
  ({ categoryId }: TCategoryPermissionsProps) => {
    const { t } = useTranslation('settings');
    const [selectedOverrideId, setSelectedOverrideId] = useState<
      string | undefined
    >();
    const { rolePermissions, userPermissions, loading, refetch } =
      useAdminCategoryPermissions(categoryId);

    const actions = useMemo<TPermissionActions>(
      () => ({
        createOverride: async (target) => {
          await getTRPCClient().categories.updatePermissions.mutate({
            categoryId,
            ...target,
            isCreate: true
          });
        },
        updateOverride: async (target, permissions) => {
          await getTRPCClient().categories.updatePermissions.mutate({
            categoryId,
            ...target,
            permissions
          });
        },
        deleteOverride: async (target) => {
          await getTRPCClient().categories.deletePermissions.mutate({
            categoryId,
            ...target
          });
        }
      }),
      [categoryId]
    );

    const selectedPermissions = useMemo<TChannelPermission[]>(() => {
      if (!selectedOverrideId) return [];

      const [type, idStr] = selectedOverrideId.split('-');
      const id = parseInt(idStr);

      if (type === 'role') {
        return rolePermissions
          .filter((perm) => perm.roleId === id)
          .map((perm) => ({
            permission: perm.permission as ChannelPermission,
            allow: perm.allow
          }));
      }

      return userPermissions
        .filter((perm) => perm.userId === id)
        .map((perm) => ({
          permission: perm.permission as ChannelPermission,
          allow: perm.allow
        }));
    }, [selectedOverrideId, rolePermissions, userPermissions]);

    const onApplyToChannels = useCallback(async () => {
      const confirmed = await requestConfirmation({
        title: t('applyCategoryPermsConfirmTitle'),
        message: t('applyCategoryPermsConfirmBody'),
        confirmLabel: t('applyCategoryPermsButton')
      });

      if (!confirmed) return;

      try {
        await getTRPCClient().categories.applyPermissionsToChannels.mutate({
          categoryId
        });
        toast.success(t('applyCategoryPermsSuccess'));
      } catch (error) {
        toast.error(getTrpcError(error, t('applyCategoryPermsFailed')));
      }
    }, [categoryId, t]);

    if (loading) {
      return <LoadingCard className="h-[600px]" />;
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>{t('permissionsTitle')}</CardTitle>
              <CardDescription>
                {t('categoryPermissionsDesc')}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onApplyToChannels}>
              {t('applyCategoryPermsButton')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <OverridesList
              actions={actions}
              rolePermissions={rolePermissions}
              userPermissions={userPermissions}
              selectedOverrideId={selectedOverrideId}
              setSelectedOverrideId={setSelectedOverrideId}
              refetch={refetch}
            />

            {selectedOverrideId ? (
              <Override
                key={selectedOverrideId}
                actions={actions}
                overrideId={selectedOverrideId}
                permissions={selectedPermissions}
                setSelectedOverrideId={setSelectedOverrideId}
                refetch={refetch}
              />
            ) : (
              <Card className="flex flex-1 items-center justify-center">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  {t('selectRoleOrUser')}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { CategoryPermissions };
