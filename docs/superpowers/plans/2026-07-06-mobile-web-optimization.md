# Mobile Web Optimization (touch actions, PWA, push) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web client the de-facto mobile app: long-press message actions on touch devices, installable PWA, and web push notifications driven by the user's existing notification preferences.

**Architecture:** Client-only work for touch + PWA (`apps/client`); push adds a `push_subscriptions` table (ADD-only migration), VAPID keys in the `settings` table, an async send queue hooked into `publishMessage`, and a `push` tRPC router. The service worker handles push only — **no offline caching, ever** (Cloudflare cache saga).

**Tech Stack:** React 18 + Vite + Tailwind + shadcn (`@sharkord/ui`), tRPC 11, Drizzle/SQLite, Bun, `web-push`, `queue` (npm).

## Global Constraints

- Branch: `development`. NEVER touch `main`.
- After each task's commit: `git push github development && git push origin development` (both remotes, always).
- Commit convention: `feat: …` / `fix: …` / `docs: …`, ending with the Co-Authored-By line used in this repo.
- Server tests: `cd apps/server && bun test`. Client gates: `cd apps/client && bun run check-types && bun run lint`.
- DB migration: **ADD TABLE / ADD COLUMN only** — no table rebuilds (prod cascade-wipe gotcha). Generate with `cd apps/server && bun run db:gen`, then `bun run db:check`.
- New user-facing strings: add i18n keys to `apps/client/src/i18n/locales/en/…` AND `…/fr/…` (other locales fall back to en).
- The desktop hover toolbar behavior must remain byte-identical on fine pointers.

**Spec deviations (agreed rationale, decided while planning):**
1. Push preference reuses the EXISTING `browser_notifications*` user-setting keys (`browser_notifications`, `_mentions`, `_dms`, `_replies`, `muted_role_mention:<id>`) instead of a new enum — one preference set drives both in-page and push notifications. The server mirrors the client's decision chain in `apps/client/src/features/server/messages/actions.ts:150-186`.
2. DND exclusion is dropped — no server-side DND state exists.
3. The client has no test infrastructure (no jest/vitest); the risk-bearing logic (push recipients) lives server-side under `bun test`. Client tasks are gated by check-types + lint + the manual checklist (Task 13).

---

### Task 1: Extract shared message action handlers hook

**Files:**
- Create: `apps/client/src/components/channel-view/text/hooks/use-message-action-handlers.ts`
- Modify: `apps/client/src/components/channel-view/text/message-actions.tsx`

**Interfaces:**
- Produces: `useMessageActionHandlers({ messageId, channelId }): { onDeleteClick: () => Promise<void>; onEmojiSelect: (emoji: TEmojiItem) => Promise<void>; onThreadClick: () => void; onPinClick: () => Promise<void> }` — consumed by Task 3's sheet and by the existing hover toolbar.

- [ ] **Step 1: Create the hook** — move the four `useCallback` handlers currently inlined in `message-actions.tsx` (lines 63–118: `onDeleteClick`, `onEmojiSelect`, `onReplyClick` → rename `onThreadClick`, `onPinClick`) verbatim into the new file:

```tsx
import { useRecentEmojis } from '@/components/emoji-picker/use-recent-emojis';
import type { TEmojiItem } from '@/components/tiptap-input/helpers';
import { openThreadSidebar } from '@/features/app/actions';
import { useIsShiftHeld } from '@/features/app/hooks';
import { requestConfirmation } from '@/features/dialogs/actions';
import { getTRPCClient } from '@/lib/trpc';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TUseMessageActionHandlersArgs = { messageId: number; channelId: number };

const useMessageActionHandlers = ({
  messageId,
  channelId
}: TUseMessageActionHandlersArgs) => {
  const { t } = useTranslation();
  const isShiftHeld = useIsShiftHeld();

  const onDeleteClick = useCallback(async () => {
    if (!isShiftHeld) {
      const choice = await requestConfirmation({
        title: t('deleteMessageTitle'),
        message: t('deleteMessageConfirm'),
        confirmLabel: t('deleteLabel'),
        cancelLabel: t('cancel')
      });
      if (!choice) return;
    }
    const trpc = getTRPCClient();
    try {
      await trpc.messages.delete.mutate({ messageId });
      toast.success(t('messageDeleted'));
    } catch {
      toast.error(t('failedDeleteMessage'));
    }
  }, [isShiftHeld, messageId, t]);

  const onEmojiSelect = useCallback(
    async (emoji: TEmojiItem) => {
      const trpc = getTRPCClient();
      try {
        await trpc.messages.toggleReaction.mutate({
          messageId,
          emoji: emoji.shortcodes[0]
        });
      } catch (error) {
        toast.error(t('failedAddReaction'));
        console.error('Error adding reaction:', error);
      }
    },
    [messageId, t]
  );

  const onThreadClick = useCallback(() => {
    openThreadSidebar(messageId, channelId);
  }, [messageId, channelId]);

  const onPinClick = useCallback(async () => {
    const trpc = getTRPCClient();
    try {
      await trpc.messages.togglePin.mutate({ messageId });
      toast.success(t('messagePinToggled'));
    } catch (error) {
      toast.error(t('failedTogglePin'));
      console.error('Error toggling pin status:', error);
    }
  }, [messageId, t]);

  return { onDeleteClick, onEmojiSelect, onThreadClick, onPinClick };
};

export { useMessageActionHandlers };
```

Keep `useIsShiftHeld` and `useRecentEmojis` where they are needed: `isShiftHeld` stays needed inside `message-actions.tsx` too (icon swap Trash/Trash2) — re-import it there; `useRecentEmojis` stays in `message-actions.tsx` (toolbar-only concern).

