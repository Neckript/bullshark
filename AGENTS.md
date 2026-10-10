# AGENTS.md

Consignes pour tout agent qui touche à ce dépôt.

## 1. La doc suit le code

Toute modification de code met à jour `docs/` dans le **même commit**. Pas de
« je documenterai après » : une doc en retard est une doc fausse, et une doc
fausse coûte plus cher que pas de doc.

- Changement visible par un utilisateur ou un administrateur → la page
  concernée de `docs/` (`getting-started.md`, `server-administration.md`,
  `plugins/`, …).
- Changement interne (chemin de code, décision technique, contournement) →
  une entrée dans `docs/development/`.

## 2. Des fonctions courtes et lisibles par un humain

- Une fonction fait une chose et son nom le dit.
- Si une fonction ne tient pas sur un écran, elle en cache deux.
- Pas d'abstraction sans deuxième appelant réel : pas d'interface à une seule
  implémentation, pas de fabrique pour un seul produit, pas de réglage pour une
  valeur qui ne change jamais.
- Avant d'écrire un helper, chercher celui qui existe déjà. Ce dépôt en a
  beaucoup.

## 3. Chaque blocage et chaque choix technique s'explique dans la doc

Le code dit *ce que* fait le programme. La doc dit **pourquoi**, et c'est la
partie qu'on ne peut pas reconstituer six mois plus tard.

À écrire systématiquement :

- **Le choix retenu et celui écarté.** « VP9 SVC plutôt que VP8 simulcast »
  ne suffit pas ; il faut la raison mesurable.
- **Tout blocage rencontré**, même résolu, et surtout la cause réelle quand
  elle diffère du symptôme.
- **Toute simplification délibérée** avec son plafond connu. Dans le code, un
  commentaire `ponytail:` nommant le plafond et le chemin de montée en charge.
- **Tout piège vérifié**, avec la preuve. « Ne marche pas » sans mesure n'est
  pas une explication.

Ne rien affirmer sans l'avoir vérifié dans le code ou la doc : ni API, ni
version, ni drapeau, ni SHA, ni nom de paquet.

## 4. Ce dépôt est public

Aucun audit de sécurité, aucun jeton, aucune adresse d'infrastructure dans
`docs/`. Ces documents restent hors du dépôt.
