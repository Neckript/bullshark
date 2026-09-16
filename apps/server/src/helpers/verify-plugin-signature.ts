import crypto from 'crypto';

// Cle publique Ed25519 du projet (SPKI DER encode en base64), epinglee dans le
// code, HORS du registry : un registry compromis ne peut pas forger une
// signature sans la cle privee correspondante (secret CI).
//
// VIDE pour l'instant : a remplir avec la vraie cle publique une fois la paire
// generee (scripts/generate-plugin-keypair.ts). Tant qu'elle est vide, aucune
// signature ne peut etre "verified" -> tout reste en warn tant que
// requireSignedPlugins vaut false, rien ne casse.
const PROJECT_PLUGIN_SIGNING_KEY = '';

type PluginSignatureStatus = 'verified' | 'unsigned' | 'unverified';

const parseEnvKeys = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

// Clef projet epinglee + clefs additionnelles d'un operateur de registry perso
// (BULLSHARK_PLUGIN_SIGNING_KEYS, separees par des virgules).
const getTrustedPluginKeys = (): string[] =>
  [
    PROJECT_PLUGIN_SIGNING_KEY,
    ...parseEnvKeys(process.env.BULLSHARK_PLUGIN_SIGNING_KEYS)
  ].filter(Boolean);

const toPublicKey = (base64Key: string): crypto.KeyObject | null => {
  try {
    return crypto.createPublicKey({
      key: Buffer.from(base64Key, 'base64'),
      format: 'der',
      type: 'spki'
    });
  } catch {
    return null;
  }
};

// true si AU MOINS une cle de confiance valide la signature.
const isSignatureValid = (
  data: Uint8Array,
  signatureBase64: string,
  trustedKeys: string[]
): boolean => {
  const signature = Buffer.from(signatureBase64, 'base64');

  for (const base64Key of trustedKeys) {
    const key = toPublicKey(base64Key);

    if (!key) {
      continue;
    }

    try {
      if (crypto.verify(null, data, key, signature)) {
        return true;
      }
    } catch {
      // cle incompatible avec la signature, on tente la suivante
    }
  }

  return false;
};

const verifyPluginSignature = (
  data: Uint8Array,
  signatureBase64: string | undefined,
  trustedKeys: string[] = getTrustedPluginKeys()
): PluginSignatureStatus => {
  if (!signatureBase64) {
    return 'unsigned';
  }

  return isSignatureValid(data, signatureBase64, trustedKeys)
    ? 'verified'
    : 'unverified';
};

export {
  getTrustedPluginKeys,
  verifyPluginSignature,
  type PluginSignatureStatus
};
