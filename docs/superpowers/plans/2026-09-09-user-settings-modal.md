# Modale des paramètres utilisateur — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent la syntaxe case à cocher (`- [ ]`).

**But :** rapprocher la modale des paramètres **utilisateur** du style Discord
— desktop : vraie modale centrée avec nav latérale groupée par sections ;
mobile : carte de profil d'abord, pas d'onglets.

**Architecture :** `ServerScreenLayout` (le shell partagé par les 4 écrans de
réglages) passe de page plein écran à modale centrée avec fond assombri —
changement purement visuel, le portail/l'état ouverture-fermeture de
`ServerScreensProvider` ne bouge pas. Dans `UserSettings`, la rangée d'onglets
horizontaux est remplacée par un split responsive en classes Tailwind
(`md:`, comme le reste de l'app) : à partir de `md`, une nav latérale groupée
par sections pilote un `Tabs` Radix contrôlé de l'extérieur (`value`/
`onValueChange`, sans `TabsList` — Radix ne l'exige pas) ; en dessous de `md`,
une carte de profil (bannière/avatar/bio/date d'inscription, toutes déjà
disponibles) plus une liste plate des 6 sections, chaque tap poussant un
plein-écran par-dessus la carte avec un chevron retour — le même geste que
pour "Modifier le profil" (le formulaire `Profile` existant réutilisé tel
quel), généralisé aux 5 autres sections plutôt que traité comme un cas
spécial. Le contenu de chaque section (`Card`/`CardHeader`/`CardContent`)
n'est pas retouché.

**Pile :** React 19, Radix UI (`@bullshark/ui`), Tailwind 4.2.1, i18next
(7 locales), `date-fns` (déjà utilisé pour `memberSince` dans
`user-popover/index.tsx`).

**Spec :** `docs/superpowers/specs/2026-09-09-user-settings-modal-design.md`

## Contraintes globales

- Branche `feat/user-settings-modal`, base `main` = `70c9d18`.
- Prettier du client : `singleQuote: true`, `trailingComma: "none"`,
  `printWidth: 80`, `semi: true`. La CI casse sur `format:check` — le lancer
  avant chaque commit.
- Portes à zéro erreur avant chaque commit, depuis `apps/client` :
  `bun run format:check && bun run check-types && bun run lint`.
- Aucune dépendance nouvelle. Pas de nouveau composant `Dialog` Radix pour le
  shell : `ServerScreensProvider` gère déjà son propre portail
  (`createPortal` dans `#portal`) et son propre `Escape` (listener manuel
  dans `ComponentWrapper`, `components/server-screens/index.tsx:28-46`).
  Ajouter un second `Dialog` Radix par-dessus doublerait le portail et la
  gestion d'`Escape` pour rien — `ServerScreenLayout` se contente de
  reprendre les classes visuelles d'une modale (`fixed inset-0 bg-black/50`
  pour le fond, panneau centré), pas le composant.
- Périmètre strict : seul `UserSettings` reçoit la nav groupée / carte
  mobile. `ServerSettings`, `ChannelSettings`, `CategorySettings` héritent du
  nouveau `ServerScreenLayout` (fond assombri) automatiquement puisqu'ils le
  partagent, mais leur contenu et leur nav interne (toujours `Tabs`/
  `TabsList` plats) ne sont **pas** touchés dans ce chantier.
- Aucune fonctionnalité Discord absente de Bullshark (Nitro, Boost, Boutique,
  Quêtes, Liste de souhaits, Centre familial) — uniquement le style de mise
  en page est repris.
- Tout texte affiché passe par i18next, dans les **7** locales :
  `cs, en, es, fr, it, ru, zh`.
- Convention responsive du projet : classes Tailwind (`hidden md:flex`,
  `md:hidden`...), deux arbres DOM rendus en parallèle — pas de hook
  `matchMedia`. Voir `screens/server-view/index.tsx` pour le précédent.

---

### Tâche 1 : shell — `ServerScreenLayout` en modale centrée

**Fichiers :**

- Modifier : `apps/client/src/components/server-screens/server-screen-layout.tsx`

**Interfaces :**

- Consomme : rien de nouveau (mêmes props `close`, `title`, `children`).
- Produit : rien de nouveau — même signature, uniquement le rendu change.

Ce composant est partagé par les 4 écrans de réglages : ce changement les
affecte tous, c'est voulu (voir "Contraintes globales").

