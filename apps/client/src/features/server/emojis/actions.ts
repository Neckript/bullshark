import { store } from '@/features/store';
import type { TJoinedEmoji } from '@bullshark/shared';
import { serverSliceActions } from '../slice';

export const setEmojis = (emojis: TJoinedEmoji[]) => {
  store.dispatch(serverSliceActions.setEmojis(emojis));
};

export const addEmoji = (emoji: TJoinedEmoji) => {
  store.dispatch(serverSliceActions.addEmoji(emoji));
};

export const updateEmoji = (emojiId: number, emoji: Partial<TJoinedEmoji>) => {
  store.dispatch(serverSliceActions.updateEmoji({ emojiId, emoji }));
};

export const removeEmoji = (emojiId: number) => {
  store.dispatch(serverSliceActions.removeEmoji({ emojiId }));
};
