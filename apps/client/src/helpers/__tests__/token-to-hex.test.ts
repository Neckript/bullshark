import { describe, expect, test } from 'bun:test';
import { rgbToHex } from '../token-to-hex';

describe('rgbToHex', () => {
  test('compose un hexadécimal à partir de trois canaux', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  test('complète chaque canal sur deux chiffres', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
  });

  test('borne les canaux hors plage', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
  });

  test('arrondit les canaux fractionnaires', () => {
    expect(rgbToHex(127.6, 0.4, 200.5)).toBe('#8000c9');
  });
});
