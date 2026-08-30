import { describe, expect, test } from 'bun:test';
import {
  decideAfterConnectFailure,
  isAuthenticationError
} from '../auto-login-policy';

// Forme réelle capturée en E2E le 2026-08-30 : quand le serveur refuse le
// jeton, il le fait dans createContext (apps/server/src/utils/wss.ts) et ferme
// la socket sans rien dire. Le client ne reçoit qu'un événement WebSocket nu.
const bareSocketError = {
  name: 'TRPCClientError',
  message: 'Unknown error',
  data: undefined,
  shape: undefined,
  cause: { isTrusted: true }
};

const structuredAuthError = {
  name: 'TRPCClientError',
  message: 'Invalid authentication token',
  data: { code: 'UNAUTHORIZED' }
};

describe('isAuthenticationError', () => {
  test('reconnaît une erreur tRPC structurée', () => {
    expect(isAuthenticationError(structuredAuthError)).toBe(true);
  });

  test("ne reconnaît pas l'événement WebSocket nu", () => {
    expect(isAuthenticationError(bareSocketError)).toBe(false);
  });

  test('ne reconnaît pas un autre code', () => {
    expect(isAuthenticationError({ data: { code: 'FORBIDDEN' } })).toBe(false);
  });

  test('tolère null et les valeurs primitives', () => {
    expect(isAuthenticationError(null)).toBe(false);
    expect(isAuthenticationError('boom')).toBe(false);
    expect(isAuthenticationError(undefined)).toBe(false);
  });
});

describe('decideAfterConnectFailure', () => {
  test("erreur d'authentification explicite → oublier la session", () => {
    expect(decideAfterConnectFailure(structuredAuthError, true)).toBe('forget');
    expect(decideAfterConnectFailure(structuredAuthError, false)).toBe(
      'forget'
    );
  });

  // Le cœur de la correction : le serveur répond sur /info, il est donc
  // debout, et il a quand même refusé la connexion. Ce n'est pas un hoquet
  // réseau, c'est notre jeton. Inutile d'attendre 13 secondes.
  test('socket refusée mais serveur joignable → oublier la session', () => {
    expect(decideAfterConnectFailure(bareSocketError, true)).toBe('forget');
  });

  // Le cas que la session persistante existe pour protéger : serveur qui
  // redémarre, portable qui se réveille, téléphone qui change de réseau.
  test('socket refusée et serveur injoignable → réessayer', () => {
    expect(decideAfterConnectFailure(bareSocketError, false)).toBe('retry');
  });
});
