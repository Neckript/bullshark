# Sélecteur rapide (Ctrl+K) — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent la syntaxe case à cocher (`- [ ]`).

**But :** rendre `Ctrl+K` à une palette de navigation instantanée (salons,
vocaux, personnes) et déplacer la recherche de contenu sur `Ctrl+Maj+F`.

**Architecture :** un dialogue de plus dans le registre existant, alimenté
uniquement par le magasin Redux déjà chargé — donc aucune requête réseau à
l'ouverture. Deux modules purs (correspondance floue, récents) testés en
`bun test`, un hook de résultats, un composant de ligne qui porte ses propres
hooks par salon, et deux liaisons clavier centralisées dans le contrôleur de
raccourcis déjà en place. Deux refactorings préalables rendent la chose
possible : extraire la sélection de salon du hook qui porte aussi un effet
d'amorçage, et étendre le pont vocal parce qu'un dialogue est monté hors du
fournisseur vocal.

**Pile :** React 19, Redux Toolkit, re-reselect, Tailwind 4.2.1, `@sharkord/ui`
(Radix), i18next (7 locales), `bun test`, Playwright.

**Spec :** `docs/superpowers/specs/2026-08-28-quick-switcher-design.md`

## Contraintes globales

- Branche `feat/quick-switcher`, base `main` = `f757827`.
- Prettier du client : `singleQuote: true`, `trailingComma: "none"`,
  `printWidth: 80`, `semi: true`. La CI casse sur `format:check` — le lancer
  avant chaque commit.
- Portes à zéro erreur avant chaque commit :
  `bun run format:check`, `bun run check-types`, `bun run lint`.
- Aucune dépendance nouvelle. Pas de `cmdk`.
- Aucune requête réseau à l'ouverture de la palette. La seule requête du
  chantier est `trpc.dms.open`, au moment du `↵` sur une personne.
- Interdit sous `components/dialogs/` : `useVoice()`. `DialogsProvider` est
  monté hors de `VoiceProvider`, l'appel renverrait un contexte par défaut dont
  `init` est une promesse vide — échec silencieux, types verts.
- Tout texte affiché passe par i18next, dans les **7** locales :
  `cs, en, es, fr, it, ru, zh`.
- Le mouvement utilise les jetons du chantier 2 : `duration-fast`, `ease-out`.
  Ne pas écrire de durée en dur.

---

### Tâche 1 : correspondance floue (module pur)

**Fichiers :**

- Créer : `apps/client/src/components/dialogs/quick-switcher/matching.ts`
- Créer :
  `apps/client/src/components/dialogs/quick-switcher/__tests__/matching.test.ts`
- Modifier : `apps/client/package.json` (ajouter le script `test`)

**Interfaces :**

- Consomme : rien.
- Produit : `type TMatch`, `matchName(name: string, query: string): TMatch | null`,
  `compareMatches(a: TMatch, b: TMatch): number`. `TMatch` porte
  `score: number`, `spread: number` et
  `segments: { text: string; matched: boolean }[]`.

Le client n'a aujourd'hui **aucun test unitaire** ; seul `apps/server` a un
script `test`. Cette tâche ouvre la capacité, avec le même outil (`bun test`) et
la même convention de dossier (`__tests__/`) que le serveur.

- [ ] **Étape 1 : ouvrir la capacité de test du client**

Dans `apps/client/package.json`, ajouter dans `"scripts"`, après
`"check-types"` :

```json
    "test": "bun test",
```

Le `test` de la racine est `bun run --filter '*' test` : le nouveau script est
donc ramassé automatiquement.

- [ ] **Étape 2 : écrire le test qui échoue**

Créer
`apps/client/src/components/dialogs/quick-switcher/__tests__/matching.test.ts` :

```ts
import { describe, expect, test } from 'bun:test';
import { compareMatches, matchName } from '../matching';

describe('matchName', () => {
  test('renvoie null quand une lettre manque', () => {
    expect(matchName('annonces', 'zz')).toBeNull();
  });

  test('trouve une sous-séquence dispersée', () => {
    const match = matchName('général', 'gnl');

    expect(match).not.toBeNull();
    expect(match!.score).toBe(1);
  });

  test('ignore les diacritiques des deux côtés', () => {
    const match = matchName('général', 'general');

    expect(match).not.toBeNull();
    expect(match!.score).toBe(4);
  });

  test('note un préfixe au-dessus d une occurrence interne', () => {
    const prefix = matchName('general', 'gen');
    const inside = matchName('bugs-et-idees', 'idee');

    expect(prefix!.score).toBe(3);
    expect(inside!.score).toBe(2);
  });

  test('une requête vide correspond à tout, sans surlignage', () => {
    const match = matchName('général', '');

    expect(match).not.toBeNull();
    expect(match!.score).toBe(0);
    expect(match!.segments).toEqual([{ text: 'général', matched: false }]);
  });

  test('découpe le nom en segments surlignés et neutres', () => {
    const match = matchName('général', 'gen');

    expect(match!.segments).toEqual([
      { text: 'gen', matched: true },
      { text: 'éral', matched: false }
    ]);
  });

  test('les segments conservent les accents du nom d origine', () => {
    const match = matchName('général', 'gé');

    expect(match!.segments[0]).toEqual({ text: 'gé', matched: true });
  });

  test('l écart ne compte que les lettres de la requête', () => {
    const contiguous = matchName('general', 'gen');
    const scattered = matchName('general', 'gnl');

    expect(contiguous!.spread).toBe(0);
    expect(scattered!.spread).toBeGreaterThan(0);
  });
});

describe('compareMatches', () => {
  test('le meilleur score passe devant', () => {
    const a = matchName('general', 'gen')!;
    const b = matchName('bugs-et-idees', 'ges')!;

    expect(compareMatches(a, b)).toBeLessThan(0);
  });

  test('à score égal, le plus resserré passe devant', () => {
    const tight = matchName('general', 'gnr')!;
    const loose = matchName('gestionnaire', 'gnr')!;

    expect(compareMatches(tight, loose)).toBeLessThan(0);
  });
});
```

- [ ] **Étape 3 : vérifier que le test échoue**

Lancer : `cd apps/client && bun test src/components/dialogs/quick-switcher`
Attendu : ÉCHEC, `Cannot find module '../matching'`.

- [ ] **Étape 4 : écrire l'implémentation**

Créer `apps/client/src/components/dialogs/quick-switcher/matching.ts` :

