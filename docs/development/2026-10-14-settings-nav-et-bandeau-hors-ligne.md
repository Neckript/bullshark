# 2026-10-14 — Nav des réglages de salon, bandeau hors ligne, passage en bêta

## Nav latérale des réglages de salon et de catégorie

Les réglages de salon et de catégorie étaient restés sur l'ancienne `TabsList`
horizontale, alors que UserSettings et ServerSettings ont une nav latérale
façon Discord.

**Choix retenu : un composant partagé,
`components/server-screens/sectioned-settings.tsx`.** Les deux écrans ont
exactement la même forme (deux sections, Général et Permissions), donc un seul
composant les sert tous les deux. Il reprend les classes et la mécanique
mobile de ServerSettings : barre latérale sur ordinateur, liste puis plein
écran avec chevron retour sur mobile. L'en-tête du groupe affiche le nom du
salon ou de la catégorie, comme Discord.

**Écarté :**

- Copier `desktop-nav.tsx`, `mobile-nav.tsx` et `sections.ts` de
  ServerSettings pour chaque écran : six fichiers pour deux entrées de menu.
- Migrer ServerSettings et UserSettings sur le nouveau composant : ce code est
  livré et validé, et la migration n'apporte rien de visible.

**Pas de filtrage par permission dans le composant**, contrairement à
ServerSettings. L'ouverture de l'écran est déjà protégée dans les menus
contextuels : `MANAGE_CHANNELS` pour un salon, `MANAGE_CATEGORIES` pour une
catégorie (`components/context-menus/channel/index.tsx`,
`components/context-menus/category/index.tsx`).

**Piège rencontré :** le composant prenait d'abord `TServerScreenBaseProps`
comme type de props. Ce type porte aussi `isOpen`, `devices` et
`saveDevices`, que les écrans ne transmettent pas, et `tsc` a refusé. Le
composant ne prend que `close`.

## Bandeau hors ligne

**Problème :** une coupure réseau courte ne donnait aucun retour. Un message
tapé pendant la coupure ne signalait rien.

**Choix retenu :** `screens/server-view/offline-banner.tsx` lit
`navigator.onLine` via `useSyncExternalStore` sur les événements `online` et
`offline`, sans dépendance. Il affiche un bandeau sous la barre du haut. Le
texte reste volontairement neutre (« Vérifiez votre connexion réseau ») et
ne promet pas de reconnexion, puisque le bandeau ne relance rien lui-même.

**Écarté :** bloquer l'envoi de messages hors ligne. Cela change le
comportement de la saisie, alors que le devenir d'un message envoyé pendant
une vraie coupure n'est pas encore établi.

### Pièges vérifiés par les tests du 14 octobre

- **Le mode « Offline » des DevTools ne coupe pas le WebSocket.** Testé sous
  Firefox : l'événement `offline` part et le bandeau s'affiche, mais un
  message envoyé dans cet état arrive normalement. Le client n'affiche pas
  les messages de façon optimiste, il attend leur retour par le serveur, donc
  le message affiché prouve l'aller-retour. Ce test valide le bandeau, il ne
  dit rien d'une vraie coupure.
- **Sur iPhone, le mode avion ferme le socket immédiatement**, avec le code
  1006 (fermeture anormale). L'écran « Connexion perdue » remplace alors toute
  l'interface, et le bandeau n'apparaît jamais. C'est le comportement attendu.
  Le bandeau sert dans le cas où le socket reste ouvert sans rien transmettre
  (wifi qui saute sur un ordinateur) : le ping toutes les 30 s ne le ferme
  qu'après jusqu'à 35 s.
- **Reconnexion au retour du réseau :** avec « rester connecté », la page
  retente avec un loader et se reconnecte seule. Sans cette option, aucune
  session n'est conservée et il faut toucher le bouton.

## Passage en bêta

La v0.1.0 marque l'entrée en bêta : le cœur est complet, aucune issue n'est
ouverte, et l'audit de sécurité n'a plus de point ouvert. Le saut
`0.0.x → 0.1.0` passe par le workflow « Manual Release » en `bump = minor`.

**Écarté : un suffixe `-beta` dans la version.** Le workflow ne propose que
`none`, `patch`, `minor` et `major`, et la compatibilité d'un suffixe de
pré-version avec le système de mise à jour de l'appli desktop n'a pas été
vérifiée.

Le README passe en anglais intégral, avec la version française dans
`README.fr.md`. Au passage, il corrigeait trois erreurs vérifiées :

- La commande Docker pointait vers une image `ghcr.io/neckript/bullshark`
  qui n'est pas publiée. Le README reprend la construction depuis les sources,
  comme `docs/getting-started.md`.
- Il annonçait un binaire pour Windows et macOS. Les releases ne publient que
  `bullshark-linux-x64` et `bullshark-linux-arm64`.
- Trois mentions « Bullshark » étaient des restes du renommage et désignaient
  en réalité Sharkord.

## Mise à jour automatique du serveur : Codeberg → GitHub

**Blocage trouvé en vérifiant la release v0.1.0 : les serveurs en binaire natif
ne se mettaient plus à jour depuis le 18 juin.**

L'updater (`apps/server/src/utils/updater/`) lisait la dernière release sur
Codeberg puis y cherchait `release.json` et les binaires. Or l'étape « Create
Codeberg release (metadata only) » de `.github/workflows/release.yml` crée
volontairement une release Codeberg **sans aucun asset** : les binaires ne
sont publiés que sur GitHub Releases, à cause du quota de stockage Codeberg.
Vérifié sur `v0.0.32` et `v0.1.0` : `assets: []` côté Codeberg, contre
`bullshark-linux-x64`, `bullshark-linux-arm64` et `release.json` côté GitHub.
Chaque vérification levait donc « release.json asset not found in the latest
release ». Les serveurs Docker n'étaient pas touchés : `canUpdate()` vaut
`IS_PRODUCTION && !IS_DOCKER`.

**Choix retenu : l'updater lit l'API GitHub Releases**
(`updater/github-releases.ts`, ex-`forgejo.ts`). La réponse a la même forme
(`tag_name`, `assets[].name`, `assets[].browser_download_url`), donc seuls
l'URL et les en-têtes changent. GitHub refuse les appels d'API sans
`User-Agent`, d'où l'en-tête `bullshark-server`. Sans jeton, la limite est de
60 appels par heure et par IP : la vérification horaire en consomme un, plus
deux par affichage de l'écran Mises à jour.

**Écarté :**

- Téléverser aussi les binaires sur Codeberg : c'est le quota que la release
  évitait.
- Mettre seulement `release.json` sur Codeberg et télécharger les binaires sur
  GitHub : deux sources pour une seule mise à jour, et du code à changer quand
  même.

L'idée d'une mise à jour « souveraine via Codeberg » (spec du 2026-06-17)
ne tenait déjà plus : les binaires ne vivent que sur GitHub.

**Vérifié contre la vraie API**, pas seulement contre le mock : la release
`v0.1.0` est trouvée, `release.json` est validé, les deux artefacts sont
présents, et le binaire x64 répond `200` (115 Mo) après la redirection de
GitHub.
