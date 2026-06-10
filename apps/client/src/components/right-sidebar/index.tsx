import { ResizableSidebar } from '@/components/resizable-sidebar';
import { UserAvatar } from '@/components/user-avatar';
import { useRoles } from '@/features/server/roles/hooks';
import { useUsers } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { isNoColor } from '@/helpers/resolve-name-color';
import { LocalStorageKey } from '@/helpers/storage';
import { cn } from '@/lib/utils';
import {
  DELETED_USER_IDENTITY_AND_NAME,
  type TJoinedPublicUser,
  type TJoinedRole
} from '@sharkord/shared';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPopover } from '../user-popover';

const MAX_USERS_TO_SHOW = 100;
const MIN_WIDTH = 180;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 240; // w-60 = 240px

type TUserProps = {
  userId: number;
  name: string;
  banned: boolean;
};

const User = memo(({ userId, name, banned }: TUserProps) => {
  return (
    <UserPopover userId={userId}>
      <div className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-accent select-none min-w-0">
        <UserAvatar userId={userId} className="h-8 w-8 shrink-0" />
        <span
          className={cn(
            'text-sm text-foreground truncate',
            banned && 'line-through text-muted-foreground'
          )}
        >
          {name}
        </span>
      </div>
    </UserPopover>
  );
});

type TMemberGroup = {
  key: string;
  label: string;
  role: TJoinedRole | null;
  members: TJoinedPublicUser[];
};

const GroupHeader = memo(
  ({ label, role }: { label: string; role: TJoinedRole | null }) => {
    const colored = role && !isNoColor(role.color);
    return (
      <div className="flex items-center gap-1.5 px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {role?.icon && (
          <img
            src={getFileUrl(role.icon)}
            alt=""
            className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover"
          />
        )}
        <span
          className="truncate"
          style={colored ? { color: role.color } : undefined}
        >
          {label}
        </span>
      </div>
    );
  }
);

type TRightSidebarProps = {
  className?: string;
  isOpen?: boolean;
};

const RightSidebar = memo(
  ({ className, isOpen = true }: TRightSidebarProps) => {
    const { t } = useTranslation('sidebar');
    const users = useUsers();
    const roles = useRoles();

    const { groups, usersCount, hiddenCount } = useMemo(() => {
      const filtered = users.filter(
        (user) => user.name !== DELETED_USER_IDENTITY_AND_NAME
      );
      const usersCount = filtered.length;
      const visible = filtered.slice(0, MAX_USERS_TO_SHOW);
      const hiddenCount = Math.max(0, usersCount - MAX_USERS_TO_SHOW);

      // Hoisted roles ranked high -> low; the first one a user holds wins.
      const hoistedRoles = roles
        .filter((role) => role.hoist)
        .sort((a, b) => b.position - a.position);

      const buckets = new Map<number, TJoinedPublicUser[]>();
      const defaultBucket: TJoinedPublicUser[] = [];

      for (const user of visible) {
        const topHoisted = hoistedRoles.find((role) =>
          user.roleIds?.includes(role.id)
        );
        if (topHoisted) {
          const bucket = buckets.get(topHoisted.id) ?? [];
          bucket.push(user);
          buckets.set(topHoisted.id, bucket);
        } else {
          defaultBucket.push(user);
        }
      }

      const groups: TMemberGroup[] = [];
      for (const role of hoistedRoles) {
        const members = buckets.get(role.id);
        if (members && members.length > 0) {
          groups.push({
            key: `role-${role.id}`,
            label: `${role.name} — ${members.length}`,
            role,
            members
          });
        }
      }
      if (defaultBucket.length > 0) {
        groups.push({
          key: 'default',
          label: `${t('membersDefaultGroup')} — ${defaultBucket.length}`,
          role: null,
          members: defaultBucket
        });
      }

      return { groups, usersCount, hiddenCount };
    }, [users, roles, t]);

    return (
      <ResizableSidebar
        storageKey={LocalStorageKey.RIGHT_SIDEBAR_WIDTH}
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
        defaultWidth={DEFAULT_WIDTH}
        edge="left"
        isOpen={isOpen}
        className={cn('h-full', className)}
      >
        <div className="flex h-12 items-center border-b border-border px-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t('membersHeader', { count: usersCount })}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.key}>
              <GroupHeader label={group.label} role={group.role} />
              <div className="space-y-1">
                {group.members.map((user) => (
                  <User
                    key={user.id}
                    userId={user.id}
                    name={user.name}
                    banned={user.banned}
                  />
                ))}
              </div>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="text-sm text-muted-foreground px-2 py-1.5">
              +{hiddenCount} more...
            </div>
          )}
        </div>
      </ResizableSidebar>
    );
  }
);

export { RightSidebar };
