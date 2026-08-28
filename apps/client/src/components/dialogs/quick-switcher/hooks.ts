import { useCategories } from '@/features/server/categories/hooks';
import { useVisibleChannels } from '@/features/server/hooks';
import { useFilteredUsers } from '@/features/server/users/hooks';
import { ChannelType } from '@sharkord/shared';
import { useMemo } from 'react';
import { compareMatches, matchName } from './matching';
import { readRecentTargets } from './recents';
import type { TQuickSwitcherGroup, TQuickSwitcherItem } from './types';

const MAX_ITEMS_PER_GROUP = 8;

const useQuickSwitcherGroups = (
  query: string,
  isOpen: boolean
): TQuickSwitcherGroup[] => {
  const channels = useVisibleChannels();
  const categories = useCategories();
  const users = useFilteredUsers();

  // Les récents sont lus une fois par ouverture : les relire à chaque frappe
  // toucherait le disque pour rien, et la liste ne peut pas changer pendant
  // que la palette est ouverte.
  const recentTargets = useMemo(
    () => (isOpen ? readRecentTargets() : []),
    [isOpen]
  );

  return useMemo(() => {
    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name])
    );
    const activeUsers = users.filter((user) => !user.banned);

    const toChannelItem = (
      channel: (typeof channels)[number],
      segments: TQuickSwitcherItem['segments']
    ): TQuickSwitcherItem => ({
      key: `channel-${channel.id}`,
      kind: channel.type === ChannelType.VOICE ? 'voice' : 'channel',
      id: channel.id,
      name: channel.name,
      categoryName: channel.categoryId
        ? categoryNames.get(channel.categoryId)
        : undefined,
      segments
    });

    const toUserItem = (
      user: (typeof activeUsers)[number],
      segments: TQuickSwitcherItem['segments']
    ): TQuickSwitcherItem => ({
      key: `user-${user.id}`,
      kind: 'user',
      id: user.id,
      name: user.name,
      segments
    });

    const plain = (name: string) => [{ text: name, matched: false }];

    if (query.trim() === '') {
      const recentItems = recentTargets
        .map((target) => {
          if (target.kind === 'channel') {
            const channel = channels.find((entry) => entry.id === target.id);

            return channel ? toChannelItem(channel, plain(channel.name)) : null;
          }

          const user = activeUsers.find((entry) => entry.id === target.id);

          return user ? toUserItem(user, plain(user.name)) : null;
        })
        .filter((item): item is TQuickSwitcherItem => item !== null);

      if (recentItems.length > 0) {
        return [{ key: 'recents', items: recentItems }];
      }
    }

    const matchAndSort = <TSource>(
      source: TSource[],
      getName: (entry: TSource) => string,
      toItem: (
        entry: TSource,
        segments: TQuickSwitcherItem['segments']
      ) => TQuickSwitcherItem
    ) =>
      source
        .map((entry) => {
          const match = matchName(getName(entry), query);

          return match ? { entry, match } : null;
        })
        .filter(
          (
            candidate
          ): candidate is {
            entry: TSource;
            match: NonNullable<ReturnType<typeof matchName>>;
          } => candidate !== null
        )
        .sort((a, b) => compareMatches(a.match, b.match))
        .slice(0, MAX_ITEMS_PER_GROUP)
        .map(({ entry, match }) => toItem(entry, match.segments));

    const textChannels = channels.filter(
      (channel) => channel.type !== ChannelType.VOICE
    );
    const voiceChannels = channels.filter(
      (channel) => channel.type === ChannelType.VOICE
    );

    const groups: TQuickSwitcherGroup[] = [
      {
        key: 'channels',
        items: matchAndSort(textChannels, (c) => c.name, toChannelItem)
      },
      {
        key: 'voice',
        items: matchAndSort(voiceChannels, (c) => c.name, toChannelItem)
      },
      {
        key: 'users',
        items: matchAndSort(activeUsers, (u) => u.name, toUserItem)
      }
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [categories, channels, query, recentTargets, users]);
};

export { useQuickSwitcherGroups };
