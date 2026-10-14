import { WifiOff } from 'lucide-react';
import { memo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

// Une coupure courte ne ferme pas le socket avant le prochain ping (30 s) :
// rien d'autre ne previent l'utilisateur. Le navigateur, lui, le sait tout de
// suite quand l'appareil perd le reseau.
const OfflineBanner = memo(() => {
  const { t } = useTranslation('disconnected');
  const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-destructive/15 px-4 py-1.5 text-sm text-destructive"
    >
      <WifiOff className="h-4 w-4" />
      {t('offline')}
    </div>
  );
});

export { OfflineBanner };
