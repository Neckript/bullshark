import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { pluginManager } from '..';
import { loadMockedPlugins, resetPluginMocks } from '../../__tests__/mocks';

// The mock plugins' onLoad records the keys of the context it was handed, which
// is the only way to observe least privilege from outside: a plugin that did not
// declare `voice` must not merely be refused ctx.voice -- the property must not
// be there at all.
const probeFor = (pluginId: string): string[] =>
  (globalThis as { __capsProbe?: Record<string, string[]> }).__capsProbe?.[
    pluginId
  ] ?? [];

const ALWAYS_PROVIDED = ['debug', 'error', 'log', 'logger', 'path', 'pluginId'];

describe('plugin capabilities', () => {
  beforeAll(loadMockedPlugins);
  beforeEach(() => {
    resetPluginMocks();
    (globalThis as { __capsProbe?: unknown }).__capsProbe = {};
  });

  test('a plugin declaring nothing gets only the always-provided base', async () => {
    await pluginManager.togglePlugin('plugin-caps-none', true);
    await pluginManager.load('plugin-caps-none');

    expect(probeFor('plugin-caps-none')).toEqual(ALWAYS_PROVIDED);
  });

  test('a plugin declaring messages gets ctx.messages', async () => {
    await pluginManager.togglePlugin('plugin-caps-messages', true);
    await pluginManager.load('plugin-caps-messages');

    expect(probeFor('plugin-caps-messages')).toContain('messages');
  });

  test('a plugin declaring messages does NOT get ctx.voice', async () => {
    await pluginManager.togglePlugin('plugin-caps-messages', true);
    await pluginManager.load('plugin-caps-messages');

    expect(probeFor('plugin-caps-messages')).not.toContain('voice');
  });

  test('a plugin declaring voice gets ctx.voice', async () => {
    await pluginManager.togglePlugin('plugin-caps-voice', true);
    await pluginManager.load('plugin-caps-voice');

    expect(probeFor('plugin-caps-voice')).toContain('voice');
  });

  test('hooks are withheld from a plugin that did not declare the hook', async () => {
    await pluginManager.togglePlugin('plugin-caps-messages', true);
    await pluginManager.load('plugin-caps-messages');

    // Registration is the only route to a before-file-save hook, so withholding
    // ctx.hooks is what stops a plugin intercepting saves it never asked for.
    expect(probeFor('plugin-caps-messages')).not.toContain('hooks');
  });

  test('hooks are granted to a plugin that declared the hook', async () => {
    await pluginManager.togglePlugin('plugin-caps-voice', true);
    await pluginManager.load('plugin-caps-voice');

    expect(probeFor('plugin-caps-voice')).toContain('hooks');
  });

  test('an unsupported capability is refused, and named', async () => {
    await pluginManager.togglePlugin('plugin-caps-unknown', true);
    await pluginManager.load('plugin-caps-unknown');

    const info = await pluginManager.getPluginInfo('plugin-caps-unknown');

    expect(info.loadError).toBeDefined();
    expect(info.loadError).toContain('quantum.teleport');
  });

  test('a plugin refused for an unsupported capability does not run', async () => {
    await pluginManager.togglePlugin('plugin-caps-unknown', true);
    await pluginManager.load('plugin-caps-unknown');

    expect(probeFor('plugin-caps-unknown')).toEqual([]);
  });

  test('the sdk version gate still applies', async () => {
    await pluginManager.togglePlugin('plugin-incompatible-sdk-version', true);
    await pluginManager.load('plugin-incompatible-sdk-version');

    const info = await pluginManager.getPluginInfo(
      'plugin-incompatible-sdk-version'
    );

    expect(info.loadError).toBeDefined();
  });
});
