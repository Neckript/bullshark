import { MentionRoleChip } from '@/components/mention-role-chip';
import { memo } from 'react';

type TMentionRoleOverrideProps = {
  roleId: number;
};

const MentionRoleOverride = memo(({ roleId }: TMentionRoleOverrideProps) => (
  <MentionRoleChip roleId={roleId} />
));

export { MentionRoleOverride };
