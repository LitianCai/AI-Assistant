import { describe, expect, it } from 'vitest';
import { resolveLanguage } from './i18n';

describe('language resolution', () => {
  it('uses the locale prop before the page and the browser', () => {
    expect(resolveLanguage('fr-CA', 'en', 'es')).toBe('fr');
    expect(resolveLanguage('es-MX', 'fr', 'en')).toBe('es');
    expect(resolveLanguage('EN', 'fr', 'es')).toBe('en');
  });

  it('uses the document language when the locale prop does not match', () => {
    expect(resolveLanguage(undefined, 'es', 'en-US')).toBe('es');
    expect(resolveLanguage('de-DE', 'fr-FR', 'en')).toBe('fr');
    expect(resolveLanguage('', 'pt', 'en-GB')).toBe('en');
  });

  it('uses the browser language and then English', () => {
    expect(resolveLanguage(undefined, '', 'fr')).toBe('fr');
    expect(resolveLanguage(undefined, undefined, 'es-419')).toBe('es');
    expect(resolveLanguage(undefined, undefined, undefined)).toBe('en');
    expect(resolveLanguage('de', 'pt', 'ja')).toBe('en');
  });
});
