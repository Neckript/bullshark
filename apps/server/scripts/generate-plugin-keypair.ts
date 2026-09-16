// Genere une paire de cles Ed25519 pour la signature des plugins.
//
//   bun run apps/server/scripts/generate-plugin-keypair.ts
//
// - Colle la cle PUBLIQUE (SPKI DER base64) dans PROJECT_PLUGIN_SIGNING_KEY
//   (apps/server/src/helpers/verify-plugin-signature.ts).
// - Garde la cle PRIVEE (PKCS8 PEM) en secret (secret CI), jamais dans le repo.
//   Le pipeline de publication du registry signe chaque archive avec elle :
//     const sig = crypto.sign(null, archiveBytes, privateKey);
//     const signatureBase64 = sig.toString('base64');
import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const publicKeyBase64 = publicKey
  .export({ format: 'der', type: 'spki' })
  .toString('base64');

const privateKeyPem = privateKey
  .export({ format: 'pem', type: 'pkcs8' })
  .toString();

console.log('PUBLIC KEY (SPKI DER base64) — pin in PROJECT_PLUGIN_SIGNING_KEY:');
console.log(publicKeyBase64);
console.log('');
console.log('PRIVATE KEY (PKCS8 PEM) — keep secret, use as a CI secret:');
console.log(privateKeyPem);
