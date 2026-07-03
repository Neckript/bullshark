import { useEffect, useRef } from 'react';

type TUseDesktopBridgeParams = {
  inVoice: boolean;
  micMuted: boolean;
  toggleMic: () => Promise<void>;
};

/**
 * Companion integration for Bullshark Desktop. When the page runs inside the
 * desktop app (window.bullshark is exposed by its preload), this hook:
 *  - reports the live voice state so the tray icon and menu stay in sync;
 *  - applies mute-toggle requests coming from the tray or the global hotkey.
 * In a regular browser it is a complete no-op.
 */
const useDesktopBridge = ({
  inVoice,
  micMuted,
  toggleMic
}: TUseDesktopBridgeParams) => {
  // Refs so the subscription stays stable across prop changes,
  // mirroring the pattern used by usePtt.
  const inVoiceRef = useRef(inVoice);
  const toggleMicRef = useRef(toggleMic);

  useEffect(() => {
    inVoiceRef.current = inVoice;
  }, [inVoice]);

  useEffect(() => {
    toggleMicRef.current = toggleMic;
  }, [toggleMic]);

  useEffect(() => {
    const api = window.bullshark?.voice;

    if (!api) {
      return;
    }

    const unsubscribe = api.onToggleRequest(() => {
      // Not in a voice channel: nothing to toggle, ignore the request.
      if (!inVoiceRef.current) {
        return;
      }

      void toggleMicRef.current();
    });

    return () => {
      unsubscribe();
      // Leave the tray in a clean state when the provider unmounts.
      api.reportState({ inVoice: false, muted: false });
    };
  }, []);

  useEffect(() => {
    window.bullshark?.voice.reportState({ inVoice, muted: micMuted });
  }, [inVoice, micMuted]);
};

export { useDesktopBridge };
