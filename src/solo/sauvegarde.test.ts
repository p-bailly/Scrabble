import { afterEach, describe, expect, it, vi } from 'vitest'
import { passerIA, nouvellePartieIA } from '../jeu/contreIA'
import { genererCoups } from '../jeu/generateur'
import { nouvellePartie, terminerCoup, type PartieDuplicate } from '../jeu/duplicate'
import { dicoAppli } from '../jeu/outils-test'
import { plateauDepuisTexte } from '../jeu/plateau'
import {
  abandonnerPartie,
  ecrireCoup,
  enregistrerPartie,
  lireCoup,
  lireHistorique,
  lirePartiesEnCours,
  retirerPartie,
  trouverPartieEnCours,
} from './sauvegarde'
import {
  abandonnerPartieIA,
  bilanParNiveau,
  enregistrerPartieIA,
  lireHistoriqueIA,
  lirePartiesIAEnCours,
  retirerPartieIA,
  trouverPartieIA,
  trouverPartieIAEnCours,
} from './sauvegardeIA'

/** localStorage factice : les tests tournent sous Node, sans navigateur. */
function stockage(contenu: Record<string, string> = {}) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => contenu[k] ?? null,
    setItem: (k: string, v: string) => void (contenu[k] = v),
    removeItem: (k: string) => void delete contenu[k],
  })
  return contenu
}

afterEach(() => vi.unstubAllGlobals())

/** Une partie de duplicate où `n` coups ont déjà été joués. */
function partieDuplicate(id: string, n = 0): PartieDuplicate {
  const ods = dicoAppli()
  let p = nouvellePartie(id, 180, id)
  for (let i = 0; i < n; i++) {
    const tous = genererCoups(ods, plateauDepuisTexte(p.plateau), p.courant!.tirage, { limite: 3 })
    p = terminerCoup(p, tous[0], tous[0], tous, 20)
  }
  return p
}

describe('parties de duplicate en cours', () => {
  it('on peut en avoir plusieurs, la dernière enregistrée en premier', () => {
    stockage()
    expect(lirePartiesEnCours()).toEqual([])
    enregistrerPartie(partieDuplicate('A'))
    enregistrerPartie(partieDuplicate('B'))
    enregistrerPartie(partieDuplicate('C'))
    expect(lirePartiesEnCours().map((p) => p.id)).toEqual(['C', 'B', 'A'])
    // Rejouer une partie la remet en tête, sans la dupliquer.
    enregistrerPartie(partieDuplicate('A', 1))
    const liste = lirePartiesEnCours()
    expect(liste.map((p) => p.id)).toEqual(['A', 'C', 'B'])
    expect(liste[0].coups).toHaveLength(1)
    expect(liste[0].majLe).toBeGreaterThan(0)
    expect(trouverPartieEnCours('B')?.id).toBe('B')
    expect(trouverPartieEnCours('absente')).toBeNull()
  })

  it('chaque partie a son propre coup en cours (temps écoulé, indices…)', () => {
    stockage()
    enregistrerPartie(partieDuplicate('A'))
    enregistrerPartie(partieDuplicate('B'))
    ecrireCoup('A', { numero: 1, ecoule: 42, bulletin: null, indices: ['valeur'], essais: [] })
    ecrireCoup('B', { numero: 1, ecoule: 7, bulletin: null, indices: [], essais: [] })
    expect(lireCoup('A', 1)).toMatchObject({ ecoule: 42, indices: ['valeur'] })
    expect(lireCoup('B', 1).ecoule).toBe(7)
    // Le coup d'un autre numéro n'est pas repris.
    expect(lireCoup('A', 2).ecoule).toBe(0)
  })

  it('retirer une partie oublie aussi son coup en cours, sans toucher aux autres', () => {
    const contenu = stockage()
    enregistrerPartie(partieDuplicate('A'))
    enregistrerPartie(partieDuplicate('B'))
    ecrireCoup('A', { numero: 1, ecoule: 42, bulletin: null, indices: [], essais: [] })
    retirerPartie('A')
    expect(lirePartiesEnCours().map((p) => p.id)).toEqual(['B'])
    expect(Object.keys(contenu).filter((k) => k.includes('solo.coup'))).toEqual([])
  })

  it('abandonner range la partie dans l’historique si des coups ont été joués, sinon elle disparaît', () => {
    stockage()
    enregistrerPartie(partieDuplicate('JOUEE', 2))
    enregistrerPartie(partieDuplicate('VIERGE'))
    abandonnerPartie(trouverPartieEnCours('JOUEE')!)
    abandonnerPartie(trouverPartieEnCours('VIERGE')!)
    expect(lirePartiesEnCours()).toEqual([])
    expect(lireHistorique().map((p) => p.id)).toEqual(['JOUEE'])
    expect(lireHistorique()[0]).toMatchObject({ finie: true, courant: null })
  })

  it('reprend l’unique partie des versions précédentes, avec son coup en cours', () => {
    const ancienne = partieDuplicate('ANCIENNE', 1)
    const contenu = stockage({
      'scrabble.solo.partie': JSON.stringify(ancienne),
      'scrabble.solo.coup': JSON.stringify({ numero: 2, ecoule: 30, bulletin: null, indices: [], essais: [] }),
    })
    enregistrerPartie(partieDuplicate('NOUVELLE'))
    expect(lirePartiesEnCours().map((p) => p.id)).toEqual(['NOUVELLE', 'ANCIENNE'])
    expect(lireCoup('ANCIENNE', 2).ecoule).toBe(30)
    expect(contenu['scrabble.solo.partie']).toBeUndefined()
    expect(contenu['scrabble.solo.coup']).toBeUndefined()
  })

  it('une ancienne partie déjà terminée n’est pas reprise', () => {
    stockage({ 'scrabble.solo.partie': JSON.stringify({ ...partieDuplicate('FINIE'), finie: true }) })
    expect(lirePartiesEnCours()).toEqual([])
  })
})

