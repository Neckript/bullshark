# Langage de mouvement — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> utilisent la syntaxe à cases (`- [ ]`) pour le suivi.

**But :** donner au client une échelle de durées et de courbes, et rendre la
garde `prefers-reduced-motion` impossible à oublier en la faisant porter par les
jetons eux-mêmes.

**Architecture :** deux familles de durée déclarées dans un bloc `@theme static`
de `apps/client/src/index.css`, l'une pour ce qui fond, l'autre pour ce qui
bouge. Sous `prefers-reduced-motion`, seule la famille « déplacement » est
redéfinie à zéro, ainsi que les distances `--rise`, `--lift` et l'échelle
`--pop-from`. Tout consommateur du bon jeton est donc gardé sans règle
supplémentaire. Un filet de sécurité ne coupe que la répétition infinie, sauf
sur les surfaces marquées `data-motion-keep`.

**Stack :** Tailwind 4.2.1, tw-animate-css 1.4.0, React, Bun, Playwright. Aucune
dépendance nouvelle.

**Spec :** `docs/superpowers/specs/2026-08-25-motion-language-design.md`

## Contraintes globales

- Branche de travail : `feat/motion-language`, base `main` = `f9916ed`. Ne
  jamais commiter sur `main`.
- Aucune dépendance ajoutée.
- Les trois portes doivent être vertes AVANT chaque commit, depuis la racine :
  `bun run format:check`, `bun run check-types`, `bun run lint`. `format:check`
  est une porte de CI : un commit non formaté casse la CI.
- Valeurs des jetons, à copier telles quelles :
  `--transition-duration-fast: 120ms`, `--transition-duration-base: 200ms`,
  `--transition-duration-slow: 320ms`, `--transition-duration-move-fast: 120ms`,
  `--transition-duration-move-base: 200ms`,
  `--transition-duration-move-slow: 320ms`,
  `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`,
  `--ease-in: cubic-bezier(0.4, 0, 1, 1)`,
  `--ease-move: cubic-bezier(0.65, 0, 0.35, 1)`,
  `--ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1)`, `--rise: 6px`,
  `--lift: 12px`, `--pop-from: 0.6`.
- `--ease-pop` est **réservé aux réactions et à la soundboard**. L'utiliser
  ailleurs est un défaut de revue.
- Le bloc `@theme` des jetons de mouvement ne doit **jamais** porter `inline` :
  `inline` fige la valeur dans l'utilitaire et la garde n'aurait plus rien à
  redéfinir.
- Lancer les tests E2E depuis `packages/e2e` avec `bun run test:e2e`. **Vider
  `packages/e2e/e2e-data` AVANT chaque run.** Lire « N passed » dans la sortie,
  **pas** le code de sortie, qui vaut 1 même quand tout est vert. Si le port
  4991 est déjà pris, un `bun` fantôme d'un run interrompu traîne : donner la
  commande à l.user, l'agent ne peut pas tuer le processus.
- Messages de commit en français, style conventionnel, avec les remorques :

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NRE1jt7RYEsVPWX8NKvmr9
  ```

---

## Structure des fichiers

| Fichier                                                                                                                       | Responsabilité                                                      |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/client/src/index.css`                                                                                                   | Jetons, garde, filet, keyframes partagées (`message-enter`, `wf-*`) |
| `packages/e2e/tests/motion.pw.ts`                                                                                             | **Créé.** Tests du mécanisme des jetons et des surfaces observables |
| `apps/client/src/components/left-sidebar/waveform.tsx`                                                                        | Perd ses `<style>` inline au profit d'`index.css`                   |
| `packages/ui/src/components/spinner.tsx`                                                                                      | Reçoit `data-motion-keep`                                           |
| `apps/client/src/components/typing-dots/index.tsx`                                                                            | Reçoit `data-motion-keep`                                           |
| `apps/client/src/components/left-sidebar/{channels,plugin-buttons}.tsx`, `left-sidebar/direct-messages/{index,dm-button}.tsx` | Transition de survol des 4 lignes soeurs                            |
| `packages/ui/src/components/{alert-dialog,dialog,sheet,popover,dropdown-menu,select,context-menu,tooltip}.tsx`                | Durée et courbe des surfaces flottantes                             |
| `apps/client/src/components/channel-view/voice/controls-bar.tsx`                                                              | Arrivée de la barre vocale                                          |
| `apps/client/src/components/channel-view/text/hooks/use-fresh-messages.tsx`                                                   | **Créé.** Décide quels messages ont le droit d'animer leur entrée   |
| `apps/client/src/components/channel-view/text/index.tsx`                                                                      | Monte le fournisseur de contexte                                    |
| `apps/client/src/components/channel-view/text/messages-group.tsx`                                                             | Applique la classe d'entrée par message                             |
| `apps/client/src/components/channel-view/text/message-reactions.tsx`                                                          | Applique la classe de rebond par réaction                           |

---

### Tâche 1 : les jetons et la garde

**Fichiers :**

- Modifier : `apps/client/src/index.css` (après le bloc `@theme inline` qui se
  ferme ligne 64 ; le bloc `:root` qui suit ; et la fin du fichier, ligne 632)
- Créer : `packages/e2e/tests/motion.pw.ts`

**Interfaces :**

- Consomme : rien.
- Produit : les jetons `--transition-duration-{fast,base,slow}`,
  `--transition-duration-move-{fast,base,slow}`, `--ease-{out,in,move,pop}`, et
  les variables `--rise`, `--lift`, `--pop-from`. Les utilitaires Tailwind
  correspondants sont `duration-fast|base|slow`, `duration-move-fast|base|slow`,
  `ease-out|in|move|pop`. Toutes les tâches suivantes ne consomment que ces
  noms.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `packages/e2e/tests/motion.pw.ts` :

