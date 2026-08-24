import { expect, test } from '@playwright/test';
import { TestId } from '@sharkord/shared';
import { loginAs } from './fixtures';

test.describe('Drop zone', () => {
  test('shows the overlay when files are dragged over the message list', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    // Filtering by name rather than taking the first item: the seeded server
    // mixes text and voice channels, and a voice channel has neither a
    // message container nor a drop zone.
    await page
      .getByTestId(TestId.CHANNEL_ITEM)
      .filter({ hasText: 'General' })
      .click();

    const messages = page.locator('[data-messages-container]');
    await expect(messages).toBeVisible();

    // Playwright does not simulate an OS-level drag: build the DataTransfer
    // inside the page and dispatch the events by hand. Adding a File via
    // `items.add` is what makes `dataTransfer.types` contain 'Files', which
    // is the filter `useFileDrag` checks before reacting at all.
    //
    // This package's tsconfig has no "DOM" lib: `DataTransfer` only exists
    // as an incomplete ambient type (from @playwright/test), with no
    // constructor and no `items`. Reach the real browser global through
    // `globalThis` cast to a minimal shape instead.
    const dataTransfer = await page.evaluateHandle(() => {
      const DataTransferCtor = (
        globalThis as unknown as {
          DataTransfer: new () => {
            items: { add: (file: File) => void };
          };
        }
      ).DataTransfer;
      const transfer = new DataTransferCtor();

      transfer.items.add(
        new File(['hello'], 'score.png', { type: 'image/png' })
      );

      return transfer;
    });

    await messages.dispatchEvent('dragenter', { dataTransfer });
    await expect(page.getByTestId(TestId.DROP_OVERLAY)).toBeVisible();

    await messages.dispatchEvent('dragleave', { dataTransfer });
    await expect(page.getByTestId(TestId.DROP_OVERLAY)).toBeHidden();
  });

  test('does not show the overlay when dragging plain text', async ({
    page
  }) => {
    await loginAs(page, 'testowner', 'password123');

    await page
      .getByTestId(TestId.CHANNEL_ITEM)
      .filter({ hasText: 'General' })
      .click();

    const messages = page.locator('[data-messages-container]');
    await expect(messages).toBeVisible();

    // No File added here: `dataTransfer.types` will not contain 'Files',
    // which is exactly the `carriesFiles` filter this test is meant to cover.
    const dataTransfer = await page.evaluateHandle(() => {
      const DataTransferCtor = (
        globalThis as unknown as {
          DataTransfer: new () => {
            setData: (format: string, data: string) => void;
          };
        }
      ).DataTransfer;
      const transfer = new DataTransferCtor();

      transfer.setData('text/plain', 'just some selected text');

      return transfer;
    });

    await messages.dispatchEvent('dragenter', { dataTransfer });
    await expect(page.getByTestId(TestId.DROP_OVERLAY)).toBeHidden();
  });
});
