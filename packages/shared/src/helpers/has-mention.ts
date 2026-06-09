const hasMention = (
  content: string | null | undefined,
  userId: number | undefined,
  ownRoleIds: number[] = [],
  mutedRoleMentionIds: number[] = []
): boolean => {
  if (!content || !userId) return false;

  const pattern = new RegExp(
    `<span[^>]*(?:\\bdata-type="mention"[^>]*\\bdata-user-id="${userId}"|\\bdata-user-id="${userId}"[^>]*\\bdata-type="mention")[^>]*>`
  );

  if (pattern.test(content)) return true;

  if (ownRoleIds.length === 0) return false;

  const muted = new Set(mutedRoleMentionIds);
  const roleMentionPattern =
    /<span[^>]*(?:\bdata-type="mention-role"[^>]*\bdata-role-id="(\d+)"|\bdata-role-id="(\d+)"[^>]*\bdata-type="mention-role")[^>]*>/g;

  let match: RegExpExecArray | null;
  while ((match = roleMentionPattern.exec(content)) !== null) {
    const roleId = Number(match[1] ?? match[2]);
    if (ownRoleIds.includes(roleId) && !muted.has(roleId)) return true;
  }

  return false;
};

export { hasMention };
