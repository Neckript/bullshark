import type { Page, WebSocketRoute } from '@playwright/test';
import { TestId } from '@bullshark/shared';
import { expect, test } from './fixtures';

const AUTO_LOGIN_TOKEN_KEY = 'bullshark-auto-login-token';

// Intercepts the tRPC socket so a test can drop it the way a server restart or
// a network hiccup would, without the user asking for anything, and can read
// what the client sends over it.
const interceptServerSocket = async (page: Page) => {
  let currentRoute: WebSocketRoute | undefined;
  const sentMessages: string[] = [];

  await page.routeWebSocket(/localhost:4991/, (ws) => {
    const server = ws.connectToServer();

    ws.onMessage((message) => {
      sentMessages.push(message.toString());
      server.send(message);
    });
    server.onMessage((message) => ws.send(message));

    currentRoute = ws;
  });

  return {
    drop: () => currentRoute?.close({ code: 1001, reason: 'connection lost' }),
    sentMessages
  };
};

const loginWithAutoLogin = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId(TestId.CONNECT_IDENTITY_INPUT).fill('testowner');
  await page.getByTestId(TestId.CONNECT_PASSWORD_INPUT).fill('password123');
  await page.getByTestId(TestId.CONNECT_AUTO_LOGIN_SWITCH).click();
  await page.getByTestId(TestId.CONNECT_BUTTON).click();
  await page.getByTestId(TestId.SERVER_VIEW).waitFor();
};

const readAutoLoginToken = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), AUTO_LOGIN_TOKEN_KEY);

test.describe('Session persistence', () => {
  test.describe.configure({ timeout: 90_000 });

  test('keeps the saved session when the connection drops', async ({
    page
  }) => {
    const socket = await interceptServerSocket(page);
    await loginWithAutoLogin(page);

    expect(await readAutoLoginToken(page)).not.toBeNull();

    await socket.drop();

    // the session must survive an unwanted disconnect, otherwise the user has
    // to type their credentials again after every network hiccup
    await expect
      .poll(() => readAutoLoginToken(page), { timeout: 15_000 })
      .not.toBeNull();
  });

  test('reconnects on its own after the connection drops', async ({ page }) => {
    const socket = await interceptServerSocket(page);
    await loginWithAutoLogin(page);

    await socket.drop();

    await expect(page.getByTestId(TestId.SERVER_VIEW)).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByTestId(TestId.CONNECT_BUTTON)).toBeHidden();
  });

  test('asks the server for a fresh token once connected', async ({ page }) => {
    const socket = await interceptServerSocket(page);
    await loginWithAutoLogin(page);

    // without this the stored token silently reaches its expiry and the user is
    // sent back to the login form even though they use the app every day
    await expect
      .poll(
        () =>
          socket.sentMessages.some((message) =>
            message.includes('security.refreshToken')
          ),
        { timeout: 15_000 }
      )
      .toBe(true);
  });

  test('forgets the saved session on an explicit disconnect', async ({
    page
  }) => {
    await loginWithAutoLogin(page);

    await page.getByTestId(TestId.SERVER_DROPDOWN_TRIGGER).click();
    await page.getByTestId(TestId.SERVER_DROPDOWN_DISCONNECT).click();
    await page.getByTestId(TestId.CONFIRMATION_CONFIRM_BUTTON).click();

    await expect(page.getByTestId(TestId.CONNECT_BUTTON)).toBeVisible({
      timeout: 15_000
    });

    expect(await readAutoLoginToken(page)).toBeNull();
  });
});
