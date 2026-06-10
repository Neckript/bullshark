import { useUserRoles } from '@/features/server/hooks';
import { memo } from 'react';

/** Returns black or white depending on which contrasts better with `hex`. */
const getContrastColor = (hex: string): string => {
  const clean =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

type TNicknameBadgeProps = {
  userId: number;
  size?: 'sm' | 'md';
};

/**
 * Pill showing the highest-priority role name next to a username.
 * Returns null when the user has no roles.
 */
// Neutral fallback when the highest role has no colour set.
const DEFAULT_BADGE_COLOR = '#6b7280';

const NicknameBadge = memo(({ userId, size = 'md' }: TNicknameBadgeProps) => {
  const roles = useUserRoles(userId);
  const sortedRoles = [...roles].sort((a, b) => b.position - a.position);
  const topRole = sortedRoles[0];

  if (!topRole) return null;

  const bg =
    topRole.color ??
    sortedRoles.find((role) => role.color)?.color ??
    DEFAULT_BADGE_COLOR;
  const fg = getContrastColor(bg);

  return (
    <span
      style={{
        backgroundColor: bg,
        color: fg,
        fontFamily: 'inherit',
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: '0.25rem',
        whiteSpace: 'nowrap',
        display: 'inline-block',
        verticalAlign: 'middle',
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(size === 'sm'
          ? { fontSize: '9px', padding: '1px 4px' }
          : { fontSize: '10px', padding: '2px 6px' })
      }}
    >
      {topRole.name}
    </span>
  );
});

export { NicknameBadge };
