import { describe, expect, it } from 'vitest'
import { ilYa, joursEcoules } from './temps'

const MIN = 60_000
const H = 60 * MIN
const J = 24 * H

describe('il y a…', () => {
  const t = 1_000_000_000_000
  it('minutes, heures, jours, semaines, mois', () => {
    expect(ilYa(t, t + 10_000)).toBe('à l’instant')
    expect(ilYa(t, t + 5 * MIN)).toBe('il y a 5 min')
    expect(ilYa(t, t + 3 * H + 20 * MIN)).toBe('il y a 3 h')
    expect(ilYa(t, t + 3 * J)).toBe('il y a 3 j')
    expect(ilYa(t, t + 13 * J)).toBe('il y a 13 j')
    expect(ilYa(t, t + 21 * J)).toBe('il y a 3 sem.')
    expect(ilYa(t, t + 90 * J)).toBe('il y a 3 mois')
  })
  it('une date dans le futur (horloges décalées) passe pour « à l’instant »', () => {
    expect(ilYa(t + H, t)).toBe('à l’instant')
    expect(joursEcoules(t + H, t)).toBe(0)
  })
  it('compte les jours entiers', () => {
    expect(joursEcoules(t, t + 14 * J - 1)).toBe(13)
    expect(joursEcoules(t, t + 14 * J)).toBe(14)
  })
})
