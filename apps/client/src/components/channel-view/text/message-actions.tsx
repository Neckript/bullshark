import { EmojiPicker } from '@/components/emoji-picker';
import { useRecentEmojis } from '@/components/emoji-picker/use-recent-emojis';
import { Protect } from '@/components/protect';
import { shouldUseFallbackImage } from '@/components/tiptap-input/helpers';
import { useIsShiftHeld } from '@/features/app/hooks';
import { Permission } from '@sharkord/shared';
import { IconButton } from '@sharkord/ui';
import {
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
  Trash,
  Trash2
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessageActionHandlers } from './hooks/use-message-action-handlers';

const MAX_QUICK_EMOJIS = 4;

type TMessageActionsProps = {
  messageId: number;
  channelId: number;
  onEdit: () => void;
  onReply?: () => void;
  canManage: boolean;
  editable: boolean;
  isThreadReply?: boolean;
  isPinned?: boolean;
  disablePin?: boolean;
};

const MessageActions = memo(
  ({
    onEdit,
    messageId,
    channelId,
    canManage,
    editable,
    isThreadReply,
    isPinned,
    disablePin,
    onReply
  }: TMessageActionsProps) => {
    const { t } = useTranslation();
    const { recentEmojis } = useRecentEmojis();
    const recentEmojisToShow = useMemo(
      () => recentEmojis.slice(0, MAX_QUICK_EMOJIS),
      [recentEmojis]
    );

    const isShiftHeld = useIsShiftHeld();

    const { onDeleteClick, onEmojiSelect, onThreadClick, onPinClick } =
      useMessageActionHandlers({ messageId, channelId });

    return (
      <div className="gap-1 absolute right-0 -top-6 z-10 hidden group-hover:flex [&:has([data-state=open])]:flex items-center space-x-1 rounded-lg shadow-lg border border-border p-2 transition-all bg-background">
        {onReply && (
          <IconButton
            size="sm"
            variant="ghost"
            icon={Reply}
            onClick={onReply}
            title={t('replyToMessage')}
          />
        )}
        {!isThreadReply && (
          <IconButton
            size="sm"
            variant="ghost"
            icon={MessageSquareText}
            onClick={onThreadClick}
            title={t('replyInThread')}
          />
        )}
        {canManage && (
          <>
            <IconButton
              size="sm"
              variant="ghost"
              icon={Pencil}
              onClick={onEdit}
              disabled={!editable}
              title={t('editMessage')}
            />

            <IconButton
              size="sm"
              variant="ghost"
              icon={isShiftHeld ? Trash2 : Trash}
              className={isShiftHeld ? 'text-destructive' : ''}
              onClick={onDeleteClick}
              title={t('deleteMessageTitle')}
            />
          </>
        )}
        {!disablePin && (
          <Protect permission={Permission.PIN_MESSAGES}>
            <IconButton
              size="sm"
              variant="ghost"
              icon={isPinned ? PinOff : Pin}
              onClick={onPinClick}
              title={isPinned ? t('unpinMessage') : t('pinMessage')}
            />
          </Protect>
        )}

        <Protect permission={Permission.REACT_TO_MESSAGES}>
          <div className="flex items-center space-x-0.5 border-l pl-1 gap-1">
            {recentEmojisToShow.map((emoji) => (
              <button
                key={emoji.name}
                type="button"
                onClick={() => onEmojiSelect(emoji)}
                className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded-md transition-colors text-md"
                title={`:${emoji.shortcodes[0]}:`}
              >
                {emoji.emoji && !shouldUseFallbackImage(emoji) ? (
                  <span>{emoji.emoji}</span>
                ) : emoji.fallbackImage ? (
                  <img
                    src={emoji.fallbackImage}
                    alt={emoji.name}
                    className="w-5 h-5 object-contain"
                  />
                ) : null}
              </button>
            ))}

            <EmojiPicker onEmojiSelect={onEmojiSelect}>
              <IconButton
                variant="ghost"
                icon={Smile}
                title={t('addReaction')}
              />
            </EmojiPicker>
          </div>
        </Protect>
      </div>
    );
  }
);

export { MessageActions };
