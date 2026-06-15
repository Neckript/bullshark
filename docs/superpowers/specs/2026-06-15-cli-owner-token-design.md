# Design — CLI de génération de token owner

**Date :** 2026-06-15
**Branche :** `development`
**Contexte :** suite de l'audit `docs/security-audit-2026-06-14.md` (findings C1, M3, L1).
**Statut :** approuvé (brainstorming), prêt pour plan d'implémentation.

---

## Objectif

Donner à l'opérateur d'un serveur Bullshark un moyen **sûr et explicite** de générer un
token de claim owner depuis l'hôte, et **supprimer le token `'dev'` par défaut** (faille C1),
sans casser les sessions actives ni les URLs de fichiers signées.

## Problème actuel

`settings.secret_token` joue **trois rôles** simultanés :

1. Secret de signature JWT — `apps/server/src/http/login.ts:262` (`getServerToken()`)
2. Clé HMAC des URLs de fichiers signées — `apps/server/src/helpers/files-crypto.ts:6` (`getServerTokenSync()`)
3. Hash du token de claim owner — `apps/server/src/routers/others/use-secret-token.ts:20`

Conséquences :
- **C1** : en dev (défaut quand `SHARKORD_ENV !== 'production'`), le token owner est la constante
  publique `'dev'` et le secret JWT devient `sha256('dev')` → prise de contrôle totale.
- **M3** : point unique de compromission (un seul secret pour signer JWT, HMAC fichiers et claim owner).
- Impossible de régénérer le token de claim sans invalider toutes les sessions et toutes les URLs signées.

## Décisions de design

### 1. Séparation des secrets

- `settings.secret_token` **reste** le secret crypto (signature JWT + HMAC fichiers). Lu par
  `getServerToken()` / `getServerTokenSync()`. **Jamais modifié par cette feature.** Toujours CSPRNG
  sur les nouvelles installations (fix C1).
- **Nouvelle colonne** `settings.owner_claim_token_hash` (`text('owner_claim_token_hash')`) =
  `sha256(token de claim owner)`. C'est désormais la seule valeur comparée par `useSecretToken`.

> Note : le split complet JWT ≠ HMAC fichiers de M3 (deux clés crypto distinctes) n'est **pas** inclus
> ici (YAGNI pour cette feature) ; il reste sur la liste des correctifs d'audit.

### 2. Migration

- `ADD COLUMN owner_claim_token_hash` — opération additive uniquement (évite le gotcha de
  reconstruction de table qui cascade-wipe les lignes enfants sur DB peuplée).
- Backfill : `UPDATE settings SET owner_claim_token_hash = secret_token WHERE owner_claim_token_hash IS NULL`.
  → Les tokens owner déjà imprimés continuent de fonctionner ; `secret_token` reste inchangé donc
  sessions JWT et URLs signées restent valides.

### 3. Commande : flag `--new-owner-token`

Dans `apps/server/src/index.ts`, **avant tout démarrage** HTTP / WebSocket / mediasoup :

1. Parser `process.argv` ; si `--new-owner-token` présent → mode CLI one-shot.
2. Initialiser la connexion DB uniquement.
3. Vérifier que la DB est seedée (ligne `settings` présente). Sinon : message clair
   (« démarrez le serveur une fois d'abord ») + `process.exit(1)`.
4. Générer `token = randomBytes(32).toString('base64url')` (CSPRNG, jamais une constante).
5. `UPDATE settings SET owner_claim_token_hash = sha256(token)` → **rotation** : l'ancien token
   de claim devient invalide.
6. Afficher le token **une seule fois** sur stdout via une notice `chalk` (même style que le seed),
   **jamais** via le logger winston/fichier.
7. `process.exit(0)`.

Portabilité : fonctionne en source (`bun src/index.ts --new-owner-token`), en binaire compilé, et via
`docker exec <conteneur> <binaire> --new-owner-token` (second process sur le même fichier sqlite).

### 4. Fixes liés inclus dans le même lot

- **C1 / `seed.ts`** : remplacer `const originalToken = IS_DEVELOPMENT ? 'dev' : randomUUIDv7()` par
  un CSPRNG `randomBytes(32).toString('base64url')` **dans tous les cas** ; stocker son hash dans
  `owner_claim_token_hash` ; `secret_token` = CSPRNG séparé. La notice de premier démarrage continue
  d'afficher le token owner une fois.
- **`use-secret-token.ts`** : comparer `sha256(input.token)` contre `settings.ownerClaimTokenHash` ;
  ajouter un rate-limit (`rateLimitedProcedure`) et une comparaison à temps constant (`crypto.timingSafeEqual`) — fix L1.

### 5. Sémantique du token

Réutilisable jusqu'à la prochaine régénération, qui le **révoque** (un seul hash stocké). Pas de
consommation one-time (YAGNI — pas d'état supplémentaire à gérer).

## Architecture / unités

| Unité | Rôle | Dépend de |
|---|---|---|
| `helpers/owner-token.ts` (nouveau) | `generateOwnerToken()` (CSPRNG) + `hashOwnerToken()` + `setOwnerClaimTokenHash(db)` | `crypto`, `@sharkord/shared` (`sha256`), db |
| `cli/new-owner-token.ts` (nouveau) | orchestration one-shot : check seed → génère → update → print → exit | helper ci-dessus, db, chalk |
| `index.ts` (modifié) | détection du flag en tête, dispatch vers la CLI avant boot | `process.argv` |
| `db/schema.ts` (modifié) | colonne `owner_claim_token_hash` | drizzle |
| `db/migrations/*` (nouveau) | ADD COLUMN + backfill | drizzle-kit |
| `seed.ts` (modifié) | CSPRNG owner token + écriture `owner_claim_token_hash` | helper |
| `routers/others/use-secret-token.ts` (modifié) | compare la nouvelle colonne + rate-limit + compare constant | db |

## Tests

- `generateOwnerToken` : longueur/entropie, jamais `'dev'`, format base64url.
- `hashOwnerToken` : stable, == `sha256`.
- Migration : backfill copie `secret_token` ; `secret_token` inchangé.
- Flag CLI : régénère le hash, exit 0, n'a pas démarré le serveur ; DB non seedée → exit 1 + message.
- Rotation : un token généré invalide le précédent.
- `useSecretToken` : accepte un token valide contre `owner_claim_token_hash`, rejette un invalide,
  rate-limit appliqué, comparaison à temps constant.
- `seed.ts` : ne produit jamais `'dev'` ; `secret_token` et `owner_claim_token_hash` distincts.

## Hors périmètre

- Split crypto complet JWT ≠ HMAC fichiers (reste sur la todo audit, M3).
- Les autres findings d'audit (H1, H2, M1, M2, M4, L2–L5) — traités dans un lot séparé.
- Toute modification du wrapper `bullshark-desktop`.
