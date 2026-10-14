import { describe, expect, test } from 'bun:test';
import { getSvcQualityLayers, isChromiumSender } from '../helpers';
import { SVC_SCALABILITY_MODE } from '../statics';

// getSvcQualityLayers ne lit que getSettings().height sur la piste
const trackOfHeight = (height?: number) =>
  ({ getSettings: () => ({ height }) }) as unknown as MediaStreamTrack;

describe('isChromiumSender', () => {
  test('reconnait les handlers mediasoup Chromium', () => {
    expect(isChromiumSender('Chrome74')).toBe(true);
    expect(isChromiumSender('Chrome70')).toBe(true);
  });

  test('rejette les autres moteurs et l absence de handler', () => {
    expect(isChromiumSender('Firefox60')).toBe(false);
    expect(isChromiumSender('Safari12')).toBe(false);
    expect(isChromiumSender(undefined)).toBe(false);
  });
});

describe('getSvcQualityLayers', () => {
  test('etiquette une couche par couche spatiale, de la plus basse a la source', () => {
    expect(
      getSvcQualityLayers(trackOfHeight(720), SVC_SCALABILITY_MODE)
    ).toEqual([
      { spatialLayer: 0, label: '180p' },
      { spatialLayer: 1, label: '360p' },
      { spatialLayer: 2, label: '720p' }
    ]);
  });

  test('produit autant de couches que le mode en declare', () => {
    expect(getSvcQualityLayers(trackOfHeight(480), 'L2T3').length).toBe(2);
    expect(getSvcQualityLayers(trackOfHeight(480), 'L1T3').length).toBe(1);
  });

  test('echoue quand la hauteur de la piste est inconnue', () => {
    expect(() =>
      getSvcQualityLayers(trackOfHeight(undefined), SVC_SCALABILITY_MODE)
    ).toThrow('Unable to determine video height for SVC labels');
  });
});
