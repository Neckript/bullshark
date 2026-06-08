type TColoredRole = { color: string; position: number };

// Roles/users left at the default white are treated as "no custom colour".
const isNoColor = (color: string | null | undefined): boolean =>
  !color || color.toLowerCase() === '#ffffff';

/**
 * Resolves the colour to use for a displayed username:
 * 1. the user's personal nickname colour (feat #15) if set, otherwise
 * 2. the colour of the highest-position role that has a non-default colour,
 *    otherwise
 * 3. undefined (fall back to the theme default).
 */
const resolveNameColor = (
  personalColor: string | null | undefined,
  roles: TColoredRole[]
): string | undefined => {
  if (!isNoColor(personalColor)) return personalColor ?? undefined;

  const topColored = [...roles]
    .sort((a, b) => b.position - a.position)
    .find((role) => !isNoColor(role.color));

  return topColored?.color ?? undefined;
};

export { isNoColor, resolveNameColor };
