import { describe, expect, test } from 'bun:test';
import { PluginCapability, zPluginManifest } from '../index';

const baseManifest = {
  id: 'example-plugin',
  name: 'Example Plugin',
  author: 'Someone',
  description: 'An example plugin',
  sdkVersion: 1,
  version: '1.0.0'
};

describe('plugin capabilities', () => {
  test('a manifest without capabilities parses and yields an empty list', () => {
    const result = zPluginManifest.parse(baseManifest);

    expect(result.capabilities).toEqual([]);
  });

  test('a valid capability list parses and preserves order', () => {
    const result = zPluginManifest.parse({
      ...baseManifest,
      capabilities: [
        PluginCapability.MESSAGES,
        PluginCapability.EVENTS,
        PluginCapability.COMMANDS
      ]
    });

    expect(result.capabilities).toEqual([
      PluginCapability.MESSAGES,
      PluginCapability.EVENTS,
      PluginCapability.COMMANDS
    ]);
  });

  // The manifest deliberately accepts any non-empty string. The interesting
  // failure is a plugin built against a NEWER SDK, declaring a capability an
  // OLDER server has never heard of: parsing that with z.enum yields an
  // unreadable schema error about the manifest as a whole, when what the author
  // needs is the name of the unsupported capability. Strictness lives where it
  // can act -- the builder at build time, the server at load time.
  test('an unknown capability parses, to be judged later by name', () => {
    const result = zPluginManifest.parse({
      ...baseManifest,
      capabilities: ['quantum.teleport']
    });

    expect(result.capabilities).toEqual(['quantum.teleport']);
  });

  test('an empty capability string is still rejected', () => {
    const result = zPluginManifest.safeParse({
      ...baseManifest,
      capabilities: ['']
    });

    expect(result.success).toBe(false);
  });

  // Dots are legal in a capability string: the per-hook and client-side
  // capabilities are namespaced rather than grouped, on purpose.
  test('dotted capabilities parse', () => {
    const result = zPluginManifest.parse({
      ...baseManifest,
      capabilities: [
        PluginCapability.HOOKS_BEFORE_FILE_SAVE,
        PluginCapability.CLIENT_SLOTS
      ]
    });

    // Asserted as plain strings: the enum's string values are the wire format
    // written into every manifest.json, so they are part of the contract.
    const wireValues: string[] = result.capabilities;

    expect(wireValues).toEqual(['hooks.onBeforeFileSave', 'client.slots']);
  });

  test('capability values are unique and stable on the wire', () => {
    const wireValues: string[] = Object.values(PluginCapability);

    expect(wireValues).toContain('voice');
    expect(new Set(wireValues).size).toBe(wireValues.length);
  });
});
