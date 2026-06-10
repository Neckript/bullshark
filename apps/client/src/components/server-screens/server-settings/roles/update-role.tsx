import { requestConfirmation } from '@/features/dialogs/actions';
import { useUserRoles } from '@/features/server/hooks';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { isNoColor } from '@/helpers/resolve-name-color';
import { uploadImage } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { useForm } from '@/hooks/use-form';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  OWNER_ROLE_ID,
  STORAGE_MAX_QUOTA_PER_USER,
  STORAGE_MIN_QUOTA_PER_USER,
  type TJoinedRole
} from '@sharkord/shared';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Switch,
  Tooltip
} from '@sharkord/ui';
import { filesize } from 'filesize';
import { Info, Star, Trash2, Upload } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QUOTA_BY_USER_PRESETS } from '../storage/presets';
import { StorageSizeControl } from '../storage/storage-size-control';
import { PermissionList } from './permissions-list';

type TUpdateRoleProps = {
  selectedRole: TJoinedRole;
  setSelectedRoleId: (id: number | undefined) => void;
  refetch: () => void;
};

const UpdateRole = memo(
  ({ selectedRole, setSelectedRoleId, refetch }: TUpdateRoleProps) => {
    const { t } = useTranslation('settings');
    const openFilePicker = useFilePicker();
    const { setTrpcErrors, r, onChange, values } = useForm({
      name: selectedRole.name,
      color: selectedRole.color,
      hoist: selectedRole.hoist,
      isMentionable: selectedRole.isMentionable,
      permissions: selectedRole.permissions,
      storageQuotaOverrideEnabled: selectedRole.storageQuotaOverrideEnabled,
      storageSpaceQuota: selectedRole.storageSpaceQuota
    });

    const isOwnerRole = selectedRole.id === OWNER_ROLE_ID;

    // Mirror the server-side rank enforcement in the UI: a role at or above the
    // current user's own rank cannot be edited (the server rejects it anyway).
    const ownUser = useOwnPublicUser();
    const ownRoles = useUserRoles(ownUser?.id ?? -1);
    const ownTopPosition = ownRoles.some((role) => role.id === OWNER_ROLE_ID)
      ? Infinity
      : Math.max(0, ...ownRoles.map((role) => role.position));
    const lockedByRank = ownTopPosition <= selectedRole.position;

    const storageQuotaLabel = filesize(Number(values.storageSpaceQuota ?? 0), {
      output: 'object',
      standard: 'jedec'
    });

    const onDeleteRole = useCallback(async () => {
      const choice = await requestConfirmation({
        title: t('deleteRoleTitle'),
        message: t('deleteRoleMsg'),
        confirmLabel: t('deleteRoleBtn')
      });

      if (!choice) return;

      const trpc = getTRPCClient();

      try {
        await trpc.roles.delete.mutate({ roleId: selectedRole.id });
        toast.success(t('roleDeleted'));
        refetch();
        setSelectedRoleId(undefined);
      } catch {
        toast.error(t('roleDeleteFailed'));
      }
    }, [selectedRole.id, refetch, setSelectedRoleId, t]);

    const onUpdateRole = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        await trpc.roles.update.mutate({
          roleId: selectedRole.id,
          ...values
        });

        toast.success(t('roleUpdated'));
        refetch();
      } catch (error) {
        setTrpcErrors(error);
      }
    }, [selectedRole.id, values, refetch, setTrpcErrors, t]);

    const onSetAsDefaultRole = useCallback(async () => {
      const choice = await requestConfirmation({
        title: t('setDefaultRoleTitle'),
        message: t('setDefaultRoleMsg'),
        confirmLabel: t('setDefaultRoleBtn')
      });

      if (!choice) return;

      const trpc = getTRPCClient();

      try {
        await trpc.roles.setDefault.mutate({ roleId: selectedRole.id });

        toast.success(t('defaultRoleUpdated'));
        refetch();
      } catch (error) {
        toast.error(getTrpcError(error, t('failedSetDefaultRole')));
      }
    }, [selectedRole.id, refetch, t]);

    const onUploadIcon = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        const [file] = await openFilePicker('.jpg,.jpeg,.png,.webp,.gif');

        const temporaryFile = await uploadImage(file);

        if (!temporaryFile) return;

        await trpc.roles.changeIcon.mutate({
          roleId: selectedRole.id,
          fileId: temporaryFile.id
        });

        toast.success(t('roleUpdated'));
        refetch();
      } catch (error) {
        toast.error(getTrpcError(error, t('roleUpdateFailed')));
      }
    }, [selectedRole.id, openFilePicker, refetch, t]);

    const onRemoveIcon = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        await trpc.roles.changeIcon.mutate({ roleId: selectedRole.id });

        toast.success(t('roleUpdated'));
        refetch();
      } catch (error) {
        toast.error(getTrpcError(error, t('roleUpdateFailed')));
      }
    }, [selectedRole.id, refetch, t]);

    return (
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('editRoleTitle')}</CardTitle>
            <div>
              <Tooltip content={t('setAsDefaultRoleTooltip')}>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={selectedRole.isDefault}
                  onClick={onSetAsDefaultRole}
                >
                  <Star className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Button
                size="icon"
                variant="ghost"
                disabled={selectedRole.isPersistent || selectedRole.isDefault}
                onClick={onDeleteRole}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedRole.isDefault && (
            <Alert variant="default">
              <Star />
              <AlertDescription>{t('defaultRoleInfo')}</AlertDescription>
            </Alert>
          )}

          {isOwnerRole && (
            <Alert variant="default">
              <Info />
              <AlertDescription>{t('ownerRoleInfo')}</AlertDescription>
            </Alert>
          )}

          {!isOwnerRole && lockedByRank && (
            <Alert variant="default">
              <Info />
              <AlertDescription>{t('roleLockedByRankInfo')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">{t('roleNameLabel')}</Label>
              <Input {...r('name')} disabled={lockedByRank} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-color">{t('roleColorLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  className="h-10 w-20"
                  {...r('color', 'color')}
                  disabled={lockedByRank}
                />
                <Input
                  className="flex-1"
                  {...r('color')}
                  disabled={lockedByRank}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={lockedByRank || isNoColor(values.color)}
                  onClick={() => onChange('color', '#ffffff')}
                >
                  {t('roleNoColorBtn')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('roleIconLabel')}</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="relative group h-16 w-16 shrink-0 rounded-md bg-muted overflow-hidden disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onUploadIcon}
                  disabled={lockedByRank}
                >
                  {selectedRole.icon ? (
                    <img
                      src={getFileUrl(selectedRole.icon)}
                      alt={selectedRole.name}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-30"
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 rounded-full p-2">
                      <Upload className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </button>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={lockedByRank}
                    onClick={onUploadIcon}
                  >
                    {t('roleIconUpload')}
                  </Button>
                  {selectedRole.icon && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={lockedByRank}
                      onClick={onRemoveIcon}
                    >
                      {t('roleIconRemove')}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="role-hoist">{t('roleHoistLabel')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('roleHoistDesc')}
                </p>
              </div>
              <Switch
                id="role-hoist"
                checked={!!values.hoist}
                disabled={lockedByRank}
                onCheckedChange={(checked) => onChange('hoist', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="role-mentionable">
                  {t('roleMentionableLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('roleMentionableDesc')}
                </p>
              </div>
              <Switch
                id="role-mentionable"
                checked={!!values.isMentionable}
                disabled={lockedByRank}
                onCheckedChange={(checked) =>
                  onChange('isMentionable', checked)
                }
              />
            </div>
          </div>

          <PermissionList
            permissions={values.permissions}
            disabled={OWNER_ROLE_ID === selectedRole.id || lockedByRank}
            setPermissions={(permissions) =>
              onChange('permissions', permissions)
            }
          />

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="role-storage-override">
                  {t('roleStorageOverrideLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('roleStorageOverrideDesc')}
                </p>
              </div>
              <Switch
                id="role-storage-override"
                checked={!!values.storageQuotaOverrideEnabled}
                onCheckedChange={(checked) =>
                  onChange('storageQuotaOverrideEnabled', checked)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('roleStorageQuotaLabel')}</Label>
              <StorageSizeControl
                value={Number(values.storageSpaceQuota)}
                max={STORAGE_MAX_QUOTA_PER_USER}
                min={STORAGE_MIN_QUOTA_PER_USER}
                disabled={!values.storageQuotaOverrideEnabled}
                onChange={(value) => onChange('storageSpaceQuota', value)}
                preview={
                  Number(values.storageSpaceQuota) === 0 ? (
                    t('unlimitedLabel')
                  ) : (
                    <>
                      {storageQuotaLabel.value} {storageQuotaLabel.unit}
                    </>
                  )
                }
                presets={QUOTA_BY_USER_PRESETS}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedRoleId(undefined)}
            >
              {t('close')}
            </Button>
            <Button onClick={onUpdateRole} disabled={lockedByRank}>
              {t('saveRoleBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { UpdateRole };
