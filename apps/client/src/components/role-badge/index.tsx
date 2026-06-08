import type { TRole } from '@sharkord/shared';
import { Badge, IconButton } from '@sharkord/ui';
import { X } from 'lucide-react';
import { memo } from 'react';

type TRoleBadgeProps = {
  role: Pick<TRole, 'id' | 'name' | 'color'>;
  onRemoveRole?: (roleId: number, roleName: string) => void;
};

// Neutral fallback used when a role has no colour set.
const DEFAULT_ROLE_COLOR = '#6b7280';

const RoleBadge = memo(({ role, onRemoveRole }: TRoleBadgeProps) => {
  const color = role.color ?? DEFAULT_ROLE_COLOR;

  return (
    <Badge
      style={{
        backgroundColor: color + '20',
        borderColor: color
      }}
    >
      <span style={{ color }}>{role.name}</span>
      {onRemoveRole && (
        <IconButton
          icon={X}
          size="xs"
          aria-label={`Remove ${role.name} role`}
          style={{ color }}
          onClick={() => onRemoveRole(role.id, role.name)}
        />
      )}
    </Badge>
  );
});

export { RoleBadge };
