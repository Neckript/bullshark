import z from 'zod';
import { zCapability } from './capability-schema';

const zMarketplacePlugin = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
  logo: z.string(),
  homepage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  verified: z.boolean(),
  screenshots: z.array(z.string()).optional()
});

const zMarketplacePluginVersion = z.object({
  version: z.string(),
  downloadUrl: z.string(),
  checksum: z.string(),
  sdkVersion: z.union([z.number(), z.string()]),
  // Absent means "declares none", so entries published before capabilities
  // existed stay valid and simply offer nothing.
  capabilities: z.array(zCapability).optional(),
  size: z.number(),
  timestamp: z.number()
});

const zMarketplaceEntry = z.object({
  plugin: zMarketplacePlugin,
  versions: z.array(zMarketplacePluginVersion)
});

type TMarketplacePlugin = z.infer<typeof zMarketplacePlugin>;
type TMarketplacePluginVersion = z.infer<typeof zMarketplacePluginVersion>;
type TMarketplaceEntry = z.infer<typeof zMarketplaceEntry>;

export {
  zMarketplaceEntry,
  zMarketplacePlugin,
  zMarketplacePluginVersion,
  type TMarketplaceEntry,
  type TMarketplacePlugin,
  type TMarketplacePluginVersion
};
