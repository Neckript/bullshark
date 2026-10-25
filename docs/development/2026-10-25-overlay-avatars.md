# 2026-10-25 — Avatars cassés dans l'overlay in-game

## Symptôme

Dans l'overlay de Bullshark Desktop, les avatars affichaient l'icône d'image
cassée de Chromium, alors que l'application montrait les vraies photos au
même moment. Ça arrivait surtout après avoir désactivé puis réactivé
l'overlay.

## Cause réelle

Les URL signées sont actives sur le serveur (réglage Stockage, durée par
défaut 1 h). Le client signe les avatars au chargement de la liste des
utilisateurs et ne renouvelle jamais ces jetons.

- La page du serveur garde l'image dans son cache d'images par document :
  un `<img>` remonté avec la même URL ne refait aucune requête, même après
  l'expiration du jeton.
- L'overlay est un autre document (une autre fenêtre Electron). Il redemande
  l'URL et le serveur répond `403` dès que le jeton a expiré. La fenêtre est
  recréée à chaque désactivation/réactivation, d'où le lien avec ce geste.

**Preuve :** dans le cache HTTP de l'application, le jeton d'avatar le plus
récent avait expiré 48 minutes plus tôt, et le serveur répondait `403` sur
cette URL. Une sonde Playwright (serveur qui sert l'image une fois puis
répond `403`) donne : même document → `load` sans requête, autre document →
`error`.

## Choix retenu

`use-overlay-reporter.ts` envoie à l'overlay une data URL de 56 px, recadrée
au centre, construite dans la page du serveur à partir de l'image qu'elle a
déjà. Elle est mise en cache par URL ; une URL re-signée est une nouvelle clé
et repart d'une nouvelle image. Si l'image ne charge pas, l'overlay reçoit
`null` et affiche les initiales.

Côté desktop, l'overlay affiche aussi les initiales sur `onError`, comme le
composant avatar de l'application.

**Écarté :**

- Renouveler les jetons de fichier dans tout le client : c'est le vrai
  problème de fond (une image jamais affichée avant l'expiration reste
  cassée partout), mais il touche le serveur et tout le client, pas
  seulement l'overlay.
- Charger l'overlay dans la partition du serveur : le cache d'images est par
  document, pas par session, donc ça ne règle rien.

**Plafond connu :** un avatar animé (GIF) devient une image fixe dans
l'overlay, et le cache des data URL n'est jamais vidé (une entrée par avatar
et par rotation de jeton).
