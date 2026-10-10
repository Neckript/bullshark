# 2026-10-10 — Webcam en VP9 SVC

## Contexte : état du dépôt au 10 octobre

Reprise après neuf jours d'arrêt. Vérification de l'état réel avant de coder,
parce que la mémoire de ce qui est fait ou non n'est pas une source fiable.

| Dépôt | Branche | Tip | Conclusion |
|---|---|---|---|
| `bullshark` | `development` | `a88bf956` | local = Codeberg = GitHub |
| `bullshark` | `main` | `99632ab9` | contient tout `development` |
| `bullshark-desktop` | `main` = `development` | `c171312` (0.1.10) | aligné |
| `bullshark-mobile` | `development` | `20e1021` | figé depuis le 6 juillet |

**Les 24 branches distantes sont toutes mergées dans `development`.** Vérifié
une par une avec `git rev-list --count development..<branche>` : zéro commit
orphelin. Ce sont des restes à nettoyer, pas du travail en cours.

### Blocage résolu : GitHub refusait `main`

Le 7 octobre, le merge de `development` dans `main` n'a atterri que sur
Codeberg. Chaque `git push` vers GitHub était rejeté avec
`remote: Internal Server Error`, y compris en poussant un commit déjà présent
vers une branche jetable — donc GitHub refusait les mises à jour de référence
sur ce dépôt, pas le commit de merge. Aucun ruleset, aucune protection de
branche.

**Cause : panne transitoire côté GitHub.** Le même `git push origin main`
rejoué le 10 octobre passe sans rien changer à la configuration. GitHub et
Codeberg portent maintenant `99632ab9`, écart nul.

À retenir : un `git push --dry-run` **ne prouve rien** dans ce cas. Il ne
transfère pas le pack, donc la mise à jour de référence côté serveur — là où
l'erreur se produisait — n'est jamais exercée.

## Le changement : webcam en VP9 SVC

### Le problème

Le partage d'écran utilisait déjà VP9 SVC sur les navigateurs Chromium, mais la
webcam restait câblée en VP8 simulcast. VP8 simulcast fait tourner **trois
encodeurs logiciels en parallèle**, un par couche. VP9 SVC produit les trois
couches spatiales avec **un seul encodeur**.

### Ce qu'il n'a pas fallu toucher

L'essentiel du travail était déjà en place. Vérifié avant d'écrire une ligne :

| Couche | État | Action |
|---|---|---|
| Codecs du routeur (`apps/server/src/runtimes/voice.ts:36`) | VP9 déjà déclaré | aucune |
| Validation serveur (`voice.ts:262`) | accepte `type === 'svc'` pour tout producteur vidéo, pas seulement `SCREEN` | aucune |
| Helpers client (`voice-provider/helpers.ts`) | `getVp9Codec`, `getSvcQualityLayers`, `parseScalabilityMode` existaient | réutilisés |
| Consommateur (`isAdaptiveConsumerType`) | couvre déjà `'svc'`, aucun filtrage sur `SCREEN` | aucune |

**Le serveur n'a aucune modification.** Le changement est entièrement dans le
bloc producteur webcam de `voice-provider/index.tsx`.

### Le choix retenu, et pourquoi il diffère du partage d'écran

Le partage d'écran **abandonne complètement** le simulcast sur Firefox et
Safari : à la résolution d'une capture d'écran, trois encodeurs VP8 logiciels
sont limités par le CPU et écrasent le framerate quels que soient les réglages.
Mieux vaut un flux unique que trois couches saccadées.

**La webcam garde VP8 simulcast sur les moteurs non-Chromium.** Une webcam
plafonne bien en dessous d'une capture d'écran en résolution, donc elle ne
heurte pas le même mur CPU. Abandonner le simulcast là aurait été une
régression nette pour les utilisateurs Firefox et Safari : ils auraient perdu
le sélecteur de qualité sans rien gagner.

Décision finale :

| Moteur émetteur | Webcam | Partage d'écran |
|---|---|---|
| Chromium | VP9 SVC, 1 encodeur | VP9 SVC, 1 encodeur |
| Firefox / Safari | **VP8 simulcast, 3 encodeurs** | flux unique, pas de simulcast |

### Mode de scalabilité partagé

`SCREEN_SVC_SCALABILITY_MODE` est renommé `SVC_SCALABILITY_MODE`
(`voice-provider/statics.ts`). La valeur ne change pas : `L3T3_KEY`, soit trois
couches spatiales et trois couches temporelles, le suffixe `_KEY` rendant les
montées de couche spatiale peu coûteuses en n'exigeant une image clé que sur la
couche ajoutée.

Webcam et partage d'écran alimentent **le même sélecteur de qualité à trois
options**, donc une seconde constante de même valeur n'aurait fait que la
dupliquer.

### Un helper au lieu d'une expression dupliquée

La détection du moteur passe par `handlerName` de mediasoup, qui vaut
`Chrome74`, `Chrome70`, `Firefox60`, `Safari12`… Le test
`handlerName.startsWith('Chrome')` encode un fait non évident, et il était sur
le point d'être écrit une deuxième fois. Il devient
`isChromiumSender(handlerName)` dans `helpers.ts`, utilisé par les deux blocs.

### Repli

Si `produce()` échoue avec le codec adaptatif, on republie sans SVC ni
simulcast — même forme que le partage d'écran. Un repli à deux étages
(SVC → simulcast → flux unique) n'a pas été écrit : l'échec de `produce()` est
rare et deux étages de repli sont de la complexité spéculative.

## Vérification

- `bun test src/components/voice-provider` → 5 tests, 9 assertions, 0 échec.
  Le test couvre la logique qui peut casser : `isChromiumSender` sur les quatre
  familles de `handlerName`, et `getSvcQualityLayers` sur le nombre de couches,
  les étiquettes et la piste sans hauteur connue.
- `bun run check-types` → 0 erreur.
- `bun run lint` → 0 erreur (3 avertissements `react-refresh` préexistants,
  dans des fichiers non touchés).
- `bun run format` → appliqué.

**Pas encore vérifié dans le vrai client.** Un test unitaire ne prouve pas
qu'un producteur VP9 SVC s'établit réellement sur une webcam. À confirmer par
un appel vocal avec caméra sur un navigateur Chromium, en lisant
`Using VP9 SVC for webcam (Chromium sender)` dans les logs vocaux, puis sur
Firefox pour confirmer que le simulcast VP8 tient toujours.

## Fichiers touchés

```
apps/client/src/components/voice-provider/index.tsx      (bloc webcam + bloc ecran)
apps/client/src/components/voice-provider/helpers.ts     (isChromiumSender)
apps/client/src/components/voice-provider/statics.ts     (constante partagee)
apps/client/src/components/voice-provider/__tests__/svc.test.ts  (nouveau)
```

## Reste ouvert

1. ~~Le balayage de `tmp/` et `uploads/`~~ — **fait le même jour**, voir
   [`2026-10-10-staging-sweep.md`](2026-10-10-staging-sweep.md).
2. **Un seul worker mediasoup**, donc tous les salons vocaux partagent un cœur.
   Plafond de montée en charge, pas un problème actuel.
3. Nettoyage des 24 branches distantes mergées.
