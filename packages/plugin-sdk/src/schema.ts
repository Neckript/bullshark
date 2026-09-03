// The manifest and registry schemas, behind their own subpath.
//
// They live here rather than in the main entry because they are the one part of
// the SDK with a runtime dependency: zod. Keeping them separate is what lets
// `@bullshark/plugin-sdk` stay a 2 KB bundle for plugin authors, who need the
// types and enums but never parse a manifest.
//
// The consumer is the plugin builder, which validates an author's manifest at
// build time. Before this existed the builder kept its own hand-copied copy,
// with a comment admitting it "should match with the one in sharkord" -- three
// definitions of one schema, checked by nobody.
//
// zod is a peer dependency: the builder already depends on it.
export {
  zCapability,
  zPluginId,
  zPluginManifest,
  type TPluginManifest
} from '@bullshark/shared/src/plugins';

export {
  zMarketplaceEntry,
  zMarketplacePlugin,
  zMarketplacePluginVersion,
  type TMarketplaceEntry,
  type TMarketplacePlugin,
  type TMarketplacePluginVersion
} from '@bullshark/shared/src/plugins/marketplace';
