# 🔒 Audit de sécurité — Bullshark (fork Sharkord)

**Date :** 2026-06-14
**Périmètre :** `apps/server`, `apps/client`, `packages/*` · branche `development`
**Type :** audit lecture seule — **aucune correction appliquée** (à prioriser ensemble)
**Objectif :** identifier toute vulnérabilité exploitable avant la stabilisation v0.1.0

---

## Synthèse

L'architecture d'accès est globalement saine : permissions tRPC systématiques, requêtes Drizzle
paramétrées, sanitisation HTML des messages, contrôle d'accès vocal à deux niveaux, anti-SSRF
sur les previews de liens. Le risque dominant est **1 faille critique de secrets par défaut**,
des **dépendances serveur vulnérables**, et un **contournement de quota/taille d'upload**.

| Sévérité | Findings |
|---|---|
| 🔴 Critique | C1 |
| 🟠 Élevée | H1, H2 |
| 🟡 Moyenne | M1, M2, M3, M4 |
| 🟢 Faible | L1, L2, L3, L4, L5 |

---

## 🔴 CRITIQUE

### C1 — Secret JWT et token owner par défaut = valeurs publiques connues
**Fichiers :** `apps/server/src/db/seed.ts:49,58` · `apps/server/src/utils/env.ts:15-17` · `apps/server/src/routers/others/use-secret-token.ts:18-29`

```ts
// env.ts
const env = typeof SHARKORD_ENV !== 'undefined' ? SHARKORD_ENV : 'development'; // défaut = development
const IS_DEVELOPMENT = !IS_PRODUCTION;
// seed.ts
const originalToken = IS_DEVELOPMENT ? 'dev' : randomUUIDv7();
secretToken: await sha256(originalToken),   // secret JWT = sha256('dev') en dev
```

**Faille :** quand `SHARKORD_ENV` n'est pas explicitement `production` (le défaut), le secret JWT
devient `sha256('dev')` — une constante publique — et le token owner devient `'dev'`.

**Scénario d'exploitation :**
1. Un attaquant anonyme forge un JWT `{ userId: 1 }` signé avec `sha256('dev')` (HS256) → session valide de n'importe quel utilisateur.
2. OU il s'enregistre normalement puis appelle `useSecretToken({ token: 'dev' })` → reçoit `OWNER_ROLE_ID` = god mode (toutes permissions, `wss.ts:83`).

→ **Prise de contrôle totale du serveur.**

**Atténuation existante :** le build officiel injecte `SHARKORD_ENV='production'`
(`apps/server/build/helpers.ts:159`), donc l'image Docker officielle est sûre. Le danger concerne
**tout déploiement compilé depuis les sources / image non officielle / `bun start`** sans la variable
— cas réaliste pour des self-hosters avant v0.1.0.

**Correctif proposé :**
- Refuser de démarrer si on n'est pas en prod ET que `SHARKORD_ENV` est absent (exiger une valeur explicite, sinon `throw`).
- Ne jamais dériver un secret d'une constante — générer un secret CSPRNG même en dev :
  ```ts
  import { randomBytes } from 'crypto';
  const originalToken = randomBytes(32).toString('hex'); // jamais 'dev'
  ```
- Avertissement bloquant si `secretToken === sha256('dev')`.

---

## 🟠 ÉLEVÉE

### H1 — Dépendances vulnérables (`bun audit`)
Résultats notables côté **serveur** (exécuté en prod) :

| Paquet | Sévérité | CVE / Impact | Exploitabilité réelle ici |
|---|---|---|---|
| `link-preview-js` ≤4.0.0 | High | SSRF via loopback/IPv6 (GHSA-4gp8-rjrq-ch6q) | Mitigée (cf. M4), lib à bumper |
| `drizzle-orm` <0.45.2 (0.44.5) | High | Injection SQL via identifiants mal échappés (GHSA-gpj5-g38j-94v9) | Faible (pas d'identifiant SQL piloté par l'utilisateur) — bumper quand même |
| `lodash-es` ≤4.17.23 | High | Code injection `_.template` (GHSA-r5fr-rjxr-66jc) | Faible (pas de `_.template` sur entrée user) |
| `yauzl` =3.2.0 | Moderate | Off-by-one (extraction zip, plugins) | À vérifier sur le flux d'install plugins |
| `vite` / `esbuild` | High/Mod | Lecture fichiers via dev-server | Dev only — pas exposé en prod (client buildé statique) |

