import { getErrorMessage, UploadHeaders } from '@bullshark/shared';
import fs from 'fs';
import http from 'http';
import z from 'zod';
import { getSettings } from '../db/queries/server';
import { getUserByToken } from '../db/queries/users';
import { logger } from '../logger';
import { fileManager } from '../utils/file-manager';
import { sanitizeFileName } from './helpers';

const zHeaders = z.object({
  [UploadHeaders.TOKEN]: z.string(),
  [UploadHeaders.ORIGINAL_NAME]: z.string(),
  [UploadHeaders.CONTENT_LENGTH]: z.string().transform((val) => Number(val))
});

const uploadFileRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const parsedHeaders = zHeaders.parse(req.headers);

  const [token, rawOriginalName, contentLength] = [
    parsedHeaders[UploadHeaders.TOKEN],
    parsedHeaders[UploadHeaders.ORIGINAL_NAME],
    parsedHeaders[UploadHeaders.CONTENT_LENGTH]
  ];

  const originalName = sanitizeFileName(rawOriginalName);

  if (!originalName) {
    req.resume();
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid file name' }));
    return;
  }

  const user = await getUserByToken(token);

  if (!user) {
    req.resume();
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const settings = await getSettings();

  if (contentLength > settings.storageUploadMaxFileSize) {
    req.resume();
    req.on('end', () => {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: `File ${originalName} exceeds the maximum allowed size`
        })
      );
    });

    return;
  }

  if (!settings.storageUploadEnabled) {
    req.resume();
    req.on('end', () => {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'File uploads are disabled on this server' })
      );
    });

    return;
  }

  const maxFileSize = settings.storageUploadMaxFileSize;
  const safePath = await fileManager.getSafeUploadPath(originalName);
  const fileStream = fs.createWriteStream(safePath);

  let bytesWritten = 0;
  let rejection: { status: number; error: string } | null = null;
  let responded = false;

  const respond = (status: number, payload: unknown) => {
    if (responded) return;
    responded = true;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  // never leave a half-written file on disk after a rejected upload
  const cleanupPartial = () => fs.unlink(safePath, () => undefined);

  req.on('data', (chunk: Buffer) => {
    if (rejection) return;

    // enforce the limit on the bytes actually received, not the
    // client-declared x-content-length header, which a client can lie about
    // to bypass the quota and fill the disk
    bytesWritten += chunk.length;

    if (bytesWritten > maxFileSize) {
      rejection = {
        status: 413,
        error: `File ${originalName} exceeds the maximum allowed size`
      };
      fileStream.destroy();
      cleanupPartial();
      // drain the rest instead of destroying the socket, so the request
      // completes cleanly and the 413 actually reaches the client
      req.resume();
      return;
    }

    // respect backpressure so a fast client can't outrun the disk and
    // balloon memory while we buffer unwritten chunks
    if (!fileStream.write(chunk)) {
      req.pause();
      fileStream.once('drain', () => {
        if (!rejection) req.resume();
      });
    }
  });

  req.on('end', () => {
    if (rejection) {
      respond(rejection.status, { error: rejection.error });
      return;
    }
    fileStream.end();
  });

  req.on('error', (err) => {
    if (rejection) return;
    rejection = { status: 500, error: 'File upload failed' };
    logger.error('Error uploading file: %s', getErrorMessage(err));
    fileStream.destroy();
    cleanupPartial();
    respond(500, { error: 'File upload failed' });
  });

  fileStream.on('finish', async () => {
    if (rejection) return;

    try {
      const tempFile = await fileManager.addTemporaryFile({
        originalName,
        filePath: safePath,
        // the real byte count, never the client-declared header
        size: bytesWritten,
        userId: user.id
      });

      respond(200, tempFile);
    } catch (error) {
      logger.error(
        'Error processing uploaded file: %s',
        getErrorMessage(error)
      );
      respond(500, { error: 'File processing failed' });
    }
  });

  fileStream.on('error', (err) => {
    if (rejection) return;
    rejection = { status: 500, error: 'File upload failed' };
    logger.error('Error uploading file: %s', getErrorMessage(err));
    cleanupPartial();
    respond(500, { error: 'File upload failed' });
  });
};

export { sanitizeFileName, uploadFileRouteHandler };
