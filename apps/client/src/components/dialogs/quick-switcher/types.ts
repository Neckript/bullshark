import type { TMatchSegment } from './matching';

type TQuickSwitcherItemKind = 'channel' | 'voice' | 'user';

type TQuickSwitcherItem = {
  key: string;
  kind: TQuickSwitcherItemKind;
  id: number;
  name: string;
  categoryName?: string;
  segments: TMatchSegment[];
};

type TQuickSwitcherGroupKey = 'recents' | 'channels' | 'voice' | 'users';

type TQuickSwitcherGroup = {
  key: TQuickSwitcherGroupKey;
  items: TQuickSwitcherItem[];
};

export type {
  TQuickSwitcherGroup,
  TQuickSwitcherGroupKey,
  TQuickSwitcherItem,
  TQuickSwitcherItemKind
};