```ts
import { expect, test } from '@playwright/test';
import { loginAs } from './fixtures';

const readTokens = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);

    return {
      fade: style.getPropertyValue('--transition-duration-base').trim(),
      move: style.getPropertyValue('--transition-duration-move-base').trim(),
      rise: style.getPropertyValue('--rise').trim(),
      easeOut: style.getPropertyValue('--ease-out').trim()
    };
  });

test.describe('Langage de mouvement', () => {
  test('les deux familles de durée sont exposées sur :root', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    const tokens = await readTokens(page);

    expect(tokens.fade).toBe('200ms');
    expect(tokens.move).toBe('200ms');
    expect(tokens.rise).toBe('6px');
    // Une propriété personnalisée est renvoyée telle qu'écrite : garder
    // exactement cette ponctuation dans index.css.
    expect(tokens.easeOut).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  test('seule la famille « déplacement » tombe à zéro en mouvement réduit', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginAs(page, 'testowner', 'password123');

    const tokens = await readTokens(page);

    // Un fondu n'est pas un mouvement : il survit.
    expect(tokens.fade).toBe('200ms');
    // Le déplacement, lui, est coupé.
    expect(tokens.move).toBe('0.01ms');
    expect(tokens.rise).toBe('0px');
  });
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : ÉCHEC. Les deux tests échouent avec `Expected: "200ms"` /
`Received: ""` : les propriétés personnalisées n'existent pas encore.

- [ ] **Étape 3 : déclarer les jetons**

Dans `apps/client/src/index.css`, **juste après** l'accolade fermante du bloc
`@theme inline` (ligne 64), insérer :

```css
/* --------------------------------------------------------------------------
   Jetons de mouvement.

   Bloc `@theme static` et SURTOUT PAS `inline` : `inline` figerait la valeur
   dans l'utilitaire généré, et la garde `prefers-reduced-motion` en bas de
   fichier n'aurait plus rien à redéfinir. `static` force l'émission des
   variables sur :root même quand aucun utilitaire ne les consomme encore.

   Deux familles de durée, volontairement identiques en valeur : elles ne
   diffèrent que par leur comportement en mouvement réduit. `*-move-*` anime un
   transform ou une position ; le reste anime une opacité ou une couleur.

   Spec : docs/superpowers/specs/2026-08-25-motion-language-design.md
   -------------------------------------------------------------------------- */
@theme static {
  --transition-duration-fast: 120ms;
  --transition-duration-base: 200ms;
  --transition-duration-slow: 320ms;

  --transition-duration-move-fast: 120ms;
  --transition-duration-move-base: 200ms;
  --transition-duration-move-slow: 320ms;

  /* Écrase volontairement les courbes Tailwind du même nom. */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);

  --ease-move: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

Dans le bloc `:root` qui suit, ajouter les trois variables juste après
`--edge-hi` :

```css
/* Les deux seules distances de déplacement autorisées, et l'échelle de
     départ du seul effet à rebond. Redéfinies à zéro par la garde. */
--rise: 6px;
--lift: 12px;
--pop-from: 0.6;
```

- [ ] **Étape 4 : écrire la garde**

À la **fin** de `apps/client/src/index.css`, après le bloc
`@media (prefers-reduced-motion: reduce)` existant qui coupe `.connect-halo` :

```css
/* --------------------------------------------------------------------------
   Mouvement réduit. La garde est portée par les jetons : tout ce qui consomme
   `duration-move-*`, `--rise`, `--lift` ou `--pop-from` est couvert sans
   qu'aucune règle supplémentaire n'ait à être écrite.

   Ce bloc n'est dans aucune couche `@layer`, contrairement aux variables
   émises par `@theme` : du CSS hors couche l'emporte toujours sur du CSS en
   couche, quel que soit l'ordre. C'est ce qui permet la redéfinition.
   -------------------------------------------------------------------------- */
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-duration-move-fast: 0.01ms;
    --transition-duration-move-base: 0.01ms;
    --transition-duration-move-slow: 0.01ms;
    --rise: 0px;
    --lift: 0px;
    --pop-from: 1;
  }
}
```

- [ ] **Étape 5 : vérifier dans le bundle construit, pas seulement au vert des
      portes**

C'est la vérification qui compte : les portes ne peuvent pas voir ce défaut, et
ce programme a déjà livré trois codes morts que seul le bundle a révélés.

```bash
cd apps/client && bun run build
grep -o -- "--transition-duration-move-base:[^;]*" dist/assets/*.css
grep -c "prefers-reduced-motion" dist/assets/*.css
```

Attendu : deux occurrences de `--transition-duration-move-base`, `200ms` puis
`0.01ms`, et au moins 2 pour `prefers-reduced-motion` (celle du chantier 4 plus
la nôtre). Si `--transition-duration-move-base` n'apparait **pas du tout**, le
bloc a été traité comme `inline` ou `static` n'a pas pris : **toute la garde est
morte**. Repli dans ce cas : déclarer les six durées comme variables CSS
ordinaires dans `:root` et fournir les utilitaires à la main via
`@utility duration-move-base { transition-duration: var(--transition-duration-move-base); --tw-duration: var(--transition-duration-move-base); }`,
puis reprendre l'étape 5.

- [ ] **Étape 6 : lancer les tests et vérifier qu'ils passent**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : « 2 passed ».

