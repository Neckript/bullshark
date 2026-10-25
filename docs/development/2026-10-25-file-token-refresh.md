# 2026-10-25 — Renouvellement des jetons de fichiers signés

## Problème

Avec les URL signées actives (réglage Stockage), le serveur signe chaque
fichier au moment où il l'envoie : jeton HMAC de `fileId:expiresAt`, valable
le temps du TTL (1 h par défaut, 30 min minimum, 7 jours maximum). Le client
ne renouvelait jamais ces jetons.

Une image déjà affichée survit à l'expiration grâce au cache d'images du
document. Mais toute image montée plus tard avec le même jeton prend un
`403` : liste des membres ouverte après une heure, vieux message remonté,
overlay du desktop (voir `2026-10-25-overlay-avatars.md`).

## Choix retenu : re-signature à la demande

- **Serveur :** route `files.refreshTokens({ fileIds })`
  (`apps/server/src/routers/files/refresh-tokens.ts`). Elle renvoie un
  nouveau jeton pour chaque fichier que l'appelant peut lire :
  - pièce jointe de message → accès au salon (`assertChannelAccess`, donc
    `VIEW_CHANNEL` et participation aux MP) ;
  - tout autre fichier référencé (avatar, bannière, emoji, icône de rôle,
    logo, son) → tout membre, comme aujourd'hui à l'envoi ;
  - fichier orphelin → jamais.

  Les fichiers refusés sont simplement absents de la réponse. La route
  renvoie `{}` quand les URL signées sont désactivées. 1000 fichiers maximum
  par appel.

- **Client :** `features/server/files/subscriptions.ts` vérifie chaque
  minute le store du serveur. Les jetons qui expirent dans moins de 10 min
  sont renouvelés par un seul appel. L'action `refreshFileTokens` réécrit
  toutes les copies du fichier, où qu'elles soient dans le store.

**Pourquoi un parcours générique du store :** les fichiers signés vivent
dans `users`, `emojis`, `roles`, `messagesMap`, `threadMessagesMap`,
`publicSettings`, etc. Lister chaque chemin à la main casserait au premier
nouveau champ. Le parcours ne descend que dans les objets simples et les
tableaux, parce que le slice contient aussi des `MediaStream`.

## Écarté

- **Cookie de session sur `/public` :** plus simple, mais moins strict. Un
  membre retiré d'un salon qui a gardé l'URL d'une pièce jointe pourrait
  encore la lire. Avec la re-signature, il perd l'accès au plus tard à la fin
  du TTL.
- **Seulement monter le TTL :** ça repousse le problème sans le régler.

## Plafonds connus

- Les fichiers hors du store (résultats de recherche, profil ouvert dans une
  modale) ne sont pas renouvelés. Ces vues refont leur requête à chaque
  ouverture.
- Un composant avatar qui recharge sa nouvelle URL peut montrer les
  initiales un court instant, une fois par TTL.
- Au-delà de 1000 fichiers proches de l'expiration, le reste passe à la
  vérification suivante, une minute plus tard.
