import fs from 'fs/promises';

const dirExists = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
};

const isEmptyDir = async (dir: string): Promise<boolean> => {
  try {
    const entries = await fs.readdir(dir);
    return entries.length === 0;
  } catch {
    return true;
  }
};

const isWritable = async (dir: string): Promise<boolean> => {
  try {
    await fs.access(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

// One-shot, no-merge move from the legacy data directory to the current
// one. If the current directory already exists, it is authoritative and
// the legacy one - if still present - is left untouched: merging could
// silently overwrite live data, so that decision is left to the operator.
//
// A directory that is itself a mount point (a Docker volume mounted
// directly on the legacy path, rather than on its parent) can't be
// renamed - the kernel refuses to move a mount point. That failure is
// swallowed here and left for assertDataDirNotShadowedByVolume to turn
// into an actionable error, instead of crashing on a raw EBUSY/EXDEV.
const migrateLegacyDataDirectory = async (
  legacyDir: string,
  currentDir: string
): Promise<void> => {
  if (await dirExists(currentDir)) return;
  if (!(await dirExists(legacyDir))) return;

  try {
    await fs.rename(legacyDir, currentDir);

    console.log(
      `[Paths] Migrated data directory "${legacyDir}" to "${currentDir}".`
    );
  } catch {
    /* left to assertDataDirNotShadowedByVolume, below */
  }
};

// Guards against the one Docker deployment shape the migration above can't
// handle safely: a volume mounted directly on the legacy directory instead
// of on its parent. In that layout the kernel refuses to rename the mount
// point at all (EBUSY/EXDEV) regardless of write permissions on its
// contents - a bind mount backed by data the operator can freely write to
// still can't be renamed away, so a writable legacy directory is not proof
// the migration succeeded. Confirmed in production: a writable bind mount
// left `migrateLegacyDataDirectory` swallowing a failed rename every
// restart, each one silently starting the server on a fresh, unmounted
// "current" directory while the real data sat untouched under the legacy
// path - years of history reset to zero on every deploy, with nothing
// logged.
//
// current empty + legacy non-empty, after a migration attempt, is that
// shape's exact signature regardless of writability: refuse to start
// rather than run on a directory that looks fresh but silently discards
// everything written to it.
const assertDataDirNotShadowedByVolume = async (
  legacyDir: string,
  currentDir: string,
  // Overridable for tests: Windows has no reliable way to make a real
  // directory non-writable via fs.chmod, unlike POSIX. Only affects the
  // wording of the error now, never whether it's thrown.
  checkWritable: (dir: string) => Promise<boolean> = isWritable
): Promise<void> => {
  if (!(await isEmptyDir(currentDir))) return;
  if (await isEmptyDir(legacyDir)) return;

  const writable = await checkWritable(legacyDir);
  const writabilityNote = writable
    ? ' (it is writable, so this is a mount point the kernel refused to rename, not a permissions issue)'
    : " and can't be written to";

  throw new Error(
    `[Paths] Refusing to start: "${currentDir}" is empty but "${legacyDir}" ` +
      `still holds data${writabilityNote}. This is the signature of ` +
      `a Docker volume mounted directly on the old data directory. Check ` +
      `your docker-compose.yml: if it mounts a volume on "${legacyDir}", ` +
      `point it at "${currentDir}" instead, then restart.`
  );
};

export { assertDataDirNotShadowedByVolume, migrateLegacyDataDirectory };
