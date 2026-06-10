import { useRoleById } from '@/features/server/roles/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { isNoColor } from '@/helpers/resolve-name-color';
import { cn } from '@/lib/utils';
import { memo } from 'react';

type TMentionRoleChipProps = {
  roleId: number;
  label?: string;
};

const MentionRoleChip = memo(
  ({ roleId, label: labelProp }: TMentionRoleChipProps) => {
    const role = useRoleById(roleId);
    const label = labelProp ?? role?.name ?? 'unknown-role';
    const colored = role ? !isNoColor(role.color) : false;

    return (
      <span
        className={cn(
          'mention rounded px-0.5 inline-flex items-center gap-1 font-medium bg-primary/10 hover:bg-primary/20 transition-colors',
          !colored && 'text-primary'
        )}
        style={colored && role ? { color: role.color } : undefined}
      >
        {role?.icon && (
          <img
            src={getFileUrl(role.icon)}
            alt=""
            className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover"
          />
        )}
        @{label}
      </span>
    );
  }
);

export { MentionRoleChip };
