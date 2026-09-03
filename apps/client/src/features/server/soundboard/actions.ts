import { store } from '@/features/store';
import type { TJoinedSound } from '@bullshark/shared';
import { serverSliceActions } from '../slice';

export const setSounds = (sounds: TJoinedSound[]) => {
  store.dispatch(serverSliceActions.setSounds(sounds));
};

export const addSound = (sound: TJoinedSound) => {
  store.dispatch(serverSliceActions.addSound(sound));
};

export const updateSound = (soundId: number, sound: Partial<TJoinedSound>) => {
  store.dispatch(serverSliceActions.updateSound({ soundId, sound }));
};

export const removeSound = (soundId: number) => {
  store.dispatch(serverSliceActions.removeSound({ soundId }));
};
