import { describe, expect, test } from 'bun:test';
import { db } from '../../db';
import { sounds } from '../../db/schema';

describe('sounds table', () => {
  test('exists and is queryable', async () => {
    const rows = await db.select().from(sounds);

    expect(Array.isArray(rows)).toBe(true);
  });
});
