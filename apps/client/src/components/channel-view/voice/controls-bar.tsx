import { useChannelCan } from '@/features/server/hooks';
import { leaveVoice } from '@/features/server/voice/actions';
import { useOwnVoiceState, useVoice } from '@/features/server/voice/hooks';
import { cn } from '@/lib/utils';
import { ChannelPermission } from '@sharkord/shared';
import { Button, Tooltip } from '@sharkord/ui';
import {
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  ScreenShareOff,
  Video,
  VideoOff
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { ControlToggleButton } from './control-toggle-button';
import { useControlsBarVisibility } from './hooks/use-controls-bar-visibility';
import { SoundboardButton } from './soundboard-button';

type TControlsBarProps = {
  channelId: number;
};

const ControlsBar = memo(({ channelId }: TControlsBarProps) => {
  const { toggleMic, toggleWebcam, toggleScreenShare, isScreenShareSupported } =
    useVoice();
  const ownVoiceState = useOwnVoiceState();
  const channelCan = useChannelCan(channelId);
  const isVisible = useControlsBarVisibility();

  const permissions = useMemo(
    () => ({
      canSpeak: channelCan(ChannelPermission.SPEAK),
      canWebcam: channelCan(ChannelPermission.WEBCAM),
      canShareScreen: channelCan(ChannelPermission.SHARE_SCREEN)
    }),
    [channelCan]
  );

  return (
    <div
      className={cn(
        'absolute bottom-8 left-0 right-0 hidden md:flex justify-center items-center pointer-events-none',
        'transition-all duration-300 ease-in-out gap-3',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 pointer-events-auto',
          'h-14 px-2 rounded-pill border shadow-xl',
          'bg-card/80 border-border/50 backdrop-blur-md'
        )}
      >
        <ControlToggleButton
          enabled={ownVoiceState.micMuted}
          enabledLabel="Unmute"
          disabledLabel="Mute"
          enabledIcon={MicOff}
          disabledIcon={Mic}
          enabledClassName="bg-destructive/20 text-destructive hover:bg-destructive/30 hover:text-destructive"
          onClick={toggleMic}
          disabled={!permissions.canSpeak || ownVoiceState.soundMuted}
        />

        <ControlToggleButton
          enabled={ownVoiceState.webcamEnabled}
          enabledLabel="Stop Video"
          disabledLabel="Start Video"
          enabledIcon={Video}
          disabledIcon={VideoOff}
          enabledClassName="bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
          onClick={toggleWebcam}
          disabled={!permissions.canWebcam}
        />

        {isScreenShareSupported && (
          <ControlToggleButton
            enabled={ownVoiceState.sharingScreen}
            enabledLabel="Stop Sharing"
            disabledLabel="Share Screen"
            enabledIcon={ScreenShareOff}
            disabledIcon={Monitor}
            enabledClassName="bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
            onClick={toggleScreenShare}
            disabled={!permissions.canShareScreen}
          />
        )}

        <SoundboardButton disabled={!permissions.canSpeak} />
      </div>

      <Tooltip content="Disconnect">
        <Button
          size="icon"
          className={cn(
            'pointer-events-auto h-14 w-18 rounded-pill text-white shadow-xl transition-all active:scale-95',
            'bg-destructive hover:bg-destructive/85'
          )}
          onClick={() => leaveVoice()}
          aria-label="Disconnect"
        >
          <PhoneOff size={24} fill="currentColor" />
        </Button>
      </Tooltip>
    </div>
  );
});

export { ControlsBar };
