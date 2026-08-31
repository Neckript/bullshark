import { EmptyState } from '@/components/empty-state';
import { useThreadSidebar } from '@/features/app/hooks';
import {
  useChannelCan,
  usePublicServerSettings,
  useTypingUsersByThreadId
} from '@/features/server/hooks';
import { useThreadMessages } from '@/features/server/messages/hooks';
import { LocalStorageKey } from '@/helpers/storage';
import { useFileDrag } from '@/hooks/use-file-drag';
import { useUploadPermission } from '@/hooks/use-upload-permission';
import { ChannelPermission, type TJoinedMessage } from '@bullshark/shared';
import { Spinner } from '@bullshark/ui';
import { MessageSquareText } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatInputDivider } from '../channel-view/text/chat-input-divider';
import { DropOverlay } from '../channel-view/text/drop-overlay';
import { DEFAULT_MAX_HEIGHT_VH } from '../channel-view/text/helpers';
import { useArrowUpEdit } from '../channel-view/text/hooks/use-arrow-up-edit';
import { useScrollController } from '../channel-view/text/hooks/use-scroll-controller';
import { MessagesGroup } from '../channel-view/text/messages-group';
import { ParentMessagePreview } from './parent-message-preview';
import { ThreadCompose } from './thread-compose';
import { ThreadHeader } from './thread-header';

type TThreadContentProps = {
  parentMessageId: number;
  channelId: number;
};

const ThreadContent = memo(
  ({ parentMessageId, channelId }: TThreadContentProps) => {
    const { t } = useTranslation('common');
    const { messages, hasMore, loadMore, loading, fetching, groupedMessages } =
      useThreadMessages(parentMessageId);
    const [replyingToMessage, setReplyingToMessage] = useState<
      TJoinedMessage | undefined
    >();
    const { activeThreadMessageId } = useThreadSidebar();
    const {
      composeRef,
      editingMessageId,
      handleArrowUpEdit,
      handleEditComplete
    } = useArrowUpEdit(messages);

    const typingUsers = useTypingUsersByThreadId(parentMessageId);
    const composeContainerRef = useRef<HTMLDivElement>(null);
    const settings = usePublicServerSettings();
    const channelCan = useChannelCan(channelId);
    const canSend = channelCan(ChannelPermission.SEND_MESSAGES);
    const uploadPermission = useUploadPermission(channelId, !canSend);

    const onDropFiles = useCallback(
      (droppedFiles: File[]) => {
        if (!uploadPermission.allowed) return;

        composeRef.current?.addFiles(droppedFiles);
      },
      [composeRef, uploadPermission.allowed]
    );

    const { dropTargetRef, isDragging: isDraggingFiles } = useFileDrag({
      onFiles: onDropFiles,
      disabled: !canSend
    });

    const {
      containerRef,
      onScroll,
      onAsyncContentLoaded,
      scrollToBottom,
      isAtBottom
    } = useScrollController({
      messages,
      fetching,
      hasMore,
      loadMore,
      hasTypingUsers: typingUsers.length > 0
    });

    const onComposeResize = useCallback(() => {
      if (isAtBottom()) {
        scrollToBottom();
      }
    }, [isAtBottom, scrollToBottom]);

    const onReplyMessageSelect = useCallback((message: TJoinedMessage) => {
      setReplyingToMessage(message);
    }, []);

    return (
      <div ref={dropTargetRef} className="relative flex flex-col h-full w-full">
        <ThreadHeader />
        <ParentMessagePreview messageId={parentMessageId} />

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <>
              {fetching && (
                <div className="h-8 flex items-center justify-center shrink-0">
                  <Spinner size="xs" />
                </div>
              )}

              <div
                ref={containerRef}
                onScroll={onScroll}
                onLoadCapture={onAsyncContentLoaded}
                className="flex-1 overflow-y-auto overflow-x-hidden p-2 animate-in fade-in duration-500"
              >
                {messages.length === 0 && !fetching ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                    <EmptyState
                      variant="compact"
                      icon={<MessageSquareText className="h-5 w-5" />}
                      title={t('noRepliesYet')}
                      description={t('beFirstToReply')}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedMessages.map((group) => (
                      <MessagesGroup
                        key={group.key}
                        group={group.messages}
                        onReplyMessageSelect={onReplyMessageSelect}
                        replyTargetMessageId={replyingToMessage?.id}
                        activeThreadMessageId={activeThreadMessageId}
                        editingMessageId={editingMessageId}
                        onEditComplete={handleEditComplete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <ChatInputDivider
            composeContainerRef={composeContainerRef}
            scrollToBottom={scrollToBottom}
            isAtBottom={isAtBottom}
            storageKey={LocalStorageKey.THREAD_INPUT_HEIGHT_VH}
            defaultMaxHeightVh={DEFAULT_MAX_HEIGHT_VH}
          />

          <ThreadCompose
            ref={composeRef}
            parentMessageId={parentMessageId}
            channelId={channelId}
            typingUsers={typingUsers}
            replyingToMessage={replyingToMessage}
            onCancelReply={() => setReplyingToMessage(undefined)}
            onArrowUp={handleArrowUpEdit}
            composeContainerRef={composeContainerRef}
            inputStorageKey={LocalStorageKey.THREAD_INPUT_HEIGHT_VH}
            inputDefaultMaxHeightVh={DEFAULT_MAX_HEIGHT_VH}
            onResize={onComposeResize}
          />
        </div>

        {isDraggingFiles && (
          <DropOverlay
            refusal={uploadPermission.reason}
            maxFiles={settings?.storageMaxFilesPerMessage}
            maxFileSize={settings?.storageUploadMaxFileSize}
          />
        )}
      </div>
    );
  }
);

export { ThreadContent };
