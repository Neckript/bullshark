import chalk from 'chalk';
import { db } from '../db';
import { settings } from '../db/schema';
import { generateOwnerToken, hashOwnerToken } from '../helpers/owner-token';

interface NewOwnerTokenDeps {
  isSeeded: () => Promise<boolean>;
  setOwnerClaimTokenHash: (hash: string) => Promise<void>;
}

interface NewOwnerTokenResult {
  ok: boolean;
  token?: string;
}

// Default deps wired to the real database.
const defaultDeps: NewOwnerTokenDeps = {
  isSeeded: async () => {
    const rows = await db.select().from(settings);
    return rows.length > 0;
  },
  setOwnerClaimTokenHash: async (hash: string) => {
    await db.update(settings).set({ ownerClaimTokenHash: hash });
  }
};

const runNewOwnerToken = async (
  deps: NewOwnerTokenDeps = defaultDeps
): Promise<NewOwnerTokenResult> => {
  if (!(await deps.isSeeded())) {
    return { ok: false };
  }

  const token = generateOwnerToken();
  await deps.setOwnerClaimTokenHash(await hashOwnerToken(token));

  return { ok: true, token };
};

// Orchestrates the one-shot CLI: run, print, exit. Never logs the token via winston.
const newOwnerTokenCli = async (): Promise<never> => {
  const result = await runNewOwnerToken();

  if (!result.ok) {
    console.error(
      chalk.redBright(
        'Database is not initialized yet. Start the server once first, then re-run --new-owner-token.'
      )
    );
    process.exit(1);
  }

  const notice = [
    chalk.redBright.bold('🚨🚨 NEW OWNER TOKEN 🚨🚨'),
    chalk.dim('────────────────────────────────────────────────────'),
    chalk.whiteBright(
      'A new owner token was generated. The previous one is now invalid.'
    ),
    chalk.whiteBright(
      'Save it somewhere safe — it will not be shown again. Anyone with this token can take over the server.'
    ),
    chalk.yellowBright('────────────────────────────────────────────────────'),
    chalk.bold.greenBright(result.token!),
    chalk.yellowBright('────────────────────────────────────────────────────')
  ].join('\n');

  console.log('\n%s\n', notice);
  process.exit(0);
};

export { newOwnerTokenCli, runNewOwnerToken };
export type { NewOwnerTokenDeps, NewOwnerTokenResult };
