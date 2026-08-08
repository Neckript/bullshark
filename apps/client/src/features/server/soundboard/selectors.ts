import type { IRootState } from '@/features/store';

export const soundsSelector = (state: IRootState) => state.server.sounds;
