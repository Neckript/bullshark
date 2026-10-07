import fs from 'fs';
import http from 'http';
import path from 'path';
import { HttpValidationError } from './utils';

type HttpRouteHandler<TContext = undefined> = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: TContext
) => Promise<unknown> | unknown;

// /login and /login/2fa are unauthenticated and their rate limiter only runs
// after the body has been read, so an unbounded body grows a string in memory
// until the process dies. The largest legitimate field here is a 128-char
// password, so 1 MiB is already generous.
const MAX_JSON_BODY_BYTES = 1024 * 1024;

const getJsonBody = async <T = any>(req: http.IncomingMessage): Promise<T> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;

      // Buffers, not string concatenation: a multi-byte UTF-8 character split
      // across two chunks is corrupted by `body += chunk`.
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

      received += buffer.length;

      if (received > MAX_JSON_BODY_BYTES) {
        settled = true;
        chunks.length = 0;
        // drain rather than destroy: destroying the socket means the client
        // never receives the 413
        req.resume();
        reject(
          new HttpValidationError('body', 'Request body is too large', 413)
        );
        return;
      }

      chunks.push(buffer);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;

      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
};

const hasPrefixPathSegment = (pathname: string, prefix: string): boolean => {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const getRequestPathname = (req: http.IncomingMessage): string | null => {
  if (!req.url) return null;

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return url.pathname;
  } catch {
    return null;
  }
};

const sanitizeFileName = (name: string): string | null => {
  // reject null bytes which can truncate paths on some
  if (name.includes('\0')) {
    return null;
  }

  const normalized = name.replace(/\\/g, '/');

  // strip any directory components (e.g. "../../etc/passwd" -> "passwd")
  const baseName = path.basename(normalized);

  // reject empty names (e.g. after stripping path components from "/")
  if (!baseName || baseName === '.' || baseName === '..') {
    return null;
  }

  return baseName;
};

const buildEtag = (md5: string | null, stat: fs.Stats) => {
  if (md5) {
    return `"${md5}"`;
  }

  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
};

const hasMatchingEtag = (
  ifNoneMatchHeader: string | undefined,
  etag: string
) => {
  if (!ifNoneMatchHeader) {
    return false;
  }

  const candidates = ifNoneMatchHeader.split(',').map((part) => part.trim());

  return candidates.includes('*') || candidates.includes(etag);
};

const isNotModifiedByDate = (
  ifModifiedSinceHeader: string | undefined,
  mtimeMs: number
) => {
  if (!ifModifiedSinceHeader) {
    return false;
  }

  const ifModifiedSinceTime = Date.parse(ifModifiedSinceHeader);

  if (Number.isNaN(ifModifiedSinceTime)) {
    return false;
  }

  // HTTP dates are second precision, so truncate mtime for accurate comparisons.
  return Math.floor(mtimeMs / 1000) * 1000 <= ifModifiedSinceTime;
};

const sendJsonError = (
  res: http.ServerResponse,
  statusCode: number,
  error: string
) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({ error }));
};

type CacheMetadata = {
  etag: string;
  lastModified: string;
  cacheControl: string;
  mtimeMs: number;
  extraHeaders?: Record<string, string>;
};

// implements RFC 7232 §6: when If-None-Match is present, If-Modified-Since is ignored.
const sendNotModified = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  meta: CacheMetadata
): boolean => {
  const ifNoneMatchHeader = req.headers['if-none-match'];
  const ifModifiedSinceHeader = req.headers['if-modified-since'];

  const isNotModified = ifNoneMatchHeader
    ? hasMatchingEtag(ifNoneMatchHeader, meta.etag)
    : isNotModifiedByDate(ifModifiedSinceHeader, meta.mtimeMs);

  if (!isNotModified) {
    return false;
  }

  res.writeHead(304, {
    ETag: meta.etag,
    'Last-Modified': meta.lastModified,
    'Cache-Control': meta.cacheControl,
    ...meta.extraHeaders
  });
  res.end();

  return true;
};

const buildCacheControl = (
  isSignedUrlProtected: boolean,
  tokenExpiresAt: number | null
) => {
  if (!isSignedUrlProtected) {
    return 'public, max-age=3600, must-revalidate';
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((tokenExpiresAt! - Date.now()) / 1000)
  );
  const maxAge = Math.min(300, remainingSeconds);

  return `private, max-age=${maxAge}, must-revalidate`;
};

export {
  buildCacheControl,
  buildEtag,
  getJsonBody,
  getRequestPathname,
  hasPrefixPathSegment,
  MAX_JSON_BODY_BYTES,
  sanitizeFileName,
  sendJsonError,
  sendNotModified
};
export type { HttpRouteHandler };
