import { useOwnVoiceUser } from '@/features/server/hooks';
import { useEffect, useRef, useState } from 'react';

// speaking intensity level (0 = silent, 1 = quiet, 2 = normal, 3 = loud)
// this might need to be optimized

enum SpeakingIntensity {
  Silent = 0,
  Quiet = 1,
  Normal = 2,
  Loud = 3
}

const ANALYZER_FFT_SIZE = 512;
const ANALYZER_MIN_DECIBELS = -90;
const ANALYZER_MAX_DECIBELS = -10;
const ANALYZER_SMOOTHING_TIME_CONSTANT = 0.85;
const SPEAKING_THRESHOLD = 8;

const SPEAKING_EFFECT_CLASSES: Record<SpeakingIntensity, string> = {
  [SpeakingIntensity.Silent]: '',
  [SpeakingIntensity.Quiet]: 'speaking-effect-low',
  [SpeakingIntensity.Normal]: 'speaking-effect-medium',
  [SpeakingIntensity.Loud]: 'speaking-effect-high'
};

const useAudioLevel = (audioStream: MediaStream | undefined) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const ownVoiceUser = useOwnVoiceUser();

  useEffect(() => {
    if (!audioStream || ownVoiceUser?.state.soundMuted) {
      setAudioLevel(0);
      setIsSpeaking(false);
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(audioStream);

      analyser.fftSize = ANALYZER_FFT_SIZE;
      analyser.minDecibels = ANALYZER_MIN_DECIBELS;
      analyser.maxDecibels = ANALYZER_MAX_DECIBELS;
      analyser.smoothingTimeConstant = ANALYZER_SMOOTHING_TIME_CONSTANT;

      source.connect(analyser);

      // Connect through a zero-gain node to audioContext.destination so Chrome
      // does not auto-suspend this context after ~10 s of "no speaker output".
      // A suspended context stops reading from the shared MediaStreamTrack,
      // which in some Chrome versions can stall the track used by the WebRTC
      // producer — contributing to the audio freeze (issue #1).
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      analyser.connect(silentGain);
      silentGain.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // calculate rms (root mean square) of the frequency data
        let sum = 0;

        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }

        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(100, (rms / 255) * 100);

        setAudioLevel(normalizedLevel);
        setIsSpeaking(normalizedLevel > SPEAKING_THRESHOLD);

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      console.warn('Audio level detection not supported:', error);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      analyserRef.current = null;

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setAudioLevel(0);
      setIsSpeaking(false);
    };
  }, [audioStream, ownVoiceUser?.state.soundMuted]);

  const speakingIntensity = isSpeaking
    ? audioLevel < 15
      ? SpeakingIntensity.Quiet
      : audioLevel < 30
        ? SpeakingIntensity.Normal
        : SpeakingIntensity.Loud
    : SpeakingIntensity.Silent;

  const speakingEffectClass = SPEAKING_EFFECT_CLASSES[speakingIntensity] ?? '';

  return {
    audioLevel,
    isSpeaking,
    speakingIntensity,
    speakingEffectClass
  };
};

export { useAudioLevel };
