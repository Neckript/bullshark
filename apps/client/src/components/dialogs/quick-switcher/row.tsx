import { UnreadCount } from '@/components/unread-count';
import { UserAvatar } from '@/components/user-avatar';
import {
  useUnreadMessagesCount,
  useVoiceUsersByChannelId
} from '@/features/server/hooks';
import { useUserById } from '@/features/server/users/hooks';
import { cn } from '@/lib/utils';
import { TestId, UserStatus } from '@bullshark/shared';
import { Hash, Volume2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TQuickSwitcherItem } from './types';

type TQuickSwitcherRowProps = {
  item: TQuickSwitcherItem;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
};

const Segments = memo(({ item }: { item: TQuickSwitcherItem }) => (
  <span className="flex-1 truncate text-left">
    {item.segments.map((segment, index) => (
      <span
        key={`${index}-${segment.text}`}
        className={
          segment.matched ? 'font-semibold text-foreground' : undefined
        }
      >
        {segment.text}
      </span>
    ))}
  </span>
));

const ChannelMeta = memo(({ item }: { item: TQuickSwitcherItem }) => {
  const unreadCount = useUnreadMessagesCount(item.id);

  return (
    <>
      {item.categoryName && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {item.categoryName}
        </span>
      )}
      <UnreadCount count={unreadCount} className="ml-0" />
    </>
  );
});

const VoiceMeta = memo(({ item }: { item: TQuickSwitcherItem }) => {
  const { t } = useTranslation('dialogs');
  const voiceUsers = useVoiceUsersByChannelId(item.id);

  if (voiceUsers.length === 0) return null;

  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {t('quickSwitcherVoiceUsers', { count: voiceUsers.length })}
    </span>
  );
});

const UserMeta = memo(({ item }: { item: TQuickSwitcherItem }) => {
  const { t } = useTranslation('dialogs');
  const user = useUserById(item.id);
  const isOnline = user?.status === UserStatus.ONLINE;

  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {isOnline ? t('quickSwitcherOnline') : t('quickSwitcherOffline')}
    </span>
  );
});

const QuickSwitcherRow = memo(
  ({ item, isActive, onSelect, onHover }: TQuickSwitcherRowProps) => (
    <div
      role="option"
      id={`quick-switcher-${item.key}`}
      data-testid={TestId.QUICK_SWITCHER_ROW}
      aria-selected={isActive}
      data-active={isActive}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        'flex w-full cursor-default items-center gap-2.5 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-out',
        isActive && 'bg-accent text-accent-foreground'
      )}
    >
      {item.kind === 'user' ? (
        <UserAvatar userId={item.id} className="h-5 w-5" />
      ) : (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground',
            isActive && 'text-primary'
          )}
        >
          {item.kind === 'voice' ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <Hash className="h-3.5 w-3.5" />
          )}
        </span>
      )}

      <Segments item={item} />

      {item.kind === 'channel' && <ChannelMeta item={item} />}
      {item.kind === 'voice' && <VoiceMeta item={item} />}
      {item.kind === 'user' && <UserMeta item={item} />}
    </div>
  )
);

export { QuickSwitcherRow };