```ts
type TMatchSegment = {
  text: string;
  matched: boolean;
};

type TMatch = {
  score: number;
  spread: number;
  segments: TMatchSegment[];
};

// Score, du plus fort au plus faible : 4 nom exact, 3 préfixe, 2 occurrence
// contiguë interne, 1 sous-séquence dispersée, 0 requête vide.
const SCORE_EXACT = 4;
const SCORE_PREFIX = 3;
const SCORE_CONTIGUOUS = 2;
const SCORE_SUBSEQUENCE = 1;
const SCORE_EMPTY = 0;

// Le serveur est francophone et le client parle 7 langues : « general » doit
// trouver « général ». La décomposition NFD sépare la lettre de son accent, la
// plage ̀-ͯ retire les accents ainsi isolés.
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const toSegments = (name: string, indexes: number[]): TMatchSegment[] => {
  const segments: TMatchSegment[] = [];
  const matchedIndexes = new Set(indexes);

  for (let index = 0; index < name.length; index++) {
    const matched = matchedIndexes.has(index);
    const last = segments[segments.length - 1];

    if (last && last.matched === matched) {
      last.text += name[index];

      continue;
    }

    segments.push({ text: name[index]!, matched });
  }

  return segments;
};

const scoreOf = (name: string, query: string) => {
  if (name === query) return SCORE_EXACT;
  if (name.startsWith(query)) return SCORE_PREFIX;
  if (name.includes(query)) return SCORE_CONTIGUOUS;

  return SCORE_SUBSEQUENCE;
};

const matchName = (name: string, query: string): TMatch | null => {
  if (query.trim() === '') {
    return {
      score: SCORE_EMPTY,
      spread: 0,
      segments: [{ text: name, matched: false }]
    };
  }

  const normalizedName = normalize(name);
  const normalizedQuery = normalize(query.trim());
  const indexes: number[] = [];

  let cursor = 0;

  // La normalisation NFD peut allonger la chaîne ; on avance donc sur le nom
  // normalisé et on retient des index qui n'ont de sens que sur lui. Ils sont
  // reprojetés sur le nom d'origine plus bas, caractère par caractère.
  for (let index = 0; index < normalizedName.length; index++) {
    if (cursor < normalizedQuery.length &&
        normalizedName[index] === normalizedQuery[cursor]) {
      indexes.push(index);
      cursor++;
    }
  }

  if (cursor < normalizedQuery.length) return null;

  const first = indexes[0]!;
  const last = indexes[indexes.length - 1]!;
  const spread = last - first - (normalizedQuery.length - 1);

  return {
    score: scoreOf(normalizedName, normalizedQuery),
    spread,
    segments: toSegments(name, indexes)
  };
};

const compareMatches = (a: TMatch, b: TMatch) =>
  b.score - a.score || a.spread - b.spread;

export { compareMatches, matchName };
export type { TMatch, TMatchSegment };
```

**Attention à la reprojection des index.** `normalize()` peut changer la
longueur de la chaîne (`'é'` en NFD fait deux unités). Si un test montre des
segments décalés sur un nom accentué, corriger en construisant, avant la
boucle, une table qui associe chaque index du nom normalisé à l'index du
caractère d'origine dont il provient :

```ts
const buildIndexMap = (name: string) => {
  const map: number[] = [];

  for (let index = 0; index < name.length; index++) {
    const normalizedChar = normalize(name[index]!);

    for (let inner = 0; inner < normalizedChar.length; inner++) {
      map.push(index);
    }
  }

  return map;
};
```

`normalizedName` devient alors la concaténation des `normalize(name[i])`, et
`toSegments(name, indexes.map((index) => map[index]!))` reçoit des index du nom
d'origine. Le test « les segments conservent les accents » existe exactement
pour forcer cette question.

- [ ] **Étape 5 : vérifier que les tests passent**

Lancer : `cd apps/client && bun test src/components/dialogs/quick-switcher`
Attendu : 10 tests au vert.

- [ ] **Étape 6 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/package.json apps/client/src/components/dialogs/quick-switcher
git commit -m "feat(client): correspondance floue du sélecteur rapide"
```

---

### Tâche 2 : mémoire des récents (module pur)

**Fichiers :**

- Créer : `apps/client/src/components/dialogs/quick-switcher/recents.ts`
- Créer :
  `apps/client/src/components/dialogs/quick-switcher/__tests__/recents.test.ts`
- Modifier : `apps/client/src/helpers/storage.ts` (une clé de plus)

**Interfaces :**

- Consomme : `getLocalStorageItemAsJSON`, `setLocalStorageItemAsJSON`,
  `LocalStorageKey` de `@/helpers/storage`.
- Produit : `type TRecentTarget = { kind: 'channel' | 'user'; id: number }`,
  `pushRecentTarget(list, target): TRecentTarget[]`,
  `sanitizeRecentTargets(value: unknown): TRecentTarget[]`,
  `readRecentTargets(): TRecentTarget[]`,
  `rememberRecentTarget(target: TRecentTarget): void`.

Les deux fonctions testées sont pures : `bun test` n'a pas de `localStorage`,
et la couche de stockage se réduit à deux lignes qui appellent des helpers déjà
protégés par `try/catch` (les navigateurs durcis lèvent `SecurityError`).

- [ ] **Étape 1 : ajouter la clé de stockage**

Dans `apps/client/src/helpers/storage.ts`, ajouter dans `enum LocalStorageKey`,
après `HIDE_OWN_SCREEN_SHARE` :

```ts
  RECENT_TARGETS = 'sharkord-recent-targets'
```

Ne pas oublier la virgule sur la ligne précédente.

- [ ] **Étape 2 : écrire le test qui échoue**

Créer
`apps/client/src/components/dialogs/quick-switcher/__tests__/recents.test.ts` :

```ts
import { describe, expect, test } from 'bun:test';
import {
  MAX_RECENT_TARGETS,
  pushRecentTarget,
  sanitizeRecentTargets
} from '../recents';

describe('pushRecentTarget', () => {
  test('met la cible en tête', () => {
    const list = pushRecentTarget([{ kind: 'channel', id: 1 }], {
      kind: 'user',
      id: 7
    });

    expect(list[0]).toEqual({ kind: 'user', id: 7 });
  });

  test('déduplique sans laisser l ancienne position', () => {
    const list = pushRecentTarget(
      [
        { kind: 'channel', id: 1 },
        { kind: 'channel', id: 2 }
      ],
      { kind: 'channel', id: 2 }
    );

    expect(list).toEqual([
      { kind: 'channel', id: 2 },
      { kind: 'channel', id: 1 }
    ]);
  });

  test('un salon et une personne de même id sont deux cibles', () => {
    const list = pushRecentTarget([{ kind: 'channel', id: 3 }], {
      kind: 'user',
      id: 3
    });

    expect(list).toHaveLength(2);
  });

  test('plafonne la liste', () => {
    let list: ReturnType<typeof pushRecentTarget> = [];

    for (let id = 1; id <= MAX_RECENT_TARGETS + 4; id++) {
      list = pushRecentTarget(list, { kind: 'channel', id });
    }

    expect(list).toHaveLength(MAX_RECENT_TARGETS);
    expect(list[0]).toEqual({
      kind: 'channel',
      id: MAX_RECENT_TARGETS + 4
    });
  });
});

