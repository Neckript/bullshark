import { useVoiceUsersByChannelId } from '@/features/server/hooks';
import { useOwnUserId } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import type { TRemoteStreams } from '@/types';
import { StreamKind } from '@bullshark/shared';
import { useEffect, useRef } from 'react';

type TUseOverlayReporterParams = {
  inVoice: boolean;
  currentVoiceChannelId: number | undefined;
  localAudioStream: MediaStream | undefined;
  remoteUserStreams: TRemoteStreams;
  ownMicMuted: boolean;
};

// Mirrors use-audio-level.ts so the overlay's speaking detection matches the
// in-app voice cards.
const ANALYZER_FFT_SIZE = 512;
const ANALYZER_MIN_DECIBELS = -90;
const ANALYZER_MAX_DECIBELS = -10;
const ANALYZER_SMOOTHING_TIME_CONSTANT = 0.85;
const SPEAKING_THRESHOLD = 8;

// 10 Hz: enough to feel live, cheap enough to satisfy the "minimal impact" goal.
const TICK_MS = 100;

type TAnalyserEntry = {
  stream: MediaStream;
  analyser: AnalyserNode;
  data: Uint8Array;
};

/**
 * Companion for the Bullshark Desktop in-game overlay. When the page runs inside
 * a desktop shell that exposes `window.bullshark.overlay`, this hook reports the
 * voice roster and who is speaking, throttled, so the overlay can render it.
 * A single AudioContext drives one analyser per audio stream; no per-user React
 * component or hook. Complete no-op in a regular browser or an older shell.
 */
const useOverlayReporter = ({
  inVoice,
  currentVoiceChannelId,
  localAudioStream,
  remoteUserStreams,
  ownMicMuted
}: TUseOverlayReporterParams) => {
  const voiceUsers = useVoiceUsersByChannelId(currentVoiceChannelId ?? -1);
  const ownUserId = useOwnUserId();

  // Kept in refs so the analysis loop stays stable and reads the latest values
  // without being torn down on every roster change.
  const voiceUsersRef = useRef(voiceUsers);
  const ownUserIdRef = useRef(ownUserId);
  const ownMicMutedRef = useRef(ownMicMuted);

  useEffect(() => {
    voiceUsersRef.current = voiceUsers;
  }, [voiceUsers]);
  useEffect(() => {
    ownUserIdRef.current = ownUserId;
  }, [ownUserId]);
  useEffect(() => {
    ownMicMutedRef.current = ownMicMuted;
  }, [ownMicMuted]);

  useEffect(() => {
    const api = window.bullshark?.overlay;

    if (!api) return;

    let enabled = true;
    let context: AudioContext | null = null;
    let analysers = new Map<number, TAnalyserEntry>();
    let interval: ReturnType<typeof setInterval> | null = null;

    const ensureContext = () => {
      if (context) return context;

      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      context = new AudioContextClass();
      return context;
    };

    const addAnalyser = (userId: number, stream: MediaStream) => {
      const ctx = ensureContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYZER_FFT_SIZE;
      analyser.minDecibels = ANALYZER_MIN_DECIBELS;
      analyser.maxDecibels = ANALYZER_MAX_DECIBELS;
      analyser.smoothingTimeConstant = ANALYZER_SMOOTHING_TIME_CONSTANT;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Zero-gain path to the destination keeps Chrome from suspending the
      // context (same rationale as use-audio-level.ts).
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      analyser.connect(silentGain);
      silentGain.connect(ctx.destination);

      analysers.set(userId, {
        stream,
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount)
      });
    };

    // (Re)build the analyser set to match the current audio streams.
    const syncAnalysers = () => {
      const wanted = new Map<number, MediaStream>();

      if (localAudioStream && ownUserIdRef.current !== undefined) {
        wanted.set(ownUserIdRef.current, localAudioStream);
      }

      for (const [userIdStr, streams] of Object.entries(remoteUserStreams)) {
        const audio = streams?.[StreamKind.AUDIO];
        if (audio) wanted.set(Number(userIdStr), audio);
      }

      // Drop analysers whose stream vanished or changed.
      for (const [userId, entry] of analysers) {
        if (wanted.get(userId) !== entry.stream) {
          analysers.delete(userId);
        }
      }

      // Add analysers for new streams.
      for (const [userId, stream] of wanted) {
        if (!analysers.has(userId)) addAnalyser(userId, stream);
      }
    };

    const isSpeaking = (entry: TAnalyserEntry): boolean => {
      entry.analyser.getByteFrequencyData(entry.data);

      let sum = 0;
      for (let i = 0; i < entry.data.length; i++) {
        sum += entry.data[i] * entry.data[i];
      }

      const rms = Math.sqrt(sum / entry.data.length);
      const normalizedLevel = Math.min(100, (rms / 255) * 100);
      return normalizedLevel > SPEAKING_THRESHOLD;
    };

    const tick = () => {
      syncAnalysers();

      api.reportParticipants({
        inVoice,
        participants: voiceUsersRef.current.map((user) => {
          const entry = analysers.get(user.id);
          const isOwn = user.id === ownUserIdRef.current;
          const speaking =
            !!entry && isSpeaking(entry) && !(isOwn && ownMicMutedRef.current);

          return {
            userId: user.id,
            name: user.name,
            avatarUrl: user.avatar ? getFileUrl(user.avatar) : null,
            speaking,
            micMuted: user.state.micMuted
          };
        })
      });
    };

    const start = () => {
      if (interval || !inVoice) return;
      interval = setInterval(tick, TICK_MS);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      analysers.forEach((entry) => entry.analyser.disconnect());
      analysers = new Map();
      if (context) {
        void context.close();
        context = null;
      }
      // Let the overlay clear itself.
      api.reportParticipants({ inVoice: false, participants: [] });
    };

    if (enabled) start();

    const unsubscribe = api.onEnabledChanged((next) => {
      enabled = next;
      if (enabled) start();
      else stop();
    });

    return () => {
      unsubscribe();
      stop();
    };
  }, [inVoice, localAudioStream, remoteUserStreams]);
};

export { useOverlayReporter };
