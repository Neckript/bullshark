import z from 'zod';
import { getGifProvider } from '../../integrations/gif';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const searchGifsRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 30,
  windowMs: 10_000,
  logLabel: 'gifs.search'
})
  .input(
    z.object({
      query: z.string().min(1).max(100),
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(8).max(50).default(24),
      locale: z.string().max(10).optional()
    })
  )
  .query(async ({ input }) => {
    const provider = await getGifProvider();
    if (!provider) {
      throw new Error('GIF search is not configured on this server.');
    }
    return provider.search(input);
  });

export { searchGifsRoute };
