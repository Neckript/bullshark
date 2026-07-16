import { describe, expect, it } from 'bun:test';
import {
  disableTotp,
  enableTotp,
  markRecoveryCodeUsed,
  replaceRecoveryCodes,
  setPendingTotpSecret
} from '../mutations/totp';
import {
  countRemainingRecoveryCodes,
  findUnusedRecoveryCode,
  getUserTotp
} from '../queries/totp';

// Seeded test user id 2 = "Test User" (see src/__tests__/seed.ts)
const USER_ID = 2;

describe('totp db layer', () => {
  it('sets a pending secret without enabling', async () => {
    await setPendingTotpSecret(USER_ID, 'enc:secret');
    const row = await getUserTotp(USER_ID);
    expect(row?.totpSecret).toBe('enc:secret');
    expect(row?.totpEnabledAt).toBeNull();
  });

  it('enables and then disables, clearing everything', async () => {
    await setPendingTotpSecret(USER_ID, 'enc:secret');
    await enableTotp(USER_ID);
    expect((await getUserTotp(USER_ID))?.totpEnabledAt).not.toBeNull();

    await replaceRecoveryCodes(USER_ID, ['h1', 'h2']);
    expect(await countRemainingRecoveryCodes(USER_ID)).toBe(2);

    await disableTotp(USER_ID);
    const row = await getUserTotp(USER_ID);
    expect(row?.totpSecret).toBeNull();
    expect(row?.totpEnabledAt).toBeNull();
    expect(await countRemainingRecoveryCodes(USER_ID)).toBe(0);
  });

  it('consumes a recovery code once', async () => {
    await replaceRecoveryCodes(USER_ID, ['h1', 'h2']);
    const found = await findUnusedRecoveryCode(USER_ID, 'h1');
    expect(found).toBeDefined();
    await markRecoveryCodeUsed(found!.id);
    expect(await findUnusedRecoveryCode(USER_ID, 'h1')).toBeUndefined();
    expect(await countRemainingRecoveryCodes(USER_ID)).toBe(1);
  });
});
