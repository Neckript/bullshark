# Bannière de serveur — design

- Date : 2026-09-03
- Statut : validé en chat avec l.user, prêt pour le plan d'implémentation
- Petit chantier, pas de dépendance

## Problème

Bullshark a une bannière **de profil utilisateur** (`users.bannerId`,
`users.bannerColor`, `banner-manager.tsx`, avec import Klipy GIF) mais aucune
notion de bannière **de serveur**. La table `settings` n'a qu'un `logoId` —
carré, utilisé pour le favicon/icônes PWA et l'écran de connexion. Discord a
les deux : l'icône ronde du serveur *et* une bannière large affichée dans le
panneau du serveur.

l.user veut la même chose ici, avec un emplacement précis : **juste sous le
nom du serveur**, dans l'en-tête de la sidebar gauche
(`components/left-sidebar/index.tsx:49-60`, la barre de 48px qui contient
`<h2>{serverName}</h2>` et le menu `ServerDropdownMenu`).

## Ce qui existe déjà et qu'il faut réutiliser

Le chemin utilisateur donne le patron exact à suivre côté image, à l'échelle
serveur :

- **Schéma** : `users.bannerId → files.id` + `users.bannerColor` (fallback
  couleur unie quand il n'y a pas d'image). `settings` n'a que `logoId` — il
  manque le pendant bannière.
- **Upload** : `banner-manager.tsx` → `useFilePicker` + `uploadImage` →
  `trpc.users.changeBanner.mutate({ fileId })`. Le pendant serveur suivrait
  `logo-manager.tsx` → `trpc.others.changeLogo.mutate({ fileId })`, donc un
  `trpc.others.changeServerBanner.mutate({ fileId })` symétrique.
- **Import GIF Klipy** : `GifPickerDialog` + `gifs.importToProfile` (target
  `avatar`/`banner`). Pour un serveur, soit un troisième `target: 'server'`
  sur `importToProfile` (le nom devient trompeur), soit une route dédiée
  `gifs.importToServerBanner` sur le même modèle que `gifs.importToMessage`
  ajoutée le 2026-09-03 — cette dernière option colle mieux au sens des
  noms de route.
- **Réglage de taille** : `storageMaxBannerSize` existe déjà côté
  `Stockage` mais s'applique à la bannière *utilisateur*. Tranché par
  l.user le 2026-09-03 : quota dédié, nouveau réglage
  `storageMaxServerBannerSize` dans l'écran Stockage, sur le même modèle que
  `storageMaxBannerSize` (slider + champ Mo + boutons 1/3/10 Mo).

## Emplacement retenu

Sous l'en-tête `<h2>{serverName}</h2>` (ligne 60 de `left-sidebar/index.tsx`),
avant le bandeau rouge « aucun propriétaire » (ligne 61) et avant
`DmButton`/`PluginButtons`/la liste des salons. Toujours visible tant qu'une
bannière est définie — pas de repli, elle disparaît simplement si
`settings.banner` est `null` (comme le logo).

## Questions ouvertes, à trancher avant le plan d'implémentation

1. ~~**Ratio et recadrage.**~~ Tranché par l.user le 2026-09-03 : même taille
   que Discord. Discord recommande **960×540 (16:9)** à l'upload pour sa
   bannière de serveur. Affichage ici en `background-size: cover` sur toute
   la largeur courante de la sidebar (200–400px, redimensionnable — voir
   `MIN_WIDTH`/`MAX_WIDTH` dans `left-sidebar/index.tsx`), hauteur dérivée du
   16:9 plutôt que fixée en dur, pas de recadrage interactif à l'upload
   (l'image fournie doit déjà être proche de ce ratio).
2. ~~**GIF animé.**~~ Tranché par l.user le 2026-09-03 : disponible dès la
   première version, au choix des admins (pas de statique-d'abord). Donc
   `gifs.importToServerBanner` (cf. section précédente) fait partie du
   périmètre initial, pas d'une itération suivante. Utilise le réglage
   générique "Max animated image size" (`storage/index.tsx`), pas le
   nouveau `storageMaxServerBannerSize` qui borne les images statiques.
3. ~~**Couleur de repli.**~~ Tranché par l.user le 2026-09-03 : invisible.
   Pas de `bannerColor` pour les serveurs — contrairement à `users`, la
   bannière n'occupe simplement aucun espace tant que `settings.bannerId`
   est `null`, comme le logo aujourd'hui.

**Droits** (pas une question, un défaut à confirmer en implémentant) :
upload/suppression réservés à `Permission.MANAGE_SETTINGS` (même garde que
`logo`), pas de nouvelle permission à créer.

## Hors périmètre

- Pas de bannière par salon ou par rôle — uniquement le serveur dans son
  ensemble, symétrique au logo.
- Pas de repositionnement/recadrage interactif à l'upload — l'utilisateur
  fournit une image déjà cadrée, comme pour le logo et les bannières de
  profil aujourd'hui.