describe('sanitizeRecentTargets', () => {
  test('rejette ce qui n est pas un tableau', () => {
    expect(sanitizeRecentTargets({ kind: 'channel', id: 1 })).toEqual([]);
    expect(sanitizeRecentTargets(null)).toEqual([]);
  });

  test('écarte les entrées mal formées et garde les bonnes', () => {
    const list = sanitizeRecentTargets([
      { kind: 'channel', id: 1 },
      { kind: 'salon', id: 2 },
      { kind: 'user', id: 'trois' },
      { id: 4 },
      { kind: 'user', id: 5 }
    ]);

    expect(list).toEqual([
      { kind: 'channel', id: 1 },
      { kind: 'user', id: 5 }
    ]);
  });

  test('applique aussi le plafond', () => {
    const stored = Array.from({ length: MAX_RECENT_TARGETS + 3 }, (_, i) => ({
      kind: 'channel' as const,
      id: i + 1
    }));

    expect(sanitizeRecentTargets(stored)).toHaveLength(MAX_RECENT_TARGETS);
  });
});
```

- [ ] **Étape 3 : vérifier que le test échoue**

Lancer : `cd apps/client && bun test src/components/dialogs/quick-switcher`
Attendu : ÉCHEC, `Cannot find module '../recents'`.

- [ ] **Étape 4 : écrire l'implémentation**

Créer `apps/client/src/components/dialogs/quick-switcher/recents.ts` :

```ts
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
```

Si la signature de `getLocalStorageItemAsJSON` refuse le paramètre de type
`unknown`, lire sa déclaration dans `helpers/storage.ts` et s'y conformer
plutôt que de la modifier — d'autres appelants en dépendent.

- [ ] **Étape 5 : vérifier que les tests passent**

Lancer : `cd apps/client && bun test src/components/dialogs/quick-switcher`
Attendu : les 10 tests de la tâche 1 plus 7 nouveaux, tous verts.

- [ ] **Étape 6 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/src/helpers/storage.ts apps/client/src/components/dialogs/quick-switcher
git commit -m "feat(client): mémoire des cibles récentes du sélecteur rapide"
```

---

### Tâche 3 : rendre la sélection de salon appelable hors du fournisseur vocal

**Fichiers :**

- Modifier : `apps/client/src/components/voice-provider/controls-bridge.ts`
- Modifier : `apps/client/src/components/voice-provider/index.tsx:1210-1219`
- Modifier : `apps/client/src/features/server/channels/actions.ts`
- Modifier : `apps/client/src/components/left-sidebar/hooks.ts:59-143`

**Interfaces :**

- Consomme : `joinVoice` de `@/features/server/voice/actions`, `init` du
  contexte vocal, `setSelectedChannelId` de
  `@/features/server/channels/actions`.
- Produit : `selectChannel(channelId: number): Promise<void>` exportée de
  `features/server/channels/actions.ts`, et
  `joinChannel(channelId: number): Promise<void>` sur le pont
  `TVoiceControlsBridge`.

Refactoring **à comportement constant** : la colonne gauche doit se comporter
exactement comme avant. Aucune fonctionnalité visible n'est ajoutée ici.

- [ ] **Étape 1 : étendre le type du pont**

Dans `apps/client/src/components/voice-provider/controls-bridge.ts`, ajouter le
membre au type :

```ts
type TVoiceControlsBridge = {
  setMicMuted: (muted: boolean) => Promise<void>;
  setSoundMuted: (muted: boolean) => Promise<void>;
  joinChannel: (channelId: number) => Promise<void>;
};
```

- [ ] **Étape 2 : poser `joinChannel` dans le fournisseur**

Dans `apps/client/src/components/voice-provider/index.tsx`, juste avant le
`useEffect` qui appelle `setVoiceControlsBridge` (ligne ~1210), ajouter le
rappel — c'est la moitié vocale de l'actuel `useSelectChannel`, déplacée sans
changement de comportement :

```ts
  const joinChannelForBridge = useCallback(
    async (channelId: number) => {
      const response = await joinVoice(channelId);

      if (!response) {
        // joining voice failed
        setSelectedChannelId(undefined);
        toast.error('Failed to join voice channel');

        return;
      }

      try {
        await init(response, channelId);
      } catch {
        setSelectedChannelId(undefined);
        toast.error('Failed to initialize voice connection');
      }
    },
    [init]
  );
```

Puis l'ajouter à l'objet posé et aux dépendances de l'effet :

```ts
  useEffect(() => {
    setVoiceControlsBridge({
      setMicMuted: setMicMutedForBridge,
      setSoundMuted: setSoundMutedForBridge,
      joinChannel: joinChannelForBridge
    });

    return () => {
      clearVoiceControlsBridge();
    };
  }, [setMicMutedForBridge, setSoundMutedForBridge, joinChannelForBridge]);
```

Les messages d'erreur sont en anglais et codés en dur dans le code d'origine :
les recopier tels quels. Les traduire serait un changement de comportement qui
n'appartient pas à ce chantier.

Ajouter les imports manquants en tête de fichier (`joinVoice`,
`setSelectedChannelId`, `toast` de `sonner`) — plusieurs y sont probablement
déjà.

- [ ] **Étape 3 : extraire `selectChannel`**

Dans `apps/client/src/features/server/channels/actions.ts`, ajouter :

```ts
export const selectChannel = async (channelId: number) => {
  const state = store.getState();
  const channel = channelsMapSelector(state)[channelId];

  if (!channel) return;

  // La vue affiche le salon pendant que le vocal se connecte : poser la
  // sélection avant toute attente réseau, comme le faisait useSelectChannel.
  setSelectedChannelId(channel.id);

  if (channel.type !== ChannelType.VOICE) {
    // persist selected channel for non-voice channels
    setLocalStorageItem(
      LocalStorageKey.LAST_SELECTED_CHANNEL,
      channel.id.toString()
    );

    return;
  }

  if (currentVoiceChannelIdSelector(state) === channel.id) return;

  // Pont absent = on n'est pas dans la vue serveur, donc il n'y a pas de vocal
  // à rejoindre. Même sémantique silencieuse que les raccourcis de coupure.
  await getVoiceControlsBridge()?.joinChannel(channel.id);
};
```

Imports à ajouter dans ce fichier : `store` de `@/features/store`,
`channelsMapSelector` et `currentVoiceChannelIdSelector` de `./selectors`,
`ChannelType` de `@sharkord/shared`, `setLocalStorageItem` et
`LocalStorageKey` de `@/helpers/storage`, `getVoiceControlsBridge` de
`@/components/voice-provider/controls-bridge`.

Si `check-types` signale une boucle d'import entre `features` et `components`,
c'est le pont qu'il faut déplacer, pas la fonction : `controls-bridge.ts` ne
dépend de rien et peut vivre sous `features/server/voice/`. Faire le
déplacement et corriger les deux importateurs plutôt que de contourner.

- [ ] **Étape 4 : réduire `useSelectChannel` à son effet d'amorçage**

Dans `apps/client/src/components/left-sidebar/hooks.ts`, remplacer tout le
corps de `useSelectChannel` (lignes 59-143) par :

```ts
const useSelectChannel = () => {
  const autoJoinLastChannel = useAutoJoinLastChannel();
  const channelsMap = useChannelsMap();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pushChannelId = Number(params.get('channelId'));

    if (pushChannelId > 0) {
      const pushChannel = channelsMap[pushChannelId];

      window.history.replaceState({}, '', '/');

      if (pushChannel) {
        setSelectedChannelId(pushChannel.id);
        localStorage.setItem(
          LocalStorageKey.LAST_SELECTED_CHANNEL,
          pushChannel.id.toString()
        );

        return;
      }
    }

    if (!autoJoinLastChannel) return;

    const lastSelectedChannelId = localStorage.getItem(
      LocalStorageKey.LAST_SELECTED_CHANNEL
    );

    if (lastSelectedChannelId) {
      const channelId = parseInt(lastSelectedChannelId, 10);
      const lastChannel = channelsMap[channelId];

      if (lastChannel) {
        setSelectedChannelId(channelId);
      }
    }
  }, [channelsMap, autoJoinLastChannel]);

  return selectChannel;
};
```

