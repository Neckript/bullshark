import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';
import { isPrivateIP } from './network';

const canonical = (ip: string): string => {
  const parsed = ipaddr.parse(ip);
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().toString();
  }
  return parsed.toString();
};

const hostnameOf = (endpoint: string): string => {
  const url = new URL(endpoint);
  return url.hostname.replace(/^\[|\]$/g, '');
};

// Synchronous checks doable on the URL string alone, no DNS. Enforces plain
// https and refuses an IP-literal host in an internal range (loopback,
// private, link-local, cloud metadata at 169.254.169.254...). Used at the
// API boundary so obvious SSRF endpoints are rejected immediately without a
// network round-trip.
const assertPublicHttpsUrl = (endpoint: string): void => {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('Invalid push endpoint.');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Invalid push endpoint.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (ipaddr.isValid(host) && isPrivateIP(canonical(host))) {
    throw new Error('Invalid push endpoint.');
  }
};

// Full check including DNS resolution. Use it where the request is actually
// made (web-push delivery): a hostname is resolved and every address it maps
// to must be public, so a name that points at the internal network - now or
// later via DNS rebinding, since this runs again at send time - is refused.
// Vendor-neutral on purpose: no push provider is hard-coded, so a
// self-hosted/sovereign push service keeps working.
const assertSafePushEndpoint = async (endpoint: string): Promise<void> => {
  assertPublicHttpsUrl(endpoint);

  const host = hostnameOf(endpoint);

  // an IP literal was already range-checked by assertPublicHttpsUrl
  if (ipaddr.isValid(host)) {
    return;
  }

  let addresses: { address: string }[];

  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Invalid push endpoint.');
  }

  if (
    addresses.length === 0 ||
    addresses.some((entry) => isPrivateIP(canonical(entry.address)))
  ) {
    throw new Error('Invalid push endpoint.');
  }
};

export { assertPublicHttpsUrl, assertSafePushEndpoint };
