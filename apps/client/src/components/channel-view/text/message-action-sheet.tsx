import { EmojiPicker } from '@/components/emoji-picker';
import { Protect } from '@/components/protect';
import type { TEmojiItem } from '@/components/tiptap-input/helpers';
import { useMessageActionHandlers } from './hooks/use-message-action-handlers';
import { Permission } from '@sharkord/shared';
import { Sheet, SheetContent } from '@sharkord/ui';
import {
  Copy,
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
  Trash
} from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const QUICK_EMOJIS: TEmojiItem[] = [
  { emoji: '👍', name: 'thumbsup', shortcodes: ['+1'] },
  { emoji: '❤️', name: 'heart', shortcodes: ['heart'] },
  { emoji: '😂', name: 'joy', shortcodes: ['joy'] },
  { emoji: '😮', name: 'open_mouth', shortcodes: ['open_mouth'] },
  { emoji: '😢', name: 'cry', shortcodes: ['cry'] }
];

type TProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  messageId: number;
  channelId: number;
  onEdit: () => void;
  onReply?: () => void;
  canManage: boolean;
  editable: boolean;
  isThreadReply?: boolean;
  isPinned?: boolean;
  disablePin?: boolean;
  messageText: string;
};

const Row = ({
  icon: Icon,
  label,
  onClick,
  destructive
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-accent ${destructive ? 'text-destructive' : ''}`}
  >
    <Icon className="h-4 w-4 shrink-0" />
    {label}
  </button>
);

const MessageActionSheet = memo(
  ({
    open,
    onOpenChange,
    messageId,
    channelId,
    onEdit,
    onReply,
    canManage,
    editable,
    isThreadReply,
    isPinned,
    disablePin,
    messageText
  }: TProps) => {
    const { t } = useTranslation();
    const { onDeleteClick, onEmojiSelect, onThreadClick, onPinClick } =
      useMessageActionHandlers({ messageId, channelId });

    const wrap = useCallback(
      (fn: () => unknown) => () => {
        onOpenChange(false);
        fn();
      },
      [onOpenChange]
    );

    const onCopy = useCallback(async () => {
      await navigator.clipboard.writeText(messageText);
      toast.success(t('copiedToClipboard'));
    }, [messageText, t]);

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl p-2 pb-6"
          close={() => onOpenChange(false)}
        >
          <Protect permission={Permission.REACT_TO_MESSAGES}>
            <div className="flex items-center justify-around border-b border-border px-2 pb-3 pt-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji.name}
                  type="button"
                  onClick={wrap(() => onEmojiSelect(emoji))}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-accent"
                >
                  {emoji.emoji}
                </button>
              ))}
              <EmojiPicker
                onEmojiSelect={(e) => {
                  onOpenChange(false);
                  onEmojiSelect(e);
                }}
              >
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
                >
                  <Smile className="h-6 w-6" />
                </button>
              </EmojiPicker>
            </div>
          </Protect>
          <div className="pt-2">
            {onReply && (
              <Row icon={Reply} label={t('replyToMessage')} onClick={wrap(onReply)} />
            )}
            {!isThreadReply && (
              <Row
                icon={MessageSquareText}
                label={t('replyInThread')}
                onClick={wrap(onThreadClick)}
              />
            )}
            <Row icon={Copy} label={t('copyMessageText')} onClick={wrap(onCopy)} />
            {!disablePin && (
              <Protect permission={Permission.PIN_MESSAGES}>
                <Row
                  icon={isPinned ? PinOff : Pin}
                  label={isPinned ? t('unpinMessage') : t('pinMessage')}
                  onClick={wrap(onPinClick)}
                />
              </Protect>
            )}
            {canManage && (
              <>
                {editable && (
                  <Row icon={Pencil} label={t('editMessage')} onClick={wrap(onEdit)} />
                )}
                <Row
                  icon={Trash}
                  label={t('deleteMessageTitle')}
                  onClick={wrap(onDeleteClick)}
                  destructive
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);

export { MessageActionSheet };
