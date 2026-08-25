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