- [ ] **Étape 1 : remplacer le rendu plein écran par une modale**

Dans `apps/client/src/components/server-screens/server-screen-layout.tsx`,
remplacer le corps du composant :

```tsx
import { cn } from '@/lib/utils';
import { Button } from '@bullshark/ui';
import { X } from 'lucide-react';
import { memo } from 'react';

type TServerScreenLayoutProps = {
  close: () => void;
  title: string;
  children: React.ReactNode;
};

const ServerScreenLayout = memo(
  ({ close, title, children }: TServerScreenLayoutProps) => {
    // Ces écrans sont rendus dans un portail, donc PAR-DESSUS la barre du haut,
    // qui reste dans le DOM avec sa zone de glissement. Or une zone de
    // glissement est remise au système d'exploitation : ce qui est peint
    // au-dessus ne perce pas le trou, seul un `no-drag` explicite soustrait.
    // Sans les deux classes ci-dessous, le bouton de fermeture se retrouve
    // sous la bande de 48 px et cesse de répondre, sans la moindre erreur.
    const isDesktopShell = Boolean(window.bullshark?.isDesktop);

    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
          isDesktopShell && 'app-drag'
        )}
      >
        <div className="flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg md:h-[85dvh]">
          <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
            <h1 className="flex-1 text-lg font-semibold">{title}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className={cn(isDesktopShell && 'app-no-drag')}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    );
  }
);

export { ServerScreenLayout };
```

Deux différences volontaires avec l'ancien fichier, à ne pas "corriger" :

- Le padding (`p-6`) qui entourait `children` disparaît d'ici : chaque écran
  (`UserSettings`, `ServerSettings`...) garde son propre `mx-auto max-w-4xl`
  interne, qui portait déjà sa propre respiration. Le retirer du shell évite
  un double padding quand `UserSettings` ajoute sa nav latérale à la tâche 4
  (elle doit pouvoir toucher le bord gauche du panneau).
- `isDesktopShell && 'app-drag'` est maintenant posé sur le **conteneur
  plein écran** (l'ancien fond, maintenant le calque assombri) plutôt que sur
  la barre de titre : le calque assombri occupe toujours toute la fenêtre
  Electron même quand le panneau est centré et plus petit, donc c'est lui qui
  doit rester une zone de glissement. Le panneau lui-même et son bouton de
  fermeture n'ont pas besoin de `app-no-drag` supplémentaire puisqu'ils ne
  sont plus dans la zone de titre.

- [ ] **Étape 2 : vérifier à la main**

Lancer le client (`cd apps/client && bun run dev`), ouvrir les paramètres
utilisateur (icône réglages en bas à gauche) puis les paramètres serveur —
vérifier dans les deux cas : fond assombri visible, panneau centré, bouton X
ferme, clic en dehors du panneau ne ferme **pas** (seul `Escape` ou le X
doivent fermer — `ServerScreensProvider` ne gère pas le clic extérieur, ne
pas en ajouter un ici, ce serait un changement de comportement hors
périmètre). Si l'app tourne dans le shell Electron (`bun run dev` du dossier
`apps/desktop` s'il existe, sinon ignorer cette partie), vérifier que la
fenêtre reste déplaçable pendant que la modale est ouverte.

- [ ] **Étape 3 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/server-screens/server-screen-layout.tsx
git commit -m "feat(client): transformer le shell des reglages en modale centree"
```

---

### Tâche 2 : configuration des sections + nav desktop groupée

**Fichiers :**

- Créer : `apps/client/src/components/server-screens/user-settings/sections.ts`
- Créer : `apps/client/src/components/server-screens/user-settings/desktop-nav.tsx`

**Interfaces :**

- Consomme : rien (module de config pur + un composant de présentation).
- Produit : `type TUserSettingsSectionId`, `type TUserSettingsSectionGroup`,
  `USER_SETTINGS_GROUPS: TUserSettingsSectionGroup[]`,
  `USER_SETTINGS_SECTION_LABEL_KEYS: Record<TUserSettingsSectionId, string>`,
  composant `<UserSettingsDesktopNav activeSection={} onSelect={} />`.

- [ ] **Étape 1 : déclarer les sections et leur regroupement**

Créer
`apps/client/src/components/server-screens/user-settings/sections.ts` :

```ts
type TUserSettingsSectionId =
  | 'profile'
  | 'password'
  | 'security'
  | 'devices'
  | 'notifications'
  | 'others';

type TUserSettingsSectionGroup = {
  id: 'account' | 'preferences';
  labelKey: string;
  sections: TUserSettingsSectionId[];
};

// Regroupement tranche par l.user le 2026-09-09 (voir la spec) : Bullshark
// n'a pas de Nitro/Facturation a mapper sur les categories de Discord, donc
// ce regroupement est propre a Bullshark plutot qu'un calque 1:1.
const USER_SETTINGS_GROUPS: TUserSettingsSectionGroup[] = [
  {
    id: 'account',
    labelKey: 'accountSectionGroup',
    sections: ['profile', 'password', 'security', 'devices']
  },
  {
    id: 'preferences',
    labelKey: 'preferencesSectionGroup',
    sections: ['notifications', 'others']
  }
];

// Les cles existent deja (utilisees par l'ancienne TabsList) : reprises
// telles quelles, pas de nouvelle traduction pour les libelles de section.
const USER_SETTINGS_SECTION_LABEL_KEYS: Record<
  TUserSettingsSectionId,
  string
> = {
  profile: 'profileTab',
  password: 'passwordTab',
  security: 'securityTab',
  devices: 'devicesTab',
  notifications: 'notificationsTab',
  others: 'othersTab'
};

export {
  USER_SETTINGS_GROUPS,
  USER_SETTINGS_SECTION_LABEL_KEYS
};
export type { TUserSettingsSectionGroup, TUserSettingsSectionId };
```

- [ ] **Étape 2 : écrire la nav desktop**

Créer
`apps/client/src/components/server-screens/user-settings/desktop-nav.tsx` :

```tsx
import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  USER_SETTINGS_GROUPS,
  USER_SETTINGS_SECTION_LABEL_KEYS,
  type TUserSettingsSectionId
} from './sections';

