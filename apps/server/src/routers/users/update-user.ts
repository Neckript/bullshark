import { DELETED_USER_IDENTITY_AND_NAME, Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { users } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const NICKNAME_FONT_VALUES = [
  'inter',
  'rajdhani',
  'orbitron',
  'exo-2',
  'bebas-neue',
  'press-start-2p',
  'share-tech-mono'
] as const;

const updateUserRoute = protectedProcedure
  .input(
    z.object({
      name: z
        .string()
        .min(1)
        .max(24)
        .refine((val) => val !== DELETED_USER_IDENTITY_AND_NAME, {
          message: 'Protected username'
        }),
      bannerColor: z
        .string()
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'),
      bio: z.string().max(160).optional(),
      nicknameColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
        .nullable()
        .optional(),
      nicknameFont: z.enum(NICKNAME_FONT_VALUES).nullable().optional(),
      showRoleBadge: z.boolean().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.nicknameColor !== undefined) {
      await ctx.needsPermission(Permission.CUSTOMIZE_NICKNAME_COLOR);
    }
    if (input.nicknameFont !== undefined) {
      await ctx.needsPermission(Permission.CUSTOMIZE_NICKNAME_FONT);
    }
    if (input.showRoleBadge !== undefined) {
      await ctx.needsPermission(Permission.CUSTOMIZE_NICKNAME_BADGE);
    }

    const updatedUser = await db
      .update(users)
      .set({
        name: input.name,
        bannerColor: input.bannerColor,
        bio: input.bio ?? null,
        ...(input.nicknameColor !== undefined && {
          nicknameColor: input.nicknameColor
        }),
        ...(input.nicknameFont !== undefined && {
          nicknameFont: input.nicknameFont
        }),
        ...(input.showRoleBadge !== undefined && {
          showRoleBadge: input.showRoleBadge
        })
      })
      .where(eq(users.id, ctx.userId))
      .returning()
      .get();

    publishUser(updatedUser.id, 'update');
  });

export { updateUserRoute };