- [ ] **Step 2: Refactor `message-actions.tsx`** to consume the hook: delete the four inlined handlers, call `const { onDeleteClick, onEmojiSelect, onThreadClick, onPinClick } = useMessageActionHandlers({ messageId, channelId });`, replace `onReplyClick` usage with `onThreadClick`. JSX untouched otherwise.

- [ ] **Step 3: Gates** — Run: `cd apps/client && bun run check-types && bun run lint`
Expected: both clean (pre-existing known noise aside: 2 type errors in `messages-group.tsx:87` / `profile/index.tsx:110` are pre-existing — do not fix, do not worsen).

- [ ] **Step 4: Quick manual regression** — `cd apps/client && bun run dev`, hover a message on desktop: toolbar appears with all actions working (reply, thread, edit, delete, pin, quick emojis, picker).

- [ ] **Step 5: Commit + push both remotes**

```bash
git add apps/client/src/components/channel-view/text/
git commit -m "refactor: extract message action handlers into a shared hook"
git push github development && git push origin development
```

### Task 2: Long-press hook

**Files:**
- Create: `apps/client/src/hooks/use-long-press.ts`

**Interfaces:**
- Produces: `useLongPress(onLongPress: () => void, opts?: { delayMs?: number; moveTolerancePx?: number }): { onTouchStart; onTouchMove; onTouchEnd; onTouchCancel; onContextMenu }` — spread onto the message wrapper div in Task 3.

- [ ] **Step 1: Implement**

```tsx
import { useCallback, useRef } from 'react';

type TUseLongPressOpts = { delayMs?: number; moveTolerancePx?: number };

const useLongPress = (
  onLongPress: () => void,
  { delayMs = 450, moveTolerancePx = 10 }: TUseLongPressOpts = {}
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || e.touches.length > 1) return;
      firedRef.current = false;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delayMs);
    },
    [delayMs, onLongPress]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !startRef.current) return;
      const dx = Math.abs(touch.clientX - startRef.current.x);
      const dy = Math.abs(touch.clientY - startRef.current.y);
      if (dx > moveTolerancePx || dy > moveTolerancePx) clear(); // scroll → cancel
    },
    [clear, moveTolerancePx]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // suppress the click/selection that follows a fired long-press
      if (firedRef.current) e.preventDefault();
      clear();
    },
    [clear]
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // iOS synthesizes contextmenu on long-press; we own that gesture
    if (firedRef.current) e.preventDefault();
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: clear,
    onContextMenu
  };
};

export { useLongPress };
```

- [ ] **Step 2: Gates** — `cd apps/client && bun run check-types && bun run lint` → clean.

- [ ] **Step 3: Commit + push both remotes**

```bash
git add apps/client/src/hooks/use-long-press.ts
git commit -m "feat: add useLongPress hook (touch long-press with scroll cancellation)"
git push github development && git push origin development
```

### Task 3: Message action sheet (bottom sheet on long-press)

**Files:**
- Create: `apps/client/src/components/channel-view/text/message-action-sheet.tsx`
- Create: `apps/client/src/hooks/use-is-coarse-pointer.ts`
- Modify: `apps/client/src/components/channel-view/text/message.tsx` (wire long-press + render sheet; MessageActions props stay identical)
- Modify: `apps/client/src/i18n/locales/en/translation.json` and `…/fr/translation.json` (reuse existing keys where possible; add `copyMessageText` if absent)

**Interfaces:**
- Consumes: `useMessageActionHandlers` (Task 1), `useLongPress` (Task 2), `Sheet/SheetContent` from `@sharkord/ui`, `EmojiPicker`, `Protect`, `Permission` from `@sharkord/shared`.
- Produces: `<MessageActionSheet open onOpenChange message-scoped props />` — props: `{ open: boolean; onOpenChange: (o: boolean) => void; messageId: number; channelId: number; onEdit: () => void; onReply?: () => void; canManage: boolean; editable: boolean; isThreadReply?: boolean; isPinned?: boolean; disablePin?: boolean; messageText: string }`.

- [ ] **Step 1: `use-is-coarse-pointer.ts`**

```tsx
import { useSyncExternalStore } from 'react';

const query = '(pointer: coarse)';

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};

const useIsCoarsePointer = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);

export { useIsCoarsePointer };
```

- [ ] **Step 2: `message-action-sheet.tsx`** — bottom sheet with the fixed quick-emoji row and the action list. Actions mirror the hover toolbar 1:1 (same conditions, same `Protect` permissions):

```tsx
import { EmojiPicker } from '@/components/emoji-picker';
import { Protect } from '@/components/protect';
import type { TEmojiItem } from '@/components/tiptap-input/helpers';
import { useMessageActionHandlers } from './hooks/use-message-action-handlers';
import { Permission } from '@sharkord/shared';
import { Sheet, SheetContent } from '@sharkord/ui';
import {
  Copy,
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
  Trash
} from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const QUICK_EMOJIS: TEmojiItem[] = [
  { emoji: '👍', name: 'thumbsup', shortcodes: ['+1'] },
  { emoji: '❤️', name: 'heart', shortcodes: ['heart'] },
  { emoji: '😂', name: 'joy', shortcodes: ['joy'] },
  { emoji: '😮', name: 'open_mouth', shortcodes: ['open_mouth'] },
  { emoji: '😢', name: 'cry', shortcodes: ['cry'] }
] as TEmojiItem[];
// NOTE: match TEmojiItem's actual shape from tiptap-input/helpers — if it has
// required fields beyond emoji/name/shortcodes, fill them (e.g. fallbackImage: undefined).

type TProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  messageId: number;
  channelId: number;
  onEdit: () => void;
  onReply?: () => void;
  canManage: boolean;
  editable: boolean;
  isThreadReply?: boolean;
  isPinned?: boolean;
  disablePin?: boolean;
  messageText: string;
};

const Row = ({
  icon: Icon,
  label,
  onClick,
  destructive
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-accent ${destructive ? 'text-destructive' : ''}`}
  >
    <Icon className="h-4 w-4 shrink-0" />
    {label}
  </button>
);

