export * from './metrics';
export * from './permissions';
export * from './storage';

export const DEFAULT_MESSAGES_LIMIT = 100;

export const OWNER_ROLE_ID = 1;

// The owner role is pinned far above any user-created role so position-based
// ordering and rank checks always place it on top. Custom roles use 1..N and
// the default role is pinned to 0.
export const OWNER_ROLE_POSITION = 1_000_000;

export const TYPING_MS = 300;

export enum DisconnectCode {
  UNEXPECTED = 1006,
  KICKED = 40000,
  BANNED = 40001,
  SERVER_SHUTDOWN = 40002
}

export const DELETED_USER_IDENTITY_AND_NAME = '__deleted_user__'; // this will be used as identity AND name, but in the interface we render as "Deleted"

export const DEFAULT_BITRATE = 6000; // kbps,
