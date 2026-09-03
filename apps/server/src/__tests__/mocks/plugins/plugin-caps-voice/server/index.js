export const onLoad = (ctx) => {
  globalThis.__capsProbe = globalThis.__capsProbe || {};
  globalThis.__capsProbe[ctx.pluginId] = Object.keys(ctx).sort();
};
