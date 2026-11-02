import { describe, expect, it } from 'vitest'
import { resolveLanguage } from '../src/i18n'

describe('language resolution', () => {
  it('uses the locale prop before the page and the browser', () => {
    expect(resolveLanguage('es-MX', 'fr-CA', 'en-US')).toBe('es')
    expect(resolveLanguage('fr-CA', 'en', 'es')).toBe('fr')
    expect(resolveLanguage('EN-gb', 'fr', 'es')).toBe('en')
  })

  it('uses the document language when the locale is missing or unsupported', () => {
    expect(resolveLanguage(undefined, 'fr', 'en')).toBe('fr')
    expect(resolveLanguage('  ', 'es-ES', 'en-US')).toBe('es')
    expect(resolveLanguage('de-DE', 'fr-FR', 'en')).toBe('fr')
  })

  it('uses the navigator language and otherwise English', () => {
    expect(resolveLanguage(undefined, null, 'en-GB')).toBe('en')
    expect(resolveLanguage('de', '', 'es')).toBe('es')
    expect(resolveLanguage(undefined, undefined, undefined)).toBe('en')
    expect(resolveLanguage('de', 'pt', 'zh-CN')).toBe('en')
  })
})
