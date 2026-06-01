import { useEffect, useRef } from 'react';

type TUsePttParams = {
  enabled: boolean;
  pttKey: string;
  transmitTrackRef: React.RefObject<MediaStreamTrack | null>;
  onActiveChange: (active: boolean) => void;
};

/**
 * Push-to-Talk: while the configured key (KeyboardEvent.code) is held the
 * transmit track is enabled; releasing or losing window focus mutes it again.
 *
 * The hook is a no-op when `enabled` is false (e.g. user not in a voice
 * channel or mode is not PTT). On mode exit it always leaves the track muted.
 */
const usePtt = ({
  enabled,
  pttKey,
  transmitTrackRef,
  onActiveChange
}: TUsePttParams) => {
  const isHeldRef = useRef(false);
  // Use refs so handlers stay stable across prop changes without re-registering.
  const pttKeyRef = useRef(pttKey);
  const onActiveChangeRef = useRef(onActiveChange);

  useEffect(() => {
    pttKeyRef.current = pttKey;
  }, [pttKey]);

  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  }, [onActiveChange]);

  useEffect(() => {
    if (!enabled) {
      // Do NOT touch track.enabled here. The mode-switch effect in
      // VoiceProvider runs first (it is declared before usePtt) and sets the
      // correct state for the new mode. Writing false here would overwrite it,
      // leaving Normal mode permanently muted.
      if (isHeldRef.current) {
        isHeldRef.current = false;
        onActiveChangeRef.current(false);
      }
      return;
    }

    // Start muted — PTT key is the only way to speak.
    if (transmitTrackRef.current) {
      transmitTrackRef.current.enabled = false;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== pttKeyRef.current) return;
      if (isHeldRef.current) return; // ignore auto-repeat
      e.preventDefault();
      isHeldRef.current = true;
      if (transmitTrackRef.current) {
        transmitTrackRef.current.enabled = true;
      }
      onActiveChangeRef.current(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== pttKeyRef.current) return;
      isHeldRef.current = false;
      if (transmitTrackRef.current) {
        transmitTrackRef.current.enabled = false;
      }
      onActiveChangeRef.current(false);
    };

    const handleBlur = () => {
      if (!isHeldRef.current) return;
      isHeldRef.current = false;
      if (transmitTrackRef.current) {
        transmitTrackRef.current.enabled = false;
      }
      onActiveChangeRef.current(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      // Do NOT set track.enabled = false here — same reason as above.
      // The mode-switch effect owns the track state on transition.
      isHeldRef.current = false;
      onActiveChangeRef.current(false);
    };
  }, [enabled, transmitTrackRef]);
};

export { usePtt };