**Correctif :** `bun update drizzle-orm link-preview-js lodash-es yauzl` (vérifier les ranges),
puis re-`bun audit`. Prioriser les deps **serveur**.

### H2 — Contournement de la limite de taille d'upload (DoS disque + bypass quota)
**Fichier :** `apps/server/src/http/upload.ts:14,49,78,85`

```ts
[UploadHeaders.CONTENT_LENGTH]: z.string().transform((val) => Number(val)) // taille = header client
...
if (contentLength > settings.storageUploadMaxFileSize) { ... } // contrôle sur valeur déclarée
req.pipe(fileStream);              // aucun comptage des octets réels du flux
size: contentLength,               // quota crédité sur la taille déclarée, pas réelle
```

**Scénario :** un utilisateur authentifié envoie un header `Content-Length` minuscule (ex. `1`) mais
streame un corps de plusieurs Go. Le contrôle de taille est passé, et `req.pipe` écrit tout sur le
disque temporaire avant la moindre vérification → **saturation disque (DoS)**. Le quota est en plus
débité de la taille *déclarée* → **bypass de quota**.

**Correctif :** compter les octets réellement reçus et abort au dépassement :
```ts
let received = 0;
req.on('data', (chunk) => {
  received += chunk.length;
  if (received > settings.storageUploadMaxFileSize) {
    fileStream.destroy(); req.destroy();
    // cleanup safePath + réponse 413
  }
});
```
Enregistrer `size` = octets réels (`fs.statSync(safePath).size`), pas le header.

---

## 🟡 MOYENNE

### M1 — JWT en localStorage, 7 jours, non révocable, sans rotation
**Fichiers :** `apps/client/src/screens/connect/index.tsx:92` · `apps/server/src/http/login.ts:262-264` · `apps/server/src/db/queries/users.ts:369`
- Token stocké en `localStorage` (`AUTO_LOGIN_TOKEN`) → volable par toute XSS.
- `expiresIn: '604800s'` (7 j), stateless : pas de révocation ; le « logout » est purement client-side ;
  un token volé reste valide 7 jours même après changement de mot de passe ou ban.
- `jwt.verify(token, secret)` sans `algorithms` pinné.

**Correctif :** durée plus courte + refresh tokens rotatifs ; pinner `algorithms: ['HS256']` ;
invalidation via `tokenVersion` par user (incrémenté au logout/ban/reset).

### M2 — Overrides de permission de canal ignorés sur les canaux non-privés
**Fichier :** `apps/server/src/utils/wss.ts:125`
```ts
if (!channel.private) return true; // tout droit de canal accordé si le canal n'est pas "private"
```
`hasChannelPermission(channelId, X)` renvoie `true` pour n'importe quelle permission dès que le canal
n'est pas `private`. Si un admin pose un override restrictif (ex. retirer `SEND`/`JOIN`) sur un canal
public, il est ignoré.

**À confirmer :** si le modèle voulu est « public = ouvert à tous, restrictions uniquement via `private` »,
ce n'est pas un bug. Sinon, évaluer l'override même pour les canaux publics. **À valider.**

### M3 — Secret de production dérivé de `randomUUIDv7()` (et réutilisé)
**Fichiers :** `apps/server/src/db/seed.ts:49,58` · `apps/server/src/helpers/files-crypto.ts:6`
Secret prod = `sha256(randomUUIDv7())`. UUIDv7 = préfixe timestamp (devinable) + ~74 bits aléatoires :
entropie correcte mais en-deçà d'un secret dédié. Ce même secret sert de clé de signature JWT **et**
de clé HMAC fichiers/URLs signées → point unique de compromission.

**Correctif :** `randomBytes(32)` comme source ; séparer clé JWT et clé HMAC fichiers.

