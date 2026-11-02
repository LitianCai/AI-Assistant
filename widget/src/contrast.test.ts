import { describe, expect, it } from 'vitest';
import { contrastRatio, resolvePrimaryColor } from './contrast';

describe('contrast fallback', () => {
  it('keeps the default blue when white text meets 4.5:1', () => {
    expect(contrastRatio('#ffffff', '#1d4ed8')).toBeGreaterThanOrEqual(4.5);
    expect(resolvePrimaryColor('#1d4ed8')).toBe('#1d4ed8');
    expect(resolvePrimaryColor('#1D4ED8')).toBe('#1d4ed8');
  });

  it('keeps a valid hex when white text has enough contrast', () => {
    expect(resolvePrimaryColor('#000000')).toBe('#000000');
  });

  it('falls back when the color is missing, malformed, or too light', () => {
    expect(resolvePrimaryColor(undefined)).toBe('#1d4ed8');
    expect(resolvePrimaryColor('blue')).toBe('#1d4ed8');
    expect(resolvePrimaryColor('#abc')).toBe('#1d4ed8');
    expect(resolvePrimaryColor('#ffffff')).toBe('#1d4ed8');
    expect(resolvePrimaryColor('#ffff00')).toBe('#1d4ed8');
  });
});
