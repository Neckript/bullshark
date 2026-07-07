# Optimisation mobile du client web + PWA + push — Design

Validé le 2026-07-06.

## Contexte et objectif

Le projet natif `bullshark-mobile` (Expo/RN) est **mis en pause** après son Plan 1 :
sans compte Apple Developer, une app iOS custom ne peut pas être installée
durablement, alors que le client web est déjà utilisable dans Safari iOS
(constat utilisateur du 2026-07-06 : navigation par slide fonctionnelle, seules
les actions de message sont inutilisables au tactile).

Objectif : faire du **client web servi par le serveur** l'app mobile de fait —
utilisable au doigt, installable sur l'écran d'accueil (PWA), avec
notifications push. Tout vit dans ce repo (`apps/client` + `apps/server`),
profite à tous les utilisateurs et suit le déploiement normal.

## Périmètre

1. **Actions de message au tactile** (client) — appui long → feuille d'actions,
   réactions utilisables au doigt.
2. **PWA installable** (client) — manifest réel, icônes, standalone.
3. **Notifications push web** (client + serveur + migration DB) — configurables
   par utilisateur.

**Hors périmètre** (jugés corrects sur mobile après test utilisateur) : tiroirs
slide gauche/droite, composer/clavier, modales et écrans de réglages.
Reportés : badge d'icône (app badging), cache offline (volontairement exclu,
voir PWA).

## Volet 1 — Actions de message au tactile

Approche retenue (option « appui long → sheet », style Discord mobile) :

- **Détection tactile** : media query `(pointer: coarse)`. Le desktop garde sa
  toolbar au survol strictement inchangée.
- **Appui long** (~450 ms) sur un message → **bottom sheet** contenant :
  - une rangée d'**emojis rapides** : jeu fixe 👍 ❤️ 😂 😮 😢 + bouton « + »
    ouvrant le picker complet existant (emojis custom du serveur inclus) ;
  - la liste d'**actions**, identique à la toolbar desktop et filtrée par les
    mêmes permissions (répondre/thread, réagir, éditer/supprimer ses propres
    messages, épingler si permission, copier le texte).
- L'appui long est **annulé si le doigt bouge** (scroll) ; il ne doit pas
  déclencher la sélection de texte du navigateur pendant la fenêtre d'appui.
- **Hook partagé** : la logique d'actions actuellement dans
  `apps/client/src/components/channel-view/text/message-actions.tsx` est
  extraite dans un hook consommé par la toolbar hover ET par la sheet — zéro
  duplication, une seule source de vérité pour les permissions.
- **Pastilles de réaction** sous les messages : zone tappable élargie
  (~44 px min) en pointeur coarse pour pouvoir toggler au doigt.

## Volet 2 — PWA installable

- `apps/client/index.html` référence déjà `/manifest.json`… qui n'existe pas
  (lien cassé). Créer le vrai `apps/client/public/manifest.json` : nom
  Bullshark, `display: standalone`, `start_url: /`, icônes 192/512 existantes
  + variante `maskable`, `theme_color`/`background_color` assortis au thème
  Bullshark.
- Ajouter `apple-touch-icon` dans `index.html` (icône d'écran d'accueil iOS).
- L'UI est embarquée dans le binaire serveur (build Vite → `interface.zip`) :
  tout ce qui est dans `public/` suit le déploiement normal, aucun changement
  d'infra.
- **Service worker minimal : push uniquement, AUCUN cache offline.** Décision
  ferme : l'historique du projet (cache edge Cloudflare masquant les
  déploiements) interdit d'ajouter une couche de cache supplémentaire côté
  client. Le SW ne gère que `push`, `notificationclick` et
  `pushsubscriptionchange`.

## Volet 3 — Notifications push web

### Serveur

- **Nouvelle table `push_subscriptions`** : `userId`, `endpoint` (unique),
  clés `p256dh`/`auth`, `createdAt`. Migration **ADD TABLE uniquement** (aucun
  rebuild de table existante — contrainte de sûreté prod, cf. gotcha migrations
  en cascade).
