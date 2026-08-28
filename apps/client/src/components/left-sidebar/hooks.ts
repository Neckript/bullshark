import { useAutoJoinLastChannel } from '@/features/app/hooks';
import {
  selectChannel,
  setSelectedChannelId
} from '@/features/server/channels/actions';
import { useChannelsMap } from '@/features/server/channels/hooks';
import { getLocalStorageItemAsJSON, LocalStorageKey } from '@/helpers/storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

const loadExpandedValue = (categoryId: number): boolean => {
  const expandedMap = getLocalStorageItemAsJSON<Record<number, boolean>>(
    LocalStorageKey.CATEGORIES_EXPANDED,
    {}
  );

  return expandedMap?.[categoryId] ?? true;
};

const saveExpandedValue = (categoryId: number, expanded: boolean): void => {
  const expandedMap = getLocalStorageItemAsJSON<Record<number, boolean>>(
    LocalStorageKey.CATEGORIES_EXPANDED,
    {}
  );

  const newExpandedMap = {
    ...expandedMap,
    [categoryId]: expanded
  };

  localStorage.setItem(
    LocalStorageKey.CATEGORIES_EXPANDED,
    JSON.stringify(newExpandedMap)
  );
};

const useCategoryExpanded = (categoryId: number) => {
  const [expanded, setExpanded] = useState(loadExpandedValue(categoryId));

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const newValue = !prev;

      saveExpandedValue(categoryId, newValue);

      return newValue;
    });
  }, [categoryId]);

  return useMemo(
    () => ({ expanded, toggleExpanded }),
    [expanded, toggleExpanded]
  );
};

const useSelectChannel = () => {
  const autoJoinLastChannel = useAutoJoinLastChannel();
  const channelsMap = useChannelsMap();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pushChannelId = Number(params.get('channelId'));

    if (pushChannelId > 0) {
      const pushChannel = channelsMap[pushChannelId];

      window.history.replaceState({}, '', '/');

      if (pushChannel) {
        setSelectedChannelId(pushChannel.id);
        localStorage.setItem(
          LocalStorageKey.LAST_SELECTED_CHANNEL,
          pushChannel.id.toString()
        );

        return;
      }
    }

    if (!autoJoinLastChannel) return;

    const lastSelectedChannelId = localStorage.getItem(
      LocalStorageKey.LAST_SELECTED_CHANNEL
    );

    if (lastSelectedChannelId) {
      const channelId = parseInt(lastSelectedChannelId, 10);
      const lastChannel = channelsMap[channelId];

      if (lastChannel) {
        setSelectedChannelId(channelId);
      }
    }
  }, [channelsMap, autoJoinLastChannel]);

  return selectChannel;
};

export { useCategoryExpanded, useSelectChannel };
