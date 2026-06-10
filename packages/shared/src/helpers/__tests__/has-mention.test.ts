import { describe, expect, test } from 'bun:test';
import { hasMention } from '../has-mention';

describe('has-mention', () => {
  test('should return false for null, undefined, or empty content', () => {
    expect(hasMention(null, 123)).toBe(false);
    expect(hasMention(undefined, 123)).toBe(false);
    expect(hasMention('', 123)).toBe(false);
  });

  test('should return false when userId is undefined', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="123">@user</span></p>';
    expect(hasMention(content, undefined)).toBe(false);
  });

  test('should return false if content does not contain a mention', () => {
    const content = '<p>Hello world</p>';
    expect(hasMention(content, 123)).toBe(false);
  });

  test('should return false if content contains a mention for a different user', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="456">@user</span></p>';
    expect(hasMention(content, 123)).toBe(false);
  });

  test('should return true if content contains a mention for the specified user', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="123">@user</span></p>';
    expect(hasMention(content, 123)).toBe(true);
  });

  test('should return true if content contains multiple mentions including the specified user', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="456">@user1</span> and <span data-type="mention" data-user-id="123">@user2</span></p>';
    expect(hasMention(content, 123)).toBe(true);
  });

  test('should return false if content contains a mention with missing data attributes', () => {
    const content = '<p>Hello <span data-type="mention">@user</span></p>';
    expect(hasMention(content, 123)).toBe(false);
  });

  test('should return false if content contains a mention with non-numeric user ID', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="abc">@user</span></p>';
    expect(hasMention(content, 123)).toBe(false);
  });

  test('should return false if content contains a mention with user ID as a substring', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="1234">@user</span></p>';
    expect(hasMention(content, 123)).toBe(false);
  });

  test('should return false if userId is a substring of the mentioned user ID', () => {
    const content =
      '<p>Hello <span data-type="mention" data-user-id="12">@user</span></p>';
    expect(hasMention(content, 1)).toBe(false);
  });

  test('should return true when attributes are in reversed order', () => {
    const content =
      '<p>Hello <span data-user-id="123" data-type="mention">@user</span></p>';
    expect(hasMention(content, 123)).toBe(true);
  });

  test('should return false for mention attributes on a non-span element', () => {
    const content =
      '<p>Hello <div data-type="mention" data-user-id="123">@user</div></p>';
    expect(hasMention(content, 123)).toBe(false);
  });

  test('should return true when span has additional attributes', () => {
    const content =
      '<p>Hello <span class="mention" data-type="mention" data-user-id="123" data-name="user">@user</span></p>';
    expect(hasMention(content, 123)).toBe(true);
  });
});

describe('has-mention — role mentions', () => {
  const roleChip = (id: number) =>
    `<p><span data-type="mention-role" data-role-id="${id}">@role</span></p>`;

  test('matches a role mention when the user holds the role and it is not muted', () => {
    expect(hasMention(roleChip(5), 1, [5], [])).toBe(true);
  });

  test('does not match when the role is muted', () => {
    expect(hasMention(roleChip(5), 1, [5], [5])).toBe(false);
  });

  test('does not match a role the user does not hold', () => {
    expect(hasMention(roleChip(5), 1, [9], [])).toBe(false);
  });

  test('does not match a role mention with no role ids passed', () => {
    expect(hasMention(roleChip(5), 1)).toBe(false);
  });

  test('still matches a direct user mention regardless of role args', () => {
    const content =
      '<p><span data-type="mention" data-user-id="1">@user</span></p>';
    expect(hasMention(content, 1, [], [5])).toBe(true);
  });

  test('does not match a role id as a substring', () => {
    expect(hasMention(roleChip(12), 1, [1], [])).toBe(false);
  });
});
