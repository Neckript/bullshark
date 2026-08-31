import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { useChannelCan } from '@/features/server/hooks';
import { leaveVoice } from '@/features/server/voice/actions';
import { useVoice } from '@/features/server/voice/hooks';
import { cn } from '@/lib/utils';
import { ChannelPermission } from '@bullshark/shared';
import { Button } from '@bullshark/ui';
import {
  AlertTriangle,
  Loader2,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalAudioStreams } from '../channel-view/voice/external-audio-streams';
import { VoiceAudioStreams } from '../channel-view/voice/voice-audio-streams';
import { StatsPopover } from './stats-popover';

const VoiceControl = memo(() => {
  const { t } = useTranslation('sidebar');
  const voiceChannelId = useCurrentVoiceChannelId();
  const channelCan = useChannelCan(voiceChannelId);
  const {
    ownVoiceState,
    toggleWebcam,
    toggleScreenShare,
    connectionStatus,
    isScreenShareSupported
  } = useVoice();

  const connectionInfo = useMemo(() => {
    switch (connectionStatus) {
      case 'connecting':
        return {
          icon: <Loader2 data-motion-keep className="h-4 w-4 animate-spin" />,
          text: t('voiceConnecting'),
          color: 'text-warning'
        };
      case 'connected':
        return {
          icon: <Wifi className="h-4 w-4 text-success" />,
          text: t('voiceConnected'),
          color: 'text-success'
        };
      case 'failed':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
          text: t('voiceFailed'),
          color: 'text-destructive'
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="h-4 w-4 text-destructive" />,
          text: t('voiceDisconnected'),
          color: 'text-destructive'
        };
    }
  }, [connectionStatus, t]);

  if (!voiceChannelId) {
    return null;
  }

  return (
    <>
      <VoiceAudioStreams channelId={voiceChannelId} />
      <ExternalAudioStreams channelId={voiceChannelId} />
      <div className="bg-secondary/30 border-t border-border">
        <StatsPopover>
          <div className="flex items-center px-2 py-1.5 gap-2 bg-secondary/50 cursor-pointer hover:bg-secondary/60 transition-colors">
            {connectionInfo.icon}
            <span className={cn('text-xs font-medium', connectionInfo.color)}>
              {connectionInfo.text}
            </span>
          </div>
        </StatsPopover>

        <div className="flex items-center justify-between px-2 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => leaveVoice({ reason: 'user_disconnect_button' })}
          >
            <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
            {t('disconnectVoice')}
          </Button>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-md transition-all duration-200',
                ownVoiceState.webcamEnabled
                  ? 'bg-success/15 hover:bg-success/25 text-success'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
              )}
              onClick={toggleWebcam}
              title={
                ownVoiceState.webcamEnabled
                  ? t('turnOffCamera')
                  : t('turnOnCamera')
              }
              disabled={!channelCan(ChannelPermission.WEBCAM)}
            >
              {ownVoiceState.webcamEnabled ? (
                <Video className="h-4 w-4" />
              ) : (
                <VideoOff className="h-4 w-4" />
              )}
            </Button>

            {isScreenShareSupported && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 rounded-md transition-all duration-200',
                  ownVoiceState.sharingScreen
                    ? 'bg-info/15 hover:bg-info/25 text-info'
                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                )}
                onClick={toggleScreenShare}
                title={
                  ownVoiceState.sharingScreen
                    ? t('stopScreenShare')
                    : t('startScreenShare')
                }
                disabled={!channelCan(ChannelPermission.SHARE_SCREEN)}
              >
                {ownVoiceState.sharingScreen ? (
                  <Monitor className="h-4 w-4" />
                ) : (
                  <MonitorOff className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export { VoiceControl };
