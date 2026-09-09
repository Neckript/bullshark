# Modale des paramètres utilisateur — design

- Date : 2026-09-09
- Statut : brouillon, questions ouvertes à trancher avant le plan d'implémentation
- Petit chantier, pas de dépendance runtime

## Problème

Les écrans de réglages de Bullshark (`UserSettings`, `ServerSettings`,
`ChannelSettings`, `CategorySettings`) sont tous rendus via le même shell
`ServerScreenLayout` (`apps/client/src/components/server-screens/server-screen-layout.tsx`) :
une page plein écran (`h-screen`, fond opaque), bouton retour en chevron.
`UserSettings` (`.../user-settings/index.tsx`) empile en plus une rangée
d'onglets horizontaux (`Tabs`/`TabsList`) tout en haut : Profil, Appareils,
Mot de passe, Sécurité, Notifications, Autres.

l.user a partagé deux captures réelles de Discord (desktop et mobile) et veut
que la modale des paramètres **utilisateur** s'en rapproche très fortement,
pas juste "avoir l'air d'une modale". Déjà noté en backlog cosmétique dans
[[bullshark-settings-modal-style-backlog]] (2026-09-08) que le passage
page → modale centrée avec fond assombri sur `ServerScreenLayout` est un
changement CSS/layout à faible risque. Cette spec va plus loin : Discord n'a
pas seulement une modale, sa navigation elle-même diffère entre desktop
(liste latérale groupée par sections) et mobile (carte de profil d'abord,
pas de liste d'onglets du tout).

## Ce qui existe déjà et qu'il faut réutiliser

- **Le portail/overlay existe déjà.** `ServerScreensProvider`
  (`apps/client/src/components/server-screens/index.tsx`) rend déjà tous les
  écrans via un React Portal avec état `isOpen`/`close` et fermeture à
  Échap — mécaniquement ce n'est pas une navigation de page, juste un style
  qui ressemble à une page. Voir [[bullshark-settings-modal-style-backlog]]
  pour le détail déjà investigué.
- **Le contenu (Cards) est déjà proche du style Discord.** Chaque onglet de
  `UserSettings` est déjà composé de `Card`/`CardHeader`/`CardContent`
  (ex. `user-settings/others/index.tsx`) — l'écart avec Discord est presque
  entièrement dans la **navigation** (onglets plats en haut vs. liste
  latérale groupée), pas dans le contenu des sections.
- **La carte de profil mobile a déjà toutes ses données.** `profile/index.tsx`
  a déjà `avatar-manager.tsx`, `banner-manager.tsx`, un champ `bio`, et
  `ownPublicUser` porte déjà de quoi afficher nom/handle/date de création —
  il manque une *présentation* en carte (lecture d'abord, édition via bouton),
  pas les données.
- **Piège Electron déjà documenté.** `ServerScreenLayout` gère explicitement
  les zones de glissement de fenêtre desktop (classes `app-drag`/`app-no-drag`,
  commentées dans le code) parce que le portail se rend par-dessus la barre du
  haut. Toute refonte du shell doit re-vérifier que le drag de fenêtre
  fonctionne toujours.
- **Convention responsive du projet : classes Tailwind, pas de hook JS.**
  Le reste de l'app bascule desktop/mobile avec des préfixes `md:`/`lg:` et
  deux arbres DOM rendus en parallèle (voir `screens/server-view/index.tsx`,
  ex. `md:hidden`, `md:relative md:flex`), pas avec un hook React basé sur
  `matchMedia` (`use-is-coarse-pointer.ts` existe mais sert à détecter un
  pointeur tactile, pas la largeur d'écran). À réutiliser telle quelle plutôt
  que d'introduire un nouveau hook de breakpoint.

## Périmètre desktop

- `ServerScreenLayout` passe de page plein écran à modale centrée avec fond
  assombri, fermeture par X en haut à droite au lieu du chevron retour
  (repris du constat déjà fait dans [[bullshark-settings-modal-style-backlog]]).
- La rangée d'onglets horizontaux de `UserSettings` est remplacée par une
  liste latérale **groupée par sections avec petits en-têtes**, comme sur la
  capture desktop de Discord (ex. un bloc "Compte" en haut, un bloc
  "Facturation" avec Nitro/Boost/Abonnements en dessous, un bloc
  "Expérience" avec Apparence/Accessibilité/Système en dessous). Item
  sélectionné mis en surbrillance, contenu de droite scrollable
  indépendamment du panneau de nav.
- Bullshark n'a pas d'équivalent Nitro/Boost/Facturation ni de Centre
  familial — les six onglets existants (Profil, Appareils, Mot de passe,
  Sécurité, Notifications, Autres) doivent être regroupés en sections qui
  ont un sens pour Bullshark, pas un calque 1:1 des catégories Discord.
  Proposition à valider (question ouverte 1) : section **"Compte"**
  (Profil, Mot de passe, Sécurité, Appareils) + section **"Préférences"**
  (Notifications, Autres).

## Périmètre mobile

- En dessous du breakpoint existant `md` (768px, cohérent avec le reste de
  l'app), ouvrir les paramètres utilisateur affiche une **carte de profil
  d'abord**, pas la liste groupée desktop : bannière (`banner-manager`) en
  haut, avatar en chevauchement bas-gauche, nom d'affichage + statut, un
  bouton principal "Modifier le profil", puis des blocs empilés (Bio,
  "Membre depuis" via la date de création déjà disponible sur
  `ownPublicUser`), puis les autres sections (Mot de passe, Sécurité,
  Appareils, Notifications, Autres) en liste simple en dessous plutôt qu'en
  nav persistante.
- Pas de barre d'actions rapides type Discord (Quêtes/Boutique/Nitro) —
  Bullshark n'a aucune de ces features, hors périmètre.
- Pas d'onglet "Liste de souhaits" — feature absente de Bullshark, hors
  périmètre.

## Questions ouvertes, à trancher avant le plan d'implémentation

1. **Groupement exact des sections desktop.** Proposition ci-dessus
   ("Compte" / "Préférences") — à valider ou modifier par l.user.
2. **Bouton "Modifier le profil" en mobile.** Discord ouvre un écran
   d'édition séparé par-dessus la carte. Ici : réutiliser le formulaire
   `profile/index.tsx` existant tel quel en overlay, ou rendre les champs
   directement éditables sous la carte sans écran séparé ?
3. **Breakpoint.** Confirmer l'alignement sur `md` (768px, déjà utilisé
   ailleurs dans l'app) plutôt qu'un seuil différent.

## Hors périmètre

- `ServerSettings`/`ChannelSettings`/`CategorySettings` héritent
  automatiquement du changement de shell (modale assombrie) puisqu'ils
  partagent `ServerScreenLayout`, mais leur navigation interne n'est **pas**
  retravaillée ici — ce sont des écrans différents avec d'autres besoins,
  à traiter séparément si souhaité un jour.
- Aucune feature Discord absente de Bullshark (Nitro, Boost, Boutique,
  Quêtes, Liste de souhaits, Centre familial) — seul le *style* de mise en
  page est repris, pas ces fonctionnalités.
- Pas de refonte du contenu des `Card` existantes (déjà proche du style
  Discord) — uniquement la navigation et le shell.