const MessageActionSheet = memo(
  ({
    open,
    onOpenChange,
    messageId,
    channelId,
    onEdit,
    onReply,
    canManage,
    editable,
    isThreadReply,
    isPinned,
    disablePin,
    messageText
  }: TProps) => {
    const { t } = useTranslation();
    const { onDeleteClick, onEmojiSelect, onThreadClick, onPinClick } =
      useMessageActionHandlers({ messageId, channelId });

    const wrap = useCallback(
      (fn: () => unknown) => () => {
        onOpenChange(false);
        fn();
      },
      [onOpenChange]
    );

    const onCopy = useCallback(async () => {
      await navigator.clipboard.writeText(messageText);
      toast.success(t('copiedToClipboard'));
    }, [messageText, t]);

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-xl p-2 pb-6">
          <Protect permission={Permission.REACT_TO_MESSAGES}>
            <div className="flex items-center justify-around border-b border-border px-2 pb-3 pt-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji.name}
                  type="button"
                  onClick={wrap(() => onEmojiSelect(emoji))}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-accent"
                >
                  {emoji.emoji}
                </button>
              ))}
              <EmojiPicker onEmojiSelect={(e) => { onOpenChange(false); onEmojiSelect(e); }}>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
                >
                  <Smile className="h-6 w-6" />
                </button>
              </EmojiPicker>
            </div>
          </Protect>
          <div className="pt-2">
            {onReply && <Row icon={Reply} label={t('replyToMessage')} onClick={wrap(onReply)} />}
            {!isThreadReply && (
              <Row icon={MessageSquareText} label={t('replyInThread')} onClick={wrap(onThreadClick)} />
            )}
            <Row icon={Copy} label={t('copyMessageText')} onClick={wrap(onCopy)} />
            {!disablePin && (
              <Protect permission={Permission.PIN_MESSAGES}>
                <Row
                  icon={isPinned ? PinOff : Pin}
                  label={isPinned ? t('unpinMessage') : t('pinMessage')}
                  onClick={wrap(onPinClick)}
                />
              </Protect>
            )}
            {canManage && (
              <>
                {editable && <Row icon={Pencil} label={t('editMessage')} onClick={wrap(onEdit)} />}
                <Row icon={Trash} label={t('deleteMessageTitle')} onClick={wrap(onDeleteClick)} destructive />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);

export { MessageActionSheet };
```

- [ ] **Step 3: Wire into `message.tsx`** — in the message component (the div at line ~69 with the `group` class): add `const isCoarse = useIsCoarsePointer();`, `const [sheetOpen, setSheetOpen] = useState(false);`, `const longPress = useLongPress(() => setSheetOpen(true));`, spread `{...(isCoarse ? longPress : {})}` on that wrapper div plus `className` gain `select-none` **only while coarse** (`isCoarse && 'select-none'` via `cn`) to suppress iOS text-selection during the press. Render `<MessageActionSheet …/>` next to `<MessageActions …/>` passing the exact same props plus `open={sheetOpen} onOpenChange={setSheetOpen}` and `messageText` (the message's raw text content — same source the renderer receives, strip via a small `stripHtml` inline: `new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''`). Only render the sheet when `isCoarse`.

- [ ] **Step 4: i18n** — check `en/translation.json` for `copyMessageText` and `copiedToClipboard`; add if missing (en: "Copy text" / "Copied to clipboard", fr: "Copier le texte" / "Copié dans le presse-papiers"). All other keys already exist (they're used by the toolbar).

- [ ] **Step 5: Gates** — `cd apps/client && bun run check-types && bun run lint` → clean.

- [ ] **Step 6: Manual check (DevTools)** — `bun run dev`, open Chrome DevTools device emulation (touch): long-press a message → sheet opens with emoji row + actions; scroll while pressing → no sheet; desktop mouse hover → toolbar unchanged, no sheet.

- [ ] **Step 7: Commit + push both remotes**

```bash
git add apps/client/src
git commit -m "feat: long-press message action sheet on touch devices"
git push github development && git push origin development
```

### Task 4: Touch-friendly reaction pills

**Files:**
- Modify: `apps/client/src/components/channel-view/text/message-reactions.tsx`
- Modify: `apps/client/src/index.css` (or the client's main CSS entry if named differently — check `main.tsx` import)

- [ ] **Step 1:** Add a stable class to the reaction pill button in `message-reactions.tsx` (e.g. `reaction-pill` appended to its existing className).

- [ ] **Step 2:** In the CSS entry:

```css
@media (pointer: coarse) {
  .reaction-pill {
    min-height: 2.25rem; /* ≥36px hit target, visual size unchanged on desktop */
    min-width: 2.75rem;
  }
}
```

- [ ] **Step 3: Gates + manual** — check-types/lint clean; DevTools touch emulation: pills tappable, desktop rendering unchanged.

- [ ] **Step 4: Commit + push both remotes**

```bash
git add apps/client/src
git commit -m "feat: enlarge reaction tap targets on coarse pointers"
git push github development && git push origin development
```

### Task 5: Installable PWA (manifest + icons)

**Files:**
- Create: `apps/client/public/manifest.json`
- Modify: `apps/client/index.html`

- [ ] **Step 1: `manifest.json`** (the `<link rel="manifest" href="/manifest.json">` already exists in `index.html:6` — the file is missing):

```json
{
  "name": "Bullshark",
  "short_name": "Bullshark",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b0e11",
  "theme_color": "#0b0e11",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

(`icon-192.png`/`icon-512.png` already exist in `apps/client/public/`. Adjust `background_color`/`theme_color` to the Bullshark theme's actual background hex — read it from the theme CSS vars added by the themes feature; keep both values identical.)

- [ ] **Step 2: `index.html`** — inside `<head>`, add:

```html
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="theme-color" content="#0b0e11" />
```

- [ ] **Step 3: Verify** — `bun run dev`, open `http://localhost:5173/manifest.json` → JSON served (no 404). Chrome DevTools → Application → Manifest → installable, icons resolve.

- [ ] **Step 4: Commit + push both remotes**

```bash
git add apps/client/public/manifest.json apps/client/index.html
git commit -m "feat: real PWA manifest and apple-touch-icon (installable web app)"
git push github development && git push origin development
```

### Task 6: DB — push_subscriptions table + VAPID columns + queries

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Create: `apps/server/src/db/queries/push-subscriptions.ts`
- Create migration via `bun run db:gen` (never hand-write)
- Test: `apps/server/src/db/queries/__tests__/push-subscriptions.test.ts` (follow the pattern of existing tests under `apps/server/src/routers/__tests__/`)

**Interfaces:**
- Produces:
  - table `pushSubscriptions` (`push_subscriptions`): `id`, `userId` (FK users), `endpoint` (unique), `p256dh`, `auth`, `createdAt`
  - `settings` table gains `vapidPublicKey: text | null`, `vapidPrivateKey: text | null`
  - queries: `addPushSubscription({ userId, endpoint, p256dh, auth }): Promise<void>` (upsert on endpoint), `deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>`, `deletePushSubscriptionsForUser(userId: number, endpoint?: string): Promise<void>`, `getPushSubscriptionsForUsers(userIds: number[]): Promise<Array<{ userId: number; endpoint: string; p256dh: string; auth: string }>>`

- [ ] **Step 1: Schema** — in `schema.ts`, mirroring existing table style (see `userSettings` at line ~590):

```ts
const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)]
);
```

Add `vapidPublicKey: text('vapid_public_key')` and `vapidPrivateKey: text('vapid_private_key')` to the existing `settings` table columns. Export `pushSubscriptions` alongside the other tables.

- [ ] **Step 2: Generate + check migration** — `cd apps/server && bun run db:gen && bun run db:check`. Open the generated SQL and **verify it contains ONLY** `CREATE TABLE push_subscriptions…`, `CREATE INDEX…`, and `ALTER TABLE settings ADD COLUMN…` — if drizzle generated a table rebuild for `settings`, STOP and split the columns into a standalone raw ADD COLUMN migration instead.

- [ ] **Step 3: Queries** (`push-subscriptions.ts`):

```ts
import { eq, inArray } from 'drizzle-orm';
import { db } from '../index';
import { pushSubscriptions } from '../schema';

const addPushSubscription = async (sub: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> => {
  await db
    .insert(pushSubscriptions)
    .values({ ...sub, createdAt: Date.now() })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: sub.userId, p256dh: sub.p256dh, auth: sub.auth }
    });
};

const deletePushSubscriptionByEndpoint = async (
  endpoint: string
): Promise<void> => {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
};

const deletePushSubscriptionsForUser = async (
  userId: number,
  endpoint?: string
): Promise<void> => {
  if (endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return;
  }
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
};

const getPushSubscriptionsForUsers = async (userIds: number[]) => {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
};

export {
  addPushSubscription,
  deletePushSubscriptionByEndpoint,
  deletePushSubscriptionsForUser,
  getPushSubscriptionsForUsers
};
```

- [ ] **Step 4: Tests first-run** — write the test asserting upsert-on-endpoint (insert same endpoint twice with different userId → one row, latest userId), delete by endpoint, and `getPushSubscriptionsForUsers([])` → `[]`. Run `bun test push-subscriptions` → PASS (uses the test DB bootstrap the other server tests use — copy their setup imports).

- [ ] **Step 5: Commit + push both remotes**

```bash
git add apps/server/src/db
git commit -m "feat: push_subscriptions table, VAPID settings columns and queries"
git push github development && git push origin development
```

### Task 7: VAPID bootstrap (web-push under Bun)

**Files:**
- Create: `apps/server/src/helpers/vapid.ts`
- Modify: `apps/server/src/index.ts` (startup call, after `loadDb()`)
- Modify: `apps/server/package.json` (add `web-push` + `@types/web-push`)

**Interfaces:**
- Produces: `ensureVapidKeys(): Promise<void>` (idempotent, called at boot) and `getVapidKeys(): { publicKey: string; privateKey: string } | null` (sync, null ⇒ push disabled).

- [ ] **Step 1: SPIKE — validate web-push under Bun** (do this FIRST): `cd apps/server && bun add web-push && bun add -d @types/web-push`, then run a scratch script:

```ts
// scratch-webpush.ts (delete after)
import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log(keys.publicKey.length > 0, keys.privateKey.length > 0);
```

Run: `bun scratch-webpush.ts` → `true true`. If web-push fails under Bun (crypto incompat), STOP and report — the fallback (manual VAPID JWT + `fetch`) needs a plan revision, do not improvise it.

- [ ] **Step 2: `vapid.ts`**

```ts
import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { getSettings } from '../db/queries/server';
import { settings } from '../db/schema';
import { logger } from '../logger';

let cached: { publicKey: string; privateKey: string } | null = null;

const ensureVapidKeys = async (): Promise<void> => {
  try {
    const current = await getSettings();
    if (current.vapidPublicKey && current.vapidPrivateKey) {
      cached = {
        publicKey: current.vapidPublicKey,
        privateKey: current.vapidPrivateKey
      };
      return;
    }
    const keys = webpush.generateVAPIDKeys();
    await db
      .update(settings)
      .set({ vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey })
      .where(eq(settings.id, current.id));
    cached = keys;
    logger.info('[Push] VAPID keys generated');
  } catch (error) {
    cached = null;
    logger.error(`[Push] VAPID init failed, push disabled: ${error}`);
  }
};

const getVapidKeys = () => cached;

export { ensureVapidKeys, getVapidKeys };
```

(Adapt the `settings` row access to how `getSettings()` actually loads it — if settings is a single-row table without `id`, use the same update pattern other settings writers use, e.g. `update-settings.ts`.)

- [ ] **Step 3:** Call `await ensureVapidKeys();` in `apps/server/src/index.ts` startup sequence after the DB is loaded. Boot the dev server (`bun dev`) → log shows VAPID generated on first boot, silent on second boot.

- [ ] **Step 4: Commit + push both remotes**

```bash
git add apps/server/src apps/server/package.json bun.lock*
git commit -m "feat: VAPID key bootstrap for web push (stored in settings)"
git push github development && git push origin development
```

### Task 8: Push recipient computation (pure logic + tests)

**Files:**
- Create: `apps/server/src/helpers/push-recipients.ts`
- Test: `apps/server/src/helpers/__tests__/push-recipients.test.ts`
- Modify: `apps/server/src/db/queries/channels.ts` (add all-users variant of the affected-users query)

**Interfaces:**
- Consumes: `hasMention(content, userId, ownRoleIds, mutedRoleMentionIds)` from `@sharkord/shared`; `MUTED_ROLE_MENTION_PREFIX` from `@sharkord/shared`; `getAffectedOnlineUserIdsForChannel` (existing, used in `db/publishers.ts`) as the model for the new all-users variant.
- Produces:
  - `getAffectedUserIdsForChannel(channelId, opts)` in `channels.ts` — same signature/permission logic as `getAffectedOnlineUserIdsForChannel` but over ALL users (copy its implementation, drop the online filter).
  - `decidePushForUser(input): boolean` — **pure**, fully unit-tested:

```ts
type TPushDecisionInput = {
  userId: number;
  authorId: number;
  isDmChannel: boolean;
  messageContent: string | null;
  replyToUserId: number | null;
  userRoleIds: number[];
  settings: Record<string, string>; // raw user_settings key→value for this user
};
```

- [ ] **Step 1: Write failing tests** — the decision chain MUST mirror the client (`apps/client/src/features/server/messages/actions.ts:150-186`), same precedence:

```ts
import { describe, expect, it } from 'bun:test';
import { decidePushForUser } from '../push-recipients';

const base = {
  userId: 2,
  authorId: 1,
  isDmChannel: false,
  messageContent: '<p>hello</p>',
  replyToUserId: null,
  userRoleIds: [],
  settings: {} as Record<string, string>
};

describe('decidePushForUser', () => {
  it('never notifies the author', () => {
    expect(decidePushForUser({ ...base, userId: 1 })).toBe(false);
  });
  it('DM + dms enabled → true', () => {
    expect(
      decidePushForUser({
        ...base,
        isDmChannel: true,
        settings: { browser_notifications_dms: 'true' }
      })
    ).toBe(true);
  });
  it('DM + dms disabled → false', () => {
    expect(decidePushForUser({ ...base, isDmChannel: true })).toBe(false);
  });
  it('mentions-only: mentioned → true', () => {
    expect(
      decidePushForUser({
        ...base,
        messageContent: '<span data-type="mention" data-user-id="2">@u</span>',
        settings: { browser_notifications_mentions: 'true' }
      })
    ).toBe(true);
  });
  it('mentions-only: not mentioned → false even with content', () => {
    expect(
      decidePushForUser({
        ...base,
        settings: { browser_notifications_mentions: 'true' }
      })
    ).toBe(false);
  });
  it('muted role mention → false', () => {
    expect(
      decidePushForUser({
        ...base,
        messageContent:
          '<span data-type="mention-role" data-role-id="7">@r</span>',
        userRoleIds: [7],
        settings: {
          browser_notifications_mentions: 'true',
          'muted_role_mention:7': 'true'
        }
      })
    ).toBe(false);
  });
  it('all-messages enabled → true', () => {
    expect(
      decidePushForUser({ ...base, settings: { browser_notifications: 'true' } })
    ).toBe(true);
  });
  it('replies: reply to own message → true', () => {
    expect(
      decidePushForUser({
        ...base,
        replyToUserId: 2,
        settings: { browser_notifications_replies: 'true' }
      })
    ).toBe(true);
  });
  it('no settings → false', () => {
    expect(decidePushForUser(base)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `cd apps/server && bun test push-recipients` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { hasMention, MUTED_ROLE_MENTION_PREFIX } from '@sharkord/shared';

type TPushDecisionInput = {
  userId: number;
  authorId: number;
  isDmChannel: boolean;
  messageContent: string | null;
  replyToUserId: number | null;
  userRoleIds: number[];
  settings: Record<string, string>;
};

const isOn = (settings: Record<string, string>, key: string) =>
  settings[key] === 'true';

const decidePushForUser = (input: TPushDecisionInput): boolean => {
  if (input.userId === input.authorId) return false;

  // precedence mirrors apps/client/src/features/server/messages/actions.ts
  if (input.isDmChannel) return isOn(input.settings, 'browser_notifications_dms');

  if (isOn(input.settings, 'browser_notifications_mentions')) {
    const mutedRoleIds = Object.keys(input.settings)
      .filter(
        (k) =>
          k.startsWith(MUTED_ROLE_MENTION_PREFIX) &&
          input.settings[k] === 'true'
      )
      .map((k) => Number(k.slice(MUTED_ROLE_MENTION_PREFIX.length)));
    return hasMention(
      input.messageContent,
      input.userId,
      input.userRoleIds,
      mutedRoleIds
    );
  }

  if (isOn(input.settings, 'browser_notifications')) return true;

  if (isOn(input.settings, 'browser_notifications_replies')) {
    return input.replyToUserId === input.userId;
  }

  return false;
};

export { decidePushForUser, type TPushDecisionInput };
```

**IMPORTANT — verify the settings value format first:** read `apps/server/src/db/queries/user-settings.ts` and the client's setters to confirm stored values are the strings `'true'`/`'false'`; if they are JSON or `'1'`, adapt `isOn` and the tests to the real format before implementing.

- [ ] **Step 4:** `bun test push-recipients` → 9 pass. Also add `getAffectedUserIdsForChannel` to `channels.ts` (copy `getAffectedOnlineUserIdsForChannel`'s body — find it via `grep -n "getAffectedOnlineUserIdsForChannel" apps/server/src -r` — and remove the online-users filter; same `{ permission }` option).

- [ ] **Step 5: Commit + push both remotes**

```bash
git add apps/server/src
git commit -m "feat: push recipient decision logic mirroring client notification rules"
git push github development && git push origin development
```

### Task 9: Push send queue + hook into publishMessage

**Files:**
- Create: `apps/server/src/queues/push/index.ts`
- Modify: `apps/server/src/db/publishers.ts` (enqueue on `type === 'create'`)

**Interfaces:**
- Consumes: `getVapidKeys` (Task 7), `decidePushForUser` + `getAffectedUserIdsForChannel` (Task 8), `getPushSubscriptionsForUsers`/`deletePushSubscriptionByEndpoint` (Task 6), `getOnlineUserIds` from `apps/server/src/utils/wss.ts`, `getUserSettings` from `db/queries/user-settings.ts`, the `queue` npm pattern from `queues/activity-log/index.ts`.
- Produces: `enqueuePushForMessage(message: TJoinedMessage, channelId: number): void` — fire-and-forget, called from `publishMessage`.

- [ ] **Step 1: Implement the queue** (same skeleton as `queues/activity-log/index.ts`: `new Queue({ concurrency: 2, autostart: true, timeout: 10000 })`):

```ts
import type { TJoinedMessage } from '@sharkord/shared';
import { ChannelPermission } from '@sharkord/shared';
import Queue from 'queue';
import webpush from 'web-push';
import { getChannel } from '../../db/queries/channels';
import { getAffectedUserIdsForChannel } from '../../db/queries/channels';
import {
  deletePushSubscriptionByEndpoint,
  getPushSubscriptionsForUsers
} from '../../db/queries/push-subscriptions';
import { getUserSettings } from '../../db/queries/user-settings';
import { decidePushForUser } from '../../helpers/push-recipients';
import { getVapidKeys } from '../../helpers/vapid';
import { logger } from '../../logger';
import { getOnlineUserIds } from '../../utils/wss';

const pushQueue = new Queue({ concurrency: 2, autostart: true, timeout: 10000 });

const stripHtml = (html: string | null): string =>
  (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const enqueuePushForMessage = (message: TJoinedMessage, channelId: number) => {
  const vapid = getVapidKeys();
  if (!vapid) return; // push disabled

  pushQueue.push(async () => {
    try {
      const channel = await getChannel(channelId);
      if (!channel) return;

      const candidateIds = (
        await getAffectedUserIdsForChannel(channelId, {
          permission: ChannelPermission.VIEW_CHANNEL
        })
      ).filter((id) => id !== message.userId);

      const online = new Set(getOnlineUserIds());
      const offlineIds = candidateIds.filter((id) => !online.has(id));
      if (offlineIds.length === 0) return;

      const recipients: number[] = [];
      for (const userId of offlineIds) {
        const settings = await getUserSettings(userId);
        // userRoleIds: reuse the same per-user role lookup the permission
        // query already joins — expose it from getAffectedUserIdsForChannel
        // as a Map<userId, roleIds> second return, or query userRoles here.
        const roleRows = await getUserRoleIds(userId);
        const notify = decidePushForUser({
          userId,
          authorId: message.userId,
          isDmChannel: !!channel.isDm,
          messageContent: message.content ?? null,
          replyToUserId: message.replyTo?.userId ?? null,
          userRoleIds: roleRows,
          settings
        });
        if (notify) recipients.push(userId);
      }
      if (recipients.length === 0) return;

      const subs = await getPushSubscriptionsForUsers(recipients);
      const title = channel.isDm
        ? (message.user?.name ?? 'Bullshark')
        : `#${channel.name}`;
      const body = `${message.user?.name ?? '?'}: ${stripHtml(message.content).slice(0, 140)}`;
      const payload = JSON.stringify({
        title,
        body,
        tag: `channel-${channelId}`,
        url: `/?channelId=${channelId}`
      });

      webpush.setVapidDetails('mailto:admin@localhost', vapid.publicKey, vapid.privateKey);

      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await deletePushSubscriptionByEndpoint(sub.endpoint);
            } else {
              logger.debug(`[Push] send failed (${status}): ${error}`);
            }
          }
        })
      );
    } catch (error) {
      logger.error(`[Push] queue job failed: ${error}`);
    }
  });
};

