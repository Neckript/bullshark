import { useChannelById } from '@/features/server/channels/hooks';
import { useCan, usePublicServerSettings } from '@/features/server/hooks';
import { Permission } from '@sharkord/shared';
import { useMemo } from 'react';

type TUploadRefusal =
  | 'uploadsDisabled'
  | 'dmSharingDisabled'
  | 'noUploadPermission';

type TUploadPermission = {
  allowed: boolean;
  reason?: TUploadRefusal;
};

const useUploadPermission = (
  channelId: number,
  disabled: boolean = false
): TUploadPermission => {
  const settings = usePublicServerSettings();
  const channel = useChannelById(channelId);
  const can = useCan();

  return useMemo(() => {
    if (disabled) {
      return { allowed: false };
    }

    if (!settings?.storageUploadEnabled) {
      return { allowed: false, reason: 'uploadsDisabled' };
    }

    if (channel?.isDm && !settings?.storageFileSharingInDirectMessages) {
      return { allowed: false, reason: 'dmSharingDisabled' };
    }

    if (!can(Permission.UPLOAD_FILES)) {
      return { allowed: false, reason: 'noUploadPermission' };
    }

    return { allowed: true };
  }, [disabled, settings, channel?.isDm, can]);
};

export { useUploadPermission, type TUploadPermission, type TUploadRefusal };
