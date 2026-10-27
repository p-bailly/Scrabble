import { afterEach, describe, expect, it, vi } from 'vitest'
import { estSombre, genresVoulus, lireReglages, notificationVoulue } from './reglages'

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
    expect(lireReglages()).toEqual({
      theme: 'auto',
      texte: 'normal',
      simple: false,
      etiquettes: true,
      notifications: true,
      notifTour: true,
      notifInvitations: true,
      notifFin: true,
      confirmerPasse: true,
    })
  })

  it('relit ce qui est enregistré et complète le reste', () => {
    stockage({ 'scrabble.reglages': JSON.stringify({ theme: 'sombre', etiquettes: false }) })
    expect(lireReglages()).toMatchObject({ theme: 'sombre', etiquettes: false, notifications: true, confirmerPasse: true })
  })

  it('ignore les valeurs abîmées', () => {
    stockage({
      'scrabble.reglages': JSON.stringify({ theme: 'violet', texte: 'enorme', simple: 'oui', etiquettes: 'oui', notifications: 0, confirmerPasse: false }),
    })
    expect(lireReglages()).toMatchObject({ theme: 'auto', texte: 'normal', simple: false, etiquettes: true, notifications: true, confirmerPasse: false })
  })

  it('ignore un contenu qui n’est pas du JSON', () => {
    stockage({ 'scrabble.reglages': '{pas du json' })
    expect(lireReglages().theme).toBe('auto')
  })
})

describe('notifications voulues', () => {
  it('tout est voulu par défaut', () => {
    stockage({})
    expect(notificationVoulue()).toBe(true)
    expect(notificationVoulue('tour')).toBe(true)
    expect(notificationVoulue('invitation')).toBe(true)
    expect(notificationVoulue('fin')).toBe(true)
  })

  it('chaque genre se coupe séparément', () => {
    stockage({ 'scrabble.reglages': JSON.stringify({ notifInvitations: false }) })
    expect(notificationVoulue('invitation')).toBe(false)
    expect(notificationVoulue('tour')).toBe(true)
    expect(notificationVoulue('fin')).toBe(true)
  })

  it('l’interrupteur général coupe tout, essai compris', () => {
    stockage({ 'scrabble.reglages': JSON.stringify({ notifications: false }) })
    expect(notificationVoulue()).toBe(false)
    expect(notificationVoulue('tour')).toBe(false)
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

describe('genres de notification voulus', () => {
  it('tous par défaut, ceux qu’on a coupés en moins, aucun si tout est coupé', () => {
    stockage({})
    expect(genresVoulus().sort()).toEqual(['fin', 'invitation', 'tour'])
    stockage({ 'scrabble.reglages': JSON.stringify({ notifInvitations: false }) })
    expect(genresVoulus().sort()).toEqual(['fin', 'tour'])
    stockage({ 'scrabble.reglages': JSON.stringify({ notifications: false }) })
    expect(genresVoulus()).toEqual([])
  })
})
