import { Database } from 'bun:sqlite';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { seedTestDb } from '../__tests__/seed';
import { DB_PATH, DRIZZLE_PATH } from '../helpers/paths';
import { IS_E2E } from '../utils/env';
import { seedDatabase } from './seed';

let db: BunSQLiteDatabase;

const loadDb = async () => {
  const sqlite = new Database(DB_PATH, { create: true, strict: true });

  sqlite.run('PRAGMA foreign_keys = ON;');
  // WAL lets readers and writers run concurrently; the default rollback journal
  // makes a writer block every reader, which is the wrong trade for a chat
  // server. synchronous = NORMAL is the safe pairing with WAL, and without
  // busy_timeout a concurrent write throws SQLITE_BUSY instead of waiting.
  sqlite.run('PRAGMA journal_mode = WAL;');
  sqlite.run('PRAGMA synchronous = NORMAL;');
  sqlite.run('PRAGMA busy_timeout = 5000;');

  db = drizzle({ client: sqlite });

  await migrate(db, { migrationsFolder: DRIZZLE_PATH });

  if (!IS_E2E) {
    await seedDatabase();
  } else {
    await seedTestDb(db);
  }
};

export { db, loadDb };