L'effet est repris **au caractère près** de l'existant. Les imports devenus
inutiles disparaissent : `useVoice`, `useCurrentVoiceChannelId`, `joinVoice`,
`ChannelType`, `toast`, `useCallback`. `selectChannel` est importée de
`@/features/server/channels/actions`. `lint` signale les imports morts, s'y
fier.

- [ ] **Étape 5 : vérifier le comportement à la main**

Lancer le client (`cd apps/client && bun dev`) et vérifier trois choses, qui
sont les seules régressions possibles de cette tâche :

1. cliquer un salon texte le sélectionne et il est rouvert au rechargement ;
2. cliquer un salon vocal le rejoint (le panneau vocal s'ouvre) ;
3. cliquer un deuxième salon vocal bascule bien de l'un à l'autre.

- [ ] **Étape 6 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/voice-provider apps/client/src/features/server/channels/actions.ts apps/client/src/components/left-sidebar/hooks.ts
git commit -m "refactor(client): rendre la selection de salon appelable hors du fournisseur vocal"
```

---

### Tâche 4 : les données de la palette

**Fichiers :**

- Modifier : `apps/client/src/features/server/selectors.ts`
- Modifier : `apps/client/src/features/server/hooks.ts`
- Créer : `apps/client/src/components/dialogs/quick-switcher/hooks.ts`
- Créer : `apps/client/src/components/dialogs/quick-switcher/types.ts`

**Interfaces :**

- Consomme : `matchName`, `compareMatches` (tâche 1), `readRecentTargets`
  (tâche 2), `canViewChannel` de `@/features/server/helpers`.
- Produit : `visibleChannelsSelector`, `useVisibleChannels()`, et
  `useQuickSwitcherGroups(query: string, isOpen: boolean):
  TQuickSwitcherGroup[]` où
  `TQuickSwitcherGroup = { key: 'recents' | 'channels' | 'voice' | 'users';
  items: TQuickSwitcherItem[] }` et
  `TQuickSwitcherItem = { key: string; kind: 'channel' | 'voice' | 'user';
  id: number; name: string; categoryName?: string; segments: TMatchSegment[] }`.

- [ ] **Étape 1 : ajouter le sélecteur de salons visibles**

Dans `apps/client/src/features/server/selectors.ts`, à côté de
`visibleChannelsInCategorySelector` (ligne 100) :

```ts
export const visibleChannelsSelector = createSelector(
  [channelsSelector, channelPermissionsSelector, isOwnUserOwnerSelector],
  (channels, channelPermissions, isOwner) =>
    channels.filter(
      (channel) =>
        !channel.isDm && canViewChannel(channel, channelPermissions, isOwner)
    )
);
```

Le `!channel.isDm` est **obligatoire** : `state.server.channels` contient aussi
les salons de conversation privée (`categoryId` nul), que la colonne gauche ne
voit jamais parce qu'elle filtre par catégorie. Sans ce test, « DM Channel »
apparaîtrait dans la palette comme un vocal à rejoindre.

Puis dans `apps/client/src/features/server/hooks.ts` :

```ts
export const useVisibleChannels = () => useSelector(visibleChannelsSelector);
```

- [ ] **Étape 2 : déclarer les types de la palette**

Créer `apps/client/src/components/dialogs/quick-switcher/types.ts` :

```ts
import type { TMatchSegment } from './matching';

type TQuickSwitcherItemKind = 'channel' | 'voice' | 'user';

type TQuickSwitcherItem = {
  key: string;
  kind: TQuickSwitcherItemKind;
  id: number;
  name: string;
  categoryName?: string;
  segments: TMatchSegment[];
};

type TQuickSwitcherGroupKey = 'recents' | 'channels' | 'voice' | 'users';

type TQuickSwitcherGroup = {
  key: TQuickSwitcherGroupKey;
  items: TQuickSwitcherItem[];
};

export type {
  TQuickSwitcherGroup,
  TQuickSwitcherGroupKey,
  TQuickSwitcherItem,
  TQuickSwitcherItemKind
};
```

- [ ] **Étape 3 : écrire le hook de résultats**

Créer `apps/client/src/components/dialogs/quick-switcher/hooks.ts` :

```ts
import { useCategories } from '@/features/server/categories/hooks';
import { useVisibleChannels } from '@/features/server/hooks';
import { useFilteredUsers } from '@/features/server/users/hooks';
import { ChannelType } from '@sharkord/shared';
import { useMemo } from 'react';
import { compareMatches, matchName } from './matching';
import { readRecentTargets } from './recents';
import type { TQuickSwitcherGroup, TQuickSwitcherItem } from './types';

const MAX_ITEMS_PER_GROUP = 8;

const useQuickSwitcherGroups = (
  query: string,
  isOpen: boolean
): TQuickSwitcherGroup[] => {
  const channels = useVisibleChannels();
  const categories = useCategories();
  const users = useFilteredUsers();

  // Les récents sont lus une fois par ouverture : les relire à chaque frappe
  // toucherait le disque pour rien, et la liste ne peut pas changer pendant
  // que la palette est ouverte.
  const recentTargets = useMemo(
    () => (isOpen ? readRecentTargets() : []),
    [isOpen]
  );

  return useMemo(() => {
    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name])
    );
    const activeUsers = users.filter((user) => !user.banned);

    const toChannelItem = (
      channel: (typeof channels)[number],
      segments: TQuickSwitcherItem['segments']
    ): TQuickSwitcherItem => ({
      key: `channel-${channel.id}`,
      kind: channel.type === ChannelType.VOICE ? 'voice' : 'channel',
      id: channel.id,
      name: channel.name,
      categoryName: channel.categoryId
        ? categoryNames.get(channel.categoryId)
        : undefined,
      segments
    });

    const toUserItem = (
      user: (typeof activeUsers)[number],
      segments: TQuickSwitcherItem['segments']
    ): TQuickSwitcherItem => ({
      key: `user-${user.id}`,
      kind: 'user',
      id: user.id,
      name: user.name,
      segments
    });

    const plain = (name: string) => [{ text: name, matched: false }];

    if (query.trim() === '') {
      const recentItems = recentTargets
        .map((target) => {
          if (target.kind === 'channel') {
            const channel = channels.find((entry) => entry.id === target.id);

            return channel ? toChannelItem(channel, plain(channel.name)) : null;
          }

          const user = activeUsers.find((entry) => entry.id === target.id);

          return user ? toUserItem(user, plain(user.name)) : null;
        })
        .filter((item): item is TQuickSwitcherItem => item !== null);

      if (recentItems.length > 0) {
        return [{ key: 'recents', items: recentItems }];
      }
    }

    const matchAndSort = <TSource,>(
      source: TSource[],
      getName: (entry: TSource) => string,
      toItem: (
        entry: TSource,
        segments: TQuickSwitcherItem['segments']
      ) => TQuickSwitcherItem
    ) =>
      source
        .map((entry) => {
          const match = matchName(getName(entry), query);

          return match ? { entry, match } : null;
        })
        .filter(
          (candidate): candidate is { entry: TSource; match: NonNullable<
            ReturnType<typeof matchName>
          > } => candidate !== null
        )
        .sort((a, b) => compareMatches(a.match, b.match))
        .slice(0, MAX_ITEMS_PER_GROUP)
        .map(({ entry, match }) => toItem(entry, match.segments));

    const textChannels = channels.filter(
      (channel) => channel.type !== ChannelType.VOICE
    );
    const voiceChannels = channels.filter(
      (channel) => channel.type === ChannelType.VOICE
    );

    const groups: TQuickSwitcherGroup[] = [
      {
        key: 'channels',
        items: matchAndSort(textChannels, (c) => c.name, toChannelItem)
      },
      {
        key: 'voice',
        items: matchAndSort(voiceChannels, (c) => c.name, toChannelItem)
      },
      {
        key: 'users',
        items: matchAndSort(activeUsers, (u) => u.name, toUserItem)
      }
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [categories, channels, query, recentTargets, users]);
};

