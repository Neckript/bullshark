import { t } from '../utils/trpc';
import { categoriesRouter } from './categories';
import { channelsRouter } from './channels';
import { dmsRouter } from './dms';
import { emojisRouter } from './emojis';
import { filesRouter } from './files';
import { gifsRouter } from './gifs';
import { invitesRouter } from './invites';
import { messagesRouter } from './messages';
import { othersRouter } from './others';
import { pluginsRouter } from './plugins';
import { rolesRouter } from './roles';
import { settingsRouter } from './settings';
import { usersRouter } from './users';
import { voiceRouter } from './voice';

const appRouter = t.router({
  others: othersRouter,
  messages: messagesRouter,
  users: usersRouter,
  channels: channelsRouter,
  dms: dmsRouter,
  files: filesRouter,
  emojis: emojisRouter,
  roles: rolesRouter,
  invites: invitesRouter,
  voice: voiceRouter,
  categories: categoriesRouter,
  plugins: pluginsRouter,
  gifs: gifsRouter,
  settings: settingsRouter
});

type AppRouter = typeof appRouter;

export { appRouter };
export type { AppRouter };
