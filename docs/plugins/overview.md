# Plugins overview / Aperçu des plugins

**EN** — A Bullshark plugin is a directory dropped into the server's `plugins`
folder, made of a `manifest.json` and up to two JavaScript entry points.

**FR** — Un plugin Bullshark est un dossier posé dans le répertoire `plugins` du
serveur, composé d'un `manifest.json` et d'au plus deux points d'entrée
JavaScript.

```
my-plugin/
├── manifest.json
├── server/index.js   # optional / optionnel
└── client/index.js   # optional / optionnel
```

## manifest.json

**EN** — Required fields: `id` (lowercase letters, digits, dashes), `name`,
`author`, `description`, `version` (`x.y.z`), `sdkVersion` (currently `1`, see
`PLUGIN_SDK_VERSION` in `@bullshark/shared`). `homepage` and `logo` are
optional URLs.

**FR** — Champs requis : `id` (lettres minuscules, chiffres, tirets), `name`,
`author`, `description`, `version` (`x.y.z`), `sdkVersion` (`1` actuellement,
voir `PLUGIN_SDK_VERSION` dans `@bullshark/shared`). `homepage` et `logo` sont
des URLs optionnelles.

## What a plugin can do / Ce qu'un plugin peut faire

**EN** — The server entry point receives a `PluginContext` (see
`packages/plugin-sdk`) exposing:

- `events` — subscribe to server events (`user:joined`, `message:created`,
  voice lifecycle, settings changes, …)
- `commands` / `actions` — register slash-commands and named actions callable
  from the client
- `messages` — send, edit, delete messages
- `voice` — read a channel's mediasoup router, create external streams
- `settings` — register typed, persisted plugin settings
- `hooks` — intercept lifecycle events such as `onBeforeFileSave`
- `data` — read users, channels, and public user info
- `ui` — enable/disable the plugin's client-side UI

The client entry point can render React components into fixed slots
(`PluginSlot`: connect screen, home screen, chat actions, top bar, full
screen).

**FR** — Le point d'entrée serveur reçoit un `PluginContext` (voir
`packages/plugin-sdk`) qui expose :

- `events` — s'abonner aux événements serveur (`user:joined`,
  `message:created`, cycle de vie vocal, changements de réglages, …)
- `commands` / `actions` — enregistrer des slash-commands et des actions
  nommées appelables depuis le client
- `messages` — envoyer, éditer, supprimer des messages
- `voice` — lire le routeur mediasoup d'un salon, créer des flux externes
- `settings` — enregistrer des réglages de plugin typés et persistés
- `hooks` — intercepter des événements de cycle de vie comme
  `onBeforeFileSave`
- `data` — lire les utilisateurs, salons, et infos publiques des utilisateurs
- `ui` — activer/désactiver l'UI côté client du plugin

Le point d'entrée client peut afficher des composants React dans des
emplacements fixes (`PluginSlot` : écran de connexion, écran d'accueil,
actions de chat, barre du haut, plein écran).

## Installing a plugin today / Installer un plugin aujourd'hui

**EN** — There is no plugin toolchain or marketplace content yet (that's a
separate, upcoming piece of work). Until then, installing a plugin means
building it yourself and copying its directory into the server's `plugins`
path, then enabling it from Server Settings → Plugins.

**FR** — Il n'y a pour l'instant ni chaîne d'outils ni contenu de marketplace
(c'est un chantier séparé, à venir). En attendant, installer un plugin veut
dire le construire soi-même et copier son dossier dans le répertoire
`plugins` du serveur, puis l'activer depuis Paramètres du serveur → Plugins.

Read **[security.md](./security.md)** before installing anything you didn't
write yourself. / Lis **[security.md](./security.md)** avant d'installer quoi
que ce soit que tu n'as pas écrit toi-même.