type TUserSettingsDesktopNavProps = {
  activeSection: TUserSettingsSectionId;
  onSelect: (section: TUserSettingsSectionId) => void;
};

const UserSettingsDesktopNav = memo(
  ({ activeSection, onSelect }: TUserSettingsDesktopNavProps) => {
    const { t } = useTranslation('settings');

    return (
      <nav className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-4">
        {USER_SETTINGS_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
              {t(group.labelKey)}
            </div>
            {group.sections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => onSelect(section)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground',
                  activeSection === section && 'bg-accent text-accent-foreground'
                )}
              >
                {t(USER_SETTINGS_SECTION_LABEL_KEYS[section])}
              </button>
            ))}
          </div>
        ))}
      </nav>
    );
  }
);

export { UserSettingsDesktopNav };
```

Si `duration-fast`/`ease-out` n'existent pas dans les jetons Tailwind du
projet (`tailwind.config`/thème CSS), les retirer plutôt qu'en inventer de
nouveaux — vérifier dans `packages/ui` ou le `globals.css` du client
(chantier "motion-language" de `docs/superpowers/plans/2026-08-25-motion-language.md`
en pose déjà, sinon utiliser une transition Tailwind par défaut
`transition-colors` sans durée custom).

- [ ] **Étape 3 : vérifier la compilation**

Lancer : `cd apps/client && bun run check-types`
Attendu : aucune erreur (ces deux fichiers ne sont pas encore importés
ailleurs, donc pas d'effet visible avant la tâche 4).

- [ ] **Étape 4 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/server-screens/user-settings/sections.ts apps/client/src/components/server-screens/user-settings/desktop-nav.tsx
git commit -m "feat(client): config des sections et nav desktop groupee des reglages"
```

---

### Tâche 3 : carte de profil mobile

**Fichiers :**

- Créer :
  `apps/client/src/components/server-screens/user-settings/profile-card.tsx`
- Créer :
  `apps/client/src/components/server-screens/user-settings/mobile-nav.tsx`

**Interfaces :**

- Consomme : `useOwnPublicUser` de `@/features/server/users/hooks`,
  `getFileUrl` de `@/helpers/get-file-url`, `UserAvatar` de
  `@/components/user-avatar`, `useDateLocale` de `@/hooks/use-date-locale`,
  `date-fns` `format`, la clé i18n `memberSince` du namespace **`common`**
  (déjà utilisée par `user-popover/index.tsx`, pas une nouvelle clé),
  `USER_SETTINGS_GROUPS`/`USER_SETTINGS_SECTION_LABEL_KEYS` (tâche 2).
