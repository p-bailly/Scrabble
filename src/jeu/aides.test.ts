import { describe, expect, it } from 'vitest'
import {
  abandonnerIA,
  aides,
  annulerCoup,
  demanderIndiceIA,
  indicesDuTour,
  memoriserAvant,
  nouvellePartieIA,
  passerIA,
  peutAnnuler,
  resumeIA,
  type PartieIA,
} from './contreIA'

const suite = (r: PartieIA | { erreur: string }): PartieIA => {
  if ('erreur' in r) throw new Error(r.erreur)
  return r
}
const depart = () => nouvellePartieIA('amateur', 'moi', undefined, 'ia-test')

describe('annuler mon dernier coup contre l’IA', () => {
  it('on revient à mon tour d’avant, avec les mêmes lettres, même si l’IA a répondu', () => {
    const p0 = depart()
    const apresMoi = memoriserAvant(p0, suite(passerIA(p0, 'moi')))
    expect(peutAnnuler(apresMoi)).toBe(true)
    // L'IA répond : la mémoire du tour est conservée.
    const apresIA = suite(passerIA(apresMoi, 'ia'))
    expect(apresIA.coups).toHaveLength(2)
    expect(peutAnnuler(apresIA)).toBe(true)
    const annulee = suite(annulerCoup(apresIA))
    expect(annulee).toMatchObject({ coups: [], tour: 'moi', passes: 0, annulations: 1 })
    expect(annulee.chevalets).toEqual(p0.chevalets)
    expect(annulee.sac).toEqual(p0.sac)
    expect(annulee.avant).toBeUndefined()
  })

  it('un seul coup à la fois : pas de seconde annulation de suite', () => {
    const p0 = depart()
    const annulee = suite(annulerCoup(memoriserAvant(p0, suite(passerIA(p0, 'moi')))))
    expect(peutAnnuler(annulee)).toBe(false)
    expect(annulerCoup(annulee)).toEqual({ erreur: 'Il n’y a rien à annuler' })
  })

  it('compte les annulations, d’une partie à l’autre tour', () => {
    let p = depart()
    for (let i = 0; i < 2; i++) p = suite(annulerCoup(memoriserAvant(p, suite(passerIA(p, 'moi')))))
    expect(p.annulations).toBe(2)
    expect(resumeIA(p).annulations).toBe(2)
  })

  it('la mémoire ne grossit pas : seul le dernier tour est gardé, sans mémoire dedans', () => {
    let p = depart()
    for (let i = 0; i < 3; i++) {
      p = memoriserAvant(p, suite(passerIA(p, 'moi')))
      p = suite(passerIA(p, 'ia'))
    }
    expect(p.coups).toHaveLength(6)
    expect(p.avant?.coups).toHaveLength(4)
    expect(p.avant && 'avant' in p.avant).toBe(false)
  })

  it('rien à annuler au départ, ni quand la partie est finie', () => {
    expect(peutAnnuler(depart())).toBe(false)
    const p0 = depart()
    const finie = abandonnerIA(memoriserAvant(p0, suite(passerIA(p0, 'moi'))))
    expect(peutAnnuler(finie)).toBe(false)
    expect(annulerCoup(finie)).toHaveProperty('erreur')
  })
})

describe('indices contre l’IA', () => {
  it('un indice se révèle une fois, et ne vaut que pour le coup à jouer', () => {
    let p = depart()
    expect(indicesDuTour(p)).toEqual([])
    p = demanderIndiceIA(p, 'valeur')
    p = demanderIndiceIA(p, 'longueur')
    expect(demanderIndiceIA(p, 'valeur')).toBe(p) // déjà révélé : rien ne change
    expect(indicesDuTour(p)).toEqual(['valeur', 'longueur'])
    expect(p.nbIndices).toBe(2)
    // Un autre tour : les indices du tour précédent ne comptent plus, le total reste.
    const tourSuivant = suite(passerIA(suite(passerIA(p, 'moi')), 'ia'))
    expect(indicesDuTour(tourSuivant)).toEqual([])
    expect(demanderIndiceIA(tourSuivant, 'valeur').nbIndices).toBe(3)
  })

  it('annuler garde les indices déjà demandés dans le total', () => {
    const p0 = demanderIndiceIA(depart(), 'direction')
    const jouee = memoriserAvant(p0, demanderIndiceIA(suite(passerIA(p0, 'moi')), 'valeur'))
    const annulee = suite(annulerCoup(jouee))
    expect(annulee.nbIndices).toBe(2)
    expect(indicesDuTour(annulee)).toEqual(['direction'])
    expect(resumeIA(annulee).indices).toBe(2)
  })

  it('le résumé n’ajoute rien quand on n’a pas utilisé d’aide', () => {
    const r = resumeIA(depart())
    expect(r).not.toHaveProperty('annulations')
    expect(r).not.toHaveProperty('indices')
  })
})

describe('résumé des aides', () => {
  it('une phrase, vide sans aide, avec les pluriels', () => {
    expect(aides({})).toBe('')
    expect(aides({ annulations: 1 })).toBe('1 coup annulé')
    expect(aides({ annulations: 2, nbIndices: 1 })).toBe('2 coups annulés · 1 indice')
    expect(aides({ nbIndices: 3 })).toBe('3 indices')
  })
})
