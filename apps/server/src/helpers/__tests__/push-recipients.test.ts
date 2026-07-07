import { describe, expect, it } from 'bun:test';
import { decidePushForUser } from '../push-recipients';

const base = {
  userId: 2,
  authorId: 1,
  isDmChannel: false,
  messageContent: '<p>hello</p>',
  replyToUserId: null,
  userRoleIds: [],
  settings: {} as Record<string, string>
};

describe('decidePushForUser', () => {
  it('never notifies the author', () => {
    expect(decidePushForUser({ ...base, userId: 1 })).toBe(false);
  });
  it('DM + dms enabled → true', () => {
    expect(
      decidePushForUser({
        ...base,
        isDmChannel: true,
        settings: { browser_notifications_dms: 'true' }
      })
    ).toBe(true);
  });
  it('DM + dms disabled → false', () => {
    expect(decidePushForUser({ ...base, isDmChannel: true })).toBe(false);
  });
  it('mentions-only: mentioned → true', () => {
    expect(
      decidePushForUser({
        ...base,
        messageContent: '<span data-type="mention" data-user-id="2">@u</span>',
        settings: { browser_notifications_mentions: 'true' }
      })
    ).toBe(true);
  });
  it('mentions-only: not mentioned → false even with content', () => {
    expect(
      decidePushForUser({
        ...base,
        settings: { browser_notifications_mentions: 'true' }
      })
    ).toBe(false);
  });
  it('muted role mention → false', () => {
    expect(
      decidePushForUser({
        ...base,
        messageContent:
          '<span data-type="mention-role" data-role-id="7">@r</span>',
        userRoleIds: [7],
        settings: {
          browser_notifications_mentions: 'true',
          'muted_role_mention:7': 'true'
        }
      })
    ).toBe(false);
  });
  it('all-messages enabled → true', () => {
    expect(
      decidePushForUser({ ...base, settings: { browser_notifications: 'true' } })
    ).toBe(true);
  });
  it('replies: reply to own message → true', () => {
    expect(
      decidePushForUser({
        ...base,
        replyToUserId: 2,
        settings: { browser_notifications_replies: 'true' }
      })
    ).toBe(true);
  });
  it('no settings → false', () => {
    expect(decidePushForUser(base)).toBe(false);
  });
  it('DM + dms OFF + all-messages ON → true (falls through like the client)', () => {
    expect(
      decidePushForUser({
        ...base,
        isDmChannel: true,
        settings: { browser_notifications: 'true' }
      })
    ).toBe(true);
  });
  it('DM + dms OFF + no other setting → false', () => {
    expect(
      decidePushForUser({ ...base, isDmChannel: true, settings: {} })
    ).toBe(false);
  });
  it('DM + dms OFF + mentions ON + mentioned → true (falls through)', () => {
    expect(
      decidePushForUser({
        ...base,
        isDmChannel: true,
        messageContent: '<span data-type="mention" data-user-id="2">@u</span>',
        settings: { browser_notifications_mentions: 'true' }
      })
    ).toBe(true);
  });
  it('DM + dms OFF + replies ON + reply to own message → true (falls through)', () => {
    expect(
      decidePushForUser({
        ...base,
        isDmChannel: true,
        replyToUserId: 2,
        settings: { browser_notifications_replies: 'true' }
      })
    ).toBe(true);
  });
});
