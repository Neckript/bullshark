import { TestId } from '@sharkord/shared';
import { expect, loginAs, test } from './fixtures';

test.describe('Sélecteur rapide', () => {
  test('Ctrl+K ouvre la palette et Échap la referme', async ({ page }) => {
    await loginAs(page, 'testowner', 'password123');

    await page.keyboard.press('Control+k');
    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeHidden();
  });

  test('taper un nom puis Entrée change de salon', async ({ page }) => {
    await loginAs(page, 'testowner', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('gene');

    await expect(
      page.getByTestId(TestId.QUICK_SWITCHER_ROW).first()
    ).toContainText('General');

    await page.keyboard.press('Enter');

    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeHidden();
    await expect(page.getByText('Test message')).toBeVisible();
  });

  test('les flèches ne s arrêtent jamais sur un en-tête de groupe', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('e');

    const rows = page.getByTestId(TestId.QUICK_SWITCHER_ROW);
    const activeRows = page.locator(
      `[data-testid="${TestId.QUICK_SWITCHER_ROW}"][data-active="true"]`
    );

    await expect(rows.first()).toHaveAttribute('data-active', 'true');

    await page.keyboard.press('ArrowDown');

    // Exactement une ligne active, et c'est la deuxième : la flèche a donc
    // enjambé l'en-tête de groupe au lieu de s'y arrêter.
    await expect(activeRows).toHaveCount(1);
    await expect(rows.nth(1)).toHaveAttribute('data-active', 'true');
  });

  test('un salon prive non autorise n apparait jamais', async ({ page }) => {
    await loginAs(page, 'testuser', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('DM Channel');

    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeVisible();
    await expect(page.getByTestId(TestId.QUICK_SWITCHER_ROW)).toHaveCount(0);
  });
});
