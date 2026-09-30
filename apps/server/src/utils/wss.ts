import {
  ActivityLogType,
  ChannelPermission,
  getErrorMessage,
  OWNER_ROLE_ID,
  Permission,
  ServerEvents,
  UserStatus,
  type DisconnectCode,
  type TConnectionParams
} from '@bullshark/shared';
import { TRPCError } from '@trpc/server';
import {
  applyWSSHandler,
  type CreateWSSContextFnOptions
} from '@trpc/server/adapters/ws';
import { eq } from 'drizzle-orm';
import http from 'http';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { db } from '../db';
import { getAllChannelUserPermissions } from '../db/queries/channels';
import { isUserDmParticipant } from '../db/queries/dms';
import { getUserById, getUserByToken } from '../db/queries/users';
import { channels } from '../db/schema';
import { getWsInfo } from '../helpers/get-ws-info';
import { logger } from '../logger';
import { enqueueActivityLog } from '../queues/activity-log';
import { appRouter } from '../routers';
import { getUserRoles } from '../routers/users/get-user-roles';
import { VoiceRuntime } from '../runtimes/voice';
import { invariant } from './invariant';
import { pubsub } from './pubsub';
import type { Context } from './trpc';

let wss: WebSocketServer | undefined;

const usersIpMap = new Map<number, string>();

const getUserIp = (userId: number): string | undefined => {
  return usersIpMap.get(userId);
};

const getOnlineUserIds = (): number[] => {
  if (!wss) return [];

  const userIdSet = new Set<number>();

  wss.clients.forEach((client) => {
    if (client.userId) {
      userIdSet.add(client.userId);
    }
  });

  return Array.from(userIdSet);
};

// takes the client set instead of reading `wss` so it can be tested without a
// live WebSocket server
const closeUserSockets = (
  clients: Iterable<WebSocket>,
  userId: number,
  code: DisconnectCode,
  reason?: string
) => {
  const sockets = Array.from(clients).filter(
    (client) => client.userId === userId
  );

  for (const socket of sockets) {
    socket.close(code, reason);
  }

  return sockets.length;
};

const createContext = async ({
  info,
  req
}: CreateWSSContextFnOptions): Promise<Context> => {
  const { token } = info.connectionParams as TConnectionParams;

  const decodedUser = await getUserByToken(token);

  invariant(decodedUser, {
    code: 'UNAUTHORIZED',
    message: 'Invalid authentication token'
  });

  invariant(!decodedUser.banned, {
    code: 'FORBIDDEN',
    message: 'User is banned'
  });

  const hasPermission = async (targetPermission: Permission | Permission[]) => {
    const user = await getUserById(decodedUser.id);

    if (!user) return false;

    const roles = await getUserRoles(user.id);

    const hasOwnerRole = roles.some((r) => r.id === OWNER_ROLE_ID);

    if (hasOwnerRole) return true; // owner always has all permissions

    const permissionsSet = new Set<Permission>();

    for (const role of roles) {
      for (const permission of role.permissions) {
        permissionsSet.add(permission);
      }
    }

    if (Array.isArray(targetPermission)) {
      return targetPermission.every((p) => permissionsSet.has(p));
    }

    return permissionsSet.has(targetPermission);
  };

  const hasChannelPermission = async (
    channelId: number,
    targetPermission: ChannelPermission
  ) => {
    const channel = await db
      .select({
        private: channels.private,
        isDm: channels.isDm
      })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)
      .get();

    if (!channel) return false;

    if (channel.isDm) {
      const isParticipant = await isUserDmParticipant(
        channelId,
        decodedUser.id
      );

      if (isParticipant) return true;
    }

    if (!channel.private) return true;

    const user = await getUserById(decodedUser.id);

    if (!user) return false;

    const roles = await getUserRoles(user.id);

    const hasOwnerRole = roles.some((r) => r.id === OWNER_ROLE_ID);

    if (hasOwnerRole) return true; // owner always has all permissions

    const userChannelPermissions = await getAllChannelUserPermissions(
      decodedUser.id
    );

    const channelInfo = userChannelPermissions[channelId];

    if (!channelInfo) return false;
    if (!channelInfo.permissions[ChannelPermission.VIEW_CHANNEL]) return false;

    return channelInfo.permissions[targetPermission] === true;
  };

  const getOwnWs = () => {
    if (!wss) return undefined;
    return Array.from(wss.clients).find((client) => client.token === token);
  };

  // closes every session the user holds and returns how many were closed: a
  // user with several tabs or devices must not keep one alive after a ban, a
  // kick or an account deletion
  const disconnectUser = (
    userId: number,
    code: DisconnectCode,
    reason?: string
  ) => {
    if (!wss) return 0;

    return closeUserSockets(wss.clients, userId, code, reason);
  };

  const getStatusById = (userId: number) => {
    if (!wss) return UserStatus.OFFLINE;

    const isConnected = Array.from(wss.clients).some(
      (ws) => ws.userId === userId
    );

    return isConnected ? UserStatus.ONLINE : UserStatus.OFFLINE;
  };

  const setWsUserId = (userId: number) => {
    if (!wss) return;

    const ws = Array.from(wss.clients).find((client) => client.token === token);

    if (ws) {
      ws.userId = userId;
    }
  };

  const getConnectionInfo = () => {
    if (!wss) return getWsInfo(undefined, req);

    const ws = Array.from(wss.clients).find((client) => client.token === token);

    if (!ws) return undefined;

    return getWsInfo(ws, req);
  };

  const needsPermission = async (
    targetPermission: Permission | Permission[]
  ) => {
    invariant(await hasPermission(targetPermission), {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions'
    });
  };

  const needsChannelPermission = async (
    channelId: number,
    targetPermission: ChannelPermission
  ) => {
    invariant(await hasChannelPermission(channelId, targetPermission), {
      code: 'FORBIDDEN',
      message: 'Insufficient channel permissions'
    });
  };

  const throwValidationError = (field: string, message: string) => {
    // this mimics the zod validation error format
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: JSON.stringify([
        {
          code: 'custom',
          path: [field],
          message
        }
      ])
    });
  };

  const saveUserIp = async (userId: number, ip: string) => {
    usersIpMap.set(userId, ip);
  };

  return {
    pubsub,
    token,
    user: decodedUser,
    authenticated: false,
    userId: decodedUser.id,
    handshakeHash: '',
    currentVoiceChannelId: undefined,
    hasPermission,
    needsPermission,
    hasChannelPermission,
    needsChannelPermission,
    getOwnWs,
    getStatusById,
    setWsUserId,
    disconnectUser,
    getConnectionInfo,
    throwValidationError,
    saveUserIp
  };
};

