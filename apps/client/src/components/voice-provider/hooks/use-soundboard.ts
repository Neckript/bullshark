import { logVoice } from '@/helpers/browser-logger';
import { getFileUrl } from '@/helpers/get-file-url';
import { getTRPCClient } from '@/lib/trpc';
import {
  SOUND_TRIGGER_COOLDOWN_MS,
  StreamKind,
  type TJoinedSound
} from '@sharkord/shared';
import type { AppData, Producer, Transport } from 'mediasoup-client/types';
import { useCallback, useRef, useState } from 'react';

type TUseSoundboardArgs = {
  producerTransport: React.RefObject<Transport<AppData> | undefined>;
};

const stopSourceNode = (source: AudioBufferSourceNode | null) => {
  if (!source) return;

  try {
    source.stop();
  } catch {
    // stop() throws when the node was never started - nothing to stop then.
  }

  source.disconnect();
};

const closeAudioContext = (audioContext: AudioContext | null) => {
  if (!audioContext || audioContext.state === 'closed') return;

  void audioContext.close();
};

/**
 * Plays a soundboard clip as its own mediasoup audio producer
 * (`StreamKind.SOUNDBOARD`) so it never touches the microphone chain, and
 * echoes the same buffer locally because the sender does not consume their
 * own producer.
 *
 * Only one clip plays at a time: a new trigger tears down the current
 * producer and AudioContext before starting the next one.
 */
const useSoundboard = ({ producerTransport }: TUseSoundboardArgs) => {
  const [playingSoundId, setPlayingSoundId] = useState<number | undefined>(
    undefined
  );

  const bufferCache = useRef<Map<number, AudioBuffer>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const echoSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const producerRef = useRef<Producer<AppData> | null>(null);
  const lastTriggerAtRef = useRef(0);
  // Bumped on every teardown so a playback still awaiting its buffer or its
  // producer can tell it has been superseded and must not publish itself.
  const playTokenRef = useRef(0);

  const teardown = useCallback(() => {
    playTokenRef.current += 1;

    stopSourceNode(sourceRef.current);
    sourceRef.current = null;

    stopSourceNode(echoSourceRef.current);
    echoSourceRef.current = null;

    producerRef.current?.close();
    producerRef.current = null;

    closeAudioContext(audioContextRef.current);
    audioContextRef.current = null;

    setPlayingSoundId(undefined);
  }, []);

  const loadBuffer = useCallback(
    async (sound: TJoinedSound, audioContext: AudioContext) => {
      const cached = bufferCache.current.get(sound.id);

      if (cached) return cached;

      const response = await fetch(getFileUrl(sound.file));
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      bufferCache.current.set(sound.id, audioBuffer);

      return audioBuffer;
    },
    []
  );

  const playSoundboardClip = useCallback(
    async (sound: TJoinedSound) => {
      const now = Date.now();

      if (now - lastTriggerAtRef.current < SOUND_TRIGGER_COOLDOWN_MS) return;

      lastTriggerAtRef.current = now;

      const transport = producerTransport.current;

      if (!transport) {
        logVoice('Cannot play sound - no producer transport');

        return;
      }

      // One sound at a time: a new trigger cuts the current one.
      teardown();

      const playToken = playTokenRef.current;
      let audioContext: AudioContext | null = null;

      try {
        // Constructed synchronously, before the first await, for two reasons:
        // it has to happen inside the user-gesture task (Chrome autoplay
        // policy), and the ref has to be set before anything can await so a
        // superseding teardown() is guaranteed to be closing this context.
        // Chrome throws here once the hardware context limit is hit, which is
        // why the construction lives inside the try.
        audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const audioBuffer = await loadBuffer(sound, audioContext);

        // A newer trigger (or a channel leave) already tore this one down.
        if (playTokenRef.current !== playToken) return;

        const destination = audioContext.createMediaStreamDestination();

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(destination);

        // Local echo - the sender does not consume their own producer. Only
        // this node reaches the speakers; the transmitted one feeds the
        // MediaStream destination, so the clip is heard exactly once.
        const echoSource = audioContext.createBufferSource();
        echoSource.buffer = audioBuffer;
        echoSource.connect(audioContext.destination);

        const track = destination.stream.getAudioTracks()[0];

        if (!track) {
          logVoice('Soundboard destination produced no audio track');
          teardown();

          return;
        }

        const producer = await transport.produce({
          track,
          codecOptions: {
            opusStereo: false,
            opusFec: true,
            opusDtx: false,
            opusMaxPlaybackRate: 48000,
            opusMaxAverageBitrate: 128000
          },
          appData: { kind: StreamKind.SOUNDBOARD }
        });

        // Closing the local producer does not tell the server, so mirror the
        // microphone producer and ask it to drop its own producer. Hanging it
        // off '@close' keeps teardown() synchronous and idempotent: the event
        // only fires when a producer actually existed, and only once.
        producer.on('@close', async () => {
          logVoice('Soundboard producer closed');

          const trpc = getTRPCClient();

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.SOUNDBOARD
            });
          } catch (error) {
            logVoice('Error closing soundboard producer', { error });
          }
        });

        if (playTokenRef.current !== playToken) {
          producer.close();

          return;
        }

        sourceRef.current = source;
        echoSourceRef.current = echoSource;
        producerRef.current = producer;

        source.onended = () => {
          if (playTokenRef.current !== playToken) return;

          teardown();
        };

        source.start();
        echoSource.start();

        setPlayingSoundId(sound.id);
      } catch (error) {
        logVoice('Error playing sound', { error });

        // Only clean up if this playback still owns the current state.
        if (playTokenRef.current !== playToken) {
          closeAudioContext(audioContext);

          return;
        }

        teardown();
      }
    },
    [loadBuffer, producerTransport, teardown]
  );

  const stopSoundboardClip = useCallback(() => {
    teardown();
  }, [teardown]);

  return { playSoundboardClip, stopSoundboardClip, playingSoundId };
};

export { useSoundboard };
