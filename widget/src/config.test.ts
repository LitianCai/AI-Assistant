import { describe, expect, it } from 'vitest';
import { normalizeConfig, sanitizeBrandName } from './config';

describe('invalid preset fallback', () => {
  it('uses ask when the preset is missing or unknown', () => {
    expect(normalizeConfig({ token: 'demo' }).preset).toBe('ask');
    expect(normalizeConfig({ token: 'demo', preset: 'banner' }).preset).toBe('ask');
    expect(normalizeConfig({ token: 'demo', preset: 'chat' }).preset).toBe('chat');
  });

  it('uses the default display and corner when those values are unknown', () => {
    expect(normalizeConfig({ token: 'demo', display: 'both' }).display).toBe('words');
    expect(normalizeConfig({ token: 'demo', display: 'icon' }).display).toBe('icon');
    expect(normalizeConfig({ token: 'demo', corner: 'center' }).corner).toBe('bottom-right');
    expect(normalizeConfig({ token: 'demo', corner: 'top-left' }).corner).toBe('top-left');
  });

  it('strips tags from the brand name and caps it at 40 characters', () => {
    expect(sanitizeBrandName('<b>Northline</b> Supply')).toBe('Northline Supply');
    expect(sanitizeBrandName(`<b>${'a'.repeat(40)}</b>`)).toBe('a'.repeat(40));
    expect(normalizeConfig({ token: 'demo', brandName: 'x'.repeat(45) }).brandName).toHaveLength(40);
  });
});
