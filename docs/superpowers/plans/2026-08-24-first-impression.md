# Première impression — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner une vraie première impression aux trois surfaces qu'un joueur
voit avant d'avoir écrit son premier message : l'écran de connexion, les écrans
vides, et le glisser-déposer de fichiers.

**Architecture :** Trois blocs indépendants. (A) L'écran de connexion est
d'abord éclaté en trois fichiers sans changement visuel, puis mis en scène. (B)
Un composant `EmptyState` partagé, à filigrane du logo serveur, remplace cinq
vides. (C) La détection du glisser monte au niveau du salon dans un hook dédié,
l'incrustation est rendue par le salon, et le compositeur reçoit les fichiers
par son `ref` impératif.

**Tech Stack :** React 19, TypeScript, Tailwind CSS v4 (jetons oklch dans
`apps/client/src/index.css`), i18next (7 locales), Playwright (`packages/e2e`).

**Spec :** `docs/superpowers/specs/2026-08-24-first-impression-design.md`

Maquette validée :
https://claude.ai/code/artifact/aed133e3-ca98-4aa8-a68c-fb96b473c0f9

## Global Constraints

- **Aucun changement serveur.** Pas de migration, pas de route, pas de champ
  nouveau dans `TServerInfo`. Tout tient dans `apps/client` et
  `packages/shared/src/test-ids.ts`.
- **Aucune couleur en dur.** Tout passe par les jetons (`--primary`, `--card`,
  `--background`, `--destructive`, `--muted-foreground`). Une valeur `#rrggbb`
  ou `rgb(...)` dans le diff est un échec de revue.
- **`rounded-full`, jamais `rounded-pill`** sur un composant qui a déjà un
  `rounded-*` de base : twMerge ne connaît pas `rounded-pill` et ne retire donc
  pas le `rounded-md` du composant `Button`.
- **`bg-card` seul ne floute rien.** `--card` est opaque dans les 7 thèmes :
  tout `backdrop-blur` doit être posé sur un fond translucide
  (`bg-card/80`, `bg-background/70`).
- **Toute chaîne visible passe par i18next**, et toute clé nouvelle est écrite
  dans les **7 locales** : `cs`, `en`, `es`, `fr`, `it`, `ru`, `zh` (dossiers
  `apps/client/src/i18n/locales/<code>/`).
- **Ne pas toucher aux `data-testid` existants**, en particulier
  `TestId.CONNECT_IDENTITY_INPUT`, `TestId.CONNECT_PASSWORD_INPUT`,
  `TestId.CONNECT_BUTTON`, `TestId.CONNECT_AUTO_LOGIN_SWITCH`.
- **Un seul élément avec `alt="Bullshark"` dans le DOM de l'écran de
  connexion.** `packages/e2e/tests/connect.pw.ts:10` fait
  `page.getByAltText('Bullshark')` : deux images (une desktop, une mobile)
  feraient échouer le mode strict de Playwright. Une seule balise `img`,
  repositionnée par la grille.
- **Portes après chaque tâche**, depuis la racine du dépôt :
  `bun run format:check && bun run check-types && bun run lint`.
  Une porte rouge bloque le commit de la tâche.
- **Commits fréquents**, un par tâche, en anglais, avec les trailers du dépôt :

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CKQL1qMM3DhdYdp1paqKCp
  ```

- **Pas de framework de test unitaire dans `apps/client`** : il n'existe aucun
  `*.test.ts`, aucun vitest. La vérification passe par les portes, la lecture du
  bundle construit, et Playwright (`packages/e2e`). Ne pas inventer un
  `bun test` qui n'existe pas.
- **Branche de travail :** `feat/first-impression`, déjà créée sur `main`
  (`055933e`), spec commitée en `a62ba15`.

---

## Structure des fichiers

**Créés :**

| Fichier | Responsabilité |
|---|---|
| `apps/client/src/components/empty-state/index.tsx` | Le vide, en deux variantes (pleine à filigrane, compacte) |
| `apps/client/src/screens/connect/connect-scene.tsx` | Le fond de l'écran de connexion, purement décoratif |
| `apps/client/src/screens/connect/connect-form.tsx` | La carte de connexion : champs, switch, alertes, bouton, vue 2FA |
| `apps/client/src/hooks/use-upload-permission.ts` | A-t-on le droit d'envoyer un fichier ici, et sinon pourquoi |
| `apps/client/src/hooks/use-file-drag.ts` | Détection du glisser de fichiers sur une surface |
| `apps/client/src/components/channel-view/text/drop-overlay.tsx` | L'incrustation « Déposer pour envoyer » |
| `packages/e2e/tests/drop-zone.pw.ts` | Test E2E de l'incrustation |

**Modifiés :**

| Fichier | Changement |
|---|---|
| `apps/client/src/screens/connect/index.tsx` | Ne garde que l'état et le réseau, rend la scène et la carte |
| `apps/client/src/screens/server-view/content-wrapper.tsx` | Accueil du bureau, DM sans conversation |
| `apps/client/src/components/channel-view/text/index.tsx` | Salon vide, enveloppe de dépôt, incrustation, i18n du bandeau |
| `apps/client/src/components/thread-sidebar/tread-content.tsx` | Enveloppe de dépôt et incrustation du fil |
| `apps/client/src/components/left-sidebar/direct-messages/index.tsx` | Liste de DM vide en variante compacte |
| `apps/client/src/components/dialogs/search/index.tsx` | Recherche sans résultat en variante compacte |
| `apps/client/src/hooks/use-upload-files.ts` | Perd `dragover`/`drop`, garde `paste`, expose `processFiles`, toasts en i18n |
| `apps/client/src/components/message-compose/index.tsx` | `addFiles` sur le handle impératif |
| `apps/client/src/i18n/locales/<7 codes>/common.json` | Clés nouvelles |
| `packages/shared/src/test-ids.ts` | `DROP_OVERLAY` |

---

## Task 1 : composant EmptyState et accueil du bureau

**Files:**

- Create: `apps/client/src/components/empty-state/index.tsx`
- Modify: `apps/client/src/screens/server-view/content-wrapper.tsx`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/common.json`

**Interfaces:**

- Consumes : `useInfo()` (`@/features/server/hooks`), `getFileUrl`
  (`@/helpers/get-file-url`).
- Produces : `EmptyState`, props
  `{ title: string; description?: string; action?: ReactNode; icon?: ReactNode; variant?: 'full' | 'compact'; children?: ReactNode }`.
  Les tâches 2 et 3 le consomment tel quel.

- [ ] **Step 1 : écrire le composant**

Créer `apps/client/src/components/empty-state/index.tsx` :

