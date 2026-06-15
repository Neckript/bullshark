import { describe, expect, test } from 'bun:test';
import { sha256 } from '@sharkord/shared';
import { runNewOwnerToken } from '../new-owner-token';

const makeDeps = (seeded: boolean) => {
  const updated: { hash?: string } = {};
  return {
    deps: {
      isSeeded: async () => seeded,
      setOwnerClaimTokenHash: async (hash: string) => {
        updated.hash = hash;
      }
    },
    updated
  };
};

describe('runNewOwnerToken', () => {
  test('generates a token, stores its hash, returns the plaintext', async () => {
    const { deps, updated } = makeDeps(true);
    const result = await runNewOwnerToken(deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(43);
    expect(updated.hash).toBe(await sha256(result.token));
  });

  test('fails when the database is not seeded and does not write a hash', async () => {
    const { deps, updated } = makeDeps(false);
    const result = await runNewOwnerToken(deps);

    expect(result.ok).toBe(false);
    expect(updated.hash).toBeUndefined();
  });
});
