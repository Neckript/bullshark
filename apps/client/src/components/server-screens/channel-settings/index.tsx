import { useChannelById } from '@/features/server/channels/hooks';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { SectionedSettings } from '../sectioned-settings';
import { General } from './general';
import { ChannelPermissions } from './permissions';

type TChannelSettingsProps = TServerScreenBaseProps & {
  channelId: number;
};

const ChannelSettings = memo(({ close, channelId }: TChannelSettingsProps) => {
  const { t } = useTranslation('settings');
  const channel = useChannelById(channelId);

  return (
    <SectionedSettings
      close={close}
      title={t('channelSettingsTitle')}
      groupLabel={channel?.name ?? ''}
      sections={[
        {
          id: 'general',
          label: t('generalTab'),
          content: <General channelId={channelId} />
        },
        {
          id: 'permissions',
          label: t('permissionsTab'),
          content: <ChannelPermissions channelId={channelId} />
        }
      ]}
    />
  );
});

export { ChannelSettings };
