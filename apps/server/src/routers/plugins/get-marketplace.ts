import { Permission, type TMarketplaceEntry } from '@bullshark/shared';
import z from 'zod';
import { fetchMarketplaceRegistry } from '../../helpers/marketplace';
import { protectedProcedure } from '../../utils/trpc';

const getMarketplaceRoute = protectedProcedure
  .input(
    z.object({
      refresh: z.boolean().optional()
    })
  )
  .query(async ({ ctx, input }): Promise<TMarketplaceEntry[]> => {
    await ctx.needsPermission(Permission.MANAGE_PLUGINS);

    return fetchMarketplaceRegistry({ refresh: input.refresh });
  });

export { getMarketplaceRoute };