```tsx
import { useInfo } from '@/features/server/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { memo, useMemo, type ReactNode } from 'react';

type TEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: 'full' | 'compact';
  children?: ReactNode;
};

// Le masque et l'échelle du filigrane passent par `style` et non par des
// classes arbitraires Tailwind : c'est la seule façon d'être certain que la
// règle sort dans le bundle construit (leçon C1/C2 du chantier 1).
const WATERMARK_STYLE = {
  WebkitMaskImage: 'radial-gradient(closest-side, #000 40%, transparent 100%)',
  maskImage: 'radial-gradient(closest-side, #000 40%, transparent 100%)'
} as const;

const EmptyState = memo(
  ({
    title,
    description,
    action,
    icon,
    variant = 'full',
    children
  }: TEmptyStateProps) => {
    const info = useInfo();

    const watermarkSrc = useMemo(() => {
      if (info?.logo) {
        return getFileUrl(info.logo);
      }

      return '/logo.webp';
    }, [info]);

    if (variant === 'compact') {
      return (
        <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
          {icon && <div className="text-muted-foreground/70">{icon}</div>}
          <span className="text-sm font-medium">{title}</span>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
          {children}
        </div>
      );
    }

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-8 text-center">
        <img
          src={watermarkSrc}
          alt=""
          aria-hidden="true"
          style={WATERMARK_STYLE}
          className="pointer-events-none absolute h-[min(60%,22rem)] w-auto max-w-[70%] select-none opacity-[0.07] grayscale dark:opacity-[0.05]"
        />

        <div className="relative flex flex-col items-center gap-2">
          {icon && <div className="mb-1 text-muted-foreground/70">{icon}</div>}
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {action && <div className="mt-2">{action}</div>}
          {children}
        </div>
      </div>
    );
  }
);

export { EmptyState };
```

Points de vigilance :

- `alt=""` **et** `aria-hidden` : le filigrane est décoratif. Ne pas y mettre
  `alt="Bullshark"`, ce qui casserait le test strict de l'écran de connexion si
  un jour les deux se croisent.
- `opacity-[0.07] dark:opacity-[0.05]` : le variant `dark` est défini par
  `@custom-variant dark (&:is(.dark *))` dans `index.css`, il fonctionne pour les
  six thèmes sombres ; la valeur nue sert le thème clair.

- [ ] **Step 2 : ajouter les clés dans les 7 locales**

Dans `apps/client/src/i18n/locales/en/common.json`, à côté des clés existantes
`selectDmPrompt` / `welcomeToServer` (lignes 14-17) :

```json
  "homeEmptyDescription": "Pick a channel on the left to start talking.",
  "homeEmptyAction": "Open #{{name}}",
```

Traductions à écrire dans les six autres fichiers :

| Clé | fr | es | it |
|---|---|---|---|
| `homeEmptyDescription` | Choisis un salon à gauche pour commencer à parler. | Elige un canal a la izquierda para empezar a hablar. | Scegli un canale a sinistra per iniziare a parlare. |
| `homeEmptyAction` | Ouvrir #{{name}} | Abrir #{{name}} | Apri #{{name}} |

| Clé | cs | ru | zh |
|---|---|---|---|
| `homeEmptyDescription` | Vyber kanál vlevo a začni si povídat. | Выберите канал слева, чтобы начать общение. | 从左侧选择一个频道开始聊天。 |
| `homeEmptyAction` | Otevřít #{{name}} | Открыть #{{name}} | 打开 #{{name}} |

Corriger au passage la traduction française existante de `welcomeToServer`,
aujourd'hui `"Bienvenu à {{name}}."` → `"Bienvenue sur {{name}}."`

- [ ] **Step 3 : brancher l'accueil du bureau**

Dans `apps/client/src/screens/server-view/content-wrapper.tsx`, remplacer tout
le bloc `else { content = ( <> … </> ) }` (celui qui contient le
`PluginSlotRenderer slotId={PluginSlot.HOME_SCREEN}` en `hidden lg:flex` et le
bloc `md:hidden` avec les deux flèches) par :

```tsx
    } else {
      content = <HomeEmpty />;
    }
```

et ajouter, au-dessus de `ContentWrapper` dans le même fichier :

```tsx
const HomeEmpty = memo(() => {
  const { t } = useTranslation();
  const serverName = useServerName();
  const info = useInfo();
  const channels = useChannels();
  const homePlugins = usePluginComponentsBySlot(PluginSlot.HOME_SCREEN);
  const can = useCan();

  const firstTextChannel = useMemo(
    () => channels.find((channel) => channel.type === ChannelType.TEXT),
    [channels]
  );

  const channelCan = useChannelCan(firstTextChannel?.id);
  const canOpenFirstChannel =
    !!firstTextChannel && channelCan(ChannelPermission.VIEW_CHANNEL);

  // PluginSlotRenderer renvoie null si le membre n'a pas USE_PLUGINS : sans
  // cette garde, un serveur à plugin d'accueil affiche un panneau VIDE à qui
  // n'a pas la permission.
  const canUsePlugins = can(Permission.USE_PLUGINS);
  const hasHomePlugin = canUsePlugins && Object.keys(homePlugins).length > 0;

  if (hasHomePlugin) {
    return (
      <div className="flex h-full w-full flex-col gap-2 overflow-auto">
        <PluginSlotRenderer slotId={PluginSlot.HOME_SCREEN} />
      </div>
    );
  }

  return (
    <EmptyState
      title={t('welcomeToServer', { name: serverName })}
      description={info?.description || t('homeEmptyDescription')}
      action={
        canOpenFirstChannel ? (
          <Button
            className="rounded-full"
            onClick={() => setSelectedChannelId(firstTextChannel.id)}
          >
            {t('homeEmptyAction', { name: firstTextChannel.name })}
          </Button>
        ) : undefined
      }
    >
      <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground md:hidden">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          <span>{t('swipeRightForChannels')}</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>{t('swipeLeftForUsers')}</span>
        </div>
      </div>
    </EmptyState>
  );
});
```

Imports à ajouter en tête du fichier :

```tsx
import { EmptyState } from '@/components/empty-state';
import { setSelectedChannelId } from '@/features/server/channels/actions';
import { useChannels } from '@/features/server/channels/hooks';
import { useCan, useChannelCan, useInfo } from '@/features/server/hooks';
import { usePluginComponentsBySlot } from '@/features/server/plugins/hooks';
import { ChannelPermission, Permission } from '@sharkord/shared';
import { Button } from '@sharkord/ui';
import { useMemo } from 'react';
```

Trois pièges :

1. `usePluginComponentsBySlot` renvoie un objet `{ [pluginId]: Component[] }` :
   tester `Object.keys(...).length`, pas la vérité de l'objet, qui est toujours
   vraie.
