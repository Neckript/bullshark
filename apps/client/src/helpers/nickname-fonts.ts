export type NicknameFontKey =
  | 'inter'
  | 'rajdhani'
  | 'orbitron'
  | 'exo-2'
  | 'bebas-neue'
  | 'press-start-2p'
  | 'share-tech-mono';

export type TNicknameFontOption = {
  key: NicknameFontKey;
  label: string;
  family: string;
};

export const NICKNAME_FONT_OPTIONS: TNicknameFontOption[] = [
  { key: 'inter', label: 'Inter', family: 'Inter, sans-serif' },
  { key: 'rajdhani', label: 'Rajdhani', family: 'Rajdhani, sans-serif' },
  { key: 'orbitron', label: 'Orbitron', family: 'Orbitron, sans-serif' },
  { key: 'exo-2', label: 'Exo 2', family: '"Exo 2", sans-serif' },
  {
    key: 'bebas-neue',
    label: 'Bebas Neue',
    family: '"Bebas Neue", sans-serif'
  },
  {
    key: 'press-start-2p',
    label: 'Press Start 2P',
    family: '"Press Start 2P", monospace'
  },
  {
    key: 'share-tech-mono',
    label: 'Share Tech Mono',
    family: '"Share Tech Mono", monospace'
  }
];

export const getNicknameFontFamily = (
  key: string | null | undefined
): string => {
  const found = NICKNAME_FONT_OPTIONS.find((f) => f.key === key);
  return found?.family ?? 'inherit';
};
