import type { TJoinedSettings, TPublicServerSettings } from '@bullshark/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '..';
import { config } from '../../config';
import { signFile } from '../../helpers/files-crypto';
import { files, settings } from '../schema';

// since this is static, we can keep it in memory to avoid querying the DB every time
let token: string;

// getSettings sits on 46 call paths, including every batch of messages and
// every joined user. Measured on this machine: drizzle spends 233us REBUILDING
// the SQL on each call, against 0.5us for the same select prepared - the
// database itself answers in 0.4us. So 99% of the cost here was query
// construction, not the query.
//
// Preparing rather than caching the result on purpose: the statement still
// hits the database every time, so there is nothing to invalidate and no way
// to serve a stale setting - which matters because `new-owner-token` writes to
// this table from a SECOND process while the server is running.
//
// Keyed on `db.$client` rather than kept in a plain variable because the test
// harness swaps in a fresh in-memory database before every test; a statement
// held across that swap would be bound to a closed sqlite handle and every
// test after the first would fail.
const buildStatements = () => ({
  settings: db.select().from(settings).prepare(),
  file: db
    .select()
    .from(files)
    .where(eq(files.id, sql.placeholder('id')))
    .prepare()
});

const statementsByClient = new WeakMap<
  object,
  ReturnType<typeof buildStatements>
>();

const getStatements = () => {
  // $client exists at runtime (drizzle() returns it, and the test proxy
  // forwards it) but is not on the exported BunSQLiteDatabase type. Verified
  // to be a distinct object per test database, which is the whole point.
  const client = (db as unknown as { $client: object }).$client;
  let statements = statementsByClient.get(client);

  if (!statements) {
    statements = buildStatements();
    statementsByClient.set(client, statements);
  }

  return statements;
};

const getSettings = async (): Promise<TJoinedSettings> => {
  const statements = getStatements();
  const serverSettings = await statements.settings.get();

  if (!serverSettings) {
    throw new Error(
      'Server settings not found in database. Something is wrong.'
    );
  }

  if (!token && serverSettings.secretToken) {
    token = serverSettings.secretToken;
  }

  const logo = serverSettings.logoId
    ? await statements.file.get({ id: serverSettings.logoId })
    : undefined;

  const banner = serverSettings.bannerId
    ? await statements.file.get({ id: serverSettings.bannerId })
    : undefined;

  return {
    ...serverSettings,
    logo: logo ?? null,
    banner: banner ?? null
  };
};

const getPublicSettings: () => Promise<TPublicServerSettings> = async () => {
  const settings = await getSettings();

  const publicSettings: TPublicServerSettings = {
    description: settings.description ?? '',
    name: settings.name,
    serverId: settings.serverId,
    storageUploadEnabled: settings.storageUploadEnabled,
    directMessagesEnabled: settings.directMessagesEnabled,
    storageQuota: settings.storageQuota,
    storageUploadMaxFileSize: settings.storageUploadMaxFileSize,
    storageFileSharingInDirectMessages:
      settings.storageFileSharingInDirectMessages,
    storageMaxAvatarSize: settings.storageMaxAvatarSize,
    storageMaxBannerSize: settings.storageMaxBannerSize,
    storageMaxServerBannerSize: settings.storageMaxServerBannerSize,
    storageMaxFilesPerMessage: settings.storageMaxFilesPerMessage,
    storageSpaceQuotaByUser: settings.storageSpaceQuotaByUser,
    storageOverflowAction: settings.storageOverflowAction,
    enablePlugins: settings.enablePlugins,
    webRtcSimulcastEnabled: settings.webRtcSimulcastEnabled,
    webRtcMaxBitrate: config.webRtc.maxBitrate,
    enableSearch: settings.enableSearch,
    showWelcomeDialog: settings.showWelcomeDialog,
    storageSignedUrlsEnabled: settings.storageSignedUrlsEnabled,
    klipyEnabled: !!settings.klipyApiKey,
    banner: signFile(
      settings.banner,
      settings.storageSignedUrlsEnabled,
      settings.storageSignedUrlsTtlSeconds
    )
  };

  return publicSettings;
};

const getServerTokenSync = (): string => {
  if (!token) {
    throw new Error('Server token has not been initialized yet');
  }

  return token;
};

const getServerToken = async (): Promise<string> => {
  if (token) return token;

  const { secretToken } = await getSettings();

  if (!secretToken) {
    throw new Error('Secret token not found in database settings');
  }

  token = secretToken;

  return token;
};

export { getPublicSettings, getServerToken, getServerTokenSync, getSettings };