2. Ne **pas** appeler `useChannelCan` dans une boucle sur les salons : un seul
   candidat, le premier salon texte, et le bouton disparaît s'il n'est pas
   visible.
3. Les deux lignes de balayage restent `md:hidden` : elles ne concernent que le
   mobile, elles passent en `children` de l'état vide.

- [ ] **Step 4 : porte**

```bash
cd /c/Users/Neckr/Documents/bullshark
bun run format:check && bun run check-types && bun run lint
```

Attendu : trois commandes vertes. Si `format:check` échoue, lancer
`bun run format` puis relire le diff.

- [ ] **Step 5 : vérification visuelle en dev**

```bash
cd apps/client && bun dev
```

Se connecter, ne sélectionner aucun salon : l'accueil doit afficher le nom du
serveur, sa description, le bouton d'ouverture, et le logo en filigrane à peine
visible derrière. Basculer en thème clair (paramètres) : le filigrane doit
rester lisible sans écraser le texte.

- [ ] **Step 6 : commit**

```bash
git add apps/client/src/components/empty-state apps/client/src/screens/server-view/content-wrapper.tsx apps/client/src/i18n/locales
git commit -m "feat(client): watermarked empty state and desktop home welcome"
```

---

## Task 2 : salon vide et DM sans conversation

**Files:**

- Modify: `apps/client/src/components/channel-view/text/index.tsx`
- Modify: `apps/client/src/screens/server-view/content-wrapper.tsx:56`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/common.json`

**Interfaces:**

- Consumes : `EmptyState` de la tâche 1.
- Produces : rien de nouveau.

- [ ] **Step 1 : clés i18n dans les 7 locales**

`en/common.json` :

```json
  "channelEmptyTitle": "This is the very beginning of #{{name}}",
  "channelEmptyDescription": "No one has said anything here yet. Go first.",
```

| Clé | fr | es | it |
|---|---|---|---|
| `channelEmptyTitle` | C'est le tout début de #{{name}} | Este es el comienzo de #{{name}} | Questo è l'inizio di #{{name}} |
| `channelEmptyDescription` | Personne n'a encore parlé ici. Lance-toi. | Nadie ha escrito aquí todavía. Empieza tú. | Nessuno ha ancora scritto qui. Inizia tu. |

| Clé | cs | ru | zh |
|---|---|---|---|
| `channelEmptyTitle` | Tohle je úplný začátek #{{name}} | Это самое начало #{{name}} | 这是 #{{name}} 的起点 |
| `channelEmptyDescription` | Zatím tu nikdo nic nenapsal. Začni. | Здесь ещё никто не писал. Начните первым. | 这里还没有人发言，来说第一句吧。 |

- [ ] **Step 2 : le salon vide**

Dans `apps/client/src/components/channel-view/text/index.tsx`, le conteneur de
défilement (autour de la ligne 195) contient aujourd'hui :

```tsx
        <div className="space-y-4">
          {groupedMessages.map((group) => (
```

Le remplacer par :

```tsx
        {groupedMessages.length === 0 && !fetching ? (
          <EmptyState
            title={t('channelEmptyTitle', { name: channel?.name ?? '' })}
            description={t('channelEmptyDescription')}
          />
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group) => (
              …inchangé…
            ))}
          </div>
        )}
```

`channel` n'existe pas encore dans ce composant : ajouter
`const channel = useChannelById(channelId);` à côté des autres hooks, avec
`import { useChannelById } from '@/features/server/channels/hooks';`.

Attention : le conteneur de défilement a la classe `flex-1 overflow-y-auto` ;
l'état vide en `h-full` s'y centre correctement. Ne pas retirer `pb-7` du
conteneur, la hauteur du compositeur en dépend.

- [ ] **Step 3 : le DM sans conversation**

Dans `content-wrapper.tsx`, remplacer :

```tsx
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('selectDmPrompt')}
          </div>
```

par :

```tsx
          <EmptyState title={t('selectDmPrompt')} />
```

- [ ] **Step 4 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 5 : vérification visuelle**

Créer un salon texte neuf, l'ouvrir : le titre doit nommer le salon et le
filigrane apparaître. Passer en mode DM sans conversation ouverte : même
traitement.

- [ ] **Step 6 : commit**

```bash
git add apps/client/src
git commit -m "feat(client): empty states for empty channels and the DM pane"
```

---

## Task 3 : variantes compactes (liste de DM, recherche)

**Files:**

- Modify: `apps/client/src/components/left-sidebar/direct-messages/index.tsx:158`
- Modify: `apps/client/src/components/dialogs/search/index.tsx:82`

**Interfaces:**

- Consumes : `EmptyState` variante `compact`.

- [ ] **Step 1 : liste de DM vide**

Remplacer :

```tsx
          {conversations.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground">
              {t('noDMsYet')}
            </div>
          )}
```

par :

```tsx
          {conversations.length === 0 && (
            <EmptyState
              variant="compact"
              icon={<MessageSquare className="h-5 w-5" />}
              title={t('noDMsYet')}
            />
          )}
```

Imports : `import { EmptyState } from '@/components/empty-state';` et
`MessageSquare` depuis `lucide-react`.

- [ ] **Step 2 : recherche sans résultat**

Dans `components/dialogs/search/index.tsx`, le vide est rendu par
`PaginatedList.Empty` (ligne 81). Remplacer :

```tsx
                <PaginatedList.Empty className="flex h-full min-h-55 items-center justify-center rounded-lg bg-muted/20 px-6 text-sm text-muted-foreground">
                  {t('noResults')}
                </PaginatedList.Empty>
```

par :

```tsx
                <PaginatedList.Empty className="flex h-full min-h-55 items-center justify-center rounded-lg bg-muted/20 px-6">
                  <EmptyState
                    variant="compact"
                    icon={<SearchX className="h-5 w-5" />}
                    title={t('noResults')}
                  />
                </PaginatedList.Empty>