- Produit : `<UserSettingsProfileCard onEditProfile={() => void} />`,
  `<UserSettingsMobileNav activeSection={} onSelect={} />`.

- [ ] **Étape 1 : écrire la carte de profil**

Créer
`apps/client/src/components/server-screens/user-settings/profile-card.tsx` :

```tsx
import { UserAvatar } from '@/components/user-avatar';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { useDateLocale } from '@/hooks/use-date-locale';
import { Button } from '@bullshark/ui';
import { format } from 'date-fns';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TUserSettingsProfileCardProps = {
  onEditProfile: () => void;
};

const UserSettingsProfileCard = memo(
  ({ onEditProfile }: TUserSettingsProfileCardProps) => {
    // Namespace par defaut (common), pas 'settings' : c'est la meme cle que
    // celle deja utilisee par user-popover/index.tsx pour "Membre depuis",
    // pas une nouvelle traduction a dupliquer.
    const { t } = useTranslation();
    const { t: tSettings } = useTranslation('settings');
    const dateLocale = useDateLocale();
    const ownPublicUser = useOwnPublicUser();

    if (!ownPublicUser) return null;

    return (
      <div className="border-b border-border pb-4">
        <div className="h-24 w-full bg-muted">
          {ownPublicUser.banner && (
            <img
              src={getFileUrl(ownPublicUser.banner)}
              alt=""
              className="h-24 w-full object-cover"
            />
          )}
        </div>

        <div className="-mt-8 flex flex-col gap-3 px-4">
          <UserAvatar
            userId={ownPublicUser.id}
            className="h-16 w-16 rounded-full border-4 border-background bg-muted"
            showStatusBadge
            showUserPopover={false}
          />

          <div>
            <p className="text-lg font-semibold text-foreground">
              {ownPublicUser.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('memberSince', {
                date: format(new Date(ownPublicUser.createdAt), 'PP', {
                  locale: dateLocale
                })
              })}
            </p>
          </div>

          <Button onClick={onEditProfile} className="w-full">
            {tSettings('editProfileButton')}
          </Button>

          {ownPublicUser.bio && (
            <p className="text-sm text-foreground">{ownPublicUser.bio}</p>
          )}
        </div>
      </div>
    );
  }
);

export { UserSettingsProfileCard };
```

- [ ] **Étape 2 : écrire la liste plate mobile**

Créer
`apps/client/src/components/server-screens/user-settings/mobile-nav.tsx` :

```tsx
import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  USER_SETTINGS_GROUPS,
  USER_SETTINGS_SECTION_LABEL_KEYS,
  type TUserSettingsSectionId
} from './sections';

type TUserSettingsMobileNavProps = {
  onSelect: (section: TUserSettingsSectionId) => void;
};

// Pas de regroupement ici, contrairement au desktop (tache 2) : la capture
// mobile de Discord partagee par l.user n'a pas de sections a en-tetes,
// juste une liste plate — voir "Perimetre mobile" de la spec.
const UserSettingsMobileNav = memo(
  ({ onSelect }: TUserSettingsMobileNavProps) => {
    const { t } = useTranslation('settings');
    const sections = USER_SETTINGS_GROUPS.flatMap((group) => group.sections);

    return (
      <div className="flex flex-col divide-y divide-border">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className="flex items-center justify-between px-4 py-3 text-left text-sm text-foreground"
          >
            {t(USER_SETTINGS_SECTION_LABEL_KEYS[section])}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }
);

export { UserSettingsMobileNav };
```

- [ ] **Étape 3 : vérifier la compilation**

Lancer : `cd apps/client && bun run check-types`
Attendu : aucune erreur. `editProfileButton` n'existe pas encore dans les
locales — c'est la tâche 5, `check-types` ne le voit pas (i18next resout les
clés au runtime), seul un `bun run dev` manuel le montrerait en clair sous
forme de clé brute jusqu'à la tâche 5 ; ignorer pour l'instant.

