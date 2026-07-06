import { describe, expect, it } from 'bun:test';
import { stripHtml } from '../helpers';

describe('stripHtml', () => {
  it('strips tags', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });

  it('collapses whitespace', () => {
    expect(stripHtml('hello   \n\n  world')).toBe('hello world');
  });

  it('handles null', () => {
    expect(stripHtml(null)).toBe('');
  });

  it('truncates to 140 chars when sliced by caller', () => {
    const long = 'a'.repeat(200);
    expect(stripHtml(long).slice(0, 140)).toHaveLength(140);
  });
});
