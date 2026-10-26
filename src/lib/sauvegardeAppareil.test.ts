import { afterEach, describe, expect, it, vi } from 'vitest'
import { conseillerInstallation, exporterDonnees, importerDonnees, nomFichier } from './sauvegardeAppareil'

/** localStorage factice : les tests tournent sous Node, sans navigateur. */
function stockage(contenu: Record<string, string> = {}) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => contenu[k] ?? null,
    setItem: (k: string, v: string) => void (contenu[k] = v),
    removeItem: (k: string) => void delete contenu[k],
    key: (i: number) => Object.keys(contenu)[i] ?? null,
    get length() {
      return Object.keys(contenu).length
    },
  })
  return contenu
}

afterEach(() => vi.unstubAllGlobals())

describe('sauvegarde des données de l’appareil', () => {
  it('exporte les réglages, le duplicate et l’IA, pas le compte ni le cache des définitions', () => {
    stockage({
      'scrabble.reglages': '{"theme":"sombre"}',
      'scrabble.solo.parties': '[]',
      'scrabble.solo.coup.A': '{"numero":1}',
      'scrabble.solo.historique': '[]',
      'scrabble.ia.encours': '[]',
      'scrabble.ia.historique': '[]',
      'scrabble.multi.pseudo': '"Pierre"',
      'scrabble.dictionnaire.definitions': '{}',
      'autre.cle': '1',
    })
    const s = JSON.parse(exporterDonnees())
    expect(s).toMatchObject({ application: 'scrabble', version: 1 })
    expect(Object.keys(s.donnees).sort()).toEqual(['ia.encours', 'ia.historique', 'reglages', 'solo.coup.A', 'solo.historique', 'solo.parties'])
  })

  it('restaure sur un autre appareil en remplaçant ce qui s’y trouvait', () => {
    const source = stockage({ 'scrabble.reglages': '{"theme":"clair"}', 'scrabble.solo.historique': '[{"id":"a"}]' })
    const texte = exporterDonnees()
    vi.unstubAllGlobals()
    const cible = stockage({
      'scrabble.reglages': '{"theme":"sombre"}',
      'scrabble.ia.historique': '[{"id":"vieux"}]',
      'scrabble.multi.pseudo': '"Pierre"',
    })
    expect(importerDonnees(texte)).toEqual({ ok: true, nb: 2 })
    expect(cible['scrabble.reglages']).toBe('{"theme":"clair"}')
    expect(cible['scrabble.solo.historique']).toBe('[{"id":"a"}]')
    // Ce que la sauvegarde remplace est vidé ; le compte des parties à deux n'est pas touché.
    expect(cible['scrabble.ia.historique']).toBeUndefined()
    expect(cible['scrabble.multi.pseudo']).toBe('"Pierre"')
    expect(source['scrabble.reglages']).toBe('{"theme":"clair"}')
  })

  it('refuse ce qui n’est pas une sauvegarde, sans rien toucher', () => {
    const contenu = stockage({ 'scrabble.reglages': '{"theme":"sombre"}' })
    const avant = { ...contenu }
    for (const texte of [
      'pas du json',
      '{}',
      '{"application":"scrabble","version":2,"donnees":{}}',
      '{"application":"scrabble","version":1,"donnees":{"multi.pseudo":"\\"x\\""}}',
      '{"application":"scrabble","version":1,"donnees":{"reglages":"{pas du json"}}',
      '{"application":"scrabble","version":1,"donnees":{"reglages":3}}',
    ])
      expect(importerDonnees(texte)).toMatchObject({ ok: false })
    expect(contenu).toEqual(avant)
  })

  it('nomme le fichier avec la date', () => {
    expect(nomFichier(new Date('2026-10-26T12:00:00Z'))).toBe('scrabble-sauvegarde-2026-10-26.json')
  })
})

describe('conseil d’installation', () => {
  const safari = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', installee: false, natif: false }
  it('sur iPhone dans Safari, oui ; une fois installée, non', () => {
    expect(conseillerInstallation(safari)).toBe(true)
    expect(conseillerInstallation({ ...safari, installee: true })).toBe(false)
  })
  it('un iPad qui se présente comme un Mac, oui ; un vrai Mac, non', () => {
    const mac = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', installee: false, natif: false }
    expect(conseillerInstallation({ ...mac, maxTouchPoints: 5 })).toBe(true)
    expect(conseillerInstallation({ ...mac, maxTouchPoints: 0 })).toBe(false)
  })
  it('Android, ordinateur et appli native, non', () => {
    expect(conseillerInstallation({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', installee: false, natif: false })).toBe(false)
    expect(conseillerInstallation({ ...safari, natif: true })).toBe(false)
  })
})
