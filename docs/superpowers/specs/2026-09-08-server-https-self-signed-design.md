# HTTPS auto-signé embarqué — design

- Date : 2026-09-08
- Statut : implémenté (branche `feat/tls-self-signed`)
- Petit chantier, pas de dépendance runtime lourde

## Problème

Bullshark ne termine pas le TLS lui-même (`apps/server/src/http/index.ts:71`,
`http.createServer` en clair). La doc actuelle (`docs/getting-started.md`)
suppose qu'on met un reverse proxy (Caddy) devant, avec un vrai nom de
domaine, pour obtenir un certificat Let's Encrypt — c'est ce que fait l.user
en prod sur le Kimsufi. Mais les navigateurs n'autorisent micro/caméra/écran
que dans un contexte sécurisé (HTTPS ou `localhost`), donc quiconque n'a pas
de nom de domaine (LAN, usage perso, test rapide) ne peut tout simplement pas
utiliser le vocal/vidéo/partage d'écran aujourd'hui.

l.user veut que les deux solutions cohabitent, sélectionnables : la voie
actuelle (reverse proxy externe type Caddy + domaine, recommandée en
production/serveur public) reste la référence, et une voie alternative
embarquée (certificat auto-signé généré par Bullshark lui-même) devient
disponible pour qui n'a pas de domaine. Décisions de détail déléguées à
l'assistant ("tu choisis").

## Solution retenue

### Configuration : un mode explicite, opt-in

Nouvelle section `tls` dans `config.ini`, sur le modèle de `webRtc` dans
`apps/server/src/config.ts` :

```ts
tls: z.object({
  mode: z.enum(['none', 'selfSigned'])
})
```

- Défaut : `mode: 'none'` — comportement actuel inchangé, zéro impact sur les
  déploiements existants (dont celui de l.user derrière Caddy).
- `mode: 'selfSigned'` — le serveur termine le TLS lui-même sur
  `server.port` (même port, `https.createServer` au lieu de
  `http.createServer` dans `apps/server/src/http/index.ts`, `createWsServer`
  reçoit le même objet serveur qu'aujourd'hui donc aucun changement côté
  WebSocket).
- Env var symétrique aux autres : `BULLSHARK_TLS_MODE`.

### Génération du certificat

- **v1 : certificat auto-signé seul (feuille), pas de CA locale à installer.**
  L'utilisateur accepte l'avertissement du navigateur une fois par
  appareil — c'est le comportement déjà connu de nombreux outils
  self-hosted (Synology, Portainer, etc.), et ça résout le vrai problème
  (contexte sécurisé pour les API WebRTC) sans construire un flux
  d'installation de CA racine. Ce flux CA (téléchargement + instructions
  d'import par OS pour supprimer l'avertissement) est noté en hors périmètre
  ci-dessous, pour une itération ultérieure si demandé.
- Génération via une lib pure JS sans dépendance native (type `selfsigned`,
  basée sur `node-forge`) — compatible avec la compilation en binaire unique
  Bun (`bun build --compile`), pas de dépendance à un `openssl` système.
- **SAN (Subject Alternative Names)** du certificat : `localhost`, `127.0.0.1`,
  `SERVER_PRIVATE_IP`, et `SERVER_PUBLIC_IP` si connu — ces valeurs sont
  déjà calculées par `apps/server/src/helpers/network.ts` et importées dans
  `config.ts`, donc réutilisées telles quelles, pas de nouvelle détection
  réseau à écrire.
- **Persistance** : `cert.pem`/`key.pem` écrits une fois dans le répertoire
  de données (`ensureServerDirs`, même famille que `config.ini`), générés
  seulement s'ils sont absents. Ne jamais régénérer à chaque redémarrage —
  ça casserait l'exception de confiance que le navigateur a mémorisée.
  Régénération manuelle via un nouveau flag `--regenerate-tls-cert`,
  symétrique à `--new-owner-token` déjà existant (même modèle : affiche un
  message, régénère, quitte sans démarrer le serveur).

### Documentation

`docs/getting-started.md`, section 3 (HTTPS), réorganisée en deux options
explicites :
- **Option A — nom de domaine (recommandé pour un serveur public)** :
  contenu actuel (Caddy + Let's Encrypt).
- **Option B — pas de domaine (LAN, perso, test)** : `BULLSHARK_TLS_MODE=selfSigned`,
  explique l'avertissement du navigateur et pourquoi il apparaît, comment
  l'accepter une fois par appareil.

## Hors périmètre

- Flux de CA racine locale téléchargeable/installable (supprimerait
  l'avertissement navigateur après un geste unique) — v2 potentielle, pas
  bloquante pour résoudre le problème initial.
- ACME/Let's Encrypt intégré directement dans Bullshark (sans Caddy externe)
  pour qui a un domaine mais ne veut pas installer Caddy — un problème
  différent (a un domaine, ne veut pas de proxy tiers), non demandé ici.
- Alternatives réseau type Tailscale (`tailscale cert`, certificats gratuits
  pour un sous-domaine `*.ts.net` sans exposer de port) — solution valable
  mais hors périmètre : suppose l'adoption d'un outil tiers, pas une
  fonctionnalité de Bullshark.
- Écoute sur le port 443 par défaut — reste sur `server.port` (4991 par
  défaut) ; le mapping vers 443 se fait comme aujourd'hui via Docker
  (`-p 443:4991`) ou le reverse proxy, pas de changement de port par défaut
  ni de besoin de privilèges root supplémentaires.