export { useQuickSwitcherGroups };
```

`MAX_ITEMS_PER_GROUP` n'est pas exporté : `knip` tourne sur ce dépôt et
signale les exports sans consommateur.

L'ordre des groupes est **fixe** : Salons, Vocaux, Personnes. Un utilisateur
qui tape trois lettres et appuie sur `↵` sans lire doit pouvoir apprendre le
geste ; un classement inter-groupes par score le rendrait imprévisible.

- [ ] **Étape 4 : vérifier la compilation**

Lancer : `cd apps/client && bun run check-types`
Attendu : aucune erreur. Le générique `<TSource,>` a besoin de la virgule dans
un fichier `.ts` compilé en TSX-compatible ; si la virgule gêne, écrire
`function matchAndSort<TSource>(...)` à la place.

- [ ] **Étape 5 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/features/server apps/client/src/components/dialogs/quick-switcher
git commit -m "feat(client): sources de donnees du selecteur rapide"
```

---

### Tâche 5 : le dialogue et sa ligne

**Fichiers :**

- Créer : `apps/client/src/components/dialogs/quick-switcher/index.tsx`
- Créer : `apps/client/src/components/dialogs/quick-switcher/row.tsx`
- Modifier : `apps/client/src/components/dialogs/dialogs.ts`
- Modifier : `apps/client/src/components/dialogs/index.tsx`
- Modifier : `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/dialogs.json`

**Interfaces :**

- Consomme : `useQuickSwitcherGroups` (tâche 4), `selectChannel` (tâche 3),
  `rememberRecentTarget` (tâche 2), `TDialogBaseProps` de `../types`.
- Produit : `Dialog.QUICK_SWITCHER` dans l'énumération,
  `QuickSwitcherDialog` dans `DialogsMap`.

À la fin de cette tâche la palette s'ouvre encore uniquement par
`openDialog(Dialog.QUICK_SWITCHER)` depuis la console ; le raccourci arrive à
la tâche 6.

- [ ] **Étape 1 : enregistrer le dialogue**

Dans `apps/client/src/components/dialogs/dialogs.ts`, ajouter dans l'énum :

```ts
  QUICK_SWITCHER = 'QUICK_SWITCHER'
```

Dans `apps/client/src/components/dialogs/index.tsx`, importer
`QuickSwitcherDialog` de `./quick-switcher` et ajouter à `DialogsMap` :

```ts
  [Dialog.QUICK_SWITCHER]: QuickSwitcherDialog,
```

- [ ] **Étape 2 : écrire la ligne**

Créer `apps/client/src/components/dialogs/quick-switcher/row.tsx` :

```tsx
import { UnreadCount } from '@/components/unread-count';
import { UserAvatar } from '@/components/user-avatar';
import {
  useUnreadMessagesCount,
  useVoiceUsersByChannelId
} from '@/features/server/hooks';
import { useUserById } from '@/features/server/users/hooks';
import { cn } from '@/lib/utils';
import { UserStatus } from '@sharkord/shared';
import { Hash, Volume2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TQuickSwitcherItem } from './types';

type TQuickSwitcherRowProps = {
  item: TQuickSwitcherItem;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
};

const Segments = memo(({ item }: { item: TQuickSwitcherItem }) => (
  <span className="flex-1 truncate text-left">
    {item.segments.map((segment, index) => (
      <span
        key={`${index}-${segment.text}`}
        className={segment.matched ? 'font-semibold text-foreground' : undefined}
      >
        {segment.text}
      </span>
    ))}
  </span>
));

const ChannelMeta = memo(({ item }: { item: TQuickSwitcherItem }) => {
  const unreadCount = useUnreadMessagesCount(item.id);

  return (
    <>
      {item.categoryName && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {item.categoryName}
        </span>
      )}
      <UnreadCount count={unreadCount} className="ml-0" />
    </>
  );
});

const VoiceMeta = memo(({ item }: { item: TQuickSwitcherItem }) => {
  const { t } = useTranslation('dialogs');
  const voiceUsers = useVoiceUsersByChannelId(item.id);

  if (voiceUsers.length === 0) return null;

  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {t('quickSwitcherVoiceUsers', { count: voiceUsers.length })}
    </span>
  );
});

const UserMeta = memo(({ item }: { item: TQuickSwitcherItem }) => {
  const { t } = useTranslation('dialogs');
  const user = useUserById(item.id);
  const isOnline = user?.status === UserStatus.ONLINE;

  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {isOnline ? t('quickSwitcherOnline') : t('quickSwitcherOffline')}
    </span>
  );
});

const QuickSwitcherRow = memo(
  ({ item, isActive, onSelect, onHover }: TQuickSwitcherRowProps) => (
    <div
      role="option"
      id={`quick-switcher-${item.key}`}
      aria-selected={isActive}
      data-active={isActive}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        'flex w-full cursor-default items-center gap-2.5 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-out',
        isActive && 'bg-accent text-accent-foreground'
      )}
    >
      {item.kind === 'user' ? (
        <UserAvatar userId={item.id} className="h-5 w-5" />
      ) : (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground',
            isActive && 'text-primary'
          )}
        >
          {item.kind === 'voice' ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <Hash className="h-3.5 w-3.5" />
          )}
        </span>
      )}

      <Segments item={item} />

      {item.kind === 'channel' && <ChannelMeta item={item} />}
      {item.kind === 'voice' && <VoiceMeta item={item} />}
      {item.kind === 'user' && <UserMeta item={item} />}
    </div>
  )
);

export { QuickSwitcherRow };
```

`UserAvatar` est appelé **sans** `showUserPopover` : une infobulle qui s'ouvre
sous le curseur dans une liste que l'on parcourt au clavier gênerait la
lecture.

- [ ] **Étape 3 : écrire le dialogue**

Créer `apps/client/src/components/dialogs/quick-switcher/index.tsx` :

