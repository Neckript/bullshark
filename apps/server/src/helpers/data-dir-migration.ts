import fs from 'fs/promises';

const dirExists = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
};

// One-shot, no-merge move from the legacy data directory to the current
// one. If the current directory already exists, it is authoritative and
// the legacy one - if still present - is left untouched: merging could
// silently overwrite live data, so that decision is left to the operator.
const migrateLegacyDataDirectory = async (
  legacyDir: string,
  currentDir: string
): Promise<void> => {
  if (await dirExists(currentDir)) return;
  if (!(await dirExists(legacyDir))) return;

  await fs.rename(legacyDir, currentDir);

  console.log(
    `[Paths] Migrated data directory "${legacyDir}" to "${currentDir}".`
  );
};

export { migrateLegacyDataDirectory };
