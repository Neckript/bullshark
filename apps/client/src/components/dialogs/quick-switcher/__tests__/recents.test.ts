import { describe, expect, test } from 'bun:test';
import {
  MAX_RECENT_TARGETS,
  pushRecentTarget,
  sanitizeRecentTargets
} from '../recents';

describe('pushRecentTarget', () => {
  test('met la cible en tête', () => {
    const list = pushRecentTarget([{ kind: 'channel', id: 1 }], {
      kind: 'user',
      id: 7
    });

    expect(list[0]).toEqual({ kind: 'user', id: 7 });
  });

  test('déduplique sans laisser l ancienne position', () => {
    const list = pushRecentTarget(
      [
        { kind: 'channel', id: 1 },
        { kind: 'channel', id: 2 }
      ],
      { kind: 'channel', id: 2 }
    );

    expect(list).toEqual([
      { kind: 'channel', id: 2 },
      { kind: 'channel', id: 1 }
    ]);
  });

  test('un salon et une personne de même id sont deux cibles', () => {
    const list = pushRecentTarget([{ kind: 'channel', id: 3 }], {
      kind: 'user',
      id: 3
    });

    expect(list).toHaveLength(2);
  });

  test('plafonne la liste', () => {
    let list: ReturnType<typeof pushRecentTarget> = [];

    for (let id = 1; id <= MAX_RECENT_TARGETS + 4; id++) {
      list = pushRecentTarget(list, { kind: 'channel', id });
    }

    expect(list).toHaveLength(MAX_RECENT_TARGETS);
    expect(list[0]).toEqual({
      kind: 'channel',
      id: MAX_RECENT_TARGETS + 4
    });
  });
});

describe('sanitizeRecentTargets', () => {
  test('rejette ce qui n est pas un tableau', () => {
    expect(sanitizeRecentTargets({ kind: 'channel', id: 1 })).toEqual([]);
    expect(sanitizeRecentTargets(null)).toEqual([]);
  });

  test('écarte les entrées mal formées et garde les bonnes', () => {
    const list = sanitizeRecentTargets([
      { kind: 'channel', id: 1 },
      { kind: 'salon', id: 2 },
      { kind: 'user', id: 'trois' },
      { id: 4 },
      { kind: 'user', id: 5 }
    ]);

    expect(list).toEqual([
      { kind: 'channel', id: 1 },
      { kind: 'user', id: 5 }
    ]);
  });

  test('applique aussi le plafond', () => {
    const stored = Array.from({ length: MAX_RECENT_TARGETS + 3 }, (_, i) => ({
      kind: 'channel' as const,
      id: i + 1
    }));

    expect(sanitizeRecentTargets(stored)).toHaveLength(MAX_RECENT_TARGETS);
  });
});
