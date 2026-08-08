import { logDebug } from '@/helpers/browser-logger';
import { getTRPCClient } from '@/lib/trpc';
import type { TJoinedSound } from '@sharkord/shared';
import { addSound, removeSound, updateSound } from './actions';

const subscribeToSounds = () => {
  const trpc = getTRPCClient();

  const onSoundCreateSub = trpc.sounds.onCreate.subscribe(undefined, {
    onData: (sound: TJoinedSound) => {
      logDebug('[EVENTS] sounds.onCreate', { sound });
      addSound(sound);
    },
    onError: (err) => console.error('onSoundCreate subscription error:', err)
  });

  const onSoundDeleteSub = trpc.sounds.onDelete.subscribe(undefined, {
    onData: (soundId: number) => {
      logDebug('[EVENTS] sounds.onDelete', { soundId });
      removeSound(soundId);
    },
    onError: (err) => console.error('onSoundDelete subscription error:', err)
  });

  const onSoundUpdateSub = trpc.sounds.onUpdate.subscribe(undefined, {
    onData: (sound: TJoinedSound) => {
      logDebug('[EVENTS] sounds.onUpdate', { sound });
      updateSound(sound.id, sound);
    },
    onError: (err) => console.error('onSoundUpdate subscription error:', err)
  });

  return () => {
    onSoundCreateSub.unsubscribe();
    onSoundDeleteSub.unsubscribe();
    onSoundUpdateSub.unsubscribe();
  };
};

export { subscribeToSounds };