- [ ] **Étape 7 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/index.css packages/e2e/tests/motion.pw.ts
git commit -m "feat(client): jetons de mouvement et garde portée par le jeton"
```

---

### Tâche 2 : garder les cinq boucles infinies

**Fichiers :**

- Modifier : `apps/client/src/index.css` (règles `.speaking-effect-*` lignes
  542-552 ; ajout des keyframes de la forme d'onde ; complément de la garde)
- Modifier : `apps/client/src/components/left-sidebar/waveform.tsx`
- Modifier : `packages/ui/src/components/spinner.tsx`
- Modifier : `apps/client/src/components/typing-dots/index.tsx`
- Modifier : `packages/e2e/tests/motion.pw.ts`

**Interfaces :**

- Consomme : la garde de la tâche 1.
- Produit : l'attribut `data-motion-keep`, à poser sur toute surface dont la
  boucle porte de l'information. Les classes `.animate-eye-blink` et
  `.animate-wf-loop` deviennent globales (définies dans `index.css`).

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `packages/e2e/tests/motion.pw.ts`, à l'intérieur du `describe`
existant :

```ts
test('le filet coupe les boucles décoratives et épargne les porteuses de sens', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loginAs(page, 'testowner', 'password123');

  const result = await page.evaluate(() => {
    // Deux sondes injectées : le filet est une règle CSS globale, on peut donc
    // le mesurer sans dépendre d'un état applicatif (parler dans un salon
    // vocal, attendre que quelqu'un tape) qui rendrait le test instable.
    const decorative = document.createElement('div');
    decorative.className = 'animate-wf-loop';
    document.body.appendChild(decorative);

    const essential = document.createElement('div');
    essential.className = 'animate-wf-loop';
    essential.setAttribute('data-motion-keep', '');
    document.body.appendChild(essential);

    const speaking = document.createElement('div');
    speaking.className = 'speaking-effect-high';
    document.body.appendChild(speaking);

    const read = (element: Element) => ({
      iterations: getComputedStyle(element).animationIterationCount,
      name: getComputedStyle(element).animationName
    });

    const values = {
      decorative: read(decorative),
      essential: read(essential),
      speaking: read(speaking)
    };

    decorative.remove();
    essential.remove();
    speaking.remove();

    return values;
  });

  // Décoratif : la boucle est ramenée à un seul passage.
  expect(result.decorative.iterations).toBe('1');
  // Porteur de sens : la boucle continue.
  expect(result.essential.iterations).toBe('infinite');
  // La parole ne clignote plus du tout, elle devient un anneau fixe.
  expect(result.speaking.name).toBe('none');
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : ÉCHEC sur `expect(result.decorative.iterations).toBe('1')`, reçu
`infinite` : le filet n'existe pas encore.

- [ ] **Étape 3 : sortir les keyframes de la forme d'onde du composant**

Dans `apps/client/src/index.css`, à la suite des règles `.speaking-effect-*`,
ajouter :

```css
/* Sorties des `<style>` inline de left-sidebar/waveform.tsx : une animation
   déclarée dans le JSX n'est ni greppable ni gardable avec les autres. */
@keyframes eye-blink {
  0%,
  90%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  95% {
    transform: scale(0.1);
    opacity: 0.5;
  }
}

.animate-eye-blink {
  transform-origin: center;
  animation: eye-blink 4s infinite;
}

@keyframes wf-pulsate {
  0%,
  100% {
    height: 6px;
    y: 9px;
  }
  50% {
    height: var(--max-h);
    y: var(--y-pos);
  }
}

.animate-wf-loop {
  animation: wf-pulsate 2.5s ease-in-out infinite;
}

.animate-wf-loop:nth-child(1) {
  --max-h: 10px;
  --y-pos: 7px;
  animation-delay: 0s;
}
.animate-wf-loop:nth-child(2) {
  --max-h: 16px;
  --y-pos: 4px;
  animation-delay: 0.2s;
}
.animate-wf-loop:nth-child(3) {
  --max-h: 12px;
  --y-pos: 6px;
  animation-delay: 0.4s;
}
.animate-wf-loop:nth-child(4) {
  --max-h: 20px;
  --y-pos: 2px;
  animation-delay: 0.6s;
}
.animate-wf-loop:nth-child(5) {
  --max-h: 10px;
  --y-pos: 7px;
  animation-delay: 0.8s;
}
```

Dans `apps/client/src/components/left-sidebar/waveform.tsx`, supprimer les
**deux** blocs
`<style>{\`...\`}</style>`(celui qui suit le`<svg>`de l'oeil, et celui qui suit le`<svg>`des barres). Ne toucher à rien d'autre : les classes`animate-eye-blink`et`animate-wf-loop`restent en place sur les éléments, elles sont désormais résolues depuis`index.css`.

- [ ] **Étape 4 : compléter la garde**

Dans le bloc `@media (prefers-reduced-motion: reduce)` créé à la tâche 1, **à
l'intérieur des accolades**, après le bloc `:root` :

```css
/* Filet de sécurité : les boucles décoratives n'utilisent aucun jeton de
     durée, elles portent leur propre `animation`. On ne coupe donc que la
     répétition, et jamais sur une surface marquée `data-motion-keep`. */
*:not([data-motion-keep]):not([data-motion-keep] *) {
  animation-iteration-count: 1 !important;
}

/* La parole porte de l'information, mais sa classe est posée dynamiquement
     par use-audio-level.ts : une règle explicite évite de plomber le composant
     consommateur. `animation: none` neutralise l'animation, donc le
     `!important` du filet n'a rien à contredire. */
.speaking-effect-low,
.speaking-effect-medium,
.speaking-effect-high {
  animation: none;
  box-shadow: 0 0 0 3px var(--speaking);
}
```

- [ ] **Étape 5 : marquer les deux surfaces porteuses de sens**

Dans `packages/ui/src/components/spinner.tsx`, sur le `<svg>`, ajouter
l'attribut juste après `xmlns` :

```tsx
data - motion - keep;
```

Dans `apps/client/src/components/typing-dots/index.tsx`, sur le `<div>`
conteneur :

```tsx
    <div data-motion-keep className={`flex space-x-1 ${className}`}>
```

Les squelettes (`animate-pulse`) ne sont **pas** marqués : figés, ils restent
parfaitement lisibles comme squelettes.

- [ ] **Étape 6 : lancer les tests et vérifier qu'ils passent**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : « 3 passed ».

- [ ] **Étape 7 : vérifier qu'aucune keyframe n'est restée dans le JSX**

```bash
grep -rn "@keyframes" apps/client/src --include=*.tsx
```

Attendu : aucun résultat.

- [ ] **Étape 8 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/index.css apps/client/src/components/left-sidebar/waveform.tsx packages/ui/src/components/spinner.tsx apps/client/src/components/typing-dots/index.tsx packages/e2e/tests/motion.pw.ts
git commit -m "feat(client): garder les cinq boucles infinies en mouvement réduit"
```

---

### Tâche 3 : le survol des quatre lignes de la colonne gauche

**Fichiers :**

- Modifier : `apps/client/src/components/left-sidebar/channels.tsx:183`
- Modifier :
  `apps/client/src/components/left-sidebar/direct-messages/index.tsx:43`
- Modifier :
  `apps/client/src/components/left-sidebar/direct-messages/dm-button.tsx:27`
- Modifier : `apps/client/src/components/left-sidebar/plugin-buttons.tsx:31`
- Modifier : `packages/e2e/tests/motion.pw.ts`

**Interfaces :**

- Consomme : les utilitaires `duration-fast` et `ease-out` de la tâche 1.
- Produit : rien que les tâches suivantes consomment.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `packages/e2e/tests/motion.pw.ts` :

```ts
test('la ligne de salon adoucit son survol à la durée courte', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');

  const duration = await page
    .getByTestId(TestId.CHANNEL_ITEM)
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);

  expect(duration).toBe('0.12s');
});
```

Ajouter l'import en tête de fichier :

```ts
import { TestId } from '@sharkord/shared';
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : ÉCHEC, reçu `0s` : la ligne n'a aujourd'hui aucune transition.

