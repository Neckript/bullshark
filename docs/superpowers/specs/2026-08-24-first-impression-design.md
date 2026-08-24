# Première impression — design

Date : 2026-08-24
Statut : validé en chat sur maquette, prêt pour le plan d'implémentation
Chantier 4 du programme « rendre Bullshark beau »

Maquette avant/après validée :
https://claude.ai/code/artifact/aed133e3-ca98-4aa8-a68c-fb96b473c0f9

## Problème

Le chantier 1 a donné une identité au shell et le chantier 3 a repris la scène
vocale. Les trois surfaces qu'un joueur voit **avant** d'avoir écrit son premier
message n'ont jamais été touchées, et ce sont elles qui décident s'il reste.

Constats vérifiés dans le code au 2026-08-24 :

1. **L'écran de connexion est une carte shadcn brute.**
   `screens/connect/index.tsx` pose un `Card` de 384 px au centre d'un fond
   plat. Le logo du serveur est plafonné à `max-h-32`, sa description est une
   ligne en `text-muted-foreground`, et le bouton de connexion — l'action la
   plus importante de l'écran — est en `variant="outline"`, donc la moins
   visible. Rien du travail du chantier 1 ne s'y voit.
2. **Le vide du bureau est total.** `screens/server-view/content-wrapper.tsx:82`
   ne rend, quand aucun salon n'est sélectionné, que
   `PluginSlotRenderer slotId={HOME_SCREEN}`. Sans plugin, c'est un rectangle
   vide — et c'est le premier écran après la connexion sur desktop. L'accueil
   qui existe (« Bienvenue sur X », les flèches de balayage) est en `md:hidden`,
   donc mobile uniquement.
3. **Un salon sans message est vide lui aussi.**
   `components/channel-view/text/index.tsx:201` rend la liste des groupes de
   messages sans aucun cas vide : rien ne distingue un salon neuf d'un salon
   cassé.
4. **La zone de dépôt de fichiers est invisible et minuscule.**
   `hooks/use-upload-files.ts:366` accroche `dragover`/`drop` au conteneur passé
   par `components/message-compose/index.tsx:145`, c'est-à-dire le compositeur
   seul. Déposer un fichier sur la liste des messages ne fait rien, aucun état
   visuel n'indique où viser, et un dépôt refusé (envois coupés, permission
   absente) échoue en silence hors du compositeur.

Correction d'un constat de l'audit fondateur : le glisser-déposer n'était pas
« absent » — il existe, mais borné au compositeur et sans retour visuel. C'est
la portée et le retour qui manquent, pas la mécanique d'envoi.

## Contrainte structurante

`TServerInfo` (`packages/shared/src/types.ts:124`) n'expose que `serverId`,
`name`, `description`, `allowNewUsers`, `logo` et `version`. Les bannières de la
base sont **par utilisateur** (`users.bannerId`), pas par serveur. La mise en
scène doit donc se construire avec le logo, le nom et la description, et rien
d'autre. Conséquence : **chantier 100 % client, aucune migration, aucune route
nouvelle.**

## Direction retenue

Deux décisions prises par l'utilisateur avant la maquette :

- **Écran de connexion : scène plein écran**, pas simple affinage de la carte.
- **Écrans vides : le logo du serveur détourné en filigrane**, plutôt qu'une
  mascotte dessinée ou des icônes lucide. Zéro nouvel actif, et une identité
  différente sur chaque serveur.

Validées ensuite sur maquette, thèmes Bullshark, rouge gaming et clair comparés.

## A. Écran de connexion

`screens/connect/index.tsx` fait 338 lignes et mélange l'état, les appels
réseau et le rendu. Il est éclaté en trois fichiers, **sans toucher à une seule
ligne de logique** :

- `screens/connect/index.tsx` — état, `onConnectClick`, `submitTwoFactor`,
  `finishLogin`, lecture du code d'invitation.
- `screens/connect/connect-scene.tsx` — le fond, purement décoratif.
- `screens/connect/connect-form.tsx` — la carte : champs, switch, alertes,
  bouton, vue 2FA.

