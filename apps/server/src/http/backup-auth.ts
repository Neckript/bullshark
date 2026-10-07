import http from 'http';
import { isOwner } from '../db/queries/is-owner';
import { getUserByToken } from '../db/queries/users';

// Dedicated header so the token never lands in a query string / logs / referrers.
const BACKUP_TOKEN_HEADER = 'x-backup-token';

const getOwnerFromRequest = async (req: http.IncomingMessage) => {
  const header = req.headers[BACKUP_TOKEN_HEADER];
  const token = Array.isArray(header) ? header[0] : header;

  if (!token) return null;

  const user = await getUserByToken(token);
  if (!user) return null;
  // reachable: an owner can ban another owner (assertOutranksUser returns early
  // when the actor is owner), and isOwner only reads user_roles, so a banned
  // owner keeps the role and a working token until it expires
  if (user.banned) return null;
  if (!(await isOwner(user.id))) return null;

  return user;
};

export { BACKUP_TOKEN_HEADER, getOwnerFromRequest };