- [ ] **Étape 3 : ajouter la transition aux quatre lignes soeurs**

Les quatre partagent la même base de classes depuis le chantier 1. Dans chacune,
insérer `transition-colors duration-fast ease-out` juste après
`text-muted-foreground`.

`channels.tsx:183` :

```tsx
          'flex w-full items-center gap-2 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-out select-none cursor-pointer',
```

`direct-messages/index.tsx:43` :

```tsx
          'flex w-full items-center gap-2 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground',
```

`dm-button.tsx:27` :

```tsx
            'flex w-full items-center gap-2 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground',
```

`plugin-buttons.tsx:31` :

```tsx
          'flex w-full items-center gap-2 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground',
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : « 4 passed ».

- [ ] **Étape 5 : vérifier que l'utilitaire pointe bien sur une variable**

C'est ici que se vérifie le point le plus important de la tâche 1, maintenant
qu'un consommateur existe :

```bash
cd apps/client && bun run build
grep -o "\.duration-fast{[^}]*}" dist/assets/*.css
grep -o "\.ease-out{[^}]*}" dist/assets/*.css
```

Attendu : `.duration-fast` contient `var(--transition-duration-fast)` et **pas**
`120ms` en dur ; `.ease-out` vaut `cubic-bezier(0.16, 1, 0.3, 1)` et non la
courbe Tailwind d'origine `cubic-bezier(0, 0, 0.2, 1)`.

- [ ] **Étape 6 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/left-sidebar packages/e2e/tests/motion.pw.ts
git commit -m "feat(client): adoucir le survol des lignes de la colonne gauche"
```

---

### Tâche 4 : durée et courbe des surfaces flottantes

**Fichiers :**

- Modifier : `packages/ui/src/components/alert-dialog.tsx:37,55`
- Modifier : `packages/ui/src/components/dialog.tsx:39,61`
- Modifier : `packages/ui/src/components/sheet.tsx:37,61`
- Modifier : `packages/ui/src/components/popover.tsx:31`
- Modifier : `packages/ui/src/components/dropdown-menu.tsx:43,231`
- Modifier : `packages/ui/src/components/select.tsx:63`
- Modifier : `packages/ui/src/components/context-menu.tsx:86,103`
- Modifier : `packages/ui/src/components/tooltip.tsx:47`
- Modifier : `packages/e2e/tests/motion.pw.ts`

**Interfaces :**

- Consomme : `duration-base`, `duration-move-base`, `duration-move-slow`,
  `ease-out` de la tâche 1.
- Produit : rien que les tâches suivantes consomment.

Rappel du mécanisme, vérifié dans `tw-animate-css@1.4.0` : `--animate-in`
retombe sur `var(--tw-animation-duration, var(--tw-duration, .15s))` et
`var(--tw-ease, ease)`. Or l'utilitaire `duration-*` de Tailwind 4 émet
`--tw-duration` en plus de `transition-duration`, et `ease-*` émet `--tw-ease`.
Poser `duration-base ease-out` sur ces composants pilote donc bien leur
animation `animate-in`, sans toucher à la bibliothèque.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `packages/e2e/tests/motion.pw.ts` :

```ts
test('un menu déroulant ouvre à la durée de base sur la courbe de sortie', async ({
  page
}) => {
  await loginAs(page, 'testowner', 'password123');
  await page.getByTestId(TestId.SERVER_DROPDOWN_TRIGGER).click();

  const menu = page.getByTestId(TestId.SERVER_DROPDOWN_DISCONNECT);
  await expect(menu).toBeVisible();

  const styles = await menu.evaluate((element) => {
    // Le contenu du menu est l'ancêtre qui porte l'animation, pas l'entrée.
    const content = element.closest('[data-state="open"]') ?? element;
    const computed = getComputedStyle(content);

    return {
      duration: computed.animationDuration,
      easing: computed.animationTimingFunction
    };
  });

  expect(styles.duration).toBe('0.2s');
  expect(styles.easing).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : ÉCHEC, reçu `0.15s` et `ease` : les défauts de la bibliothèque.

- [ ] **Étape 3 : les voiles (fondu seul)**

Sur `alert-dialog.tsx:37`, `dialog.tsx:39` et `sheet.tsx:37`, la chaine ne
contient que du fondu. Ajouter `duration-base ease-out` juste après
`data-[state=open]:fade-in-0`. Exemple pour `dialog.tsx:39` :

```tsx
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-base ease-out',
```

- [ ] **Étape 4 : les panneaux avec zoom**

Sur `alert-dialog.tsx:55`, `dialog.tsx:61`, `popover.tsx:31`,
`dropdown-menu.tsx:43`, `dropdown-menu.tsx:231`, `select.tsx:63`,
`context-menu.tsx:86`, `context-menu.tsx:103` et `tooltip.tsx:47` :

1. remplacer `zoom-out-95` par `zoom-out-98` et `zoom-in-95` par `zoom-in-98`,
   en conservant leurs préfixes `data-[state=...]:` ;
2. si un `duration-200` est présent (c'est le cas d'`alert-dialog.tsx:55` et
   `dialog.tsx:61`), le remplacer par `duration-base` ; sinon ajouter
   `duration-base` ;
3. ajouter `ease-out`.

Les `slide-in-from-*-2` sont conservés tels quels : 8px dans le sens de
l'ancrage, c'est déjà le bon geste.

Exemple complet pour `popover.tsx:31`, portion animation :

```tsx
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 duration-base ease-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
```

Choix assumé, à ne pas signaler en revue : ces panneaux utilisent
`duration-base` (famille « fondu ») et non `duration-move-base`, alors qu'un
zoom est techniquement un transform. Un écart d'échelle de 2 % est sous le seuil
de perception ; en échange, les menus continuent de fondre proprement en
mouvement réduit au lieu d'apparaitre sèchement.

- [ ] **Étape 5 : le tiroir, qui lui glisse vraiment**

`sheet.tsx:61` est le seul cas d'un vrai déplacement : il porte
`ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500`.
Remplacer par :

```tsx
        'data-[state=open]:animate-in data-[state=closed]:animate-out ease-out data-[state=closed]:duration-move-base data-[state=open]:duration-move-slow',
```

Famille « déplacement » ici, et c'est voulu : en mouvement réduit le tiroir
apparait sans glisser.

- [ ] **Étape 6 : lancer les tests et vérifier qu'ils passent**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : « 5 passed ».

- [ ] **Étape 7 : vérifier qu'aucun zoom à 95 % ne subsiste**

```bash
grep -rn "zoom-in-95\|zoom-out-95" packages/ui/src apps/client/src
```

Attendu : aucun résultat.

- [ ] **Étape 8 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add packages/ui/src/components packages/e2e/tests/motion.pw.ts
git commit -m "feat(ui): durée et courbe communes aux surfaces flottantes"
```

---

### Tâche 5 : l'arrivée de la barre de contrôles vocale

**Fichiers :**

- Modifier :
  `apps/client/src/components/channel-view/voice/controls-bar.tsx:44-47`

**Interfaces :**

- Consomme : `duration-move-base`, `ease-out`, `--lift` de la tâche 1.
- Produit : rien que les tâches suivantes consomment.

Pas de test E2E ici : atteindre cette barre demande de rejoindre un salon vocal
avec un vrai flux média, ce que la suite ne sait pas faire de façon stable. La
vérification est le grep de bundle de l'étape 3 plus la validation visuelle
finale. C'est dit franchement plutôt que déguisé en test.

- [ ] **Étape 1 : remplacer la transition et la distance**

Dans `apps/client/src/components/channel-view/voice/controls-bar.tsx`, remplacer
les lignes 44 à 47 :

```tsx
      className={cn(
        'absolute bottom-8 left-0 right-0 hidden md:flex justify-center items-center pointer-events-none',
        'transition-[opacity,transform] duration-move-base ease-out gap-3',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-[var(--lift)]'
      )}
```

Trois changements, tous délibérés : `transition-all` devient la liste explicite
des deux propriétés réellement animées (il faisait aussi transiter `gap` et la
couleur) ; 300 ms passent à `duration-move-base` ; et les 40 px de
`translate-y-10` deviennent les 12 px de `--lift`, ce qui met fin au dépassement
hors du conteneur `overflow-hidden` de `voice/index.tsx:146` repéré au
chantier 3.

- [ ] **Étape 2 : vérifier que le décalage vient bien du jeton**

```bash
grep -n "translate-y-10\|transition-all" apps/client/src/components/channel-view/voice/controls-bar.tsx
```

Attendu : plus aucune occurrence de `translate-y-10` ; le `transition-all` de la
ligne 98 (bouton raccrocher) subsiste et reste hors périmètre.

- [ ] **Étape 3 : vérifier dans le bundle**

```bash
cd apps/client && bun run build
grep -o "\.translate-y-\\\\\[var(--lift)\\\\\]{[^}]*}" dist/assets/*.css
```

Attendu : une règle existe et contient `var(--lift)`. Si le grep ne rend rien,
essayer sans échappement :

```bash
grep -o "var(--lift)" dist/assets/*.css | head
```

Attendu : au moins une occurrence. Aucune signifie que la classe arbitraire n'a
pas été générée et que la barre ne bouge plus du tout.

- [ ] **Étape 4 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/channel-view/voice/controls-bar.tsx
git commit -m "fix(client): arrivée de la barre vocale sur 12px au lieu de 40"
```

---

### Tâche 6 : l'arrivée d'un message

**Fichiers :**

- Créer :
  `apps/client/src/components/channel-view/text/hooks/use-fresh-messages.tsx`
- Modifier : `apps/client/src/index.css` (keyframes `message-enter`)
- Modifier : `apps/client/src/components/channel-view/text/index.tsx`
- Modifier :
  `apps/client/src/components/channel-view/text/messages-group.tsx:111-118`
- Modifier : `packages/e2e/tests/motion.pw.ts`

**Interfaces :**

- Consomme : `--transition-duration-move-base`, `--ease-out`, `--rise` de la
  tâche 1.
- Produit :
  - `FreshMessagesProvider` : composant, props
    `{ channelId: number; messages: TJoinedMessage[]; loading: boolean; children: ReactNode }`.
  - `useFreshMessages()` : renvoie
    `{ isFresh: (messageId: number) => boolean; markPlayed: (messageId: number) => void }`.
  - La classe CSS `message-enter`, et la keyframe du même nom.
  - La tâche 7 réutilise le même motif, sans dépendre de ce module.

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter dans `packages/e2e/tests/motion.pw.ts` :

```ts
test("l'historique n'anime pas son entrée au chargement", async ({ page }) => {
  await loginAs(page, 'testowner', 'password123');

  await page
    .getByTestId(TestId.CHANNEL_ITEM)
    .filter({ hasText: 'General' })
    .click();

  await expect(page.getByTestId(TestId.MESSAGE_ITEM).first()).toBeVisible();

  // Le salon amorcé contient déjà un message : aucun ne doit avoir joué son
  // entrée, sinon tout l'historique s'animerait à chaque ouverture de salon.
  await expect(page.locator('.message-enter')).toHaveCount(0);
});

test('un message reçu en direct anime son entrée', async ({ page }) => {
  await loginAs(page, 'testowner', 'password123');

  await page
    .getByTestId(TestId.CHANNEL_ITEM)
    .filter({ hasText: 'General' })
    .click();

  const messages = page.locator('[data-messages-container]');
  await expect(messages).toBeVisible();

  // On observe l'insertion plutôt que d'interroger le DOM après coup :
  // l'animation dure 200 ms et la classe se retire toute seule à la fin, une
  // assertion différée serait une course perdue d'avance.
  await page.evaluate(() => {
    const scope = globalThis as unknown as { __entered: number };
    scope.__entered = 0;

    const container = document.querySelector('[data-messages-container]');
    if (!container) return;

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.classList.contains('message-enter')) scope.__entered += 1;
          scope.__entered += node.querySelectorAll('.message-enter').length;
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  });

  const editor = page.getByTestId(TestId.MESSAGE_COMPOSE_EDITOR);
  await editor.click();
  await editor.fill('salut le mouvement');
  await editor.press('Enter');

  await expect(page.getByText('salut le mouvement')).toBeVisible();

  const entered = await page.evaluate(
    () => (globalThis as unknown as { __entered: number }).__entered
  );

  expect(entered).toBeGreaterThan(0);
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : le premier test PASSE déjà (aucune classe `message-enter` n'existe),
le second ÉCHOUE avec `Expected: > 0, Received: 0`. C'est normal et voulu : le
premier test est un garde-fou contre la régression que la suite introduit.

- [ ] **Étape 3 : écrire le décideur**

Créer
`apps/client/src/components/channel-view/text/hooks/use-fresh-messages.tsx` :

```tsx
import type { TJoinedMessage } from '@sharkord/shared';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

type TFreshMessages = {
  isFresh: (messageId: number) => boolean;
  markPlayed: (messageId: number) => void;
};

const FreshMessagesContext = createContext<TFreshMessages>({
  isFresh: () => false,
  markPlayed: () => {}
});

type TFreshMessagesProviderProps = {
  channelId: number;
  messages: TJoinedMessage[];
  loading: boolean;
  children: ReactNode;
};

/**
 * Décide quels messages ont le droit de jouer leur animation d'entrée.
 *
 * La liste des messages n'est pas virtualisée : c'est un `map` ordinaire, donc
 * un groupe qui se reforme remonte ses enfants et rejouerait l'animation sur
 * des messages déjà lus. On se déclenche donc sur l'IDENTIFIANT et jamais sur
 * le rendu : seuls les identifiants strictement supérieurs à la ligne d'eau
 * sont frais. La pagination ne peut pas les déclencher, puisqu'elle ajoute des
 * identifiants PLUS PETITS.
 */