### Le fond

Deux halos radiaux dérivés de `--primary` par `color-mix`, posés sur
`--background`, dans un conteneur `absolute inset-0 pointer-events-none`. Aucune
couleur en dur : le fond est donc juste dans les 7 thèmes, y compris le thème
utilisateur dérivé.

Dérive lente des halos (~30 s, `ease-in-out infinite alternate`), coupée par
`@media (prefers-reduced-motion: reduce)`. Cette règle est en avance sur le
chantier 2 ; elle est écrite ici pour ne pas introduire une animation qu'il
faudra corriger ensuite.

### La mise en page

`lg:grid-cols-2`, deux colonnes centrées verticalement :

- **Gauche, l'identité du serveur** : logo en `max-h-40` (contre `max-h-32`
  aujourd'hui), nom en `font-display text-4xl font-semibold tracking-tight`,
  description en accroche sous le nom, version en `font-mono text-xs`
  discrète.
- **Droite, le formulaire** dans une carte en verre :
  `bg-card/80 backdrop-blur-xl`. Le `/80` est indispensable — `--card` est
  opaque dans les 7 thèmes, un `backdrop-blur` seul ne flouterait rien (défaut
  C2 du chantier 1, puis même défaut retrouvé sur la barre vocale au
  chantier 3).

Sous `lg`, une seule colonne : logo réduit, nom, puis la carte. Le sélecteur de
langue reste en bas à droite, le pied de page (version, liens) reste centré en
bas.

### Le bouton

`variant="default"` plein au lieu de `outline`, pleine largeur, `rounded-full`
et **non `rounded-pill`** : twMerge ne connaît pas `rounded-pill` et ne peut donc
pas retirer le `rounded-md` de base du composant `Button` (dette relevée au
chantier 3). Un `Spinner` remplace le libellé pendant l'envoi.

### Ce qui ne bouge pas

Les champs et leurs `Group`/`Input`, le switch d'auto-login, l'alerte
`isSecureContext`, le bandeau d'invitation, toute la vue 2FA (challenge, code de
récupération), le `PluginSlotRenderer` du slot `CONNECT_SCREEN`, et surtout
**tous les `data-testid` `TestId.CONNECT_*`** : la suite Playwright de
`packages/e2e` traverse cet écran à chaque test, c'est le garde-fou de ce
chantier.

## B. Écrans vides

Nouveau composant partagé `components/empty-state/index.tsx`, deux variantes.

### Variante pleine, avec filigrane

Props : `title`, `description?`, `action?`.

