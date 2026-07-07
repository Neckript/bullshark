import type { TEmojiItem } from '@/components/tiptap-input/helpers';
import { openThreadSidebar } from '@/features/app/actions';
import { useIsShiftHeld } from '@/features/app/hooks';
import { requestConfirmation } from '@/features/dialogs/actions';
import { getTRPCClient } from '@/lib/trpc';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TUseMessageActionHandlersArgs = { messageId: number; channelId: number };

const useMessageActionHandlers = ({
  messageId,
  channelId
}: TUseMessageActionHandlersArgs) => {
  const { t } = useTranslation();
  const isShiftHeld = useIsShiftHeld();

  const onDeleteClick = useCallback(async () => {
    if (!isShiftHeld) {
      const choice = await requestConfirmation({
        title: t('deleteMessageTitle'),
        message: t('deleteMessageConfirm'),
        confirmLabel: t('deleteLabel'),
        cancelLabel: t('cancel')
      });
      if (!choice) return;
    }
    const trpc = getTRPCClient();
    try {
      await trpc.messages.delete.mutate({ messageId });
      toast.success(t('messageDeleted'));
    } catch {
      toast.error(t('failedDeleteMessage'));
    }
  }, [isShiftHeld, messageId, t]);

  const onEmojiSelect = useCallback(
    async (emoji: TEmojiItem) => {
      const trpc = getTRPCClient();
      try {
        await trpc.messages.toggleReaction.mutate({
          messageId,
          emoji: emoji.shortcodes[0]
        });
      } catch (error) {
        toast.error(t('failedAddReaction'));
        console.error('Error adding reaction:', error);
      }
    },
    [messageId, t]
  );

  const onThreadClick = useCallback(() => {
    openThreadSidebar(messageId, channelId);
  }, [messageId, channelId]);

  const onPinClick = useCallback(async () => {
    const trpc = getTRPCClient();
    try {
      await trpc.messages.togglePin.mutate({ messageId });
      toast.success(t('messagePinToggled'));
    } catch (error) {
      toast.error(t('failedTogglePin'));
      console.error('Error toggling pin status:', error);
    }
  }, [messageId, t]);

  return { onDeleteClick, onEmojiSelect, onThreadClick, onPinClick };
};

export { useMessageActionHandlers };
