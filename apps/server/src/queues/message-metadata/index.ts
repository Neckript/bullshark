import { getErrorMessage } from '@bullshark/shared';
import Queue from 'queue';
import { publishMessage } from '../../db/publishers';
import { logger } from '../../logger';
import { processMessageMetadata } from './get-message-metadata';

const messageMetadataQueue = new Queue({
  concurrency: 1,
  autostart: true,
  timeout: 3000
});

messageMetadataQueue.autostart = true;

const enqueueProcessMetadata = (content: string, messageId: number) => {
  messageMetadataQueue.push(async (callback) => {
    // best-effort: link-preview enrichment must never surface as an unhandled
    // rejection (network error, transient DB error, or the DB torn down in tests)
    try {
      const updatedMessage = await processMessageMetadata(content, messageId);

      if (updatedMessage) {
        publishMessage(messageId, updatedMessage.channelId, 'update');
      }
    } catch (error) {
      logger.error(
        'Failed to process message metadata for message %d: %s',
        messageId,
        getErrorMessage(error)
      );
    } finally {
      callback?.();
    }
  });
};

export { enqueueProcessMetadata, messageMetadataQueue };
