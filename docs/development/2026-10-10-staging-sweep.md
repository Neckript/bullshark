# 2026-10-10 — Balayage de `tmp/` et `uploads/`

## Le problème, après correction d'un diagnostic trop rapide

L'affirmation de départ était « rien ne purge `tmp/` ni `uploads/` ». **C'est
faux**, et il a fallu lire le code pour s'en apercevoir :

- `crons/cleanup-files.ts` tourne déjà toutes les 15 minutes et supprime les
  lignes de `files` que plus rien ne référence, disque compris.
- `utils/file-manager.ts:37` fixe un TTL d'une minute sur chaque fichier
  temporaire.

**Le vrai trou est plus étroit : ce TTL est un `setTimeout` en mémoire.**

```ts
this.timeouts[tempFile.id] = setTimeout(() => {
  this.removeTemporaryFile(tempFile.id);
}, TEMP_FILE_TTL);
```

Un crash ou un redéploiement perd le timer. Le fichier reste sur le disque pour
toujours, et plus rien ne le connaît : il n'a pas encore de ligne en base, donc
le balayage des orphelins ne le voit pas non plus. Pour un serveur
auto-hébergé, c'est une fuite de disque silencieuse qui ne se répare jamais
toute seule.

## Le choix retenu : étendre le cron, pas en ajouter un

Trois options étaient sur la table.

| Option | Écartée pourquoi |
|---|---|
| Une étape de balayage dans `index.ts` | Ne couvre que le démarrage. Un serveur qui tourne des mois sans redémarrer accumule quand même. |
| Un nouveau cron dédié | Un deuxième calendrier à comprendre pour la même responsabilité. |
| **Étendre `cleanup-files.ts`** | **Retenue.** |

Le cron existant est déjà enregistré avec `runOnInit` à `true` :

```ts
new CronJob(
  CRON_TIMES.EVERY_15_MINUTES,
  cleanupFiles,
  null,
  true,            // start
  'Europe/Lisbon',
  null,
  true             // runOnInit
);
```

Donc le brancher dedans donne **les deux** comportements d'un coup : une passe
au démarrage, qui rattrape le crash, et une passe toutes les 15 minutes, qui
rattrape le serveur au long cours. Aucune nouvelle étape de démarrage, aucun
nouveau cron, et le nettoyage de fichiers reste dans le fichier qui en est déjà
responsable.

Le balayage passe **avant** le retour anticipé sur `orphanedFileIds.length === 0`
— sinon il ne tournerait jamais dans le cas courant, qui est précisément celui
où il n'y a pas d'orphelin.

## Le seuil : une heure, et pourquoi pas de vérification croisée

`STALE_FILE_MAX_AGE = 1000 * 60 * 60`, soit **60 fois le TTL**.

La tentation était de croiser avec la liste `temporaryFiles` en mémoire pour ne
jamais supprimer un fichier encore suivi. Inutile : un fichier suivi a au
maximum une minute. À une heure, l'écart est tel qu'aucun fichier dont le
serveur se soucie encore ne peut être concerné. La vérification croisée aurait
été du code en plus pour une garantie déjà acquise par l'arithmétique.

## Les deux pièges vérifiés avant d'écrire

Un balayage qui supprime des fichiers doit prouver qu'il ne détruit rien de
vital. Les deux candidats ont été tracés :

1. **Une restauration en attente.** `applyPendingRestore()` tourne à l'étape 3
   du démarrage, avant l'ouverture de la base. Si son staging vivait sous
   `tmp/`, un balayage au démarrage détruirait une restauration en cours.
   **Il n'y vit pas** : `restore.ts:5-6` place
   `RESTORE_STAGING_PATH` et `RESTORE_PENDING_PATH` directement sous
   `DATA_PATH`, en frères de `tmp/`. Hors de portée.

2. **`tmp/downloads`**, utilisé par `downloads.ts` pour les archives de
   plugins. Supprimer ce dossier serait un problème s'il n'était pas recréé.
   **Il l'est** : `downloads.ts:78` appelle `ensureDir(downloadsPath)` avant
   chaque usage. Et son mtime bouge à chaque écriture, donc un dossier
   réellement actif n'atteint jamais une heure.

## Où vit le code

Le balayage est une fonction de système de fichiers pure, dans
`helpers/fs.ts` — à côté de `ensureDir`, et comme elle sans aucune dépendance
à la base. C'est ce qui rend le test possible sans monter le harnais SQLite :

```ts
sweepStaleEntries(dir, maxAgeMs, { now?, onError? }): Promise<number>
```

- Un dossier absent rend `0`, ce n'est pas une erreur : cela veut seulement
  dire que rien n'y a encore été écrit.
- Une entrée illisible est signalée par `onError` et **n'arrête pas** le
  balayage. Un résidu bloqué ne doit pas laisser le reste du disque se remplir.
- `now` est injectable, ce qui rend le seuil testable sans attendre.

Le cron fournit `onError` et journalise : `debug` quand il n'y a rien,
`info` avec le détail `tmp` / `uploads` quand il a supprimé quelque chose. Un
auto-hébergeur doit pouvoir lire dans ses logs ce qui a disparu.

Pas de réglage de configuration pour le seuil. Personne ne l'a demandé, et une
heure n'a pas de raison connue de devoir changer. À ajouter quand un
auto-hébergeur en exprimera le besoin.

## Vérification

- `bun test src/helpers/__tests__/sweep-stale-entries.test.ts` → 5 tests,
  8 assertions, 0 échec. Couvre : périmé supprimé et récent conservé,
  sous-dossier périmé supprimé en entier, entrée pile sous le seuil épargnée,
  dossier absent, dossier vide.
- `bun test` (suite serveur complète) → **1069 tests, 0 échec**.
- `bun run check-types` → 0 erreur.
- `bun run lint` → 0 erreur, aucun avertissement dans les fichiers touchés.

Les mtimes sont posés par `fs.utimes` dans le test au lieu d'attendre. `utimes`
prend des secondes, pas des millisecondes.

## Fichiers touchés

```
apps/server/src/helpers/fs.ts                                   (sweepStaleEntries)
apps/server/src/crons/cleanup-files.ts                          (sweepStagingDirs + branchement)
apps/server/src/helpers/__tests__/sweep-stale-entries.test.ts   (nouveau)
```
