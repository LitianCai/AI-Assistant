import { describe, expect, it } from 'vitest'
import { contrastRatio, resolvePrimaryColor } from '../src/contrast'

describe('contrast fallback', () => {
  it('keeps a hex color when white text meets 4.5:1', () => {
    expect(contrastRatio('#ffffff', '#1d4ed8')).toBeGreaterThanOrEqual(4.5)
    expect(resolvePrimaryColor('#1d4ed8')).toBe('#1d4ed8')
    expect(resolvePrimaryColor('#0F172A')).toBe('#0f172a')
  })

  it('falls back when white text would be below 4.5:1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeLessThan(4.5)
    expect(resolvePrimaryColor('#ffffff')).toBe('#1d4ed8')
    expect(resolvePrimaryColor('#fff')).toBe('#1d4ed8')
    expect(resolvePrimaryColor('#fde047')).toBe('#1d4ed8')
  })

  it('falls back when the value is not a 3 or 6 digit hex color', () => {
    expect(resolvePrimaryColor('blue')).toBe('#1d4ed8')
    expect(resolvePrimaryColor('#12')).toBe('#1d4ed8')
    expect(resolvePrimaryColor('#gg0000')).toBe('#1d4ed8')
    expect(resolvePrimaryColor(undefined)).toBe('#1d4ed8')
  })
})
