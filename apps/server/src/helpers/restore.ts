import fs from 'fs/promises';
import path from 'path';
import { DATA_PATH, DB_PATH, DRIZZLE_PATH, PUBLIC_PATH } from './paths';

const RESTORE_STAGING_PATH = path.join(DATA_PATH, 'restore-staging');
const RESTORE_PENDING_PATH = path.join(DATA_PATH, 'restore.pending');
const DB_PRE_RESTORE_PATH = `${DB_PATH}.pre-restore`;
const PUBLIC_PRE_RESTORE_PATH = `${PUBLIC_PATH}.pre-restore`;

type DrizzleJournalEntry = { idx: number; tag: string };
type DrizzleJournal = { entries: DrizzleJournalEntry[] };

const readJournal = async (): Promise<DrizzleJournal> => {
  const journalPath = path.join(DRIZZLE_PATH, 'meta', '_journal.json');
  const raw = await fs.readFile(journalPath, 'utf8');
  return JSON.parse(raw) as DrizzleJournal;
};

// The tag of the most recently-applied migration this server build knows about.
const getLatestMigrationTag = async (): Promise<string> => {
  const journal = await readJournal();
  const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
  const last = sorted[sorted.length - 1];
  if (!last) {
    throw new Error('Drizzle journal has no entries');
  }
  return last.tag;
};

// True when `tag` is known to this build (equal or older). An unknown tag means the backup is from a newer build -> not restorable here.
const isMigrationTagRestorable = async (tag: string): Promise<boolean> => {
  const journal = await readJournal();
  return journal.entries.some((entry) => entry.tag === tag);
};

const writeRestoreMarker = async (): Promise<void> => {
  await fs.writeFile(RESTORE_PENDING_PATH, new Date().toISOString());
};

const moveAside = async (src: string, dest: string): Promise<void> => {
  await fs.rm(dest, { recursive: true, force: true });
  if (await fs.exists(src)) {
    await fs.rename(src, dest);
  }
};

// Runs at the very top of boot, before loadDb. Applies a staged restore (if one is pending)
// and keeps one recoverable pre-restore generation of the current state.
// Intentionally non-atomic: if it fails mid-swap, the server may need manual CLI recovery
// from the `.pre-restore` copies. Acceptable for a boot-time one-shot operation.
const applyPendingRestore = async (): Promise<void> => {
  if (!(await fs.exists(RESTORE_PENDING_PATH))) {
    return;
  }

  const stagedDb = path.join(RESTORE_STAGING_PATH, 'db.sqlite');
  const stagedPublic = path.join(RESTORE_STAGING_PATH, 'public');

  // Safety net: keep current state recoverable from the CLI.
  await moveAside(DB_PATH, DB_PRE_RESTORE_PATH);
  await moveAside(PUBLIC_PATH, PUBLIC_PRE_RESTORE_PATH);

  await fs.rename(stagedDb, DB_PATH);

  if (await fs.exists(stagedPublic)) {
    await fs.rename(stagedPublic, PUBLIC_PATH);
  } else {
    await fs.mkdir(PUBLIC_PATH, { recursive: true });
  }

  await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
  await fs.rm(RESTORE_PENDING_PATH, { force: true });
};

export {
  applyPendingRestore,
  DB_PRE_RESTORE_PATH,
  getLatestMigrationTag,
  isMigrationTagRestorable,
  PUBLIC_PRE_RESTORE_PATH,
  RESTORE_PENDING_PATH,
  RESTORE_STAGING_PATH,
  writeRestoreMarker
};
