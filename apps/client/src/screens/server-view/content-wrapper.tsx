import { TextChannel } from '@/components/channel-view/text';
import { VoiceChannel } from '@/components/channel-view/voice';
import { EmptyState } from '@/components/empty-state';
import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { setSelectedChannelId } from '@/features/server/channels/actions';
import {
  useChannels,
  useSelectedChannelId,
  useSelectedChannelType
} from '@/features/server/channels/hooks';
import {
  useActiveFullscreenPluginId,
  useCan,
  useChannelCan,
  useInfo,
  useServerName
} from '@/features/server/hooks';
import { usePluginComponentsBySlot } from '@/features/server/plugins/hooks';
import {
  ChannelPermission,
  ChannelType,
  Permission,
  PluginSlot
} from '@bullshark/shared';
import { Button } from '@bullshark/ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type TContentWrapperProps = {
  isDmMode: boolean;
  selectedDmChannelId?: number;
};

const HomeEmpty = memo(() => {
  const { t } = useTranslation();
  const serverName = useServerName();
  const info = useInfo();
  const channels = useChannels();
  const homePlugins = usePluginComponentsBySlot(PluginSlot.HOME_SCREEN);
  const can = useCan();

  const firstTextChannel = useMemo(
    () => channels.find((channel) => channel.type === ChannelType.TEXT),
    [channels]
  );

  const channelCan = useChannelCan(firstTextChannel?.id);
  const canOpenFirstChannel =
    !!firstTextChannel && channelCan(ChannelPermission.VIEW_CHANNEL);

  const canUsePlugins = can(Permission.USE_PLUGINS);
  const hasHomePlugin = canUsePlugins && Object.keys(homePlugins).length > 0;

  if (hasHomePlugin) {
    return (
      <div className="flex h-full w-full flex-col gap-2 overflow-auto">
        <PluginSlotRenderer slotId={PluginSlot.HOME_SCREEN} />
      </div>
    );
  }

  return (
    <EmptyState
      title={t('welcomeToServer', { name: serverName })}
      description={info?.description || t('homeEmptyDescription')}
      action={
        canOpenFirstChannel ? (
          <Button
            className="rounded-full"
            onClick={() => setSelectedChannelId(firstTextChannel.id)}
          >
            {t('homeEmptyAction', { name: firstTextChannel.name })}
          </Button>
        ) : undefined
      }
    >
      <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground md:hidden">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          <span>{t('swipeRightForChannels')}</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>{t('swipeLeftForUsers')}</span>
        </div>
      </div>
    </EmptyState>
  );
});

const ContentWrapper = memo(
  ({ isDmMode, selectedDmChannelId }: TContentWrapperProps) => {
    const { t } = useTranslation();
    const selectedChannelId = useSelectedChannelId();
    const selectedChannelType = useSelectedChannelType();
    const activeFullscreenPluginId = useActiveFullscreenPluginId();

    if (activeFullscreenPluginId) {
      return (
        <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
          <div className="flex-col gap-2 h-full w-full flex overflow-auto relative bg-background">
            <PluginSlotRenderer
              slotId={PluginSlot.FULL_SCREEN}
              activeFullscreenPluginId={activeFullscreenPluginId}
            />
          </div>
        </main>
      );
    }

    let content;

    if (isDmMode) {
      if (selectedDmChannelId) {
        content = (
          <TextChannel
            key={selectedDmChannelId}
            channelId={selectedDmChannelId}
          />
        );
      } else {
        content = <EmptyState title={t('selectDmPrompt')} />;
      }

      return (
        <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
          {content}
        </main>
      );
    }

    if (selectedChannelId) {
      if (selectedChannelType === ChannelType.TEXT) {
        content = (
          <TextChannel key={selectedChannelId} channelId={selectedChannelId} />
        );
      } else if (selectedChannelType === ChannelType.VOICE) {
        content = (
          <VoiceChannel key={selectedChannelId} channelId={selectedChannelId} />
        );
      }
    } else {
      content = <HomeEmpty />;
    }

    return (
      <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
        {content}
      </main>
    );
  }
);

export { ContentWrapper };
