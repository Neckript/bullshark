import { describe, expect, test } from 'bun:test';
import { compareMatches, matchName } from '../matching';

describe('matchName', () => {
  test('renvoie null quand une lettre manque', () => {
    expect(matchName('annonces', 'zz')).toBeNull();
  });

  test('trouve une sous-séquence dispersée', () => {
    const match = matchName('général', 'gnl');

    expect(match).not.toBeNull();
    expect(match!.score).toBe(1);
  });

  test('ignore les diacritiques des deux côtés', () => {
    const match = matchName('général', 'general');

    expect(match).not.toBeNull();
    expect(match!.score).toBe(4);
  });

  test('note un préfixe au-dessus d une occurrence interne', () => {
    const prefix = matchName('general', 'gen');
    const inside = matchName('bugs-et-idees', 'idee');

    expect(prefix!.score).toBe(3);
    expect(inside!.score).toBe(2);
  });

  test('une requête vide correspond à tout, sans surlignage', () => {
    const match = matchName('général', '');

    expect(match).not.toBeNull();
    expect(match!.score).toBe(0);
    expect(match!.segments).toEqual([{ text: 'général', matched: false }]);
  });

  test('découpe le nom en segments surlignés et neutres', () => {
    const match = matchName('général', 'gen');

    expect(match!.segments).toEqual([
      { text: 'gén', matched: true },
      { text: 'éral', matched: false }
    ]);
  });

  test('les segments conservent les accents du nom d origine', () => {
    const match = matchName('général', 'gé');

    expect(match!.segments[0]).toEqual({ text: 'gé', matched: true });
  });

  test('l écart ne compte que les lettres de la requête', () => {
    const contiguous = matchName('general', 'gen');
    const scattered = matchName('general', 'gnl');

    expect(contiguous!.spread).toBe(0);
    expect(scattered!.spread).toBeGreaterThan(0);
  });
});

describe('compareMatches', () => {
  test('le meilleur score passe devant', () => {
    const a = matchName('general', 'gen')!;
    const b = matchName('bugs-et-idees', 'ges')!;

    expect(compareMatches(a, b)).toBeLessThan(0);
  });

  test('à score égal, le plus resserré passe devant', () => {
    const tight = matchName('general', 'gnr')!;
    const loose = matchName('gestionnaire', 'gnr')!;

    expect(compareMatches(tight, loose)).toBeLessThan(0);
  });
});