```

Les classes de typographie (`text-sm text-muted-foreground`) partent avec le
texte : c'est `EmptyState` qui les porte désormais. Les classes de mise en page
(`flex h-full min-h-55 …`) restent sur `PaginatedList.Empty`.

Imports : `EmptyState` et `SearchX` depuis `lucide-react`.

- [ ] **Step 3 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 4 : commit**

```bash
git add apps/client/src
git commit -m "feat(client): compact empty states for DM list and search"
```

---

## Task 4 : éclatement de l'écran de connexion, sans changement visuel

Cette tâche ne doit produire **aucune différence à l'écran**. Elle sépare la
logique du rendu pour que la tâche 5 ne touche que du CSS et de la structure.

**Files:**

- Create: `apps/client/src/screens/connect/connect-form.tsx`
- Modify: `apps/client/src/screens/connect/index.tsx`

**Interfaces:**

- Produces : `ConnectForm`, props :

  ```ts
  type TConnectFormProps = {
    values: { identity: string; password: string; autoLogin: boolean };
    r: (name: 'identity' | 'password') => Record<string, unknown>;
    onChange: (name: 'autoLogin', value: boolean) => void;
    loading: boolean;
    challenge: string | null;
    twoFactorCode: string;
    setTwoFactorCode: (value: string) => void;
    useRecovery: boolean;
    setUseRecovery: (value: boolean) => void;
    onConnectClick: () => void;
    submitTwoFactor: () => void;
    inviteCode?: string;
    allowNewUsers?: boolean;
  };
  ```

  Le type exact de `r` doit être repris **tel quel** de `useForm`
  (`apps/client/src/hooks/use-form.ts`) : lire ce fichier et réutiliser son type
  de retour plutôt que de le retaper.

- [ ] **Step 1 : déplacer le rendu**

Créer `connect-form.tsx` avec, à l'identique, tout ce qui est aujourd'hui entre
`<CardContent …>` et `</CardContent>` dans `index.tsx`, plus le `Card`,
`CardHeader`, `CardTitle`, le logo et le `PluginSlotRenderer`. Copier les
attributs sans les réécrire, `data-testid` compris.

- [ ] **Step 2 : alléger index.tsx**

`index.tsx` garde : `useForm`, `loading`, `challenge`, `twoFactorCode`,
`useRecovery`, `info`, `inviteCode`, `finishLogin`, `onConnectClick`,
`submitTwoFactor`, `logoSrc`, le `LanguageSwitcher`, le pied de page, et rend
`<ConnectForm … />` en lui passant les props ci-dessus.

- [ ] **Step 3 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 4 : preuve que rien n'a bougé — E2E**

```bash
cd packages/e2e && bun run test:e2e connect.pw.ts
```

Attendu : les 3 tests de `Connect Screen` passent.

**Si le lancement échoue sur un port occupé** (`4991` ou `5173`), c'est un
serveur fantôme d'un run interrompu : ne pas tenter de le tuer, demander à
l'utilisateur de lancer lui-même la commande d'arrêt sur sa machine.

- [ ] **Step 5 : commit**

```bash
git add apps/client/src/screens/connect
git commit -m "refactor(client): split the connect screen into state and form"
```

---

## Task 5 : la scène de connexion

**Files:**

- Create: `apps/client/src/screens/connect/connect-scene.tsx`
- Modify: `apps/client/src/screens/connect/index.tsx`
- Modify: `apps/client/src/screens/connect/connect-form.tsx`

**Interfaces:**

- Consumes : `ConnectForm` de la tâche 4.
- Produces : `ConnectScene` (aucune prop, purement décoratif).

- [ ] **Step 1 : le fond**

Créer `connect-scene.tsx` :

```tsx
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
```

- [ ] **Step 2 : les couleurs et la dérive, dans index.css**

Ajouter à la fin de `apps/client/src/index.css` :

```css
.connect-halo-a {
  background: color-mix(in oklab, var(--primary) 42%, transparent);
  animation: connect-drift-a 34s ease-in-out infinite alternate;
}

.connect-halo-b {
  background: color-mix(in oklab, var(--primary) 26%, transparent);
  animation: connect-drift-b 41s ease-in-out infinite alternate;
}

@keyframes connect-drift-a {
  to {
    transform: translate3d(3rem, 2rem, 0) scale(1.12);
  }
}

