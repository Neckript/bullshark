import { describe, expect, test } from 'bun:test';
import {
  isAllowedUserSettingKey,
  MUTED_ROLE_MENTION_PREFIX
} from '../user-settings';

describe('user setting key allowlist', () => {
  test('accepts a known fixed key', () => {
    expect(isAllowedUserSettingKey('browser_notifications')).toBe(true);
  });

  test('accepts a muted-role-mention key with numeric role id', () => {
    expect(isAllowedUserSettingKey(`${MUTED_ROLE_MENTION_PREFIX}42`)).toBe(
      true
    );
  });

  test('rejects an unknown key', () => {
    expect(isAllowedUserSettingKey('arbitrary_key')).toBe(false);
  });

  test('rejects a muted-role-mention key with non-numeric id', () => {
    expect(isAllowedUserSettingKey(`${MUTED_ROLE_MENTION_PREFIX}abc`)).toBe(
      false
    );
  });
});