- **Clés VAPID** générées au premier boot et persistées en DB (même pattern que
  le server token).
- **Lib `web-push`** ; sa compatibilité Bun est validée en tout début
  d'implémentation, avec fallback prévu (envoi HTTP manuel VAPID) si besoin.
- **Préférence par utilisateur** (user settings existants) :
  `all` / `mentions_dms` (défaut) / `none`.
- **Déclenchement** sur nouveau message (salon ou DM). Destinataires =
  utilisateurs abonnés, filtrés par :
  1. leur préférence (`all` → tout message du salon ; `mentions_dms` →
     @mention détectée via `has-mention.ts` du shared, ou DM adressé) ;
  2. **exclusion si session WS active** (déjà devant l'app) ;
  3. **exclusion si statut DND** ;
  4. permissions de lecture du salon concerné.
- **Envoi asynchrone non bloquant** via le système de queues existant du
  serveur : un échec de push ne ralentit ni ne fait échouer l'envoi du message.
- **Nettoyage** : réponse 404/410 du service de push → abonnement supprimé.
  Autres erreurs → loggées, sans retry agressif.
- **Procédures tRPC** : enregistrer un abonnement, le supprimer, lire/écrire la
  préférence de notification.
- **Payload** : titre (serveur/salon ou expéditeur du DM), corps (auteur +
  extrait de texte, HTML retiré, tronqué), URL cible ; `tag` par salon pour
  regrouper les notifications.

### Client

- **Section « Notifications » dans les réglages utilisateur** :
  - bouton « Activer sur cet appareil » — la demande de permission part d'un
    geste utilisateur (obligatoire iOS) ;
  - sélecteur de préférence (tout / mentions + DMs / rien) ;
  - états explicites : non supporté par le navigateur, **PWA requise** (iPhone
    hors standalone → message « Installe d'abord l'app : Partager → Sur
    l'écran d'accueil », le push iOS n'existe qu'en PWA installée, iOS 16.4+),
    permission refusée (« bloquée dans les réglages du navigateur »), activé.
- **Clic sur une notification** → ouvre ou met au premier plan l'app sur le bon
  salon/DM (`notificationclick` + navigation).
- `pushsubscriptionchange` (renouvellement iOS) → réabonnement en arrière-plan
  et mise à jour serveur.

## Gestion des erreurs

- Actions de la sheet : mêmes toasts d'erreur tRPC que la toolbar desktop.
- Permission refusée : état explicite dans l'UI (pas de bouton silencieusement
  inopérant).
- Échec d'envoi de push : loggé côté serveur, jamais propagé au chemin d'envoi
  du message ; 404/410 → purge de l'abonnement.
- Échec de génération VAPID au boot : loggé, le push est proprement désactivé
  (le reste du serveur démarre normalement).

## Tests

- **Serveur (`bun test`)** : calcul des destinataires (les 3 préférences,
  exclusion DND, exclusion session WS active, détection de mention,
  permissions de salon), CRUD des abonnements, purge sur 404/410.
- **Client (RTL)** : hook partagé d'actions (filtrage par permissions identique
  hover/sheet), hook d'appui long (déclenchement à ~450 ms, annulation au
  mouvement), états de la section réglages notifications.
- **Vérification manuelle iPhone** (checklist en fin de plan) : installation
  PWA, activation du push, réception d'une mention app fermée, tap → bon
  salon ; **non-régression desktop** : toolbar au survol inchangée.

## Ordre de développement

1. Actions tactiles (hook partagé + sheet + réactions) — livrable seul.
2. PWA installable (manifest, icônes, SW squelette sans cache).
3. Push serveur (table, VAPID, destinataires, queue, tRPC).
4. Push client (réglages, abonnement, SW push/notificationclick).
5. Vérification manuelle iPhone + non-régression desktop.