@keyframes connect-drift-b {
  to {
    transform: translate3d(-2.5rem, -1.5rem, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .connect-halo {
    animation: none;
  }
}
```

Le `blur` et la géométrie restent en classes Tailwind sur le composant ; seules
la couleur (qui a besoin de `color-mix`) et l'animation vivent dans le CSS.

- [ ] **Step 3 : la mise en page**

Dans `index.tsx`, le conteneur racine devient :

```tsx
    <div className="relative flex h-full flex-col items-center justify-center gap-2 overflow-hidden">
      <ConnectScene />

      <div className="relative grid w-full max-w-4xl items-center gap-8 px-6 lg:grid-cols-2">
        <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
          <img
            src={logoSrc}
            alt="Bullshark"
            className="block max-h-24 max-w-full rounded-[var(--radius)] lg:max-h-40"
          />
          {info?.name && (
            <h1 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">
              {info.name}
            </h1>
          )}
          {info?.description && (
            <p className="max-w-sm text-sm text-muted-foreground">
              {info.description}
            </p>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            v{VITE_APP_VERSION}
          </span>
        </div>

        <ConnectForm … />
      </div>

      …LanguageSwitcher et pied de page inchangés…
    </div>
```

Contraintes :

- **Une seule balise `img` avec `alt="Bullshark"`** dans tout l'arbre : le logo
  quitte le `CardHeader` de `ConnectForm`, qui perd aussi le nom du serveur et
  la description (ils sont désormais dans la colonne de gauche). Le
  `PluginSlotRenderer slotId={PluginSlot.CONNECT_SCREEN}` reste dans la carte.
- Sous `lg`, la grille est à une colonne : identité puis carte, centrées.

- [ ] **Step 4 : la carte en verre et le bouton**

Dans `connect-form.tsx` :

- Le `Card` reçoit
  `className="w-full bg-card/80 shadow-2xl backdrop-blur-xl"`.
  Le `/80` est obligatoire : sans lui le `backdrop-blur` n'a rien à flouter.
  (`border-white/10` a été retiré après revue : `Card` porte déjà `border` et
  `border-border` via la règle globale, et `border-white/10` l'écrasait — en
  thème clair `--card` et `--background` valent tous deux
  `oklch(1 0 0)`, donc la bordure disparaissait complètement.)
- Le bouton de connexion perd `variant="outline"` (donc `variant` par défaut) et
  reçoit `className="w-full rounded-full"`. **Pas `rounded-pill`.**
- Pendant `loading`, le libellé est remplacé par `<Spinner size="xs" />`
  (`import { Spinner } from '@sharkord/ui'`). L'attribut `disabled` et le
  `data-testid` ne changent pas.
- Le bouton de la vue 2FA reçoit le même traitement.

- [ ] **Step 5 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 6 : E2E de non-régression**

```bash
cd packages/e2e && bun run test:e2e connect.pw.ts
```

Attendu : 3 tests verts. Un échec sur `getByAltText('Bullshark')` en mode strict
signifie qu'il reste deux logos dans l'arbre : en supprimer un.

- [ ] **Step 7 : vérification dans le bundle construit**

```bash
cd apps/client && bun run build
grep -o "connect-halo-a{[^}]*}" dist/assets/*.css | head -3
grep -c "prefers-reduced-motion" dist/assets/*.css
grep -o "bg-card\\\\/80{[^}]*}" dist/assets/*.css | head -3
```

Attendu :

1. la règle `connect-halo-a` contient `color-mix(in oklab,var(--primary)…` et
   non une couleur littérale ;
2. au moins une occurrence de `prefers-reduced-motion` ;
3. `bg-card\/80` sort bien en `color-mix(… var(--card) 80% …)` — s'il sort en
   couleur opaque, le verre ne floute rien et la tâche n'est pas finie.

- [ ] **Step 8 : commit**

```bash
git add apps/client/src
git commit -m "feat(client): stage the connect screen with a themed scene"
```

---

## Task 6 : permission d'envoi extraite et six chaînes en dur passées en i18n

**Files:**

- Create: `apps/client/src/hooks/use-upload-permission.ts`
- Modify: `apps/client/src/hooks/use-upload-files.ts`
- Modify: `apps/client/src/components/channel-view/text/index.tsx:181`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/common.json`

**Interfaces:**

- Produces :

  ```ts
  type TUploadRefusal =
    | 'uploadsDisabled'
    | 'dmSharingDisabled'
    | 'noUploadPermission';

  type TUploadPermission = { allowed: boolean; reason?: TUploadRefusal };

  const useUploadPermission: (
    channelId: number,
    disabled?: boolean
  ) => TUploadPermission;
  ```

  Les tâches 7 et 8 consomment `reason` pour choisir le texte de l'incrustation.

- [ ] **Step 1 : le hook**

Créer `apps/client/src/hooks/use-upload-permission.ts` :

```ts
import { useChannelById } from '@/features/server/channels/hooks';
import { useCan, usePublicServerSettings } from '@/features/server/hooks';
import { Permission } from '@sharkord/shared';
import { useMemo } from 'react';

type TUploadRefusal =
  | 'uploadsDisabled'
  | 'dmSharingDisabled'
  | 'noUploadPermission';

type TUploadPermission = {
  allowed: boolean;
  reason?: TUploadRefusal;
};

const useUploadPermission = (
  channelId: number,
  disabled: boolean = false
): TUploadPermission => {
  const settings = usePublicServerSettings();
  const channel = useChannelById(channelId);
  const can = useCan();

  return useMemo(() => {
    if (disabled) {
      return { allowed: false };
    }

    if (!settings?.storageUploadEnabled) {
      return { allowed: false, reason: 'uploadsDisabled' };
    }

    if (channel?.isDm && !settings?.storageFileSharingInDirectMessages) {
      return { allowed: false, reason: 'dmSharingDisabled' };
    }

    if (!can(Permission.UPLOAD_FILES)) {
      return { allowed: false, reason: 'noUploadPermission' };
    }

    return { allowed: true };
  }, [disabled, settings, channel?.isDm, can]);
};

export { useUploadPermission, type TUploadPermission, type TUploadRefusal };
```

L'ordre des trois refus reproduit exactement celui de `checkUploadPermissions`
dans `use-upload-files.ts` — ne pas le réordonner, le message affiché en
dépend.

- [ ] **Step 2 : clés i18n dans les 7 locales**

`en/common.json` :

```json
  "uploadsDisabled": "File uploads are disabled on this server.",
  "dmSharingDisabled": "File sharing in direct messages is disabled on this server.",
  "noUploadPermission": "You do not have permission to upload files.",
  "uploadMaxFilesReached": "Maximum attachments reached ({{count}} per message).",
  "uploadFileIgnored_one": "{{count}} file was ignored due to the per-message attachment limit.",
  "uploadFileIgnored_other": "{{count}} files were ignored due to the per-message attachment limit.",
  "uploadFileTooLarge": "\"{{name}}\" exceeds the maximum file size limit.",
  "fetchingOlderMessages": "Fetching older messages…",
```

Les suffixes `_one` / `_other` sont la forme de pluriel i18next déjà employée
dans ce dépôt (`reply_one` / `reply_other`, `common.json:79`). Le russe et le
tchèque ont des formes supplémentaires : y écrire au minimum `_one`, `_few` et
`_many` pour `ru`, `_one`, `_few` et `_other` pour `cs`. Si le doute subsiste
sur une forme, écrire une phrase qui ne dépend pas du pluriel plutôt que
d'inventer une déclinaison fausse.

Traductions françaises :

```json
  "uploadsDisabled": "Les envois de fichiers sont désactivés sur ce serveur.",
  "dmSharingDisabled": "Le partage de fichiers en message privé est désactivé sur ce serveur.",
  "noUploadPermission": "Tu n'as pas la permission d'envoyer des fichiers.",
  "uploadMaxFilesReached": "Nombre maximum de pièces jointes atteint ({{count}} par message).",
  "uploadFileIgnored_one": "{{count}} fichier ignoré : limite de pièces jointes par message.",
  "uploadFileIgnored_other": "{{count}} fichiers ignorés : limite de pièces jointes par message.",
  "uploadFileTooLarge": "« {{name}} » dépasse la taille maximale autorisée.",
  "fetchingOlderMessages": "Chargement des messages plus anciens…",
```

Écrire les quatre autres langues sur le même modèle.

- [ ] **Step 3 : brancher use-upload-files**

Dans `apps/client/src/hooks/use-upload-files.ts` :

- Ajouter `const { t } = useTranslation();`
  (`import { useTranslation } from 'react-i18next';`).
- Remplacer le corps de `checkUploadPermissions` par un appel à
  `useUploadPermission(channelId, disabled)` et un `switch` sur `reason` qui
  choisit le toast : `uploadsDisabled` et `dmSharingDisabled` en
  `toast.warning`, `noUploadPermission` en `toast.error` — c'est le découpage
  actuel, le conserver.
- Remplacer les trois autres chaînes littérales (`Maximum attachments
  reached…`, `… ignored due to the per-message attachment limit.`,
  `"…" exceeds the maximum file size limit.`) par `t('uploadMaxFilesReached', { count })`,
  `t('uploadFileIgnored', { count: discardedCount })` et
  `t('uploadFileTooLarge', { name: file.name })`.
- Ajouter `t` aux tableaux de dépendances des `useCallback` concernés.

**Ne pas toucher** au `useMemo` `canUploadFiles` de
`components/message-compose/index.tsx:111` : il ne teste pas
`storageUploadEnabled`, et le brancher sur le nouveau hook ferait disparaître le
trombone quand les envois sont coupés. C'est peut-être souhaitable, mais c'est
un changement de comportement hors périmètre de ce chantier.

- [ ] **Step 4 : le bandeau de chargement**

Dans `components/channel-view/text/index.tsx`, ligne 181, remplacer le texte
littéral `Fetching older messages...` par `{t('fetchingOlderMessages')}`. Le `t`
est déjà présent dans ce composant.

- [ ] **Step 5 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 6 : vérification qu'aucune chaîne n'a été oubliée**

```bash
cd /c/Users/Neckr/Documents/bullshark
grep -n "disabled on this server\|permission to upload\|attachment limit\|maximum file size\|Fetching older" apps/client/src --include=*.ts --include=*.tsx -r
```

Attendu : **aucun résultat**.

- [ ] **Step 7 : commit**

```bash
git add apps/client/src
git commit -m "refactor(client): extract upload permission and translate upload strings"
```

---

## Task 7 : détection du glisser et incrustation

**Files:**

- Create: `apps/client/src/hooks/use-file-drag.ts`
- Create: `apps/client/src/components/channel-view/text/drop-overlay.tsx`
- Modify: `apps/client/src/hooks/use-upload-files.ts`
- Modify: `apps/client/src/components/message-compose/index.tsx`
- Modify: `packages/shared/src/test-ids.ts`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/common.json`

**Interfaces:**

- Consumes : `TUploadRefusal` de la tâche 6.
- Produces :
  - `useFileDrag(targetRef: RefObject<HTMLElement | null>, options: { onFiles: (files: File[]) => void; disabled?: boolean }) => boolean`
  - `DropOverlay`, props
    `{ channelName?: string; refusal?: TUploadRefusal; maxFiles?: number; maxFileSize?: number }`
  - `TMessageComposeHandle` gagne `addFiles: (files: File[]) => void`
  - `TestId.DROP_OVERLAY = 'drop-overlay'`

  La tâche 8 branche les trois.

- [ ] **Step 1 : le hook de détection**

Créer `apps/client/src/hooks/use-file-drag.ts` :

```ts
import { useEffect, useRef, useState, type RefObject } from 'react';

type TUseFileDragOptions = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

// Un glisser de texte ou d'un message interne ne doit rien allumer.
const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files');

const useFileDrag = (
  targetRef: RefObject<HTMLElement | null>,
  { onFiles, disabled = false }: TUseFileDragOptions
) => {
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);
  const onFilesRef = useRef(onFiles);

  onFilesRef.current = onFiles;

  useEffect(() => {
    const target = targetRef.current;

    if (!target || disabled) return;

    const reset = () => {
      depthRef.current = 0;
      setIsDragging(false);
    };

    // dragenter/dragleave se déclenchent aussi en passant d'un enfant à
    // l'autre : sans compteur, l'incrustation clignote au milieu du salon.
    const handleDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      depthRef.current += 1;
      setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      depthRef.current -= 1;

      if (depthRef.current <= 0) {
        reset();
      }
    };

    // Sans preventDefault sur dragover, le navigateur ouvre le fichier.
    const handleDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (event: DragEvent) => {
      reset();

      if (!carriesFiles(event)) return;

      event.preventDefault();

      const items = Array.from(event.dataTransfer?.items ?? []);
      const fromItems = items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);

      const files = fromItems.length
        ? fromItems
        : Array.from(event.dataTransfer?.files ?? []);

      if (files.length) {
        onFilesRef.current(files);
      }
    };

    target.addEventListener('dragenter', handleDragEnter);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('dragover', handleDragOver);
    target.addEventListener('drop', handleDrop);

    // Un glisser relâché hors de la fenêtre n'émet pas de dragleave
    // exploitable : sans ce filet, l'incrustation reste collée à l'écran.
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);

    return () => {
      target.removeEventListener('dragenter', handleDragEnter);
      target.removeEventListener('dragleave', handleDragLeave);
      target.removeEventListener('dragover', handleDragOver);
      target.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop', reset);
    };
  }, [targetRef, disabled]);

  return isDragging;
};

export { useFileDrag };
```

- [ ] **Step 2 : retirer les anciens écouteurs de dépôt**

Dans `apps/client/src/hooks/use-upload-files.ts`, le `useEffect` des lignes
~340-380 accroche `paste`, `dragover` et `drop` au conteneur du compositeur.

**Supprimer `handleDragOver` et `handleDrop`, ainsi que leurs
`addEventListener` / `removeEventListener`. Garder `paste` intact.**

C'est obligatoire, pas cosmétique : le compositeur est à l'intérieur de la
future surface de dépôt, donc un `drop` déclencherait **deux** envois, un par
écouteur. Le collage, lui, reste borné au compositeur pour ne pas capter les
collages d'édition de message.

Exposer `processFiles` dans l'objet retourné par le hook (et l'ajouter au
tableau de dépendances du `useMemo` final).

- [ ] **Step 3 : `addFiles` sur le handle du compositeur**

Dans `components/message-compose/index.tsx` :

```tsx
type TMessageComposeHandle = {
  clearFiles: () => void;
  focus: () => void;
  addFiles: (files: File[]) => void;
};
```

et :

```tsx
    useImperativeHandle(
      ref,
      () => ({
        clearFiles,
        focus: () => tiptapRef.current?.focus(),
        addFiles: (droppedFiles: File[]) => {
          void processFiles(droppedFiles);
        }
      }),
      [clearFiles, processFiles]
    );
```

`processFiles` doit être ajouté à la déstructuration de `useUploadFiles`
(ligne 135-145 du fichier) :

```tsx
    const {
      files,
      displayItems,
      removeFile,
      clearFiles,
      uploading,
      uploadingSize,
      uploadSpeed,
      openFileDialog,
      fileInputProps,
      processFiles
    } = useUploadFiles(channelId, containerRef, !canSendMessages);
```

- [ ] **Step 4 : le TestId**

Dans `packages/shared/src/test-ids.ts`, ajouter à l'enum :

```ts
  DROP_OVERLAY = 'drop-overlay',
```

- [ ] **Step 5 : clés i18n dans les 7 locales**

`en/common.json` :

```json
  "dropToSendInChannel": "Drop to send in #{{name}}",
  "dropToSendHere": "Drop to send here",
  "dropLimits": "{{count}} files max · {{size}} per file",
  "dropRefusedTitle": "You can't drop files here",
```

Français :

```json
  "dropToSendInChannel": "Déposer pour envoyer dans #{{name}}",
  "dropToSendHere": "Déposer pour envoyer ici",
  "dropLimits": "{{count}} fichiers maximum · {{size}} par fichier",
  "dropRefusedTitle": "Impossible de déposer des fichiers ici",
```

Puis les cinq autres langues. Les trois motifs de refus réutilisent les clés de
la tâche 6 (`uploadsDisabled`, `dmSharingDisabled`, `noUploadPermission`) : ne
pas en créer de nouvelles.

- [ ] **Step 6 : l'incrustation**

Créer `apps/client/src/components/channel-view/text/drop-overlay.tsx` :

```tsx
import type { TUploadRefusal } from '@/hooks/use-upload-permission';
import { TestId } from '@sharkord/shared';
import { filesize } from 'filesize';
import { CircleSlash, Upload } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type TDropOverlayProps = {
  channelName?: string;
  refusal?: TUploadRefusal;
  maxFiles?: number;
  maxFileSize?: number;
};

const DropOverlay = memo(
  ({ channelName, refusal, maxFiles, maxFileSize }: TDropOverlayProps) => {
    const { t } = useTranslation();

    const limits = useMemo(() => {
      if (!maxFiles || !maxFileSize) return undefined;

      return t('dropLimits', {
        count: maxFiles,
        size: filesize(maxFileSize)
      });
    }, [maxFiles, maxFileSize, t]);

    const title = refusal
      ? t('dropRefusedTitle')
      : channelName
        ? t('dropToSendInChannel', { name: channelName })
        : t('dropToSendHere');

    const subtitle = refusal ? t(refusal) : limits;

    return (
      <div
        data-testid={TestId.DROP_OVERLAY}
        className={`pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed bg-background/70 backdrop-blur-sm animate-in fade-in duration-150 ${
          refusal ? 'border-destructive/60' : 'border-primary/60'
        }`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            refusal
              ? 'bg-destructive/15 text-destructive'
              : 'bg-primary/15 text-primary'
          }`}
        >
          {refusal ? (
            <CircleSlash className="h-6 w-6" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </div>

        <span className="font-display text-base font-semibold">{title}</span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    );
  }
);

export { DropOverlay };
```

`pointer-events-none` est indispensable : l'incrustation ne doit jamais
intercepter le `drop`, qui est écouté par la surface en dessous.

- [ ] **Step 7 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 8 : commit**

```bash
git add apps/client/src packages/shared/src/test-ids.ts
git commit -m "feat(client): file drag detection hook and drop overlay"
```

---

## Task 8 : brancher la zone de dépôt sur le salon et sur les fils

**Files:**

- Modify: `apps/client/src/components/channel-view/text/index.tsx`
- Modify: `apps/client/src/components/thread-sidebar/tread-content.tsx`

**Interfaces:**

- Consumes : `useFileDrag`, `DropOverlay`, `useUploadPermission`,
  `TMessageComposeHandle.addFiles`.

- [ ] **Step 1 : envelopper le salon**

`TextChannel` rend aujourd'hui un fragment `<>…</>`. L'envelopper dans :

```tsx
    <div
      ref={dropRef}
      className="relative flex flex-1 flex-col min-h-0"
    >
      …contenu inchangé…
      {isDraggingFiles && (
        <DropOverlay
          channelName={channel?.isDm ? undefined : channel?.name}
          refusal={uploadPermission.reason}
          maxFiles={settings?.storageMaxFilesPerMessage}
          maxFileSize={settings?.storageUploadMaxFileSize}
        />
      )}
    </div>
```

Ces classes reproduisent le contexte flex du parent. Vérifié sur les trois sites
d'appel :

- `screens/server-view/content-wrapper.tsx:48` et `:71`, sous
  `main.flex.flex-1.flex-col.relative.min-w-0.min-h-0` ;
- `components/voice-chat-sidebar/index.tsx:31`, sous
  `div.flex-1.flex.flex-col.overflow-hidden`.

**Piège du chantier 1 :** ne pas ajouter `w-full` — la largeur est déjà donnée
par le parent, et un `w-full` de trop avait écrasé un offset au chantier 1.

- [ ] **Step 2 : l'état et le branchement**

Dans le même composant :

```tsx
  const dropRef = useRef<HTMLDivElement>(null);
  const settings = usePublicServerSettings();
  const canSend = channelCan(ChannelPermission.SEND_MESSAGES);
  const uploadPermission = useUploadPermission(channelId, !canSend);

  const onDropFiles = useCallback((droppedFiles: File[]) => {
    composeRef.current?.addFiles(droppedFiles);
  }, [composeRef]);

  const isDraggingFiles = useFileDrag(dropRef, {
    onFiles: onDropFiles,
    disabled: !canSend
  });
```

`composeRef` existe déjà, il vient de `useArrowUpEdit`. `channelCan` et
`channelId` aussi. Imports à ajouter :

```tsx
import { DropOverlay } from './drop-overlay';
import { useChannelById } from '@/features/server/channels/hooks';
import { usePublicServerSettings } from '@/features/server/hooks';
import { useFileDrag } from '@/hooks/use-file-drag';
import { useUploadPermission } from '@/hooks/use-upload-permission';
```

`useChannelById` a déjà été ajouté à ce fichier par la tâche 2 : ne pas le
dupliquer.

Quand `uploadPermission.allowed` est faux, on garde l'incrustation mais en
variante refus : c'est tout l'intérêt, aujourd'hui un dépôt refusé hors du
compositeur ne produit rien du tout. En revanche, `onFiles` doit alors ne rien
faire — `processFiles` refusera de toute façon via `checkUploadPermissions`,
mais autant ne pas l'appeler :

```tsx
  const onDropFiles = useCallback(
    (droppedFiles: File[]) => {
      if (!uploadPermission.allowed) return;

      composeRef.current?.addFiles(droppedFiles);
    },
    [composeRef, uploadPermission.allowed]
  );
```

- [ ] **Step 3 : le fil**

Dans `components/thread-sidebar/tread-content.tsx`, la racine est
`<div className="flex flex-col h-full w-full">`. Lui ajouter `relative` et un
`ref={dropRef}`, puis reproduire exactement le même branchement qu'au step 2 :
même hook, même incrustation, `channelName` laissé indéfini (un fil n'a pas de
nom de salon propre, l'incrustation dira « Déposer pour envoyer ici »).

Le fil est rendu **au-dessus** du salon dans une colonne distincte : les deux
surfaces ne se recouvrent pas, il n'y a donc pas de double envoi. Vérifier ce
point à la main (step 5).

- [ ] **Step 4 : porte**

```bash
bun run format:check && bun run check-types && bun run lint
```

- [ ] **Step 5 : vérification manuelle, la plus importante de ce plan**

`cd apps/client && bun dev`, puis, dans un salon texte :

1. Glisser un fichier depuis le bureau vers **la liste des messages** :
   l'incrustation apparaît, le dépôt ajoute bien **une seule** fois le fichier au
   compositeur (compter les vignettes : deux vignettes = les anciens écouteurs
   n'ont pas été retirés, revenir à la tâche 7 step 2).
2. Promener le curseur d'un message à l'autre pendant le glisser :
   l'incrustation ne doit pas clignoter.
3. Sortir de la fenêtre et relâcher : l'incrustation disparaît.
4. Sélectionner du texte dans un message et le glisser : **rien** ne doit
   s'allumer.
5. Ouvrir un fil et glisser au-dessus : l'incrustation du fil s'affiche, celle du
   salon ne s'affiche pas.
6. Couper les envois de fichiers dans les réglages du serveur, recommencer :
   l'incrustation passe en rouge et annonce la raison.

- [ ] **Step 6 : commit**

```bash
git add apps/client/src
git commit -m "feat(client): channel-wide file drop zone with overlay"
```

---

## Task 9 : test E2E de la zone de dépôt et contrôle du bundle

**Files:**

- Create: `packages/e2e/tests/drop-zone.pw.ts`

**Interfaces:**

- Consumes : `TestId.DROP_OVERLAY`, `TestId.CONNECT_*`, `TestId.CHANNEL_ITEM`.

- [ ] **Step 1 : écrire le test**

Créer `packages/e2e/tests/drop-zone.pw.ts` :

```ts
import { expect, test } from '@playwright/test';
import { TestId } from '@sharkord/shared';

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByTestId(TestId.CONNECT_IDENTITY_INPUT).fill('testowner');
  await page.getByTestId(TestId.CONNECT_PASSWORD_INPUT).fill('password123');
  await page.getByTestId(TestId.CONNECT_BUTTON).click();
  await expect(page.getByTestId(TestId.SERVER_VIEW)).toBeVisible();
};

test.describe('Drop zone', () => {
  test('shows the overlay when files are dragged over the message list', async ({
    page
  }) => {
    await login(page);
    await page.getByTestId(TestId.CHANNEL_ITEM).first().click();

    const messages = page.locator('[data-messages-container]');
    await expect(messages).toBeVisible();

    // Playwright ne simule pas un glisser venu du système : on fabrique le
    // DataTransfer dans la page et on émet les évènements à la main.
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();

      transfer.items.add(
        new File(['hello'], 'score.png', { type: 'image/png' })
      );

      return transfer;
    });

    await messages.dispatchEvent('dragenter', { dataTransfer });
    await expect(page.getByTestId(TestId.DROP_OVERLAY)).toBeVisible();

    await messages.dispatchEvent('dragleave', { dataTransfer });
    await expect(page.getByTestId(TestId.DROP_OVERLAY)).toBeHidden();
  });
});
```

- [ ] **Step 2 : lancer le test**

```bash
cd packages/e2e && bun run test:e2e drop-zone.pw.ts
```

Attendu : 1 test vert.

Si le test échoue sur `toBeHidden`, c'est le compteur `dragenter`/`dragleave` :
un `dragenter` émis sur un enfant a incrémenté sans que le `dragleave`
correspondant redescende. Relire `use-file-drag.ts`, ne pas contourner en
forçant `setIsDragging(false)`.

Si le lancement échoue sur un port occupé (`4991`), c'est un serveur fantôme
d'un run interrompu : demander la commande d'arrêt à l'utilisateur.

- [ ] **Step 3 : suite E2E complète**

```bash
cd packages/e2e && bun run test:e2e
```

Attendu : aucune régression par rapport à `main`.

- [ ] **Step 4 : contrôle du bundle construit**

```bash
cd apps/client && bun run build
grep -o "connect-halo-a{[^}]*}" dist/assets/*.css | head -2
grep -o "bg-card\\\\/80{[^}]*}" dist/assets/*.css | head -2
grep -c "radial-gradient(closest-side" dist/assets/*.js
grep -c "prefers-reduced-motion" dist/assets/*.css
```

Attendu, dans l'ordre : le halo consomme `var(--primary)` ; `bg-card/80` sort en
`color-mix` ; le masque du filigrane est bien présent dans le JS (il est en
`style` inline, donc dans le bundle JS et non le CSS) ; au moins une règle
`prefers-reduced-motion`.

- [ ] **Step 5 : portes complètes et commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
bun run format:check && bun run check-types && bun run lint
git add packages/e2e
git commit -m "test(e2e): cover the channel drop overlay"
```

- [ ] **Step 6 : pousser la branche**

```bash
git push origin feat/first-impression
git push github feat/first-impression
```

---

## Après le plan

La branche n'est **pas** fusionnable tant que l'utilisateur ne l'a pas déployée
sur son Kimsufi et validée à l'œil : aucun agent n'a de navigateur, et les trois
défauts les plus graves des chantiers 1 et 3 (typographie morte, colonne de code
mort, faux verre) étaient invisibles aux portes.

Commande de déploiement à lui donner telle quelle :

```bash
cd ~/bullshark && git fetch origin && git reset --hard origin/feat/first-impression && bun install && ( cd apps/server && bun run build ) && docker build -t bullshark:local . && docker compose up -d --build
```

## Amendements pendant l'implémentation

- **Hook de dépôt.** La spec (§C) décrivait un paramètre supplémentaire sur
  `use-upload-files.ts` exposant `isDraggingFiles`. Ce plan s'en écarte dès le
  tableau des fichiers touchés : la détection du glisser vit dans un hook
  séparé, `hooks/use-file-drag.ts`, adossé à un callback ref plutôt qu'à un
  `RefObject` (pour re-déclencher son effet quand la cible apparaît après le
  premier rendu, cas d'un squelette de chargement) ; le motif de refus vient
  d'un second hook, `hooks/use-upload-permission.ts`. `use-upload-files.ts`
  perd seulement `dragover`/`drop` et garde `processFiles`. Ce plan fait
  autorité sur ce point.
- **Colonne de gauche, version.** Le Step 3 ci-dessus garde
  `v{VITE_APP_VERSION}` dans la colonne de gauche de l'écran de connexion. Il a
  été retiré à l'implémentation : le pied de page en bas de l'écran affiche
  déjà la version, et le dupliquer n'ajoutait rien.
- **Fondu de l'incrustation.** La spec promettait une garde
  `prefers-reduced-motion` sur le fondu d'entrée/sortie de l'incrustation de
  dépôt. L'incrustation livrée utilise `animate-in fade-in duration-150` sans
  garde, et il n'y a pas de fondu de sortie : le composant se démonte
  directement. Reste dans le périmètre du chantier 2 (balayage
  `prefers-reduced-motion`).
- **Carte de connexion, bordure.** Le Step 4 ci-dessus a été corrigé après
  revue : `border-white/10` a été retiré du `className` de la carte en verre
  (voir la note insérée directement dans le Step 4). Il écrasait
  `border-border` posé par `Card` et la règle globale, et en thème clair
  `--card` et `--background` valent tous deux `oklch(1 0 0)`, donc la bordure
  disparaissait complètement. Pas de remplacement par `--edge-hi`, qui a le
  même défaut en thème clair.

Vider le cache Safari ou resupprimer la PWA, sinon l'ancien bundle est servi.
