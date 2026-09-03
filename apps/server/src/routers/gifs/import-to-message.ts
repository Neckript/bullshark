import z from 'zod';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';
import { downloadGif } from './download-gif';

// Downloads a Klipy gif into a temporary file, same shape as a regular
// upload, so the client can attach it to a message via messages.send's
// existing `files` array. Channel send permissions are enforced there, not
// here -- this route only produces a temp file.
const importToMessageRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 10,
  windowMs: 60_000,
  logLabel: 'gifs.importToMessage'
})
  .input(
    z.object({
      gifId: z.string().min(1).max(200)
    })
  )
  .mutation(async ({ ctx, input }) => downloadGif(input.gifId, ctx.userId));

export { importToMessageRoute };
