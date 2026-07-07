import { openThreadSidebar } from '@/features/app/actions';
import { useCan } from '@/features/server/hooks';
import { useIsOwnUser, useOwnUserId } from '@/features/server/users/hooks';
import { useIsCoarsePointer } from '@/hooks/use-is-coarse-pointer';
import { cn } from '@/lib/utils';
import {
  hasMention,
  Permission,
  TestId,
  type TJoinedMessage
} from '@sharkord/shared';
import { MessageSquareText, MoreVertical } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageActionSheet } from './message-action-sheet';
import { MessageActions } from './message-actions';
import { MessageEditInline } from './message-edit-inline';
import { MessageRenderer } from './renderer';

const stripHtml = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';

type TMessageProps = {
  message: TJoinedMessage;
  disableActions?: boolean;
  disableFiles?: boolean;
  disableReactions?: boolean;
  onReplyMessageSelect?: (message: TJoinedMessage) => void;
  isInlineReplyTarget?: boolean;
  isActiveThread?: boolean;
  editingMessageId?: number;
  onEditComplete?: () => void;
};

const Message = memo(
  ({
    message,
    disableActions,
    disableFiles,
    disableReactions,
    onReplyMessageSelect,
    isInlineReplyTarget,
    isActiveThread,
    editingMessageId,
    onEditComplete
  }: TMessageProps) => {
    const { t } = useTranslation('common');
    const [isPencilEditing, setIsPencilEditing] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const isEditing = isPencilEditing || editingMessageId === message.id;
    const isFromOwnUser = useIsOwnUser(message.userId);
    const can = useCan();
    const ownUserId = useOwnUserId();
    const isCoarse = useIsCoarsePointer();

    const canManage = useMemo(
      () => can(Permission.MANAGE_MESSAGES) || isFromOwnUser,
      [can, isFromOwnUser]
    );

    const isMentioned = useMemo(
      () => hasMention(message.content, ownUserId),
      [message.content, ownUserId]
    );

    const isThreadReply = !!message.parentMessageId;
    const replyCount = message.replyCount ?? 0;

    const onThreadClick = useCallback(() => {
      openThreadSidebar(message.id, message.channelId);
    }, [message.id, message.channelId]);

    return (
      <div
        className={cn(
          'min-w-0 flex-1 ml-1 relative hover:bg-secondary/50 rounded-md px-1 py-0.5 group',
          isActiveThread && 'bg-primary/10',
          isMentioned && 'border-primary bg-primary/5',
          isInlineReplyTarget && 'ring-1 ring-primary/50 bg-primary/10'
        )}
        data-testid={TestId.MESSAGE_ITEM}
        data-message-id={message.id}
      >
        {!isEditing ? (
          <>
            <MessageRenderer
              message={message}
              disableFiles={disableFiles}
              disableReactions={disableReactions}
            />
            {!isThreadReply && replyCount > 0 && (
              <button
                type="button"
                onClick={onThreadClick}
                className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary hover:underline mt-1 transition-colors"
              >
                <MessageSquareText className="h-3 w-3" />
                <span>{t('reply', { count: replyCount })}</span>
              </button>
            )}
            {!disableActions && (
              <MessageActions
                onEdit={() => setIsPencilEditing(true)}
                canManage={canManage}
                messageId={message.id}
                channelId={message.channelId}
                editable={message.editable ?? false}
                isPinned={message.pinned ?? false}
                disablePin={!!message.parentMessageId}
                isThreadReply={isThreadReply}
                onReply={() => onReplyMessageSelect?.(message)}
              />
            )}
            {!disableActions && isCoarse && (
              <button
                type="button"
                aria-label={t('messageActions')}
                onClick={() => setSheetOpen(true)}
                className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
            {!disableActions && isCoarse && (
              <MessageActionSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onEdit={() => setIsPencilEditing(true)}
                canManage={canManage}
                messageId={message.id}
                channelId={message.channelId}
                editable={message.editable ?? false}
                isPinned={message.pinned ?? false}
                disablePin={!!message.parentMessageId}
                isThreadReply={isThreadReply}
                onReply={() => onReplyMessageSelect?.(message)}
                messageText={stripHtml(message.content ?? '')}
              />
            )}
          </>
        ) : (
          <MessageEditInline
            message={message}
            onBlur={() => {
              setIsPencilEditing(false);
              if (editingMessageId === message.id) {
                onEditComplete?.();
              }
            }}
          />
        )}
      </div>
    );
  }
);

export { Message };