```tsx
import type { TDialogBaseProps } from '@/components/dialogs/types';
import { setSelectedDmChannelId } from '@/features/app/actions';
import { closeDialogs, openDialog } from '@/features/dialogs/actions';
import { setDmsOpen } from '@/features/server/actions';
import { selectChannel } from '@/features/server/channels/actions';
import { getTRPCClient } from '@/lib/trpc';
import { Dialog, DialogContent, DialogTitle } from '@sharkord/ui';
import { Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog as DialogName } from '../dialogs';
import { useQuickSwitcherGroups } from './hooks';
import { rememberRecentTarget } from './recents';
import { QuickSwitcherRow } from './row';
import type { TQuickSwitcherGroup, TQuickSwitcherItem } from './types';

const GROUP_LABEL_KEYS: Record<TQuickSwitcherGroup['key'], string> = {
  recents: 'quickSwitcherRecents',
  channels: 'quickSwitcherChannels',
  voice: 'quickSwitcherVoice',
  users: 'quickSwitcherUsers'
};

const QuickSwitcherDialog = memo(({ isOpen, close }: TDialogBaseProps) => {
  const { t } = useTranslation('dialogs');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useQuickSwitcherGroups(query, isOpen);

  const items = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const hasEscapeHatch = query.trim() !== '';
  // La porte de sortie est une ligne de plus, en fin de liste : elle est
  // atteignable aux flèches, et c'est elle qui est active quand rien d'autre
  // ne correspond.
  const totalRows = items.length + (hasEscapeHatch ? 1 : 0);
  const boundedIndex = Math.min(activeIndex, Math.max(0, totalRows - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [boundedIndex, groups]);

  const openContentSearch = useCallback(() => {
    openDialog(DialogName.SEARCH, { initialQuery: query.trim() });
  }, [query]);

  const openItem = useCallback(
    async (item: TQuickSwitcherItem) => {
      if (item.kind === 'user') {
        const trpc = getTRPCClient();

        try {
          const result = await trpc.dms.open.mutate({ userId: item.id });

          setDmsOpen(true);
          setSelectedDmChannelId(result.channelId);
        } catch {
          // Seule action du chantier qui touche le réseau : sur échec la
          // palette reste ouverte, l'utilisateur peut réessayer ou choisir
          // autre chose.
          toast.error(t('quickSwitcherCouldNotOpenDm'));

          return;
        }

        rememberRecentTarget({ kind: 'user', id: item.id });
        closeDialogs();

        return;
      }

      setDmsOpen(false);
      setSelectedDmChannelId(undefined);
      rememberRecentTarget({ kind: 'channel', id: item.id });
      closeDialogs();

      await selectChannel(item.id);
    },
    [t]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (totalRows === 0) return;

        event.preventDefault();

        setActiveIndex((current) => {
          const bounded = Math.min(current, totalRows - 1);

          return event.key === 'ArrowDown'
            ? (bounded + 1) % totalRows
            : (bounded - 1 + totalRows) % totalRows;
        });

        return;
      }

      if (event.key !== 'Enter') return;

      event.preventDefault();

      const item = items[boundedIndex];

      if (item) {
        openItem(item);

        return;
      }

      if (hasEscapeHatch) {
        openContentSearch();
      }
    },
    [
      boundedIndex,
      hasEscapeHatch,
      items,
      openContentSearch,
      openItem,
      totalRows
    ]
  );

  let rowIndex = -1;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[14vh] block max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onInteractOutside={close}
      >
        <DialogTitle className="sr-only">{t('quickSwitcherTitle')}</DialogTitle>

        <div className="flex h-13 items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded
            aria-controls="quick-switcher-list"
            aria-activedescendant={
              items[boundedIndex]
                ? `quick-switcher-${items[boundedIndex]!.key}`
                : undefined
            }
            placeholder={t('quickSwitcherPlaceholder')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          ref={listRef}
          id="quick-switcher-list"
          role="listbox"
          aria-label={t('quickSwitcherTitle')}
          className="flex max-h-85 flex-col gap-0.5 overflow-y-auto p-2"
        >
          {groups.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-label={t(GROUP_LABEL_KEYS[group.key])}
              className="flex flex-col gap-0.5"
            >
              <div className="px-2.5 pt-2 pb-1 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                {t(GROUP_LABEL_KEYS[group.key])}
              </div>
              {group.items.map((item) => {
                rowIndex += 1;

                const index = rowIndex;

                return (
                  <QuickSwitcherRow
                    key={item.key}
                    item={item}
                    isActive={index === boundedIndex}
                    onSelect={() => openItem(item)}
                    onHover={() => setActiveIndex(index)}
                  />
                );
              })}
            </div>
          ))}

          {hasEscapeHatch && (
            <div
              role="option"
              aria-selected={boundedIndex === items.length}
              data-active={boundedIndex === items.length}
              onClick={openContentSearch}
              onMouseMove={() => setActiveIndex(items.length)}
              className={
                boundedIndex === items.length
                  ? 'mt-1 flex cursor-default items-center gap-2.5 rounded-pill border-t border-border px-2.5 py-1.5 text-sm bg-accent text-accent-foreground'
                  : 'mt-1 flex cursor-default items-center gap-2.5 border-t border-border px-2.5 py-1.5 text-sm text-muted-foreground'
              }
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">
                {t('quickSwitcherSearchMessages', { query: query.trim() })}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>{t('quickSwitcherHintNavigate')}</span>
          <span>{t('quickSwitcherHintOpen')}</span>
          <span className="ml-auto">{t('quickSwitcherHintSearch')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { QuickSwitcherDialog };
```

`Échap` n'est pas géré ici : Radix ferme déjà le dialogue sur `Escape` via
`onOpenChange`. Vérifier à l'étape 5 que la fermeture marche ; si le dialogue
reste ouvert (les autres dialogues du dépôt passent par `useOnEsc`), ajouter
`useOnEsc(close)` de `@/hooks/use-on-esc` comme le fait `search/index.tsx:31`.

Le compteur `rowIndex` est remis à `-1` à chaque rendu, avant le `map` : c'est
ce qui donne un index continu à travers les groupes, celui-là même que les
flèches manipulent.

- [ ] **Étape 4 : ajouter les traductions (7 locales)**

Dans `apps/client/src/i18n/locales/en/dialogs.json` :

```json
  "quickSwitcherTitle": "Quick switcher",
  "quickSwitcherPlaceholder": "Jump to a channel or a person...",
  "quickSwitcherRecents": "Recent",
  "quickSwitcherChannels": "Channels",
  "quickSwitcherVoice": "Voice",
  "quickSwitcherUsers": "People",
  "quickSwitcherVoiceUsers_one": "{{count}} person",
  "quickSwitcherVoiceUsers_other": "{{count}} people",
  "quickSwitcherOnline": "online",
  "quickSwitcherOffline": "offline",
  "quickSwitcherSearchMessages": "Search \"{{query}}\" in messages",
  "quickSwitcherCouldNotOpenDm": "Could not open the conversation.",
  "quickSwitcherHintNavigate": "↑↓ navigate",
  "quickSwitcherHintOpen": "↵ open",
  "quickSwitcherHintSearch": "Ctrl+Shift+F search messages",
```

Dans `fr/dialogs.json` :