const FreshMessagesProvider = memo(
  ({ channelId, messages, loading, children }: TFreshMessagesProviderProps) => {
    const watermarkRef = useRef({
      channelId: -1,
      highestId: 0,
      seeded: false
    });
    const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set());

    const highestId = messages.reduce(
      (highest, message) => (message.id > highest ? message.id : highest),
      0
    );

    // Mise à jour d'état pendant le rendu : c'est le motif React « ajuster
    // l'état quand une prop change ». Le faire dans un effet peindrait une
    // frame sans la classe, donc le message à sa position finale avant de
    // sauter à l'opacité zéro : un clignotement.
    if (watermarkRef.current.channelId !== channelId) {
      watermarkRef.current = { channelId, highestId: 0, seeded: false };
      if (fresh.size) setFresh(new Set());
    } else if (!loading && !watermarkRef.current.seeded) {
      // Premier lot du salon : il devient la ligne d'eau, sans rien animer.
      watermarkRef.current = { channelId, highestId, seeded: true };
    } else if (
      watermarkRef.current.seeded &&
      highestId > watermarkRef.current.highestId
    ) {
      const previousHighestId = watermarkRef.current.highestId;
      watermarkRef.current = { channelId, highestId, seeded: true };

      setFresh((current) => {
        const next = new Set(current);

        messages.forEach((message) => {
          if (message.id > previousHighestId) next.add(message.id);
        });

        return next;
      });
    }

    const markPlayed = useCallback((messageId: number) => {
      setFresh((current) => {
        if (!current.has(messageId)) return current;

        const next = new Set(current);
        next.delete(messageId);

        return next;
      });
    }, []);

    const value = useMemo<TFreshMessages>(
      () => ({
        isFresh: (messageId: number) => fresh.has(messageId),
        markPlayed
      }),
      [fresh, markPlayed]
    );

    return (
      <FreshMessagesContext.Provider value={value}>
        {children}
      </FreshMessagesContext.Provider>
    );
  }
);

