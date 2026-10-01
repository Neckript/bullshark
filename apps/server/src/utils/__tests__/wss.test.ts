import { DisconnectCode } from '@bullshark/shared';
import { describe, expect, test } from 'bun:test';
import type { WebSocket } from 'ws';
import { closeUserSockets } from '../wss';

type TFakeSocket = WebSocket & {
  userId?: number;
  closedWith: { code: number; reason?: string }[];
};

const createFakeSocket = (userId?: number): TFakeSocket => {
  const socket = {
    userId,
    closedWith: [] as { code: number; reason?: string }[],
    close(code: number, reason?: string) {
      this.closedWith.push({ code, reason });
    }
  };

  return socket as unknown as TFakeSocket;
};

describe('closeUserSockets', () => {
  test('closes every session a user holds, not just the first', () => {
    // a user with two tabs plus the desktop app must not keep one alive
    const sessions = [
      createFakeSocket(7),
      createFakeSocket(7),
      createFakeSocket(7)
    ];
    const other = createFakeSocket(9);

    const closed = closeUserSockets(
      [...sessions, other],
      7,
      DisconnectCode.BANNED,
      'Violated rules'
    );

    expect(closed).toBe(3);

    for (const session of sessions) {
      expect(session.closedWith).toEqual([
        { code: DisconnectCode.BANNED, reason: 'Violated rules' }
      ]);
    }

    expect(other.closedWith).toEqual([]);
  });

  test('returns 0 and closes nothing when the user has no session', () => {
    const other = createFakeSocket(9);

    const closed = closeUserSockets([other], 7, DisconnectCode.KICKED);

    expect(closed).toBe(0);
    expect(other.closedWith).toEqual([]);
  });
});
