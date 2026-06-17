import fs from 'fs/promises';

const sha256File = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const verifyChecksum = async (
  filePath: string,
  expected: string
): Promise<boolean> => (await sha256File(filePath)) === expected;

export { sha256File, verifyChecksum };