const useFreshMessages = () => useContext(FreshMessagesContext);

export { FreshMessagesProvider, useFreshMessages };
```

- [ ] **Étape 4 : déclarer l'animation**

Dans `apps/client/src/index.css`, à la suite des keyframes de la forme d'onde
ajoutées à la tâche 2 :

```css
/* Entrée d'un message reçu en direct. Gardée sans règle supplémentaire : la
   durée vient de la famille « déplacement » et la distance de `--rise`, que le
   bloc `prefers-reduced-motion` remet toutes deux à zéro. */
@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(var(--rise));
  }
}

.message-enter {
  animation: message-enter var(--transition-duration-move-base) var(--ease-out)
    both;
}
```

- [ ] **Étape 5 : monter le fournisseur**

Dans `apps/client/src/components/channel-view/text/index.tsx`, ajouter l'import
:

```tsx
import { FreshMessagesProvider } from './hooks/use-fresh-messages';
```

puis envelopper la liste (le `<div className="space-y-4">` et son contenu, dans
la branche `else` du ternaire sur `groupedMessages.length`) :

```tsx
<FreshMessagesProvider
  channelId={channelId}
  messages={messages}
  loading={loading}
>
  <div className="space-y-4">
    {groupedMessages.map((group) => (
      <MessagesGroup
        key={group.key}
        group={group.messages}
        onReplyMessageSelect={onReplyMessageSelect}
        replyTargetMessageId={replyingToMessage?.id}
        activeThreadMessageId={activeThreadMessageId}
        editingMessageId={editingMessageId}
        onEditComplete={handleEditComplete}
      />
    ))}
  </div>
