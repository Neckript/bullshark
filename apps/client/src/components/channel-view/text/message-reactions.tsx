import { isTextPresentation } from '@/components/tiptap-input/helpers';
import { useOwnUserId, useUsernames } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { getTRPCClient } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  getTrpcError,
  type TFile,
  type TJoinedMessageReaction
} from '@bullshark/shared';
import { Button, Tooltip } from '@bullshark/ui';
import { gitHubEmojis } from '@tiptap/extension-emoji';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const MAX_REACTORS_PREVIEW = 4;

type TTooltipPreviewProps = {
  emojiName: string;
  emojiSlot: React.ReactNode;
  reacters: string;
};

const TooltipPreview = memo(
  ({ emojiName, emojiSlot, reacters }: TTooltipPreviewProps) => {
    const { t } = useTranslation('common');

    return (
      <div className="flex items-center gap-2 max-w-xs wrap-break-word whitespace-pre-wrap text-sm">
        <div className="flex items-center flex-col">
          {emojiSlot}
          <span className="text-[8px]">:{emojiName}:</span>
        </div>
        <span className="text-xs">{t('wasReactedBy', { reacters })}</span>
      </div>
    );
  }
);

type TEmojiProps = {
  emoji: string;
  file: TFile | null;
  className?: string;
  nativeEmojiClassName?: string;
};

const Emoji = memo(
  ({ emoji, file, className, nativeEmojiClassName }: TEmojiProps) => {
    const gitHubEmoji = useMemo(
      () =>
        gitHubEmojis.find(
          (e) => e.name === emoji || e.shortcodes.includes(emoji)
        ),
      [emoji]
    );

    const onError = useCallback(
      (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const target = e.target as HTMLImageElement;

        target.outerHTML = `<span class="text-xs text-muted-foreground">:${emoji}:</span>`;
      },
      [emoji]
    );

    const imgSrc = useMemo(
      () => gitHubEmoji?.fallbackImage ?? getFileUrl(file),
      [gitHubEmoji, file]
    );

    if (gitHubEmoji?.emoji && !isTextPresentation(gitHubEmoji.emoji)) {
      return (
        <span className={cn('text-sm', nativeEmojiClassName)}>
          {gitHubEmoji.emoji}
        </span>
      );
    }

    return (
      <img
        src={imgSrc}
        alt={`:${emoji}:`}
        className={cn('w-5 h-5 object-contain', className)}
        onError={onError}
      />
    );
  }
);

type TReactionProps = {
  emoji: string;
  count: number;
  isUserReacted: boolean;
  onClick: () => void;
  file: TFile | null;
  userIds: number[];
  isPopping: boolean;
  onPopEnd: (emoji: string) => void;
};

const Reaction = memo(
  ({
    emoji,
    count,
    isUserReacted,
    onClick,
    file,
    userIds,
    isPopping,
    onPopEnd
  }: TReactionProps) => {
    const { t } = useTranslation('common');
    const usernames = useUsernames();
    const tooltipContent = useMemo(() => {
      const names = userIds
        .slice(0, MAX_REACTORS_PREVIEW)
        .map((userId) => usernames[userId] || 'Unknown');

      if (userIds.length > MAX_REACTORS_PREVIEW) {
        names.push(
          t('andMore', { count: userIds.length - MAX_REACTORS_PREVIEW })
        );
      }

      return names.join(', ');
    }, [userIds, usernames, t]);

    return (
      <Tooltip
        content={
          <TooltipPreview
            emojiName={emoji}
            reacters={tooltipContent}
            emojiSlot={
              <Emoji
                emoji={emoji}
                file={file}
                className="w-10 h-10"
                nativeEmojiClassName="text-[28px]"
              />
            }
          />
        }
      >
        <Button
          size="sm"
          variant="outline"
          onClick={onClick}
          onAnimationEnd={(event) => {
            if (event.animationName !== 'reaction-pop') return;
            onPopEnd(emoji);
          }}
          className={cn(
            'flex items-center gap-1 h-9 reaction-pill',
            isUserReacted ? 'border-border' : 'border-none',
            isPopping && 'reaction-pop'
          )}
        >
          <Emoji emoji={emoji} file={file} />
          <span className="font-medium">{count}</span>
        </Button>
      </Tooltip>
    );
  }
);

type TMessageReactionsProps = {
  messageId: number;
  reactions: TJoinedMessageReaction[];
};

type TAggregatedReaction = {
  emoji: string;
  count: number;
  userIds: number[];
  isUserReacted: boolean;
  createdAt: number;
  file: TFile | null;
};

const MessageReactions = memo(
  ({ messageId, reactions }: TMessageReactionsProps) => {
    const { t } = useTranslation();
    const ownUserId = useOwnUserId();

    const handleReactionClick = useCallback(
      async (emoji: string) => {
        if (!ownUserId) return;

        const trpc = getTRPCClient();

        try {
          await trpc.messages.toggleReaction.mutate({
            messageId,
            emoji
          });
        } catch (error) {
          toast.error(getTrpcError(error, t('failedToggleReaction')));
        }
      },
      [messageId, ownUserId, t]
    );

    const aggregatedReactions = useMemo((): TAggregatedReaction[] => {
      const reactionMap = new Map<string, TAggregatedReaction>();

      reactions.forEach((reaction) => {
        if (!reactionMap.has(reaction.emoji)) {
          reactionMap.set(reaction.emoji, {
            emoji: reaction.emoji,
            count: 0,
            userIds: [],
            isUserReacted: false,
            createdAt: reaction.createdAt,
            file: reaction.file
          });
        }

        const aggregated = reactionMap.get(reaction.emoji)!;

        aggregated.count++;
        aggregated.userIds.push(reaction.userId);

        if (ownUserId && reaction.userId === ownUserId) {
          aggregated.isUserReacted = true;
        }
      });

      // sort by first reaction createdAt desc
      return Array.from(reactionMap.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      );
    }, [reactions, ownUserId]);

    // Même règle que pour les messages : on se déclenche sur l'apparition
    // d'un emoji, pas sur un rendu. Les réactions déjà présentes au premier
    // rendu sont adoptées telles quelles et n'animent rien.
    const knownEmojisRef = useRef<Set<string> | null>(null);
    const [popping, setPopping] = useState<ReadonlySet<string>>(
      () => new Set()
    );

    const currentEmojis = aggregatedReactions.map((reaction) => reaction.emoji);

    if (knownEmojisRef.current === null) {
      knownEmojisRef.current = new Set(currentEmojis);
    } else {
      const appeared = currentEmojis.filter(
        (emoji) => !knownEmojisRef.current!.has(emoji)
      );

      if (appeared.length) {
        knownEmojisRef.current = new Set(currentEmojis);
        setPopping((current) => new Set([...current, ...appeared]));
      }
    }

    const markPopped = useCallback((emoji: string) => {
      setPopping((current) => {
        if (!current.has(emoji)) return current;

        const next = new Set(current);
        next.delete(emoji);

        return next;
      });
    }, []);

    if (!aggregatedReactions.length) return null;

    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {aggregatedReactions.map((reaction) => (
          <Reaction
            key={reaction.emoji}
            emoji={reaction.emoji}
            count={reaction.count}
            userIds={reaction.userIds}
            isUserReacted={reaction.isUserReacted}
            onClick={() => handleReactionClick(reaction.emoji)}
            file={reaction.file}
            isPopping={popping.has(reaction.emoji)}
            onPopEnd={markPopped}
          />
        ))}
      </div>
    );
  }
);

export { MessageReactions };
