import { describe, expect, test } from 'bun:test';
import { serverSliceActions, serverSliceReducer } from '../slice';

const signed = (id: number, token: string) => ({
  id,
  name: `${id}.png`,
  _accessToken: token,
  _accessTokenExpiresAt: 1
});

type TToken = { _accessToken: string; _accessTokenExpiresAt: number };
type TPatchedState = {
  users: { avatar: TToken; banner: TToken }[];
  messagesMap: Record<number, { files: TToken[] }[]>;
  externalStreamsMap: Record<number, { file: TToken }>;
};

describe('refreshFileTokens', () => {
  test('patches every copy of a file, wherever it sits, and nothing else', () => {
    class Opaque {
      file = signed(1, 'old');
    }

    const state = {
      ...serverSliceReducer(undefined, { type: 'init' }),
      users: [{ id: 7, avatar: signed(1, 'old'), banner: signed(2, 'old') }],
      messagesMap: { 3: [{ id: 9, files: [signed(1, 'old')] }] },
      externalStreamsMap: { 1: new Opaque() }
    } as unknown as Parameters<typeof serverSliceReducer>[0];

    const next = serverSliceReducer(
      state,
      serverSliceActions.refreshFileTokens({
        1: { token: 'new', expiresAt: 99 }
      })
    ) as unknown as TPatchedState;

    expect(next.users[0].avatar._accessToken).toBe('new');
    expect(next.users[0].avatar._accessTokenExpiresAt).toBe(99);
    expect(next.messagesMap[3][0].files[0]._accessToken).toBe('new');
    expect(next.users[0].banner._accessToken).toBe('old');
    expect(next.externalStreamsMap[1].file._accessToken).toBe('old');
  });
});
