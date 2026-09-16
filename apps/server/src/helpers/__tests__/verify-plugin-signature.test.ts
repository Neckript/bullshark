import crypto from 'crypto';
import { describe, expect, test } from 'bun:test';
import { verifyPluginSignature } from '../verify-plugin-signature';

const makeKeypair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  return {
    publicKeyBase64: publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64'),
    privateKey
  };
};

const sign = (data: Uint8Array, privateKey: crypto.KeyObject) =>
  crypto.sign(null, data, privateKey).toString('base64');

describe('verifyPluginSignature', () => {
  const data = new TextEncoder().encode('plugin archive bytes');

  test('a signature from a trusted key is verified', () => {
    const { publicKeyBase64, privateKey } = makeKeypair();
    const signature = sign(data, privateKey);

    expect(verifyPluginSignature(data, signature, [publicKeyBase64])).toBe(
      'verified'
    );
  });

  test('missing signature is unsigned', () => {
    const { publicKeyBase64 } = makeKeypair();

    expect(verifyPluginSignature(data, undefined, [publicKeyBase64])).toBe(
      'unsigned'
    );
  });

  test('tampered data does not verify', () => {
    const { publicKeyBase64, privateKey } = makeKeypair();
    const signature = sign(data, privateKey);
    const tampered = new TextEncoder().encode('plugin archive bytez');

    expect(verifyPluginSignature(tampered, signature, [publicKeyBase64])).toBe(
      'unverified'
    );
  });

  test('a signature from an untrusted key does not verify', () => {
    const { privateKey } = makeKeypair();
    const { publicKeyBase64: otherKey } = makeKeypair();
    const signature = sign(data, privateKey);

    expect(verifyPluginSignature(data, signature, [otherKey])).toBe(
      'unverified'
    );
  });

  test('no trusted keys means a signed plugin is unverified', () => {
    const { privateKey } = makeKeypair();
    const signature = sign(data, privateKey);

    expect(verifyPluginSignature(data, signature, [])).toBe('unverified');
  });
});
