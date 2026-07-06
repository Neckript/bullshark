import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { initTest } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { pushSubscriptions } from '../../db/schema';
import { ensureVapidKeys } from '../../helpers/vapid';

describe('push router', () => {
  test('getPublicKey returns the VAPID public key', async () => {
    const { caller } = await initTest(1);

    await ensureVapidKeys();

    const result = await caller.push.getPublicKey();

    expect(typeof result.publicKey).toBe('string');
    expect(result.publicKey?.length).toBeGreaterThan(0);
  });

  test('subscribe upserts a row for the caller', async () => {
    const { caller } = await initTest(1);

    await caller.push.subscribe({
      endpoint: 'https://push.example.com/endpoint-1',
      p256dh: 'p256dh-key',
      auth: 'auth-key'
    });

    const rows = await tdb
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, 'https://push.example.com/endpoint-1'));

    expect(rows.length).toBe(1);
    expect(rows[0]!.userId).toBe(1);
    expect(rows[0]!.p256dh).toBe('p256dh-key');
    expect(rows[0]!.auth).toBe('auth-key');
  });

  test('subscribe upserts (does not duplicate) when called again for same endpoint', async () => {
    const { caller } = await initTest(1);

    await caller.push.subscribe({
      endpoint: 'https://push.example.com/endpoint-upsert',
      p256dh: 'first-key',
      auth: 'first-auth'
    });

    await caller.push.subscribe({
      endpoint: 'https://push.example.com/endpoint-upsert',
      p256dh: 'second-key',
      auth: 'second-auth'
    });

    const rows = await tdb
      .select()
      .from(pushSubscriptions)
      .where(
        eq(pushSubscriptions.endpoint, 'https://push.example.com/endpoint-upsert')
      );

    expect(rows.length).toBe(1);
    expect(rows[0]!.p256dh).toBe('second-key');
  });

  test('unsubscribe removes the caller subscription and does not touch another user row with a different endpoint', async () => {
    const { caller: caller1 } = await initTest(1);
    const { caller: caller2 } = await initTest(2);

    await caller1.push.subscribe({
      endpoint: 'https://push.example.com/user-1-endpoint',
      p256dh: 'p256dh-1',
      auth: 'auth-1'
    });

    await caller2.push.subscribe({
      endpoint: 'https://push.example.com/user-2-endpoint',
      p256dh: 'p256dh-2',
      auth: 'auth-2'
    });

    await caller1.push.unsubscribe({
      endpoint: 'https://push.example.com/user-1-endpoint'
    });

    const user1Rows = await tdb
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, 'https://push.example.com/user-1-endpoint'));

    const user2Rows = await tdb
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, 'https://push.example.com/user-2-endpoint'));

    expect(user1Rows.length).toBe(0);
    expect(user2Rows.length).toBe(1);
    expect(user2Rows[0]!.userId).toBe(2);
  });

  test('unsubscribe with another user endpoint does not delete that user subscription', async () => {
    const { caller: caller1 } = await initTest(1);
    const { caller: caller2 } = await initTest(2);

    await caller2.push.subscribe({
      endpoint: 'https://push.example.com/user-2-only-endpoint',
      p256dh: 'p256dh-2',
      auth: 'auth-2'
    });

    // user 1 tries to unsubscribe user 2's endpoint
    await caller1.push.unsubscribe({
      endpoint: 'https://push.example.com/user-2-only-endpoint'
    });

    const user2Rows = await tdb
      .select()
      .from(pushSubscriptions)
      .where(
        eq(
          pushSubscriptions.endpoint,
          'https://push.example.com/user-2-only-endpoint'
        )
      );

    expect(user2Rows.length).toBe(1);
    expect(user2Rows[0]!.userId).toBe(2);
  });

  test('subscribe rejects invalid endpoint', async () => {
    const { caller } = await initTest(1);

    await expect(
      caller.push.subscribe({
        endpoint: 'not-a-url',
        p256dh: 'p256dh-key',
        auth: 'auth-key'
      })
    ).rejects.toThrow();
  });
});