### M4 — SSRF résiduel sur la prévisualisation de liens
**Fichiers :** `apps/server/src/queues/message-metadata/get-message-metadata.ts:54,77-111` · `apps/server/src/helpers/network.ts:64-83`
Mitigation **bonne** : `isPrivateIP` via `ipaddr.js` bloque loopback/private/linkLocal/uniqueLocal en
IPv4 **et IPv6**, fail-closed ; `resolveDNSHost` rejette si une adresse résolue est privée (anti-rebinding).
Résiduel : avec `followRedirects:'follow'`, vérifier que chaque cible de redirection repasse par
`resolveDNSHost`, et que la requête se connecte à l'IP validée (sinon fenêtre de re-résolution/rebind).
Lib sous-jacente toujours flaggée (cf. H1).

**Correctif :** bumper `link-preview-js`, re-valider les hôtes de redirection, épingler la connexion sur l'IP validée.

---

## 🟢 FAIBLE

- **L1 — `useSecretToken` sans rate-limit + comparaison non constante** (`others/use-secret-token.ts:20`, `===` sur hash). Brute-force infaisable en prod (UUIDv7), mais ajouter `rateLimitedProcedure` + `safeCompare`.
- **L2 — Mot de passe serveur en clair + comparaison non constante** (`routers/others/join.ts:57`, `settings.password` stocké en clair). Hasher, comparer en temps constant.
- **L3 — Liens `target=_blank` sans `rel=noopener` forcé** (`helpers/sanitize-html.ts:29`) → reverse-tabnabbing. Forcer `rel="noopener noreferrer"` via `transformTags.a`. Ajouter `X-Content-Type-Options: nosniff` sur les réponses de `public.ts`.
- **L4 — Lecture morte `USER_PASSWORD` en localStorage** (`connect/index.tsx:45`) : clé lue mais aucune écriture trouvée → le mot de passe n'est pas persisté aujourd'hui. Supprimer la clé pour éviter qu'un futur dev y stocke le mdp en clair.
- **L5 — Ban appliqué à une seule session** (`routers/users/ban.ts:38` `getUserWs` renvoie 1 socket) + bannissement vérifié uniquement à la connexion (`wss.ts:69`). Un user multi-onglets garde une session jusqu'à expiration du token. Fermer toutes les WS du userId et re-vérifier `banned` dans `authMiddleware`.

---

## ✅ Points vérifiés conformes (pas de faille)

| Axe | Constat |
|---|---|
| **Injection SQL** | Drizzle paramétré partout ; `sql``` n'interpole que des valeurs liées ; `LIKE` échappé avec `ESCAPE`. Pas de `sql.raw` sur entrée user. |
| **XSS messages** | `sanitize-html` allow-list stricte, `allowedSchemes` http/https/mailto (bloque `javascript:`), aucun handler d'événement, zalgo strippé ; aucun `dangerouslySetInnerHTML` côté client. |
| **Upload — path traversal** | `sanitizeFileName` (null-byte + `basename`) + stockage sous nom `randomUUIDv7()`. |
| **Upload — XSS fichier** | `INLINE_ALLOW_LIST` exclut SVG/HTML → servis en `attachment` ; CRLF strippés du `Content-Disposition`. |
| **WebRTC/mediasoup** | `joinVoice` exige permission globale **+** `ChannelPermission.JOIN` ; `consume` limité aux producers du salon courant ; ICE n'annonce que `announcedAddress`/IP publique. |
| **Autorisation tRPC** | `protectedProcedure` + `ctx.needsPermission(...)` systématiques ; rôle owner re-vérifié à chaque appel (révocation immédiate). |
| **CSRF** | Auth par token en `connectionParams`/header (pas de cookie) → CSRF non applicable. |
| **Secrets exposés au client** | `get-settings` retire `password`, `secretToken`, `klipyApiKey` (`clearFields`). Aucun secret en dur trouvé. |

---

## Priorisation suggérée

1. **C1** — blocage démarrage si secret = défaut dev (*quick win, impact max*).
2. **H2** (comptage octets upload) + **H1** (bump deps serveur).
3. **M1** (révocation/rotation JWT) et **M2** (clarifier l'intention du modèle de perms canaux publics).

---

*Audit réalisé par analyse statique du code (lecture seule) + `bun audit`. Aucune modification du code
n'a été effectuée. Les sévérités combinent l'impact et l'exploitabilité réelle dans ce codebase.*