Le filigrane est le logo du serveur lu par `useInfo()` et `getFileUrl`, repli
`/logo.webp` (même logique que `logoSrc` dans l'écran de connexion). Rendu en
`absolute`, très grand, `grayscale`, opacité 5 % en thème sombre et 7 % en thème
clair, fondu par un `mask-image` radial `closest-side`, avec `pointer-events-none`
et `aria-hidden`. Devant : titre en `font-display`, description en
`text-muted-foreground`, action optionnelle en bouton `rounded-full`.

Trois emplacements :

1. **Le vide du bureau** — `content-wrapper.tsx`. Titre
   « Bienvenue sur {serveur} », description tirée de `info.description` avec un
   repli, action « Ouvrir #{premier salon visible} ». L'état vide n'est rendu
   que si le slot `HOME_SCREEN` est réellement inoccupé : on lit
   `usePluginComponentsBySlot(PluginSlot.HOME_SCREEN)`, le même hook que
   `PluginSlotRenderer`, plutôt que de deviner. L'accueil mobile existant
   (`md:hidden`, les deux flèches de balayage) devient le même composant, avec
   ses deux lignes de balayage conservées sous `md`.
2. **Salon texte sans message** — `channel-view/text/index.tsx`, dans le
   conteneur de défilement quand `groupedMessages.length === 0` et que le
   chargement est terminé. « C'est le tout début de #{salon} », sans action.
3. **Mode DM sans conversation choisie** — `content-wrapper.tsx:56`, remplace la
   ligne `selectDmPrompt`.

### Variante compacte, sans filigrane

Icône lucide, titre, une ligne. La place manque pour un filigrane :

4. **Liste de DM vide** — `left-sidebar/direct-messages/index.tsx:158`
   (`noDMsYet`).
5. **Recherche sans résultat** — `components/dialogs/search/index.tsx:82`
   (`noResults`).

## C. Zone de dépôt à l'échelle du salon

### Le hook

`hooks/use-upload-files.ts` prend un paramètre supplémentaire : la **surface de
dépôt**, distincte du conteneur du compositeur.

- `dragover` / `dragenter` / `dragleave` / `drop` sont accrochés à la surface de
  dépôt.
- `paste` **reste** sur le conteneur du compositeur : le déplacer à l'échelle du
  salon lui ferait capter les collages d'édition de message.

Le hook expose deux valeurs nouvelles : `isDraggingFiles` et le motif de refus
éventuel.

Trois pièges à traiter explicitement, sans quoi l'incrustation reste collée ou
clignote :

- **Compteur `dragenter`/`dragleave`.** Survoler un enfant émet un `dragleave`
  sur le parent ; un simple booléen éteindrait l'incrustation au milieu du
  salon. On incrémente sur `dragenter`, on décrémente sur `dragleave`, on
  n'éteint qu'à zéro.
- **Filtre `dataTransfer.types.includes('Files')`.** Sans lui, glisser une
  sélection de texte ou un message allumerait l'incrustation.
- **Filet de sécurité sur `window`.** Un glisser relâché hors de la fenêtre
  n'émet pas de `dragleave` exploitable : un `dragend` et un `drop` au niveau
  `window` remettent le compteur à zéro.

Le motif de refus réutilise `checkUploadPermissions` : envois désactivés sur le
serveur, partage de fichiers coupé en DM, permission `UPLOAD_FILES` absente.

### L'incrustation

Nouveau `components/channel-view/text/drop-overlay.tsx` : `absolute inset-2`,
bord tireté `border-2 border-dashed border-primary/60`, fond
`bg-background/70 backdrop-blur-sm`, `rounded-[--radius]`, icône dans une
pastille, titre « Déposer pour envoyer dans #{salon} » et sous-titre reprenant
les **limites réelles du serveur** lues dans `usePublicServerSettings`
(`storageMaxFilesPerMessage`, `storageUploadMaxFileSize`).

Variante refus : bord et pastille en `--destructive`, titre « Impossible de
déposer ici », sous-titre = la raison. C'est le gain fonctionnel du chantier :
aujourd'hui, hors du compositeur, un dépôt refusé ne produit rien du tout.

Entrée et sortie en fondu court (`transition-opacity`, ~180 ms), sous garde
`prefers-reduced-motion`.

### La surface

`TextChannel` rend un fragment. Il est enveloppé dans un
`relative flex flex-1 flex-col min-h-0` qui reproduit le contexte flex de son
parent, vérifié sur les trois sites d'appel :

- `content-wrapper.tsx:48` (DM) et `:71` (salon), sous
  `main.flex.flex-1.flex-col.relative.min-w-0.min-h-0` ;
- `voice-chat-sidebar/index.tsx:31`, sous
  `div.flex-1.flex.flex-col.overflow-hidden`.

Les fils reçoivent la même incrustation, bornée à leur colonne :
`thread-sidebar/thread-compose.tsx:115` passe la racine de `ThreadContent`
comme surface de dépôt. Un fil ouvert capte donc les dépôts faits au-dessus de
lui, ce qui est le comportement attendu.

## Chaînes anglaises codées en dur

Six chaînes se déclenchent précisément sur les surfaces touchées et sont en
anglais littéral. Elles passent en i18n dans ce chantier :

- `use-upload-files.ts` : « Maximum attachments reached (…) », « … ignored due
  to the per-message attachment limit. », « "…" exceeds the maximum file size
  limit. », « File uploads are disabled on this server. », « File sharing in
  direct messages is disabled on this server. », « You do not have permission to
  upload files. »
- `channel-view/text/index.tsx:181` : « Fetching older messages... »

Toutes les clés nouvelles, celles-ci comprises, sont écrites dans les **7
locales** : `cs`, `en`, `es`, `fr`, `it`, `ru`, `zh`.

## Vérification

Portes habituelles : `bun run format:check`, `bun run check-types`,
`bun run lint`.

**En plus des portes**, contrôle dans le bundle construit — leçon C1/C2 du
chantier 1, où les trois portes étaient vertes sur du code mort :

- `bg-card/80` sort bien en `color-mix(… var(--card) 80% …)` sous garde
  `@supports`, sinon le verre de l'écran de connexion ne floute rien ;
- le `mask-image` du filigrane est bien émis (préfixe `-webkit-` compris) ;
- les halos consomment `var(--primary)` et non une couleur en dur ;
- l'enveloppe de `TextChannel` n'a pas cassé la hauteur du compositeur ni le
  défilement (piège du chantier 1 : un `w-full` de trop avait écrasé un offset).

La suite Playwright de `packages/e2e` traverse l'écran de connexion à chaque
test : elle valide la partie A par construction, à condition que les
`data-testid` soient intacts.

Le verdict final reste la **validation visuelle sur le Kimsufi** : aucun agent
n'a de navigateur, c'est une limite assumée depuis le chantier 1.

## Hors périmètre, assumé

- Le sélecteur rapide Ctrl+K — chantier 5.
- `prefers-reduced-motion` partout ailleurs dans le client — chantier 2, qui
  reprendra aussi les animations `speaking-effect-*` restées infinies.
- Les écrans de déconnexion et de chargement : corrects, pas prioritaires.
- Le bouton « revenir » absent de la vue 2FA : manque fonctionnel, pas visuel.
- Les points laissés ouverts au chantier 1 : Geist sans `unicode-range` (rendu
  mixte en ru/zh/tchèque), `--edge-hi` sans effet en thème clair,
  `--radius-pill` doublon de `rounded-full`, colonne du thème clair.

## Amendements pendant l'implémentation

- **Section C, hook de dépôt.** Cette section décrivait un paramètre
  supplémentaire sur `use-upload-files.ts` exposant `isDraggingFiles`. Le plan
  d'implémentation s'en écarte : la détection du glisser vit dans un hook
  séparé, `hooks/use-file-drag.ts`, adossé à un callback ref plutôt qu'à un
  `RefObject` pour re-déclencher son effet quand la cible apparaît après le
  premier rendu ; le motif de refus vient d'un second hook,
  `hooks/use-upload-permission.ts`. `use-upload-files.ts` n'a pas bougé sur ce
  point. Le plan fait autorité ici.
- **Colonne de gauche, version.** La maquette de cette section garde
  `v{VITE_APP_VERSION}` dans la colonne de gauche de l'écran de connexion. Il a
  été retiré à l'implémentation : le pied de page en bas de l'écran affiche
  déjà la version, et le dupliquer n'ajoutait rien.
- **Fondu de l'incrustation.** Cette section promettait une garde
  `prefers-reduced-motion` sur le fondu d'entrée/sortie de l'incrustation.
  L'incrustation livrée utilise `animate-in fade-in duration-150` sans garde,
  et il n'y a pas de fondu de sortie : le composant se démonte directement.
  Reste dans le périmètre du chantier 2 (balayage `prefers-reduced-motion`).
- **Carte de connexion, bordure.** Cette section (« La mise en page ») ne
  prescrit que `bg-card/80 backdrop-blur-xl` pour la carte en verre, mais le
  plan d'implémentation avait ajouté `border-white/10` à cette classe. Une
  revue a montré qu'il écrasait `border-border` posé par `Card` et la règle
  globale, et qu'en thème clair `--card` et `--background` valent tous deux
  `oklch(1 0 0)` : la bordure du verre disparaissait complètement. Corrigé en
  retirant `border-white/10`, sans le remplacer — `--edge-hi` a le même
  problème en thème clair (voir « Hors périmètre, assumé » ci-dessus).
