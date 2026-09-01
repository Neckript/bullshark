// these values are injected at build time
const BULLSHARK_ENV = process.env.BULLSHARK_ENV;
const BULLSHARK_BUILD_VERSION = process.env.BULLSHARK_BUILD_VERSION;
const BULLSHARK_BUILD_DATE = process.env.BULLSHARK_BUILD_DATE;
const BULLSHARK_MEDIASOUP_BIN_NAME = process.env.BULLSHARK_MEDIASOUP_BIN_NAME;

const SERVER_VERSION =
  typeof BULLSHARK_BUILD_VERSION !== 'undefined'
    ? BULLSHARK_BUILD_VERSION
    : '0.1.0-alpha';

const BUILD_DATE =
  typeof BULLSHARK_BUILD_DATE !== 'undefined' ? BULLSHARK_BUILD_DATE : 'dev';

const env = typeof BULLSHARK_ENV !== 'undefined' ? BULLSHARK_ENV : 'development';
const IS_PRODUCTION = env === 'production';
const IS_DEVELOPMENT = !IS_PRODUCTION;
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_E2E = process.env.IS_E2E === 'true';
const IS_DOCKER = process.env.RUNNING_IN_DOCKER === 'true';

if (IS_PRODUCTION) {
  if (!BULLSHARK_MEDIASOUP_BIN_NAME) {
    throw new Error('BULLSHARK_MEDIASOUP_BIN is not defined');
  }
}

export {
  BUILD_DATE,
  IS_DEVELOPMENT,
  IS_DOCKER,
  IS_E2E,
  IS_PRODUCTION,
  IS_TEST,
  SERVER_VERSION,
  BULLSHARK_MEDIASOUP_BIN_NAME
};
