import { Dialog } from '@/components/dialogs/dialogs';
import { getVoiceControlsBridge } from '@/components/voice-provider/controls-bridge';
import {
  setModifierKeysHeldMap,
  togglePluginSlotDebug
} from '@/features/app/actions';
import { closeDialogs, openDialog } from '@/features/dialogs/actions';
import { dialogInfoSelector } from '@/features/dialogs/selectors';
import { connectedSelector } from '@/features/server/selectors';
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

  const isConnected = useSelector(connectedSelector);
  const isConnectedRef = useRef(isConnected);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const openDialogName = useSelector(dialogInfoSelector).openDialog;
  const openDialogRef = useRef(openDialogName);

  useEffect(() => {
    openDialogRef.current = openDialogName;
  }, [openDialogName]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F4') {
      togglePluginSlotDebug();
    }

    if (e.key === 'Alt') {
      e.preventDefault();
    }

    // Ctrl+K ouvre le sélecteur rapide, Ctrl+Maj+F la recherche de contenu.
    // Les deux vivent ici et non dans leurs surfaces : deux écouteurs
    // « keydown » concurrents sur window se disputeraient la touche, et le
    // dernier monté gagnerait.
    if ((e.ctrlKey || e.metaKey) && !e.repeat) {
      const key = e.key.toLowerCase();

      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();

        if (!isConnectedRef.current) return;

        if (openDialogRef.current === Dialog.QUICK_SWITCHER) {
          closeDialogs();
        } else {
          openDialog(Dialog.QUICK_SWITCHER);
        }
      } else if (key === 'f' && e.shiftKey) {
        e.preventDefault();

        if (isConnectedRef.current) {
          openDialog(Dialog.SEARCH);
        }
      }
    }

    // Global voice hotkeys (Ctrl+Shift+M / Ctrl+Shift+D).
    // The bridge is only set while the user is in a voice channel; if it is
    // null the shortcuts are silently ignored (issue #3 / Bullshark#678).
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
