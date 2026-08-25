import { expect, test } from '@playwright/test';
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
});