export { enqueuePushForMessage };
```

Adapt during implementation (these are look-ups, not design changes): the real `getChannel` return shape (`isDm`/type field — use whatever the client's `channelByIdSelector` reads), the real `TJoinedMessage` author field (`message.user?.name` — check `packages/shared` types), and `getUserRoleIds` (find the existing user-roles query used by permissions; if none is exported, add one in `db/queries/users.ts` selecting `userRoles.roleId` by userId).

- [ ] **Step 2: Hook** — in `db/publishers.ts`, inside `publishMessage` right after `pubsub.publishFor(affectedUserIds, targetEvent, message);`:

```ts
if (type === 'create') enqueuePushForMessage(message, channelId);
```

- [ ] **Step 3: Gates** — `cd apps/server && bun run check-types && bun test` → clean; boot `bun dev`, send a message → no errors in log (no subscriptions yet, queue no-ops).

- [ ] **Step 4: Commit + push both remotes**

```bash
git add apps/server/src
git commit -m "feat: web push send queue hooked into message publishing"
git push github development && git push origin development
```

### Task 10: push tRPC router

**Files:**
- Create: `apps/server/src/routers/push/index.ts`, `subscribe.ts`, `unsubscribe.ts`, `get-public-key.ts`
- Modify: `apps/server/src/routers/index.ts` (register `push: pushRouter`)
- Test: `apps/server/src/routers/__tests__/push.test.ts`

**Interfaces:**
- Produces tRPC procedures (all `protectedProcedure` — copy the auth middleware usage from `routers/channels/mark-as-read.ts`):
  - `push.getPublicKey: query → { publicKey: string | null }`
  - `push.subscribe: mutation({ endpoint: string, p256dh: string, auth: string }) → void`
  - `push.unsubscribe: mutation({ endpoint: string }) → void` (deletes only the caller's own subscription: match on endpoint AND ctx.userId)

- [ ] **Step 1: Write the failing test** — subscribe upserts a row for ctx user; unsubscribe removes it; getPublicKey returns the VAPID public key after `ensureVapidKeys()` (copy the tRPC test-caller bootstrap from an existing router test in `routers/__tests__/`).

- [ ] **Step 2: Implement** — each procedure delegates to Task 6 queries / Task 7 `getVapidKeys`; `subscribe` input validated with zod (`z.object({ endpoint: z.string().url().max(2048), p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) })`); `unsubscribe` calls `deletePushSubscriptionsForUser(ctx.userId, input.endpoint)`.

- [ ] **Step 3:** Register in `routers/index.ts` (`push: pushRouter` in the `t.router({...})` map). Run `bun test push && bun run check-types` → PASS.

- [ ] **Step 4: Commit + push both remotes**

```bash
git add apps/server/src/routers
git commit -m "feat: push tRPC router (subscribe/unsubscribe/getPublicKey)"
git push github development && git push origin development
```

### Task 11: Service worker (push only, NO caching)

**Files:**
- Create: `apps/client/public/sw.js`
- Create: `apps/client/src/helpers/push-subscription.ts`
- Modify: `apps/client/src/main.tsx` (register SW)

**Interfaces:**
- Produces: `registerServiceWorker(): Promise<ServiceWorkerRegistration | null>`, `subscribeToPush(): Promise<boolean>`, `unsubscribeFromPush(): Promise<void>`, `getPushState(): Promise<'unsupported' | 'needs-pwa' | 'denied' | 'subscribed' | 'not-subscribed'>` — consumed by Task 12's settings card.

- [ ] **Step 1: `sw.js`** — push only. **No `fetch` handler, no caches — this is a hard rule** (deployment freshness depends on it):

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Bullshark', {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icon-192.png',
      data: { url: payload.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const oldSub = event.oldSubscription;
      const newSub = await self.registration.pushManager.subscribe(
        oldSub ? { userVisibleOnly: true, applicationServerKey: oldSub.options.applicationServerKey } : { userVisibleOnly: true }
      );
      // Best effort: the app re-syncs the subscription on next open;
      // we cannot call tRPC from the SW without auth context.
      void newSub;
    })()
  );
});
```