describe('parties contre l’IA en cours', () => {
  const nouvelle = (id: string) => nouvellePartieIA('amateur', 'moi', undefined, id)
  /** La partie après un premier tour passé : un coup joué. */
  const jouee = (id: string) => {
    const r = passerIA(nouvelle(id), 'moi')
    if ('erreur' in r) throw new Error(r.erreur)
    return r
  }

  it('on peut en avoir plusieurs et les retrouver une à une', () => {
    stockage()
    enregistrerPartieIA(nouvelle('ia-1'))
    enregistrerPartieIA(nouvelle('ia-2'))
    enregistrerPartieIA(jouee('ia-1'))
    expect(lirePartiesIAEnCours().map((p) => p.id)).toEqual(['ia-1', 'ia-2'])
    expect(trouverPartieIAEnCours('ia-2')?.coups).toHaveLength(0)
    retirerPartieIA('ia-2')
    expect(lirePartiesIAEnCours().map((p) => p.id)).toEqual(['ia-1'])
  })

  it('abandonner : l’IA gagne et la partie est rangée dans l’historique ; sans coup, elle disparaît', () => {
    stockage()
    enregistrerPartieIA(jouee('ia-jouee'))
    enregistrerPartieIA(nouvelle('ia-vierge'))
    abandonnerPartieIA(trouverPartieIAEnCours('ia-jouee')!)
    abandonnerPartieIA(trouverPartieIAEnCours('ia-vierge')!)
    expect(lirePartiesIAEnCours()).toEqual([])
    expect(lireHistoriqueIA()).toHaveLength(1)
    expect(lireHistoriqueIA()[0]).toMatchObject({ id: 'ia-jouee', gagnant: 'ia', abandon: true })
    expect(bilanParNiveau().find((b) => b.niveau === 'amateur')).toMatchObject({ parties: 1, defaites: 1 })
  })

  it('l’analyse retrouve une partie en cours par son identifiant, ou la plus récente avec « courante »', () => {
    stockage()
    enregistrerPartieIA(jouee('ia-1'))
    enregistrerPartieIA(jouee('ia-2'))
    expect(trouverPartieIA('ia-1')?.id).toBe('ia-1')
    expect(trouverPartieIA('courante')?.id).toBe('ia-2')
    expect(trouverPartieIA('inconnue')).toBeNull()
  })

  it('reprend l’unique partie des versions précédentes', () => {
    const contenu = stockage({ 'scrabble.ia.partie': JSON.stringify(nouvelle('ia-ancienne')) })
    expect(lirePartiesIAEnCours().map((p) => p.id)).toEqual(['ia-ancienne'])
    expect(contenu['scrabble.ia.partie']).toBeUndefined()
    expect(contenu['scrabble.ia.encours']).toBeDefined()
  })
})
