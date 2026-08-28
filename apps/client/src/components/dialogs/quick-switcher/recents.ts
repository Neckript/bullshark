import {
  getLocalStorageItemAsJSON,
  LocalStorageKey,
  setLocalStorageItemAsJSON
} from '@/helpers/storage';

type TRecentTargetKind = 'channel' | 'user';

type TRecentTarget = {
  kind: TRecentTargetKind;
  id: number;
};

const MAX_RECENT_TARGETS = 8;

const isRecentTarget = (value: unknown): value is TRecentTarget => {
  if (typeof value !== 'object' || value === null) return false;

  const { kind, id } = value as Record<string, unknown>;

  return (
    (kind === 'channel' || kind === 'user') &&
    typeof id === 'number' &&
    Number.isInteger(id)
  );
};

// Le contenu vient du disque de l'utilisateur : il peut dater d'une version
// antérieure, avoir été édité à la main, ou être corrompu. Rien n'en sort qui
// n'ait été vérifié entrée par entrée.
const sanitizeRecentTargets = (value: unknown): TRecentTarget[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecentTarget)
    .map((target) => ({ kind: target.kind, id: target.id }))
    .slice(0, MAX_RECENT_TARGETS);
};

const pushRecentTarget = (
  list: TRecentTarget[],
  target: TRecentTarget
): TRecentTarget[] =>
  [
    target,
    ...list.filter(
      (entry) => !(entry.kind === target.kind && entry.id === target.id)
    )
  ].slice(0, MAX_RECENT_TARGETS);

const readRecentTargets = (): TRecentTarget[] =>
  sanitizeRecentTargets(
    getLocalStorageItemAsJSON<unknown>(LocalStorageKey.RECENT_TARGETS, [])
  );

const rememberRecentTarget = (target: TRecentTarget): void => {
  setLocalStorageItemAsJSON(
    LocalStorageKey.RECENT_TARGETS,
    pushRecentTarget(readRecentTargets(), target)
  );
};

export {
  MAX_RECENT_TARGETS,
  pushRecentTarget,
  readRecentTargets,
  rememberRecentTarget,
  sanitizeRecentTargets
};
export type { TRecentTarget };
