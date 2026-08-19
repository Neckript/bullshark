# Identité visuelle du shell — design

Date : 2026-08-19
Statut : validé en chat, prêt pour le plan d'implémentation
Chantier 1 sur 6 du programme « rendre Bullshark beau »

## Problème

Le système de couleurs de Bullshark est bon : jetons sémantiques en oklch, quatre
thèmes signature et un thème utilisateur dérivé par `oklch(from ...)`. Mais tout
le reste du shell est du shadcn sorti de la boîte, et c'est ce qui fait que
l'interface ne se distingue pas d'un panneau d'administration repeint en bleu.

Constat tiré de `apps/client/src/index.css` :

1. **Aucun jeton de typographie.** Ni `--font-sans` ni `--font-display` dans le
   bloc `@theme inline`. L'interface tourne sur la police système par défaut.
2. **Six polices dormantes.** Orbitron, Rajdhani, Exo 2, Bebas Neue,
   Press Start 2P et Share Tech Mono sont importées au démarrage mais ne servent
   qu'aux pseudos personnalisés des membres (`getNicknameFontFamily`).
3. **Angles par défaut.** `--radius: 0.625rem`, la valeur shadcn d'origine.
4. **Thèmes plats.** Les quatre thèmes ne redéfinissent que des couleurs. Aucun
   ne peut toucher la typographie, la densité ou le relief.

## Direction retenue

« Discord en mieux » : on garde des codes familiers, denses et sobres, et on
gagne le caractère par la typographie, les arrondis et le relief plutôt que par
la rupture. Direction choisie par l'utilisateur après présentation de trois
options, et affinée sur maquette en deux allers-retours :

- les angles **s'arrondissent**, ils ne se durcissent pas ;
- **une seule famille de caractères** pour toute l'interface, la hiérarchie
  venant du poids et de la taille.

Maquette de référence (avant / après, à contenu identique) :
<https://claude.ai/code/artifact/f1bd8748-e870-4caa-887c-fe3f4d7a85bc>

## Les jetons

Tous dans `apps/client/src/index.css`, dans `@theme inline` et `:root`.

| Jeton | Aujourd'hui | Proposé | Raison |
| --- | --- | --- | --- |
| `--font-sans` | absent | Geist | Grotesque neutre dans la lignée d'Helvetica, dessinée pour l'écran. Nette en 12 px, sobre en gros titre. |
| `--font-display` | absent | Geist, poids 700, approche −1 % | La même famille. La hiérarchie vient du poids et de la taille, pas d'une deuxième police. |
| `--radius` | `0.625rem` | `0.75rem` | Plus rond, pas plus sec. Douze pixels sur les panneaux et les boîtes de dialogue. |
| `--radius-pill` | absent | `999px` | Salons, badges et boutons deviennent des pastilles. C'est ce qui adoucit le plus la colonne de gauche. |
| `--edge-hi` | absent | `oklch(1 0 0 / 5%)` | Liseré clair en haut des panneaux. Donne du relief sans ombre portée. |
| `--sidebar` | **plus clair** que `--background` (+0.02 de luminance dans les cinq thèmes) | **plus sombre** (−0.025) | Inversion du rapport. Les colonnes latérales reculent au lieu d'avancer, et la zone de lecture devient la surface la plus claire, donc celle où l'œil va. |

Ces six jetons sont ajoutés **dans les cinq thèmes** (`gaming-red`,
`deep-ocean`, `midnight-purple`, `bullshark`, `custom`) pour que chacun reste
cohérent. `--font-sans`, `--font-display`, `--radius` et `--radius-pill` sont
définis une seule fois sur `:root` puisqu'ils ne dépendent pas du thème ;
`--edge-hi` et `--sidebar` sont redéfinis par thème.

## Règle d'usage de l'accent

Ce n'est pas un jeton mais une discipline, et c'est la moitié de l'effet visuel.
Aujourd'hui la couleur d'accent sert de décoration un peu partout. Elle est
désormais **réservée aux états** :

- salon sélectionné ;
- message qui te mentionne (déjà en place, `border-primary bg-primary/5`) ;
- membre en train de parler ;
- compteur de non-lus.