- [ ] **Étape 4 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/server-screens/user-settings/profile-card.tsx apps/client/src/components/server-screens/user-settings/mobile-nav.tsx
git commit -m "feat(client): carte de profil et liste mobile des reglages"
```

---

### Tâche 4 : intégration dans `UserSettings`

**Fichiers :**

- Modifier :
  `apps/client/src/components/server-screens/user-settings/index.tsx`

**Interfaces :**

- Consomme : `UserSettingsDesktopNav` (tâche 2), `UserSettingsProfileCard`,
  `UserSettingsMobileNav` (tâche 3), `TUserSettingsSectionId` (tâche 2).
- Produit : rien de nouveau en dehors du composant lui-même — même export
  `UserSettings`.

C'est ici que le split responsive `md:` prend forme : deux arbres rendus en
parallèle, un seul visible à la fois selon la largeur, comme
`screens/server-view/index.tsx`.

- [ ] **Étape 1 : remplacer le corps du composant**

Remplacer entièrement
`apps/client/src/components/server-screens/user-settings/index.tsx` :

```tsx
import { Tabs, TabsContent } from '@bullshark/ui';
import { ChevronLeft } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { ServerScreenLayout } from '../server-screen-layout';
import { UserSettingsDesktopNav } from './desktop-nav';
import { Devices } from './devices';
import { UserSettingsMobileNav } from './mobile-nav';
import { Notifications } from './notifications';
import { Others } from './others';
import { Password } from './password';
import { Profile } from './profile';
import { UserSettingsProfileCard } from './profile-card';
import { USER_SETTINGS_SECTION_LABEL_KEYS, type TUserSettingsSectionId } from './sections';
import { Security } from './security';

type TUserSettingsProps = TServerScreenBaseProps;