const createWsServer = async (server: http.Server | https.Server) => {
  return new Promise<WebSocketServer>((resolve) => {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      try {
        ws.userId = undefined;
        ws.token = '';

        ws.once('message', async (message) => {
          try {
            const parsed = JSON.parse(message.toString());
            const { token } = parsed.data as TConnectionParams;

            ws.token = token;
          } catch (error) {
            logger.error(
              'Failed to parse initial WebSocket message: %s',
              getErrorMessage(error)
            );
          }
        });

        ws.on('close', async () => {
          try {
            const userId = ws.userId;

            // ignore connections that never authenticated through joinServer
            if (!userId) {
              return;
            }

            // only mark as offline when there are no other active sessions
            const hasOtherSessions = Array.from(wss?.clients ?? []).some(
              (client) =>
                client !== ws &&
                client.userId === userId &&
                client.readyState === WebSocket.OPEN
            );

            if (hasOtherSessions) {
              return;
            }

            // this runs before the user row is looked up: delete-user now
            // disconnects after the row is gone, and that session still has to
            // be removed from voice and from the presence list
            const voiceRuntime = VoiceRuntime.findRuntimeByUserId(userId);

            if (voiceRuntime) {
              voiceRuntime.removeUser(userId);

              pubsub.publish(ServerEvents.USER_LEAVE_VOICE, {
                channelId: voiceRuntime.id,
                userId
              });
            }

            usersIpMap.delete(userId);
            pubsub.publish(ServerEvents.USER_LEAVE, userId);

            const user = await getUserById(userId);

            // the activity log has a foreign key on the user, so a deleted
            // account gets no USER_LEFT entry
            if (!user) return;

            logger.info('%s left the server', user.name);

            enqueueActivityLog({
              type: ActivityLogType.USER_LEFT,
              userId: user.id
            });
          } catch (error) {
            logger.error(
              `Error occurred while handling WebSocket close: ${getErrorMessage(error)}`
            );
          }
        });

        ws.on('error', (err) => {
          logger.error('WebSocket client error:', err);
        });
      } catch (error) {
        logger.error(
          `Error occurred while handling WebSocket connection: ${getErrorMessage(error)}`
        );
      }
    });

    wss.on('close', () => {
      logger.debug('WebSocket server closed');
    });

    wss.on('error', (err) => {
      logger.error('WebSocket server error: %s', getErrorMessage(err));
    });

    applyWSSHandler({
      wss,
      router: appRouter,
      createContext,
      keepAlive: {
        enabled: true,
        pingMs: 30_000,
        pongWaitMs: 5_000
      }
    });

    resolve(wss);
  });
};

export {
  closeUserSockets,
  createContext,
  createWsServer,
  getOnlineUserIds,
  getUserIp
};
