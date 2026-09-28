import { getTRPCClient } from '@/lib/trpc';
import { getTrpcError } from '@bullshark/shared';
import { IconButton } from '@bullshark/ui';
import { MicOff } from 'lucide-react';
import { memo, useCallback } from 'react';
import { toast } from 'sonner';

type TServerMuteButtonProps = {
  userId: number;
  serverMuted: boolean;
};

const ServerMuteButton = memo(
  ({ userId, serverMuted }: TServerMuteButtonProps) => {
    const handleToggle = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        await trpc.voice.serverMute.mutate({ userId, muted: !serverMuted });
      } catch (error) {
        toast.error(getTrpcError(error, 'Failed to update server mute'));
      }
    }, [userId, serverMuted]);

    return (
      <IconButton
        variant={serverMuted ? 'destructive' : 'ghost'}
        icon={MicOff}
        onClick={handleToggle}
        title={serverMuted ? 'Unmute (server)' : 'Server mute'}
        size="sm"
      />
    );
  }
);

ServerMuteButton.displayName = 'ServerMuteButton';

export { ServerMuteButton };
