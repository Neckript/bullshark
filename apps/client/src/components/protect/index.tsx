import { useCan } from '@/features/server/hooks';
import type { Permission } from '@bullshark/shared';
import { memo } from 'react';

type TProtectProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  permission: Permission | Permission[];
};

const Protect = memo(
  ({ children, fallback = null, permission }: TProtectProps) => {
    const can = useCan();

    return can(permission) ? <>{children}</> : <>{fallback}</>;
  }
);

export { Protect };
