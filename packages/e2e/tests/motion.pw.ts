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

  test("l'historique n'anime pas son entrée au chargement", async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    // A deferred `.message-enter` query races the 200ms window: the class
    // removes itself via `markPlayed` once the entrance animation ends, so
    // querying after the fact can land after it already cleared and pass
    // even if the whole history briefly animated. Install the observer
    // BEFORE clicking into the channel — before `[data-messages-container]`
    // even exists — so it catches the class appearing at any point while
    // the history renders, transient or not. Same technique as the "un
    // message reçu en direct" test below, just anchored on `document.body`
    // since the messages container isn't mounted yet at this point.
    await page.evaluate(() => {
      const scope = globalThis as unknown as { __enteredOnLoad: number };
      scope.__enteredOnLoad = 0;

      type TMinimalElement = {
        classList: { contains: (name: string) => boolean };
        querySelectorAll: (selector: string) => { length: number };
      };
      type TMutationRecord = { addedNodes: { nodeType: number }[] };

      const { document, MutationObserver, HTMLElement } =
        globalThis as unknown as {
          document: { body: unknown };
          MutationObserver: new (
            callback: (records: TMutationRecord[]) => void
          ) => {
            observe: (
              target: unknown,
              options: { childList: boolean; subtree: boolean }
            ) => void;
          };
          HTMLElement: new () => unknown;
        };

      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;

            const element = node as unknown as TMinimalElement;

            if (element.classList.contains('message-enter'))
              scope.__enteredOnLoad += 1;
            scope.__enteredOnLoad +=
              element.querySelectorAll('.message-enter').length;
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });

    await page
      .getByTestId(TestId.CHANNEL_ITEM)
      .filter({ hasText: 'General' })
      .click();

    await expect(page.getByTestId(TestId.MESSAGE_ITEM).first()).toBeVisible();

    // Le salon amorcé contient déjà un message : aucun ne doit avoir joué son
    // entrée, sinon tout l'historique s'animerait à chaque ouverture de salon
    // — que la classe soit encore présente (forme permanente) ou déjà
    // retirée par `markPlayed` (forme transitoire).
    const enteredOnLoad = await page.evaluate(
      () =>
        (globalThis as unknown as { __enteredOnLoad: number }).__enteredOnLoad
    );

    expect(enteredOnLoad).toBe(0);
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
    // l'animation dure 200 ms et la classe se retire toute seule à la fin,
    // une assertion différée serait une course perdue d'avance.
    //
    // This package's tsconfig has no "DOM" lib (see tests/drop-zone.pw.ts
    // for why): reach `document`/`MutationObserver`/`HTMLElement` through
    // `globalThis` cast to a minimal shape instead of widening the whole
    // package's lib contract for one file.
    await page.evaluate(() => {
      const scope = globalThis as unknown as { __entered: number };
      scope.__entered = 0;

      type TMinimalElement = {
        classList: { contains: (name: string) => boolean };
        querySelectorAll: (selector: string) => { length: number };
      };
      type TMinimalNode = { nodeType: number };
      type TMutationRecord = { addedNodes: TMinimalNode[] };

      const { document, MutationObserver, HTMLElement } =
        globalThis as unknown as {
          document: {
            querySelector: (selector: string) => unknown;
          };
          MutationObserver: new (
            callback: (records: TMutationRecord[]) => void
          ) => {
            observe: (
              target: unknown,
              options: { childList: boolean; subtree: boolean }
            ) => void;
          };
          HTMLElement: new () => unknown;
        };

      const container = document.querySelector('[data-messages-container]');
      if (!container) return;

      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;

            const element = node as unknown as TMinimalElement;

            if (element.classList.contains('message-enter'))
              scope.__entered += 1;
            scope.__entered +=
              element.querySelectorAll('.message-enter').length;
          });
        });
      });

      observer.observe(container, { childList: true, subtree: true });
    });

    // TipTap's contenteditable does not behave like a form field: `fill()`
    // leaves the typed text sitting unsent in the editor instead of
    // triggering the compose state that submitting on Enter relies on.
    // `pressSequentially` types real key events instead.
    const editor = page.getByTestId(TestId.MESSAGE_COMPOSE_EDITOR);
    await editor.click();
    await editor.pressSequentially('salut le mouvement');
    await editor.press('Enter');

    // Waiting on `getByText` alone races the send: the typed text is
    // visible inside the still-open composer the instant it's typed, well
    // before the mutation round-trip lands the real message. Waiting on the
    // message item specifically only resolves once the message has actually
    // joined the list.
    await expect(
      page
        .getByTestId(TestId.MESSAGE_ITEM)
        .filter({ hasText: 'salut le mouvement' })
    ).toBeVisible();

    const entered = await page.evaluate(
      () => (globalThis as unknown as { __entered: number }).__entered
    );

    expect(entered).toBeGreaterThan(0);
  });
});
