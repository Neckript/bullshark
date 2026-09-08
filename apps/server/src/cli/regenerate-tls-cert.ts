import chalk from 'chalk';
import { regenerateTlsCertificate } from '../helpers/tls';

interface RegenerateTlsCertDeps {
  regenerate: () => Promise<unknown>;
}

const defaultDeps: RegenerateTlsCertDeps = {
  regenerate: regenerateTlsCertificate
};

const runRegenerateTlsCert = async (
  deps: RegenerateTlsCertDeps = defaultDeps
): Promise<void> => {
  await deps.regenerate();
};

// Orchestrates the one-shot CLI: regenerate, print, exit. Works regardless of
// the current tls.mode — harmless to have unused cert/key files on disk.
const regenerateTlsCertCli = async (): Promise<never> => {
  await runRegenerateTlsCert();

  const notice = [
    chalk.greenBright.bold('TLS certificate regenerated.'),
    chalk.dim('────────────────────────────────────────────────────'),
    chalk.whiteBright(
      'Any browser that had a "proceed anyway" exception for the previous certificate will need to accept the warning again.'
    )
  ].join('\n');

  console.log('\n%s\n', notice);
  process.exit(0);
};

export { regenerateTlsCertCli, runRegenerateTlsCert };
export type { RegenerateTlsCertDeps };
