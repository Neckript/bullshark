import { describe, expect, test } from 'bun:test';
import {
  addPushSubscription,
  deletePushSubscriptionByEndpoint,
  deletePushSubscriptionsForUser,
  getPushSubscriptionsForUsers
} from '../push-subscriptions';

describe('push subscriptions — upsert on endpoint', () => {
  test('inserting the same endpoint twice with a different userId keeps a single row with the latest userId', async () => {
    await addPushSubscription({
      userId: 2,
      endpoint: 'https://push.example.com/abc',
      p256dh: 'p256dh-1',
      auth: 'auth-1'
    });
    await addPushSubscription({
      userId: 3,
      endpoint: 'https://push.example.com/abc',
      p256dh: 'p256dh-2',
      auth: 'auth-2'
    });

    const rows = await getPushSubscriptionsForUsers([2, 3]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      userId: 3,
      endpoint: 'https://push.example.com/abc',
      p256dh: 'p256dh-2',
      auth: 'auth-2'
    });
  });
});

describe('push subscriptions — delete by endpoint', () => {
  test('removes only the matching subscription', async () => {
    await addPushSubscription({
      userId: 2,
      endpoint: 'https://push.example.com/keep',
      p256dh: 'p1',
      auth: 'a1'
    });
    await addPushSubscription({
      userId: 2,
      endpoint: 'https://push.example.com/remove',
      p256dh: 'p2',
      auth: 'a2'
    });

    await deletePushSubscriptionByEndpoint('https://push.example.com/remove');

    const rows = await getPushSubscriptionsForUsers([2]);
    expect(rows.map((r) => r.endpoint)).toEqual([
      'https://push.example.com/keep'
    ]);
  });
});

describe('push subscriptions — delete for user', () => {
  test('with no endpoint, removes all subscriptions for that user', async () => {
    await addPushSubscription({
      userId: 4,
      endpoint: 'https://push.example.com/one',
      p256dh: 'p1',
      auth: 'a1'
    });
    await addPushSubscription({
      userId: 4,
      endpoint: 'https://push.example.com/two',
      p256dh: 'p2',
      auth: 'a2'
    });

    await deletePushSubscriptionsForUser(4);

    expect(await getPushSubscriptionsForUsers([4])).toEqual([]);
  });

  test('with an endpoint, removes only that subscription', async () => {
    await addPushSubscription({
      userId: 4,
      endpoint: 'https://push.example.com/one',
      p256dh: 'p1',
      auth: 'a1'
    });
    await addPushSubscription({
      userId: 4,
      endpoint: 'https://push.example.com/two',
      p256dh: 'p2',
      auth: 'a2'
    });

    await deletePushSubscriptionsForUser(4, 'https://push.example.com/one');

    const rows = await getPushSubscriptionsForUsers([4]);
    expect(rows.map((r) => r.endpoint)).toEqual([
      'https://push.example.com/two'
    ]);
  });
});

describe('push subscriptions — getPushSubscriptionsForUsers([])', () => {
  test('returns an empty array without querying the db', async () => {
    expect(await getPushSubscriptionsForUsers([])).toEqual([]);
  });
});
