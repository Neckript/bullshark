import { getVoiceControlsBridge } from '@/components/voice-provider/controls-bridge';
import { assertVoiceChatClose } from '@/features/app/actions';
import { store } from '@/features/store';
import { LocalStorageKey, setLocalStorageItem } from '@/helpers/storage';
import {
  ChannelType,
  type TChannel,
  type TChannelUserPermissionsMap
} from '@sharkord/shared';
import { markChannelAsRead } from '../actions';
import { serverSliceActions } from '../slice';
import {
  channelByIdSelector,
  channelReadStateByIdSelector,
  channelsMapSelector,
  currentVoiceChannelIdSelector,
  isChannelTextVisibleByIdSelector,
  selectedChannelIdSelector
} from './selectors';

export const setChannels = (channels: TChannel[]) => {
  store.dispatch(serverSliceActions.setChannels(channels));
};

export const setSelectedChannelId = (channelId: number | undefined) => {
  store.dispatch(serverSliceActions.setSelectedChannelId(channelId));

  if (!channelId) {
    return;
  }

  const state = store.getState();
  const unreadCount = channelReadStateByIdSelector(state, channelId);

  if (
    unreadCount === 0 ||
    !isChannelTextVisibleByIdSelector(state, channelId)
  ) {
    return;
  }

  markChannelAsRead(channelId);
};

export const setCurrentVoiceChannelId = (channelId: number | undefined) =>
  store.dispatch(serverSliceActions.setCurrentVoiceChannelId(channelId));

export const addChannel = (channel: TChannel) => {
  store.dispatch(serverSliceActions.addChannel(channel));
};

export const updateChannel = (
  channelId: number,
  channel: Partial<TChannel>
) => {
  store.dispatch(serverSliceActions.updateChannel({ channelId, channel }));
};

export const removeChannel = (channelId: number) => {
  store.dispatch(serverSliceActions.removeChannel({ channelId }));

  assertVoiceChatClose(channelId);
};

export const setChannelPermissions = (
  permissions: TChannelUserPermissionsMap
) => {
  store.dispatch(serverSliceActions.setChannelPermissions(permissions));

  const state = store.getState();
  const selectedChannel = selectedChannelIdSelector(state);

  if (!selectedChannel) return;

  const channel = channelByIdSelector(state, selectedChannel || -1);

  if (!channel?.private) return;

  // user is in a channel that is private, so we need to check if their permissions changed
  const canViewChannel =
    permissions[selectedChannel]?.permissions['VIEW_CHANNEL'] === true;

  if (!canViewChannel) {
    // user lost VIEW_CHANNEL permission, deselect the channel
    setSelectedChannelId(undefined);
    assertVoiceChatClose(selectedChannel);
  }
};

export const setChannelReadState = (
  channelId: number,
  payload: {
    count?: number;
    delta?: number;
  }
) => {
  const state = store.getState();
  const currentCount = channelReadStateByIdSelector(state, channelId);

  let nextCount: number | undefined;

  if (typeof payload.count === 'number') {
    nextCount = payload.count;
  } else if (typeof payload.delta === 'number') {
    nextCount = Math.max(0, currentCount + payload.delta);
  }

  let actualCount = nextCount;

  const shouldResetCount = isChannelTextVisibleByIdSelector(state, channelId);

  // if the channel is currently selected, set the read count to 0
  if (shouldResetCount) {
    actualCount = 0;

    // we also need to notify the server that the channel has been read
    // otherwise the count will be wrong when the user joins the server again
    // we can't do it here to avoid infinite loops
  }

  store.dispatch(
    serverSliceActions.setChannelReadState({ channelId, count: actualCount })
  );
};

export const selectChannel = async (channelId: number) => {
  const state = store.getState();
  const channel = channelsMapSelector(state)[channelId];

  if (!channel) return;

  // La vue affiche le salon pendant que le vocal se connecte : poser la
  // sélection avant toute attente réseau, comme le faisait useSelectChannel.
  setSelectedChannelId(channel.id);

  if (channel.type !== ChannelType.VOICE) {
    // persist selected channel for non-voice channels
    setLocalStorageItem(
      LocalStorageKey.LAST_SELECTED_CHANNEL,
      channel.id.toString()
    );

    return;
  }

  if (currentVoiceChannelIdSelector(state) === channel.id) return;

  // Pont absent = on n'est pas dans la vue serveur, donc il n'y a pas de vocal
  // à rejoindre. Même sémantique silencieuse que les raccourcis de coupure.
  await getVoiceControlsBridge()?.joinChannel(channel.id);
};
