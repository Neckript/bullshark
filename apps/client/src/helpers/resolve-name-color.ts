type TColoredRole = { color: string | null; position: number };

/**
 * Resolves the colour to use for a displayed username:
 * 1. the user's personal nickname colour (feat #15) if set, otherwise
 * 2. the colour of the highest-position role that has a colour, otherwise
 * 3. undefined (fall back to the theme default).
 */
const resolveNameColor = (
  personalColor: string | null | undefined,
  roles: TColoredRole[]
): string | undefined => {
  if (personalColor) return personalColor;

  const topColored = [...roles]
    .sort((a, b) => b.position - a.position)
    .find((role) => role.color);

  return topColored?.color ?? undefined;
};

export { resolveNameColor };