</FreshMessagesProvider>
```

- [ ] **Étape 6 : appliquer la classe par message**

Dans `apps/client/src/components/channel-view/text/messages-group.tsx`, ajouter
l'import :

```tsx
import { useFreshMessages } from './hooks/use-fresh-messages';
```

Dans le corps du composant, avant `const groupContent = (` :

```tsx
const { isFresh, markPlayed } = useFreshMessages();
```

Puis remplacer le `<div>` enveloppant chaque message (lignes 113 à 117) :

```tsx
              <div
                key={message.id}
                id={`message-${message.id}`}
                className={cn(
                  'rounded-md transition-colors duration-1000',
                  isFresh(message.id) && 'message-enter'
                )}
                onAnimationEnd={(event) => {
                  // L'évènement remonte depuis les enfants : sans ce filtre,
                  // n'importe quelle animation interne au message effacerait la
                  // classe avant que l'entrée n'ait joué.
                  if (event.animationName !== 'message-enter') return;
                  markPlayed(message.id);
                }}
              >
```

Le `transition-colors duration-1000` existant est le surlignage de saut vers un
message : il reste tel quel, hors périmètre.

- [ ] **Étape 7 : lancer les tests et vérifier qu'ils passent**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e motion.pw.ts
```

Attendu : « 7 passed ». Le test « l'historique n'anime pas son entrée au
chargement » doit toujours passer : c'est lui qui garantit qu'on n'a pas
rebranché l'animation sur le rendu.

- [ ] **Étape 8 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/index.css apps/client/src/components/channel-view/text packages/e2e/tests/motion.pw.ts
git commit -m "feat(client): animer l'arrivée des messages reçus en direct"
```

---

### Tâche 7 : le rebond d'une réaction

**Fichiers :**

- Modifier : `apps/client/src/index.css` (keyframes `reaction-pop`)
- Modifier :
  `apps/client/src/components/channel-view/text/message-reactions.tsx`

**Interfaces :**

- Consomme : `--transition-duration-move-base`, `--ease-pop`, `--pop-from` de la
  tâche 1.
- Produit : la classe CSS `reaction-pop`.

Pas de test E2E : ajouter une réaction demande de survoler un message, d'ouvrir
le sélecteur d'emoji et d'en choisir un, un enchainement que la suite ne sait
pas jouer sans devenir instable. La vérification est le grep de bundle plus la
validation visuelle finale.

- [ ] **Étape 1 : déclarer l'animation**

Dans `apps/client/src/index.css`, à la suite de `message-enter` :

```css
/* Seul effet à rebond du client. `--pop-from` vaut 1 en mouvement réduit : le
   dépassement disparait alors de lui-même, il ne reste qu'un fondu. */
@keyframes reaction-pop {
  from {
    opacity: 0;
    transform: scale(var(--pop-from));
  }
}

.reaction-pop {
  animation: reaction-pop var(--transition-duration-move-base) var(--ease-pop)
    both;
}
```

- [ ] **Étape 2 : n'animer que les réactions apparues à l'écran**

Dans `apps/client/src/components/channel-view/text/message-reactions.tsx`,
ajouter `useRef` et `useState` aux imports React existants, puis, dans
`MessageReactions`, juste après `aggregatedReactions` :

```tsx
// Même règle que pour les messages : on se déclenche sur l'apparition d'un
// emoji, pas sur un rendu. Les réactions déjà présentes au premier rendu
// sont adoptées telles quelles et n'animent rien.
const knownEmojisRef = useRef<Set<string> | null>(null);
const [popping, setPopping] = useState<ReadonlySet<string>>(() => new Set());

const currentEmojis = aggregatedReactions.map((reaction) => reaction.emoji);

if (knownEmojisRef.current === null) {
  knownEmojisRef.current = new Set(currentEmojis);
} else {
  const appeared = currentEmojis.filter(
    (emoji) => !knownEmojisRef.current!.has(emoji)
  );

  if (appeared.length) {
    knownEmojisRef.current = new Set(currentEmojis);
    setPopping((current) => new Set([...current, ...appeared]));
  }
}

const markPopped = useCallback((emoji: string) => {
  setPopping((current) => {
    if (!current.has(emoji)) return current;

    const next = new Set(current);
    next.delete(emoji);

    return next;
  });
}, []);
```

- [ ] **Étape 3 : passer l'état à la pastille**

Toujours dans le même fichier, dans le `map` final, ajouter deux props :

```tsx
<Reaction
  key={reaction.emoji}
  emoji={reaction.emoji}
  count={reaction.count}
  userIds={reaction.userIds}
  isUserReacted={reaction.isUserReacted}
  onClick={() => handleReactionClick(reaction.emoji)}
  file={reaction.file}
  isPopping={popping.has(reaction.emoji)}
  onPopEnd={markPopped}
/>
```

Étendre `TReactionProps` :

```tsx
type TReactionProps = {
  emoji: string;
  count: number;
  isUserReacted: boolean;
  onClick: () => void;
  file: TFile | null;
  userIds: number[];
  isPopping: boolean;
  onPopEnd: (emoji: string) => void;
};
```

et la signature du composant `Reaction` :

```tsx
  ({
    emoji,
    count,
    isUserReacted,
    onClick,
    file,
    userIds,
    isPopping,
    onPopEnd
  }: TReactionProps) => {
```

Enfin, sur le `<Button>` de `Reaction` :

```tsx
        <Button
          size="sm"
          variant="outline"
          onClick={onClick}
          onAnimationEnd={(event) => {
            if (event.animationName !== 'reaction-pop') return;
            onPopEnd(emoji);
          }}
          className={cn(
            'flex items-center gap-1 h-9 reaction-pill',
            isUserReacted ? 'border-border' : 'border-none',
            isPopping && 'reaction-pop'
          )}
        >
```

- [ ] **Étape 4 : vérifier dans le bundle**

```bash
cd apps/client && bun run build
grep -o "\.reaction-pop{[^}]*}" dist/assets/*.css
grep -o -- "--pop-from:[^;]*" dist/assets/*.css
```

Attendu : `.reaction-pop` référence `var(--transition-duration-move-base)` et
`var(--ease-pop)` ; `--pop-from` apparait deux fois, `0.6` puis `1`.

- [ ] **Étape 5 : vérifier que la courbe à rebond ne s'est pas répandue**

```bash
grep -rn "ease-pop" apps/client/src packages/ui/src
```

Attendu : uniquement la déclaration du jeton dans `index.css` et la règle
`.reaction-pop`. Toute autre occurrence est un défaut de revue.

- [ ] **Étape 6 : lancer la suite complète et vérifier qu'elle passe**

```bash
rm -rf packages/e2e/e2e-data
cd packages/e2e && bun run test:e2e
```

Attendu : aucun test en échec. Lire « N passed », pas le code de sortie.

- [ ] **Étape 7 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/index.css apps/client/src/components/channel-view/text/message-reactions.tsx
git commit -m "feat(client): faire rebondir une réaction qui apparait"
```

---

## Après les sept tâches

1. Revue de branche complète avec la compétence
   `superpowers:requesting-code-review`.
2. Pousser sur les **deux** dépôts :
   `git push origin feat/motion-language && git push github feat/motion-language`.
3. Donner à l.user la commande de déploiement sur le Kimsufi (il ne lance rien
   en local) :

   ```bash
   cd ~/bullshark && git fetch origin && git reset --hard origin/feat/motion-language && bun install && ( cd apps/server && bun run build ) && docker build -t bullshark:local . && docker compose up -d --build
   ```

   Lui rappeler de vider le cache Safari ou de resupprimer la PWA, sinon
   l'ancien bundle est servi.

4. Lui demander de valider **aussi** avec le réglage système « réduire les
   animations » activé : c'est la moitié du chantier, et aucun agent n'a de
   navigateur pour le voir.
5. Fusionner seulement après validation visuelle, puis amender la spec avec ce
   qui a réellement changé pendant l'implémentation.
