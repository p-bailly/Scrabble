import { afterEach, describe, expect, it, vi } from 'vitest'
import { estSombre, lireReglages } from './reglages'

/** localStorage factice : les tests tournent sous Node, sans navigateur. */
function stockage(contenu: Record<string, string>) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => contenu[k] ?? null,
    setItem: (k: string, v: string) => void (contenu[k] = v),
    removeItem: (k: string) => void delete contenu[k],
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('réglages', () => {
  it('valeurs par défaut quand rien n’est enregistré', () => {
    stockage({})
    expect(lireReglages()).toEqual({ theme: 'auto', etiquettes: true, notifications: true, confirmerPasse: true })
  })

  it('relit ce qui est enregistré et complète le reste', () => {
    stockage({ 'scrabble.reglages': JSON.stringify({ theme: 'sombre', etiquettes: false }) })
    expect(lireReglages()).toEqual({ theme: 'sombre', etiquettes: false, notifications: true, confirmerPasse: true })
  })

  it('ignore les valeurs abîmées', () => {
    stockage({ 'scrabble.reglages': JSON.stringify({ theme: 'violet', etiquettes: 'oui', notifications: 0, confirmerPasse: false }) })
    expect(lireReglages()).toEqual({ theme: 'auto', etiquettes: true, notifications: true, confirmerPasse: false })
  })

  it('ignore un contenu qui n’est pas du JSON', () => {
    stockage({ 'scrabble.reglages': '{pas du json' })
    expect(lireReglages().theme).toBe('auto')
  })
})

describe('thème sombre', () => {
  it('« automatique » suit le système', () => {
    expect(estSombre('auto', true)).toBe(true)
    expect(estSombre('auto', false)).toBe(false)
  })
  it('un thème choisi l’emporte sur le système', () => {
    expect(estSombre('clair', true)).toBe(false)
    expect(estSombre('sombre', false)).toBe(true)
  })
})
