import { getTRPCClient } from '@/lib/trpc';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari legacy flag
  (navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const registerServiceWorker =
  async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await navigator.serviceWorker.register('/sw.js');
    } catch {
      return null;
    }
  };

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const getPushState = async (): Promise<
  'unsupported' | 'needs-pwa' | 'denied' | 'subscribed' | 'not-subscribed'
> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return isIos() && !isStandalone() ? 'needs-pwa' : 'unsupported';
  }
  if (isIos() && !isStandalone()) return 'needs-pwa';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'not-subscribed';
};

const subscribeToPush = async (): Promise<boolean> => {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const trpc = getTRPCClient();
  const { publicKey } = await trpc.push.getPublicKey.query();
  if (!publicKey) return false;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await trpc.push.subscribe.mutate({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  });
  return true;
};

const unsubscribeFromPush = async (): Promise<void> => {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const trpc = getTRPCClient();
  await trpc.push.unsubscribe.mutate({ endpoint });
};

export {
  getPushState,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush
};
