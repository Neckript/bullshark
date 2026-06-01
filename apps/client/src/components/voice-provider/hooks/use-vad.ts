import { useEffect, useRef } from 'react';

const VAD_FFT_SIZE = 512;
const VAD_SMOOTHING = 0.8;
const VAD_HOLD_MS = 400;

// These must match the AnalyserNode settings below.
const ANALYSER_MIN_DB = -90;
const ANALYSER_MAX_DB = -10;

type TUseVadParams = {
  enabled: boolean;
  rawStream: MediaStream | null;
  thresholdDb: number;
  transmitTrackRef: React.RefObject<MediaStreamTrack | null>;
  onSpeakingChange: (speaking: boolean) => void;
};

/**
 * Voice Activity Detection: analyses the raw microphone stream's RMS level
 * and enables/disables the transmit track around a configurable dB threshold.
 *
 * A 400 ms hold-time prevents rapid on/off switching at the gate boundary.
 *
 * The hook is a no-op when `enabled` is false or `rawStream` is null. On
 * exit (mode change, channel leave) it always leaves the track muted.
 */
const useVad = ({
  enabled,
  rawStream,
  thresholdDb,
  transmitTrackRef,
  onSpeakingChange
}: TUseVadParams) => {
  // Use refs so the analysis loop can pick up live changes without being
  // restarted (avoids AudioContext teardown on every threshold slider tick).
  const thresholdRef = useRef(thresholdDb);
  const onSpeakingChangeRef = useRef(onSpeakingChange);

  useEffect(() => {
    thresholdRef.current = thresholdDb;
  }, [thresholdDb]);

  useEffect(() => {
    onSpeakingChangeRef.current = onSpeakingChange;
  }, [onSpeakingChange]);

  useEffect(() => {
    if (!enabled || !rawStream) {
      // Do NOT touch track.enabled here. The mode-switch effect in
      // VoiceProvider runs first (it is declared before useVad) and sets the
      // correct state for the new mode. Writing false here would overwrite it,
      // leaving Normal mode permanently muted.
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = VAD_FFT_SIZE;
    analyser.minDecibels = ANALYSER_MIN_DB;
    analyser.maxDecibels = ANALYSER_MAX_DB;
    analyser.smoothingTimeConstant = VAD_SMOOTHING;

    const source = audioContext.createMediaStreamSource(rawStream);
    source.connect(analyser);

    // Route through a zero-gain node to audioContext.destination so Chrome
    // does not auto-suspend the context after ~10 s of "no speaker output"
    // (same pattern as use-audio-level.ts).
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    analyser.connect(silentGain);
    silentGain.connect(audioContext.destination);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let holdTimerId: ReturnType<typeof setTimeout> | null = null;
    let isSpeaking = false;
    let animFrameId: number;

    // Start muted — VAD will re-enable when voice is detected.
    if (transmitTrackRef.current) {
      transmitTrackRef.current.enabled = false;
    }

    const detect = () => {
      analyser.getByteFrequencyData(dataArray);

      // RMS of frequency bins (0-255 scale).
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Convert threshold dB to the byte scale the analyser uses.
      const thresholdByte =
        ((thresholdRef.current - ANALYSER_MIN_DB) /
          (ANALYSER_MAX_DB - ANALYSER_MIN_DB)) *
        255;

      const voiceDetected = rms > thresholdByte;

      if (voiceDetected) {
        if (holdTimerId !== null) {
          clearTimeout(holdTimerId);
          holdTimerId = null;
        }
        if (!isSpeaking) {
          isSpeaking = true;
          if (transmitTrackRef.current) {
            transmitTrackRef.current.enabled = true;
          }
          onSpeakingChangeRef.current(true);
        }
      } else if (isSpeaking && holdTimerId === null) {
        holdTimerId = setTimeout(() => {
          holdTimerId = null;
          isSpeaking = false;
          if (transmitTrackRef.current) {
            transmitTrackRef.current.enabled = false;
          }
          onSpeakingChangeRef.current(false);
        }, VAD_HOLD_MS);
      }

      animFrameId = requestAnimationFrame(detect);
    };

    animFrameId = requestAnimationFrame(detect);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (holdTimerId !== null) clearTimeout(holdTimerId);
      audioContext.close();
      // Do NOT set track.enabled = false here — same reason as the !enabled
      // path above. The mode-switch effect owns the track state on transition.
      onSpeakingChangeRef.current(false);
    };
  }, [enabled, rawStream, transmitTrackRef]);
};

export { useVad };
