import { TestId } from '@bullshark/shared';
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

  // Ce test couvre uniquement l'exclusion des salons de messages directs
  // (filtre `!channel.isDm`) : le seul salon prive du seed ('DM Channel')
  // est un DM, donc ce test passerait meme si la clause de permission
  // `canViewChannel` de `visibleChannelsSelector` etait entierement
  // supprimee. Cette clause reste donc non couverte, faute d'un salon
  // prive non-DM dans le seed. On reste connecte en tant que 'testuser'
  // (et non 'testowner') car `canViewChannel` renvoie toujours true pour
  // le proprietaire du serveur : executer ce test en tant qu'owner
  // prouverait donc encore moins de choses.
  test('un salon de message direct n apparait jamais dans la palette', async ({
    page
  }) => {
    await loginAs(page, 'testuser', 'password123');

    await page.keyboard.press('Control+k');
    await page.getByTestId(TestId.QUICK_SWITCHER_INPUT).fill('DM Channel');

    await expect(page.getByTestId(TestId.QUICK_SWITCHER)).toBeVisible();
    await expect(page.getByTestId(TestId.QUICK_SWITCHER_ROW)).toHaveCount(0);
  });
});
