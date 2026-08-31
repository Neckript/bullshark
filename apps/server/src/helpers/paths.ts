import path from 'path';
import {
  IS_DEVELOPMENT,
  IS_TEST,
  SERVER_VERSION,
  SHARKORD_MEDIASOUP_BIN_NAME
} from '../utils/env';
import { getAppDataPath } from './fs';

// Read for this version only: kept so a deployment that already sets the
// old variable doesn't wake up on an empty data directory. Remove once
// operators have had a release to move to BULLSHARK_DATA_PATH.
const LEGACY_DATA_PATH_ENV_VAR = 'SHARKORD_DATA_PATH';

type TDataPathEnv = {
  BULLSHARK_DATA_PATH?: string;
  [LEGACY_DATA_PATH_ENV_VAR]?: string;
};

type TDataPathContext = {
  isTest: boolean;
  isDevelopment: boolean;
  cwd: string;
  appDataPath: string;
  warn: (message: string) => void;
};

type TDataPaths = {
  dataPath: string;
  // The directory the pre-rename server used, as a sibling of the current
  // one under the app data root. Non-null only when the server lands on the
  // default production layout - never in dev/test, and never once an
  // operator has pointed BULLSHARK_DATA_PATH/SHARKORD_DATA_PATH somewhere
  // else, since neither case ever wrote data under this name.
  legacyDataDirCandidate: string | null;
};

const resolveDataPaths = (
  env: TDataPathEnv,
  { isTest, isDevelopment, cwd, appDataPath, warn }: TDataPathContext
): TDataPaths => {
  if (env.BULLSHARK_DATA_PATH) {
    return {
      dataPath: path.resolve(env.BULLSHARK_DATA_PATH),
      legacyDataDirCandidate: null
    };
  }

  const legacyInjectedDataPath = env[LEGACY_DATA_PATH_ENV_VAR];

  if (legacyInjectedDataPath) {
    warn(
      `[Paths] ${LEGACY_DATA_PATH_ENV_VAR} is deprecated and will stop being read in a future version. Set BULLSHARK_DATA_PATH instead.`
    );

    return {
      dataPath: path.resolve(legacyInjectedDataPath),
      legacyDataDirCandidate: null
    };
  }

  if (isTest) {
    return {
      dataPath: path.resolve(cwd, './data-test'),
      legacyDataDirCandidate: null
    };
  }

  if (isDevelopment) {
    return {
      dataPath: path.resolve(cwd, './data'),
      legacyDataDirCandidate: null
    };
  }

  return {
    dataPath: path.join(appDataPath, 'bullshark'),
    legacyDataDirCandidate: path.join(appDataPath, 'sharkord')
  };
};

const { dataPath: DATA_PATH, legacyDataDirCandidate: LEGACY_DATA_DIR_CANDIDATE } =
  resolveDataPaths(process.env, {
    isTest: IS_TEST,
    isDevelopment: IS_DEVELOPMENT,
    cwd: process.cwd(),
    appDataPath: getAppDataPath(),
    warn: console.warn
  });

const getMediasoupBinaryPath = (): string | undefined => {
  if (IS_DEVELOPMENT) {
    return undefined;
  }

  return path.join(
    DATA_PATH,
    'mediasoup',
    SHARKORD_MEDIASOUP_BIN_NAME || 'mediasoup-worker'
  );
};

const MEDIASOUP_BINARY_PATH = getMediasoupBinaryPath();
const DB_PATH = path.join(DATA_PATH, 'db.sqlite');
const LOGS_PATH = path.join(DATA_PATH, 'logs');
const PUBLIC_PATH = path.join(DATA_PATH, 'public');
const TMP_PATH = path.join(DATA_PATH, 'tmp');
const UPLOADS_PATH = path.join(DATA_PATH, 'uploads');
const INTERFACE_PATH = path.resolve(DATA_PATH, 'interface', SERVER_VERSION);
const DRIZZLE_PATH = path.resolve(DATA_PATH, 'drizzle');
const MEDIASOUP_PATH = path.resolve(DATA_PATH, 'mediasoup');
const CONFIG_INI_PATH = path.resolve(DATA_PATH, 'config.ini');
const PLUGINS_PATH = path.join(DATA_PATH, 'plugins');
const SRC_MIGRATIONS_PATH = path.join(process.cwd(), 'src', 'db', 'migrations');

export {
  CONFIG_INI_PATH,
  DATA_PATH,
  DB_PATH,
  DRIZZLE_PATH,
  INTERFACE_PATH,
  LEGACY_DATA_DIR_CANDIDATE,
  LOGS_PATH,
  MEDIASOUP_BINARY_PATH,
  MEDIASOUP_PATH,
  PLUGINS_PATH,
  PUBLIC_PATH,
  resolveDataPaths,
  SRC_MIGRATIONS_PATH,
  TMP_PATH,
  UPLOADS_PATH
};