```json
  "quickSwitcherTitle": "Sélecteur rapide",
  "quickSwitcherPlaceholder": "Aller à un salon ou une personne...",
  "quickSwitcherRecents": "Récents",
  "quickSwitcherChannels": "Salons",
  "quickSwitcherVoice": "Vocaux",
  "quickSwitcherUsers": "Personnes",
  "quickSwitcherVoiceUsers_one": "{{count}} personne",
  "quickSwitcherVoiceUsers_other": "{{count}} personnes",
  "quickSwitcherOnline": "en ligne",
  "quickSwitcherOffline": "hors ligne",
  "quickSwitcherSearchMessages": "Chercher « {{query}} » dans les messages",
  "quickSwitcherCouldNotOpenDm": "Impossible d'ouvrir la conversation.",
  "quickSwitcherHintNavigate": "↑↓ naviguer",
  "quickSwitcherHintOpen": "↵ ouvrir",
  "quickSwitcherHintSearch": "Ctrl+Maj+F chercher un message",
```

Les cinq autres locales (`cs`, `es`, `it`, `ru`, `zh`) reçoivent les mêmes clés
traduites. Le fichier `topbar.json` de chaque locale contient déjà des pluriels
en `_one` / `_other` (`stream_one`) : suivre cette forme, c'est celle qu'i18next
attend. Le russe et le tchèque ont des formes de pluriel supplémentaires ;
fournir au minimum `_one` et `_other`, i18next retombe dessus.

- [ ] **Étape 5 : vérifier à la main**

Lancer le client, ouvrir la console du navigateur et taper
`window.__store` n'existe pas — passer plutôt par un appel temporaire dans le
code, ou attendre la tâche 6. Le plus simple : ajouter provisoirement un
`openDialog(Dialog.QUICK_SWITCHER)` sur le clic du bouton de recherche de la
barre du haut, vérifier les quatre états (champ vide sans récents, frappe avec
résultats, frappe sans résultat, `↑`/`↓` qui bouclent), **puis retirer cette
modification provisoire** avant de committer.

- [ ] **Étape 6 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/dialogs apps/client/src/i18n
git commit -m "feat(client): dialogue du selecteur rapide"
```

---

### Tâche 6 : les raccourcis et la porte de sortie

**Fichiers :**

- Modifier : `apps/client/src/components/hotkeys-controller/index.tsx:21-53`
- Modifier : `apps/client/src/components/top-bar/server-search.tsx`
- Modifier : `apps/client/src/components/dialogs/search/index.tsx`
- Modifier : `apps/client/src/components/dialogs/search/hooks.ts`

**Interfaces :**

- Consomme : `Dialog.QUICK_SWITCHER` (tâche 5), `openDialog` de
  `@/features/dialogs/actions`.
- Produit : `SearchDialog` accepte `initialQuery?: string`.

- [ ] **Étape 1 : poser les deux liaisons**

Dans `apps/client/src/components/hotkeys-controller/index.tsx`, dans
`handleKeyDown`, avant le bloc `if (e.ctrlKey && e.shiftKey)` :

```ts
    // Ctrl+K ouvre le sélecteur rapide, Ctrl+Maj+F la recherche de contenu.
    // Les deux vivent ici et non dans leurs surfaces : deux écouteurs
    // « keydown » concurrents sur window se disputeraient la touche, et le
    // dernier monté gagnerait.
    if ((e.ctrlKey || e.metaKey) && !e.repeat) {
      const key = e.key.toLowerCase();

      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();

        if (isConnectedRef.current) {
          openDialog(Dialog.QUICK_SWITCHER);
        }
      } else if (key === 'f' && e.shiftKey) {
        e.preventDefault();

        if (isConnectedRef.current) {
          openDialog(Dialog.SEARCH);
        }
      }
    }
```

Le contrôleur est monté hors de toute vue serveur : sans la garde de
connexion, `Ctrl+K` ouvrirait une palette vide sur l'écran de connexion.
Ajouter le ref à côté de `ownVoiceStateRef`, sur le même modèle :

```ts
  const isConnected = useSelector(connectedSelector);
  const isConnectedRef = useRef(isConnected);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
```

`connectedSelector` vient de `@/features/server/selectors`. Le `handleKeyDown`
existant est un `useCallback` à dépendances vides qui lit ses états par ref :
respecter ce choix, ne pas ajouter de dépendance.

Une seconde pression sur `Ctrl+K` doit refermer la palette. `openDialog` ne
bascule pas ; ajouter la bascule en lisant le dialogue ouvert :

```ts
      if (key === 'k' && !e.shiftKey) {
        e.preventDefault();

        if (!isConnectedRef.current) return;

        if (openDialogRef.current === Dialog.QUICK_SWITCHER) {
          closeDialogs();
        } else {
          openDialog(Dialog.QUICK_SWITCHER);
        }
      }
```

avec `openDialogRef` alimenté depuis `state.dialogs` (lire le nom exact du
champ dans `features/dialogs/slice.ts` et le sélecteur associé dans
`features/dialogs/hooks.ts`).

- [ ] **Étape 2 : désarmer l'écouteur de la barre du haut**

Dans `apps/client/src/components/top-bar/server-search.tsx`, supprimer le
`useEffect` complet (lignes 15-25) et l'import `useEffect`. Le bouton garde son
`onClick`. Changer le badge :

```tsx
      <span className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] md:inline">
        Ctrl+Maj+F
      </span>
