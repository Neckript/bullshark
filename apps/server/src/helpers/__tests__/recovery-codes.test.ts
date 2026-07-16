import { describe, expect, it } from 'bun:test';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode
} from '../recovery-codes';

describe('recovery-codes', () => {
  it('generates 10 unique formatted codes by default', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    expect(new Set(codes).size).toBe(10);
  });

  it('normalizes user input to the canonical form', () => {
    expect(normalizeRecoveryCode('  abcde-fghij ')).toBe('ABCDE-FGHIJ');
  });

  it('hashes deterministically and hides the plaintext', async () => {
    const hash = await hashRecoveryCode('ABCDE-FGHIJ');
    expect(hash).not.toContain('ABCDE');
    expect(await hashRecoveryCode('ABCDE-FGHIJ')).toBe(hash);
  });
});
