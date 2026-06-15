import { sha256 } from '@sharkord/shared';
import { randomBytes } from 'crypto';

// CSPRNG owner-claim token. 32 bytes -> 43 base64url chars. Never a constant.
const generateOwnerToken = (): string => randomBytes(32).toString('base64url');

const hashOwnerToken = (token: string): Promise<string> => sha256(token);

export { generateOwnerToken, hashOwnerToken };
