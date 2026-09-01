import { useDevices } from '@/components/devices-provider/hooks/use-devices';
import { useVoice } from '@/features/server/voice/hooks';
import { applyAudioOutputDevice } from '@/helpers/audio-output';
import { StreamKind } from '@bullshark/shared';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useVolumeControl } from './volume-control-context';

type TSoundboardPlayerProps = {
  userId: number;
  stream: MediaStream;
};

const SoundboardPlayer = memo(({ userId, stream }: TSoundboardPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { getVolume, getUserVolumeKey } = useVolumeControl();
  const { ownVoiceState } = useVoice();
  const { devices } = useDevices();

  const volume = getVolume(getUserVolumeKey(userId));

  useEffect(() => {
    if (!audioRef.current) return;

    if (audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream;
    }

    audioRef.current.volume = volume / 100;
    audioRef.current.muted = ownVoiceState.soundMuted;

    applyAudioOutputDevice(audioRef.current, devices.playbackId);
  }, [stream, volume, devices.playbackId, ownVoiceState.soundMuted]);

  return <audio ref={audioRef} className="hidden" autoPlay playsInline />;
});

const SoundboardPlayers = memo(() => {
  const { remoteUserStreams } = useVoice();

  const entries = useMemo(
    () =>
      Object.entries(remoteUserStreams)
        .map(([userId, streams]) => ({
          userId: Number(userId),
          stream: streams?.[StreamKind.SOUNDBOARD]
        }))
        .filter(
          (entry): entry is { userId: number; stream: MediaStream } =>
            !!entry.stream
        ),
    [remoteUserStreams]
  );

  return (
    <>
      {entries.map(({ userId, stream }) => (
        <SoundboardPlayer key={userId} userId={userId} stream={stream} />
      ))}
    </>
  );
});

export { SoundboardPlayers };
