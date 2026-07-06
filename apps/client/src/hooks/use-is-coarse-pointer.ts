import { useSyncExternalStore } from 'react';

const query = '(pointer: coarse)';

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};

const useIsCoarsePointer = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);

export { useIsCoarsePointer };
