import { getVoiceControlsBridge } from '@/components/voice-provider/controls-bridge';
import {
  setModifierKeysHeldMap,
  togglePluginSlotDebug
} from '@/features/app/actions';
import { ownVoiceStateSelector } from '@/features/server/voice/selectors';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

const HotkeysController = memo(() => {
  const ownVoiceState = useSelector(ownVoiceStateSelector);

  // Keep a ref so the stable handleKeyDown closure always reads the latest
  // voice state without needing to be recreated on every state change.
  const ownVoiceStateRef = useRef(ownVoiceState);
  useEffect(() => {
    ownVoiceStateRef.current = ownVoiceState;
  }, [ownVoiceState]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F4') {
      togglePluginSlotDebug();
    }

    if (e.key === 'Alt') {
      e.preventDefault();
    }

    // Global voice hotkeys (Ctrl+Shift+M / Ctrl+Shift+D).
    // The bridge is only set while the user is in a voice channel; if it is
    // null the shortcuts are silently ignored (issue #3 / Sharkord#678).
    if (e.ctrlKey && e.shiftKey) {
      const key = e.key.toLowerCase();

      if (key === 'm') {
        e.preventDefault();
        const bridge = getVoiceControlsBridge();
        if (bridge) {
          bridge.setMicMuted(!ownVoiceStateRef.current.micMuted);
        }
      } else if (key === 'd') {
        e.preventDefault();
        const bridge = getVoiceControlsBridge();
        if (bridge) {
          bridge.setSoundMuted(!ownVoiceStateRef.current.soundMuted);
        }
      }
    }

    setModifierKeysHeldMap({
      Shift: e.shiftKey,
      Control: e.ctrlKey,
      Alt: e.altKey
    });
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    setModifierKeysHeldMap({
      Shift: e.shiftKey,
      Control: e.ctrlKey,
      Alt: e.altKey
    });
  }, []);

  const handleBlur = useCallback(() => {
    setModifierKeysHeldMap({
      Shift: false,
      Control: false,
      Alt: false
    });
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);
  return null;
});

export { HotkeysController };
