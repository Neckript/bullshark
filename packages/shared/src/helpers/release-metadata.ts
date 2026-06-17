import z from 'zod';
import type { TVersionInfo } from '../types';

const zArtifact = z.object({
  name: z.string(),
  target: z.string(),
  size: z.number(),
  checksum: z.string()
});

const zVersionInfo = z.object({
  version: z.string(),
  releaseDate: z.string(),
  artifacts: z.array(zArtifact)
});

const validateReleaseMetadata = (input: unknown): TVersionInfo =>
  zVersionInfo.parse(input);

export { validateReleaseMetadata, zVersionInfo };
