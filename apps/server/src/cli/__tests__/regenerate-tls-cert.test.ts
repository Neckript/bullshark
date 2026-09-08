import { describe, expect, test } from 'bun:test';
import { runRegenerateTlsCert } from '../regenerate-tls-cert';

describe('runRegenerateTlsCert', () => {
  test('calls the regenerate dependency', async () => {
    let called = false;

    await runRegenerateTlsCert({
      regenerate: async () => {
        called = true;
      }
    });

    expect(called).toBe(true);
  });
});
