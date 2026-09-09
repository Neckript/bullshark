import type { TFile } from '@bullshark/shared';

const getHostFromServer = () => {
  if (import.meta.env.MODE === 'development') {
    return 'localhost:4991';
  }

  return window.location.host;
};

const getUrlFromServer = () => {
  if (import.meta.env.MODE === 'development') {
    // set VITE_DEV_SERVER_PROTOCOL=https when running the server with
    // BULLSHARK_TLS_MODE=selfSigned locally, defaults to plain http otherwise
    const protocol = import.meta.env.VITE_DEV_SERVER_PROTOCOL || 'http';

    return `${protocol}://localhost:4991`;
  }

  const host = window.location.host;
  const currentProtocol = window.location.protocol;

  const finalUrl = `${currentProtocol}//${host}`;

  return finalUrl;
};

const getFileUrl = (file: TFile | undefined | null) => {
  if (!file) return '';

  const url = getUrlFromServer();

  let baseUrl = `${url}/public/${file.name}`;

  if (file._accessToken) {
    baseUrl += `?accessToken=${file._accessToken}`;

    if (file._accessTokenExpiresAt) {
      baseUrl += `&expires=${file._accessTokenExpiresAt}`;
    }
  }

  return encodeURI(baseUrl);
};

export { getFileUrl, getHostFromServer, getUrlFromServer };
