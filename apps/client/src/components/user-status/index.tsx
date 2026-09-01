import { cn } from '@/lib/utils';
import { UserStatus } from '@bullshark/shared';
import { memo } from 'react';

type TUserStatusBadgeProps = {
  status: UserStatus;
  className?: string;
};

const UserStatusBadge = memo(({ status, className }: TUserStatusBadgeProps) => {
  return (
    <div
      className={cn(
        'h-3 w-3 rounded-full border-2 border-card',
        status === UserStatus.ONLINE && 'bg-success',
        status === UserStatus.IDLE && 'bg-warning',
        status === UserStatus.OFFLINE && 'bg-muted-foreground',
        className
      )}
    />
  );
});

export { UserStatusBadge };
