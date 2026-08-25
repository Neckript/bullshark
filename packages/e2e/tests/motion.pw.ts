import { expect, test } from '@playwright/test';
import { TestId } from '@sharkord/shared';
import { loginAs } from './fixtures';

const readTokens = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    // This package's tsconfig has no "DOM" lib (see tests/drop-zone.pw.ts for
    // why): reach `document`/`getComputedStyle` through `globalThis` cast to
    // a minimal shape instead of widening the whole package's lib contract
    // for one file.
    const { document, getComputedStyle } = globalThis as unknown as {
      document: { documentElement: unknown };
      getComputedStyle: (element: unknown) => {
        getPropertyValue: (name: string) => string;
      };
    };
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

  test('le filet coupe les boucles décoratives et épargne les porteuses de sens', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginAs(page, 'testowner', 'password123');

    const result = await page.evaluate(() => {
      // This package's tsconfig has no "DOM" lib (see tests/drop-zone.pw.ts
      // for why): reach `document`/`getComputedStyle` through `globalThis`
      // cast to a minimal shape instead of widening the whole package's lib
      // contract for one file.
      const { document, getComputedStyle } = globalThis as unknown as {
        document: {
          createElement: (tag: string) => {
            className: string;
            setAttribute: (name: string, value: string) => void;
            remove: () => void;
          };
          body: {
            appendChild: (element: unknown) => void;
          };
        };
        getComputedStyle: (element: unknown) => {
          animationIterationCount: string;
          animationName: string;
        };
      };

      // Deux sondes injectées : le filet est une règle CSS globale, on peut
      // donc le mesurer sans dépendre d'un état applicatif (parler dans un
      // salon vocal, attendre que quelqu'un tape) qui rendrait le test
      // instable.
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

      const read = (element: unknown) => {
        const style = getComputedStyle(element);
        return {
          iterations: style.animationIterationCount,
          name: style.animationName
        };
      };

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

  test('la ligne de salon adoucit son survol à la durée courte', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    const duration = await page
      .getByTestId(TestId.CHANNEL_ITEM)
      .first()
      .evaluate((element) => {
        // This package's tsconfig has no "DOM" lib (see tests/drop-zone.pw.ts
        // for why): reach `getComputedStyle` through `globalThis` cast to a
        // minimal shape instead of widening the whole package's lib contract
        // for one file.
        const { getComputedStyle } = globalThis as unknown as {
          getComputedStyle: (element: unknown) => {
            transitionDuration: string;
          };
        };

        return getComputedStyle(element).transitionDuration;
      });

    expect(duration).toBe('0.12s');
  });

  test('un menu déroulant ouvre à la durée de base sur la courbe de sortie', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');
    await page.getByTestId(TestId.SERVER_DROPDOWN_TRIGGER).click();

    const menu = page.getByTestId(TestId.SERVER_DROPDOWN_DISCONNECT);
    await expect(menu).toBeVisible();

    const styles = await menu.evaluate((element) => {
      // This package's tsconfig has no "DOM" lib (see tests/drop-zone.pw.ts
      // for why): reach `getComputedStyle` through `globalThis` cast to a
      // minimal shape instead of widening the whole package's lib contract
      // for one file.
      const { getComputedStyle } = globalThis as unknown as {
        getComputedStyle: (element: unknown) => {
          animationDuration: string;
          animationTimingFunction: string;
        };
      };
      const typedElement = element as unknown as {
        closest: (selector: string) => unknown;
      };

      // Le contenu du menu est l'ancêtre qui porte l'animation, pas l'entrée.
      const content = typedElement.closest('[data-state="open"]') ?? element;
      const computed = getComputedStyle(content);

      return {
        duration: computed.animationDuration,
        easing: computed.animationTimingFunction
      };
    });

    expect(styles.duration).toBe('0.2s');
    expect(styles.easing).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });
});