Partout ailleurs, on utilise `--foreground` et `--muted-foreground`. Un accent
qui signale tout ne signale plus rien.

## Portée réelle

Un relevé du code a montré que le rayon passe presque intégralement par les
classes Tailwind `rounded-sm` / `rounded-md` / `rounded-lg`, qui dérivent toutes
de `--radius` via le bloc `@theme inline`. Sur 108 fichiers utilisant `rounded-`,
la quasi-totalité suit donc automatiquement le changement de jeton. Seul
`rounded-full` (55 occurrences) est déjà une pastille et ne bouge pas.

Conséquence : **le changement de rayon ne demande aucune édition de composant.**

Les éditions ciblées se limitent aux surfaces du shell :

- `components/left-sidebar/channels.tsx` — les lignes de salon passent en
  pastille, l'état actif devient un remplissage teinté avec liseré clair, et la
  barre d'accent à gauche disparaît (un trait droit collé à une pastille jure).
- `components/left-sidebar/categories.tsx` — libellés de section en capitales,
  approche large, suivis d'un filet.
- `components/left-sidebar/user-control.tsx` — liseré haut, fond de panneau.
- `components/top-bar/index.tsx` — fond de panneau, liseré haut, nom du salon en
  `--font-display` en casse normale.
- `components/right-sidebar/` — même traitement de section que la colonne gauche.
- `components/message-compose/` — rayon `--radius` et liseré haut.

## Ce qui est explicitement écarté

- **L'échelle d'espacement globale.** La maquette proposait un jeton
  `--space-row`. Imposer une échelle unique à 108 fichiers coûte cher pour un
  gain peu visible à côté du reste. La densité se règle ici sur les seules
  surfaces du shell listées ci-dessus. Si le besoin d'une échelle formelle
  réapparaît, ce sera un chantier à part.
- **Les six polices gamer.** Elles restent, puisqu'elles servent aux pseudos
  personnalisés. Les charger toutes au démarrage pour des membres qui n'en
  utilisent aucune est un vrai gâchis, mais c'est un sujet de performance, pas de
  direction artistique.
- **Le mouvement**, le **panneau vocal**, la **première impression**, le
  **navigateur rapide** et les **aperçus de liens** : chantiers 2 à 6.
- **Donner aux thèmes l'accès à la typographie et à la densité.** À reconsidérer
  une fois les jetons stabilisés.

## Dépendance

Une seule : `@fontsource/geist-sans`, version 5.3.0 vérifiée sur npm, licence
ouverte. Importée dans `index.css` à côté des six polices existantes. Aucune
dépendance retirée.

## Vérification

`apps/client` n'a aucun harnais de test : pas de script `test`, aucun fichier de
test. La vérification est donc :

- `bun run check-types` — 0 erreur ;
- `bun run lint` — 0 erreur (deux avertissements préexistants sur
  `mod-view-sheet/context.tsx` et `voice-provider/volume-control-context.tsx`
  sont sans rapport et restent) ;
- `bun run format:check` — propre, c'est la porte qui casse la CI ;
- passe manuelle sur le serveur Kimsufi, dans les cinq thèmes, en vérifiant que
  le thème utilisateur dérivé continue de fonctionner.

Aucune touche serveur, aucune migration de base, aucun changement d'API.

## Risques

- **Régression de contraste.** Geist a une hauteur d'x différente de la police
  système ; du texte en 11 px peut devenir moins lisible. À contrôler sur les
  libellés de section et les horodatages pendant la passe manuelle.
- **Le thème `custom`.** Il dérive tout de `--custom-bg` et `--custom-accent`,
  et son `--sidebar` vaut aujourd'hui `calc(l + 0.02)`. L'inversion en
  `calc(l - 0.025)` peut produire une luminance quasi nulle si un membre choisit
  un fond déjà presque noir. Il faut un plancher, du genre
  `max(0.04, calc(l - 0.025))`, et vérifier que la syntaxe passe bien dans
  `oklch(from ...)` sur les navigateurs visés avant de s'en remettre à elle.
- **Poids du bundle.** Une septième famille s'ajoute. Geist est légère, mais il
  faut n'importer que les graisses réellement utilisées (400, 500, 600, 700).