- [ ] **Step 2: `push-subscription.ts`**

```ts
import { getTRPCClient } from '@/lib/trpc';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari legacy flag
  (navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
};

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const getPushState = async (): Promise<
  'unsupported' | 'needs-pwa' | 'denied' | 'subscribed' | 'not-subscribed'
> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return isIos() && !isStandalone() ? 'needs-pwa' : 'unsupported';
  }
  if (isIos() && !isStandalone()) return 'needs-pwa';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'not-subscribed';
};

const subscribeToPush = async (): Promise<boolean> => {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const trpc = getTRPCClient();
  const { publicKey } = await trpc.push.getPublicKey.query();
  if (!publicKey) return false;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await trpc.push.subscribe.mutate({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  });
  return true;
};

const unsubscribeFromPush = async (): Promise<void> => {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const trpc = getTRPCClient();
  await trpc.push.unsubscribe.mutate({ endpoint });
};

export {
  getPushState,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush
};
```

- [ ] **Step 3:** In `main.tsx`, after app mount: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});` (registration is safe pre-permission; it enables `pushsubscriptionchange` handling).

- [ ] **Step 3b: Deep-link handling** — the SPA has no URL-driven channel routing; the notification URL `/?channelId=N` must be consumed at bootstrap. In the client's post-connect bootstrap (where the server state is first loaded — follow `setSelectedChannelId` imports from `@/features/server/channels/actions` to find the right spot, e.g. next to the `auto_join_last_channel` handling), add:

```ts
const params = new URLSearchParams(window.location.search);
const pushChannelId = Number(params.get('channelId'));
if (pushChannelId > 0) {
  setSelectedChannelId(pushChannelId);
  window.history.replaceState({}, '', '/');
}
```

This must run AFTER channels are loaded (otherwise the id is unknown) and must win over `auto_join_last_channel`.

- [ ] **Step 4: Gates** — check-types + lint clean; `bun run dev` → DevTools Application → Service Workers shows `sw.js` active, **Cache Storage stays empty**.

- [ ] **Step 5: Commit + push both remotes**

```bash
git add apps/client/public/sw.js apps/client/src
git commit -m "feat: push-only service worker and subscription helpers (no offline cache)"
git push github development && git push origin development
```

### Task 12: Settings UI — "Push on this device" card

**Files:**
- Modify: `apps/client/src/components/server-screens/user-settings/notifications/index.tsx`
- Modify: `apps/client/src/i18n/locales/en/settings.json` and `…/fr/settings.json` (adapt to the real settings-namespace file names in `src/i18n/locales/en/`)

**Interfaces:**
- Consumes: `getPushState/subscribeToPush/unsubscribeFromPush` (Task 11). The existing preference switches above the card already drive WHAT gets pushed (shared keys, Task 8) — the card only controls THIS DEVICE's subscription.

- [ ] **Step 1:** Add below the existing switches, inside the same `CardContent`, a `PushDeviceCard` section (same `Group` styling):

```tsx
const PushDeviceSection = () => {
  const { t } = useTranslation('settings');
  const [state, setState] = useState<
    'loading' | 'unsupported' | 'needs-pwa' | 'denied' | 'subscribed' | 'not-subscribed'
  >('loading');

  const refresh = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onToggle = useCallback(async () => {
    if (state === 'subscribed') await unsubscribeFromPush();
    else if (state === 'not-subscribed') {
      const ok = await subscribeToPush();
      if (!ok) toast.error(t('pushSubscribeFailed'));
    }
    await refresh();
  }, [state, refresh, t]);

  if (state === 'loading') return null;
  if (state === 'unsupported')
    return <p className="text-sm text-muted-foreground">{t('pushUnsupported')}</p>;
  if (state === 'needs-pwa')
    return <p className="text-sm text-muted-foreground">{t('pushNeedsPwa')}</p>;
  if (state === 'denied')
    return <p className="text-sm text-muted-foreground">{t('pushDenied')}</p>;

  return (
    <Group label={t('pushDeviceLabel')} description={t('pushDeviceDesc')}>
      <Switch checked={state === 'subscribed'} onCheckedChange={onToggle} />
    </Group>
  );
};
```

- [ ] **Step 2: i18n keys** (en / fr):

```json
"pushDeviceLabel": "Push notifications on this device" / "Notifications push sur cet appareil"
"pushDeviceDesc": "Receive notifications even when the app is closed. Uses the preferences above." / "Reçois des notifications même app fermée. Utilise les préférences ci-dessus."
"pushUnsupported": "Push notifications are not supported by this browser." / "Les notifications push ne sont pas supportées par ce navigateur."
"pushNeedsPwa": "On iPhone, install the app first: Share → Add to Home Screen, then enable push from the installed app." / "Sur iPhone, installe d'abord l'app : Partager → Sur l'écran d'accueil, puis active le push depuis l'app installée."
"pushDenied": "Notifications are blocked in your browser settings for this site." / "Les notifications sont bloquées dans les réglages du navigateur pour ce site."
"pushSubscribeFailed": "Could not enable push notifications." / "Impossible d'activer les notifications push."
```

- [ ] **Step 3: Gates** — check-types + lint clean; desktop Chrome: toggle ON → permission prompt → accept → `push_subscriptions` row appears (check via server log or sqlite); toggle OFF → row gone.

- [ ] **Step 4: End-to-end smoke (desktop Chrome)** — two accounts, A subscribes then closes the tab, B sends a message with A's `browser_notifications` enabled (or a mention with mentions-only) → OS notification appears; click → app opens on the channel.

- [ ] **Step 5: Commit + push both remotes**

```bash
git add apps/client/src
git commit -m "feat: per-device push subscription card in notification settings"
git push github development && git push origin development
```

### Task 13: Manual verification checklist (iPhone + desktop non-regression)

**Files:** none (verification task; fix-forward anything found before sign-off).

- [ ] **Step 1: Deploy** the branch to a reachable server (user's standard VM deploy from `development`, or LAN dev server `bun dev` + `vite --host`).

- [ ] **Step 2: iPhone checklist (Safari)**
  1. Open the server URL → long-press a message → action sheet opens; quick emoji reacts; scroll during press does NOT open the sheet.
  2. Reaction pills toggle reliably at first tap.
  3. Share → Add to Home Screen → icon is the Bullshark logo (not a screenshot); opening it is standalone full-screen (no Safari bars).
  4. In the installed PWA: Settings → Notifications → push card offers "Activer" (not the needs-PWA message); enable → iOS permission prompt → accept.
  5. Close the PWA fully. From another account, @mention the iPhone user (mentions-only) or send any message (all-messages) → notification arrives on the lock screen; tapping opens the app on the right channel.
  6. In Safari (NOT the PWA), the push card shows the "install first" message.
- [ ] **Step 3: Desktop non-regression**
  1. Hover toolbar unchanged (all actions + quick emojis).
  2. No action sheet ever appears with a mouse.
  3. DevTools → Application → Cache Storage is EMPTY (SW caches nothing); a hard-refresh after a server redeploy picks up the new UI (Cloudflare purge still applies as usual).
- [ ] **Step 4:** Record results; fix-forward any failure (superpowers:systematic-debugging), re-run the failed item, then commit fixes and push both remotes.