const UserSettings = memo(({ close }: TUserSettingsProps) => {
  const { t } = useTranslation('settings');
  const [activeSection, setActiveSection] =
    useState<TUserSettingsSectionId>('profile');
  // null = carte de profil + liste (mobile) ; une section = plein-ecran de
  // cette section par-dessus la carte, avec un chevron retour. Le meme
  // mecanisme sert a "Modifier le profil" qu'aux 5 autres sections : la
  // spec ne demandait un overlay que pour l'edition du profil, generalise
  // ici plutot que d'ecrire un second mecanisme de navigation mobile.
  const [mobileOpenSection, setMobileOpenSection] =
    useState<TUserSettingsSectionId | null>(null);

  return (
    <ServerScreenLayout close={close} title={t('userSettingsTitle')}>
      <Tabs
        value={activeSection}
        onValueChange={(value) =>
          setActiveSection(value as TUserSettingsSectionId)
        }
        className="h-full gap-0 md:flex-row"
      >
        <UserSettingsDesktopNav
          activeSection={activeSection}
          onSelect={setActiveSection}
        />

        <div className="hidden min-w-0 flex-1 overflow-y-auto p-6 md:block">
          <div className="mx-auto max-w-2xl">
            <TabsContent value="profile" className="space-y-6">
              <Profile />
            </TabsContent>
            <TabsContent value="devices" className="space-y-6">
              <Devices />
            </TabsContent>
            <TabsContent value="password" className="space-y-6">
              <Password />
            </TabsContent>
            <TabsContent value="security" className="space-y-6">
              <Security />
            </TabsContent>
            <TabsContent value="notifications" className="space-y-6">
              <Notifications />
            </TabsContent>
            <TabsContent value="others" className="space-y-6">
              <Others />
            </TabsContent>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto md:hidden">
          <UserSettingsProfileCard
            onEditProfile={() => setMobileOpenSection('profile')}
          />
          <UserSettingsMobileNav onSelect={setMobileOpenSection} />
        </div>
      </Tabs>

      {mobileOpenSection && (
        <div className="absolute inset-0 flex flex-col bg-background md:hidden">
          <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
            <button
              type="button"
              onClick={() => setMobileOpenSection(null)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold">
              {t(USER_SETTINGS_SECTION_LABEL_KEYS[mobileOpenSection])}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {mobileOpenSection === 'profile' && <Profile />}
            {mobileOpenSection === 'devices' && <Devices />}
            {mobileOpenSection === 'password' && <Password />}
            {mobileOpenSection === 'security' && <Security />}
            {mobileOpenSection === 'notifications' && <Notifications />}
            {mobileOpenSection === 'others' && <Others />}
          </div>
        </div>
      )}
    </ServerScreenLayout>
  );
});

export { UserSettings };
```

Deux points d'attention, pas des erreurs si constatés mais à vérifier à
l'étape 2 :

- Le conteneur `absolute inset-0` de l'overlay mobile a besoin d'un ancêtre
  `relative` pour se positionner par rapport au panneau de la modale (pas à
  la fenêtre entière). `ServerScreenLayout` (tâche 1) n'en pose pas
  explicitement, mais son panneau est déjà `flex flex-col` avec
  `overflow-hidden` : si l'overlay se positionne par rapport à la fenêtre au
  lieu du panneau, ajouter `relative` sur le `div` du panneau dans
  `server-screen-layout.tsx` (celui avec `rounded-lg border ...`) plutôt que
  de changer `absolute` en autre chose ici.
- `Tabs` de `@bullshark/ui` applique `flex flex-col gap-2` par défaut (voir
  tâche 2, étape 2 de lecture du composant) — `gap-0 md:flex-row` sur cette
  instance l'écrase pour ce cas d'usage précis, ne pas modifier le composant
  partagé `Tabs` lui-même pour ça.

- [ ] **Étape 2 : vérifier à la main**

Lancer `cd apps/client && bun run dev`, ouvrir les paramètres utilisateur :

1. Fenêtre large (desktop) : nav latérale groupée visible ("Compte" /
   "Préférences"), clic sur chaque item change le contenu à droite, carte de
   profil mobile **invisible**.
2. Réduire la fenêtre sous 768px (ou DevTools mode responsive) : nav
   desktop disparaît, carte de profil (bannière/avatar/nom/date/bio)
   apparaît suivie de la liste plate à 6 lignes.
3. Sur mobile, taper "Modifier le profil" : le formulaire `Profile` complet
   s'ouvre plein-écran avec chevron retour ; retour ramène à la carte.
4. Sur mobile, taper une ligne de la liste (ex. "Sécurité") : même
   comportement d'overlay avec le bon titre et le bon contenu.
5. Revérifier `ServerSettings` (inchangé, toujours ses onglets plats) pour
   confirmer qu'il n'a pas été touché par erreur.

- [ ] **Étape 3 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/server-screens/user-settings/index.tsx
git commit -m "feat(client): brancher la nav groupee et la carte mobile des reglages"
```

---

### Tâche 5 : traductions (7 locales)

**Fichiers :**

- Modifier :
  `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json`

**Interfaces :**

- Consomme : rien.
- Produit : 3 nouvelles clés dans le namespace `settings` par locale —
  `accountSectionGroup`, `preferencesSectionGroup`, `editProfileButton`.
  Pas de nouvelle clé pour "Membre depuis" : `memberSince` existe déjà dans
  `common.json` de chaque locale (utilisée par `user-popover`), réutilisée
  telle quelle par la tâche 3.

- [ ] **Étape 1 : ajouter les clés, une locale à la fois**

Dans `apps/client/src/i18n/locales/fr/settings.json`, ajouter après
`"othersTab": "Autres",` :

```json
  "accountSectionGroup": "Compte",
  "preferencesSectionGroup": "Préférences",
  "editProfileButton": "Modifier le profil",
```

Dans `en/settings.json`, après `"othersTab": "Others",` :

```json
  "accountSectionGroup": "Account",
  "preferencesSectionGroup": "Preferences",
  "editProfileButton": "Edit profile",
```

Répéter pour `cs`, `es`, `it`, `ru`, `zh` — traduire les 3 valeurs, garder
les mêmes clés. Vérifier la virgule de la ligne précédente dans chaque
fichier avant d'insérer.

- [ ] **Étape 2 : vérifier que le JSON reste valide**

```bash
cd apps/client && for f in src/i18n/locales/*/settings.json; do node -e "require('./$f')" || echo "JSON invalide: $f"; done
```

Attendu : aucune ligne "JSON invalide" imprimée.

- [ ] **Étape 3 : vérifier à la main**

Dans le sélecteur de langue de l'app (bas de la nav desktop des réglages ou
équivalent), basculer sur `en` et `cs`, rouvrir les paramètres utilisateur,
confirmer que les en-têtes de section et le bouton "Modifier le profil" sont
traduits (pas de clé brute du type `accountSectionGroup` affichée).

- [ ] **Étape 4 : portes et commit**

```bash
cd apps/client && bun run format:check && bun run check-types && bun run lint
git add apps/client/src/i18n/locales
git commit -m "i18n: traduire les sections de la modale de reglages utilisateur"
```