```

Retirer aussi `animate-pulse` de l'icône de loupe : une icône qui pulse en
permanence dans une barre d'outils est un appel à l'attention permanent, et le
chantier 2 a passé le reste du client à des animations gardées.

- [ ] **Étape 3 : brancher la porte de sortie**

Dans `apps/client/src/components/dialogs/search/hooks.ts`, changer la signature
et amorcer la requête à l'ouverture :

```ts
export const useSearch = (isOpen: boolean, initialQuery: string = '') => {
  const [query, setQuery] = useState(initialQuery);
```

et dans l'effet de réinitialisation (ligne 18), réamorcer au lieu de vider :

```ts
  useEffect(() => {
    // reset state when dialog is closed
    if (!isOpen) {
      setQuery('');
      setResults(EMPTY_RESULTS);
      setLoading(false);

      return;
    }

    setQuery(initialQuery);
  }, [isOpen, initialQuery]);
```

L'amorçage doit être **dans l'effet** et pas seulement dans le `useState` :
l'effet existant remet `query` à `''` à chaque fermeture, un état initial
serait écrasé au deuxième passage.

Dans `apps/client/src/components/dialogs/search/index.tsx`, étendre les props :

```tsx
type TSearchDialogProps = TDialogBaseProps & {
  initialQuery?: string;
};

const SearchDialog = memo(
  ({ isOpen, close, initialQuery = '' }: TSearchDialogProps) => {
```

et passer la valeur : `useSearch(isOpen, initialQuery)`.

Sans la prop, le dialogue se comporte exactement comme aujourd'hui.

- [ ] **Étape 4 : vérifier à la main, dans l'application réelle**

C'est la vérification centrale du chantier : les portes ne peuvent pas
attraper deux écouteurs `keydown` concurrents.

1. `Ctrl+K` ouvre la palette — **pas** l'ancien dialogue de recherche.
2. `Ctrl+K` à nouveau la referme.
3. `Ctrl+Maj+F` ouvre la recherche de contenu.
4. Taper trois lettres dans la palette, `↵` sur la ligne « Chercher … » :
   la recherche s'ouvre **avec le texte déjà saisi** et des résultats.
5. `Ctrl+K` sur l'écran de connexion ne fait rien.
6. Rejoindre un **salon vocal** depuis la palette : le vocal se connecte
   réellement. C'est le chemin que ni les portes ni les tests ne couvrent, et
   qu'un `useVoice()` oublié raterait en silence.

Contrôles statiques avant de committer :

```bash
grep -rn "'k'" apps/client/src --include=*.tsx --include=*.ts | grep -i keydown
grep -rn "useVoice" apps/client/src/components/dialogs
```

Le premier ne doit rien renvoyer hors `hotkeys-controller`, le second rien du
tout.

- [ ] **Étape 5 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/hotkeys-controller apps/client/src/components/top-bar apps/client/src/components/dialogs/search
git commit -m "feat(client): Ctrl+K ouvre le selecteur, Ctrl+Maj+F la recherche"
```

---

### Tâche 7 : test de bout en bout

**Fichiers :**

- Modifier : `packages/shared/src/test-ids.ts`
- Modifier : `apps/client/src/components/dialogs/quick-switcher/index.tsx`
  (poser les `data-testid`)
- Créer : `packages/e2e/tests/quick-switcher.pw.ts`

**Interfaces :**

- Consomme : `loginAs` de `./fixtures`, `TestId` de `@sharkord/shared`.
- Produit : `TestId.QUICK_SWITCHER`, `TestId.QUICK_SWITCHER_INPUT`,
  `TestId.QUICK_SWITCHER_ROW`.

Données du seed sur lesquelles les tests s'appuient
(`apps/server/src/__tests__/seed.ts`) : un salon texte **General** dans la
catégorie **Text Channels**, un salon vocal **Voice** dans **Voice Channels**,
un salon **DM Channel** `isDm` et `private`, et les comptes `testowner` et
`testuser` (mot de passe `password123`).

- [ ] **Étape 1 : ajouter les identifiants de test**

Dans `packages/shared/src/test-ids.ts`, avant l'accolade fermante :

```ts
  QUICK_SWITCHER = 'quick-switcher',
  QUICK_SWITCHER_INPUT = 'quick-switcher-input',
  QUICK_SWITCHER_ROW = 'quick-switcher-row'
```

Ajouter la virgule sur la ligne précédente (`DROP_OVERLAY = 'drop-overlay'`).

- [ ] **Étape 2 : poser les identifiants dans le dialogue**

Dans `quick-switcher/index.tsx` : `data-testid={TestId.QUICK_SWITCHER}` sur le
`DialogContent` et `data-testid={TestId.QUICK_SWITCHER_INPUT}` sur l'`input`.
Dans `quick-switcher/row.tsx` : `data-testid={TestId.QUICK_SWITCHER_ROW}` sur
le `div` racine, celui qui porte déjà `role="option"` et `data-active`.
Importer `TestId` de `@sharkord/shared` dans les deux fichiers.

- [ ] **Étape 3 : écrire le test**

Créer `packages/e2e/tests/quick-switcher.pw.ts` :

```ts
import { TestId } from '@sharkord/shared';
import { expect, loginAs, test } from './fixtures';

test.describe('Sélecteur rapide', () => {
  test('Ctrl+K ouvre la palette et Échap la referme', async ({ page }) => {
    await loginAs(page, 'testowner', 'password123');

    await page.keyboard.press('Control+k');
    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeHidden();
  });

  test('taper un nom puis Entrée change de salon', async ({ page }) => {
    await loginAs(page, 'testowner', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('gene');

    await expect(
      page.getByTestId(TestId.QUICK_SWITCHER_ROW).first()
    ).toContainText('General');

    await page.keyboard.press('Enter');

    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeHidden();
    await expect(page.getByText('Test message')).toBeVisible();
  });

  test('les flèches ne s arrêtent jamais sur un en-tête de groupe', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('e');

    const rows = page.getByTestId(TestId.QUICK_SWITCHER_ROW);
    const activeRows = page.locator(
      `[data-testid="${TestId.QUICK_SWITCHER_ROW}"][data-active="true"]`
    );

    await expect(rows.first()).toHaveAttribute('data-active', 'true');

    await page.keyboard.press('ArrowDown');

    // Exactement une ligne active, et c'est la deuxième : la flèche a donc
    // enjambé l'en-tête de groupe au lieu de s'y arrêter.
    await expect(activeRows).toHaveCount(1);
    await expect(rows.nth(1)).toHaveAttribute('data-active', 'true');
  });

  test('un salon prive non autorise n apparait jamais', async ({ page }) => {
    await loginAs(page, 'testuser', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('DM Channel');

    await expect(
      page.getByTestId(TestId.QUICK_SWITCHER_ROW)
    ).toHaveCount(0);
  });
});
```

Le quatrième test se connecte en **`testuser`** et non `testowner` :
`canViewChannel` renvoie toujours `true` pour le propriétaire, un test lancé en
propriétaire serait vert sans rien prouver.

- [ ] **Étape 4 : lancer la suite**

Avant chaque exécution, **vider `packages/e2e/e2e-data`**, sinon la base d'un
run précédent fausse les résultats. Puis :

```bash
cd packages/e2e && bunx playwright test quick-switcher.pw.ts
```

Lire la ligne « N passed » et non le code de sortie, qui vaut 1 même au vert.
Attendu : 4 passed.

Si un `bun` fantôme occupe le port 4991 (run interrompu), aucun test ne peut
démarrer : donner la commande d'arrêt à l.user, ne pas tenter de tuer le
processus.

- [ ] **Étape 5 : lancer la suite complète**

```bash
cd packages/e2e && bunx playwright test
```

`auto-login.pw.ts` et `infinite-scroll.pw.ts` sont connus pour être instables
sous plusieurs workers : un échec isolé et non reproductible sur ces
fichiers-là n'est pas un défaut de la branche. Relancer le fichier seul pour
trancher.

- [ ] **Étape 6 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add packages/shared/src/test-ids.ts packages/e2e/tests/quick-switcher.pw.ts apps/client/src/components/dialogs/quick-switcher/index.tsx
git commit -m "test(e2e): couvrir le selecteur rapide"
```

---

## Après les 7 tâches

1. Revue de branche complète (`superpowers:requesting-code-review`), en
   insistant sur les trois pièges du programme : jeton ou classe sans
   consommateur, valeur figée, et écouteur clavier concurrent.
2. Pousser sur **les deux** remotes : `git push origin feat/quick-switcher` et
   `git push github feat/quick-switcher`.
3. Donner à l.user la commande de déploiement sur le Kimsufi — il ne lance
   rien en local :

```bash
cd ~/bullshark && git fetch origin && git reset --hard origin/feat/quick-switcher && bun install && ( cd apps/server && bun run build ) && docker build -t bullshark:local . && docker compose up -d --build
```

Vider le cache Safari ou resupprimer la PWA, sinon l'ancien bundle est servi.

4. Validation visuelle par l.user, puis fusion en avance rapide dans
   `development` puis `main`, et poussée sur les deux remotes. C'est l'ordre
   suivi par les chantiers 1, 3, 4 et 2.
