import { describe, expect, it } from 'vitest'
import { construireDawg, fichierDawg, normaliserMot, preparerListe } from './construireDawg'
import { Dawg } from './dawg'
import { dicoAppli } from './outils-test'

describe('normalisation des mots', () => {
  it('majuscules, sans accents, sans trait d’union', () => {
    expect(normaliserMot('éléphant')).toBe('ELEPHANT')
    expect(normaliserMot(' Cœur ')).toBe('COEUR')
    expect(normaliserMot('ex-aequo')).toBeNull()
    expect(normaliserMot("aujourd'hui")).toBeNull()
    expect(normaliserMot('a')).toBeNull()
    expect(normaliserMot('anticonstitutionnellement')).toBeNull() // plus de 15 lettres
    expect(preparerListe(['Été', 'ETE', 'zèbre', 'zebre', ''])).toEqual(['ETE', 'ZEBRE'])
  })
})

describe('DAWG', () => {
  const mots = preparerListe(['CHAT', 'CHATS', 'CHIEN', 'CHIENS', 'RAT', 'RATS', 'RA', 'ZOO', 'AA'])
  const dawg = new Dawg(construireDawg(mots))

  it('contient exactement les mots de la liste', () => {
    for (const m of mots) expect(dawg.contient(m)).toBe(true)
    for (const m of ['CHA', 'CHATON', 'R', 'ZO', 'ZOOS', '', 'A']) expect(dawg.contient(m)).toBe(false)
    expect([...dawg.mots()]).toEqual(mots)
  })

  it('partage les suffixes communs', () => {
    // CHATS / RATS / CHIENS partagent la fin « S » : bien moins d'arcs qu'un arbre des préfixes.
    expect(dawg.arcs.length).toBeLessThan(mots.join('').length)
  })

  it('aller-retour dans le format de fichier', () => {
    const octets = fichierDawg(dawg.arcs, mots.length, 'Test')
    const relu = Dawg.depuisFichier(octets.buffer as ArrayBuffer)
    expect(relu.nom).toBe('Test')
    expect(relu.nbMots).toBe(mots.length)
    expect([...relu.mots()]).toEqual(mots)
  })

  it('dictionnaire de l’appli (ODS)', () => {
    const ods = dicoAppli()
    expect(ods.nbMots).toBeGreaterThan(300000)
    for (const m of ['KIWI', 'WOK', 'QAT', 'ZYTHUMS', 'SCRABBLER', 'MAISON', 'AA', 'XI', 'ZEN'])
      expect(ods.contient(m), m).toBe(true)
    for (const m of ['ZZ', 'MAISONN', 'QQ', 'BONJOURZ']) expect(ods.contient(m), m).toBe(false)
  })
})
