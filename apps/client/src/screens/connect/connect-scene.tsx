import { memo } from 'react';

// Les deux halos sont dérivés de --primary : la scène est donc juste dans les
// 7 thèmes, thème utilisateur compris. Aucune couleur en dur ici.
const ConnectScene = memo(() => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 overflow-hidden"
  >
    <div className="connect-halo connect-halo-a absolute -left-40 -top-56 h-[38rem] w-[38rem] rounded-full blur-[120px]" />
    <div className="connect-halo connect-halo-b absolute -bottom-64 -right-40 h-[34rem] w-[34rem] rounded-full blur-[120px]" />
  </div>
));

export { ConnectScene };
