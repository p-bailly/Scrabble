import { describe, expect, it } from 'vitest'
import { analyserCoup, lireReference, reference, retirerDuChevalet, jetonsUtilises } from './coup'
import { DISTRIBUTION, VALEURS, tousLesJetons, sommeValeurs } from './lettres'
import { BONUS, CENTRE, index, plateauDepuisTexte, plateauEnTexte } from './plateau'
import { dicoDe, ecrire, posesDe, vide } from './outils-test'

describe('lettres', () => {
  it('102 jetons dont 2 jokers, avec la répartition française', () => {
    const jetons = tousLesJetons()
    expect(jetons).toHaveLength(102)
    expect(jetons.filter((j) => j === '?')).toHaveLength(2)
    expect(DISTRIBUTION.E).toBe(15)
    expect(DISTRIBUTION.A).toBe(9)
    expect(VALEURS.K + VALEURS.W + VALEURS.X + VALEURS.Y + VALEURS.Z).toBe(50)
    expect(sommeValeurs(jetons)).toBe(197)
  })
})

describe('plateau', () => {
  it('cases bonus standard', () => {
    const compte = (b: string) => BONUS.filter((x) => x === b).length
    expect(compte('MT')).toBe(8)
    expect(compte('MD')).toBe(17) // étoile comprise
    expect(compte('LT')).toBe(12)
    expect(compte('LD')).toBe(24)
    expect(BONUS[CENTRE]).toBe('MD')
    expect(BONUS[index(0, 0)]).toBe('MT')
    expect(BONUS[index(0, 3)]).toBe('LD')
    expect(BONUS[index(1, 5)]).toBe('LT')
    expect(BONUS[index(13, 13)]).toBe('MD')
  })

  it('aller-retour en texte', () => {
    const p = ecrire(vide(), 7, 7, 'H', 'MOt')
    expect(plateauDepuisTexte(plateauEnTexte(p))).toEqual(p)
  })

  it('références à la française', () => {
    expect(reference(index(7, 3), 'H')).toBe('H4')
    expect(reference(index(7, 3), 'V')).toBe('4H')
    expect(reference(index(14, 14), 'H')).toBe('O15')
    expect(lireReference('h4')).toEqual({ debut: index(7, 3), dir: 'H' })
    expect(lireReference('12B')).toEqual({ debut: index(1, 11), dir: 'V' })
    expect(lireReference('P4')).toBeNull()
  })
})

describe('analyse des coups', () => {
  const dico = dicoDe(['MAISON', 'SE', 'LE', 'EXAMENS', 'ZOO', 'AMI', 'MAIS', 'ZEN', 'OSE', 'ROSE', 'ROSES', 'RA', 'RAS', 'RO', 'AS'])

  it('premier mot sur l’étoile, mot compte double et lettre compte double', () => {
    // H4 : M sur la case LD (H4), O sur l'étoile.
    const a = analyserCoup(vide(), posesDe(vide(), 7, 3, 'H', 'MAISON'), dico)
    expect(a.valide).toBe(true)
    expect(a.points).toBe((2 * 2 + 1 + 1 + 1 + 1 + 1) * 2)
    expect(a.coup?.dir).toBe('H')
    expect(reference(a.coup!.debut, a.coup!.dir)).toBe('H4')
  })

  it('scrabble : 7 lettres posées, +50', () => {
    const a = analyserCoup(vide(), posesDe(vide(), 7, 1, 'H', 'EXAMENS'), dico)
    expect(a.scrabble).toBe(true)
    // E X A(LD) M E N S(étoile) : (1+10+2+2+1+1+1) × 2 + 50
    expect(a.points).toBe(36 + 50)
  })

  it('mot secondaire et lettre déjà posée sans bonus', () => {
    const p = ecrire(vide(), 7, 3, 'H', 'MAISON')
    // E en I7 (case LD) sous le S : SE vertical.
    const a = analyserCoup(p, [{ pos: index(8, 6), lettre: 'E' }], dico)
    expect(a.valide).toBe(true)
    expect(a.mots.map((m) => m.mot)).toEqual(['SE'])
    expect(a.points).toBe(1 + 1 * 2)
  })

  it('mot principal et mots croisés comptent tous', () => {
    // RAS en H8 ; OSE posé juste dessous (I8) forme aussi RO, AS et SE.
    const p = ecrire(vide(), 7, 7, 'H', 'RAS')
    const a = analyserCoup(p, posesDe(p, 8, 7, 'H', 'OSE'), dico)
    expect(a.valide).toBe(true)
    expect(a.mots.map((m) => m.mot)).toEqual(['OSE', 'RO', 'AS', 'SE'])
    // OSE : S sur la case LD (I9) → 1 + 2 + 1 ; RO 2 ; AS 1 + 2 ; SE 2
    expect(a.mots.map((m) => m.points)).toEqual([4, 2, 3, 2])
    expect(a.points).toBe(11)
  })

  it('mot compte triple, lettre existante comptée sans bonus', () => {
    const p = ecrire(vide(), 0, 1, 'H', 'E')
    const a = analyserCoup(p, [{ pos: index(0, 0), lettre: 'L' }], dico)
    expect(a.valide).toBe(true)
    expect(a.points).toBe((1 + 1) * 3)
  })

  it('un coup compte les mots croisés avec leurs propres bonus', () => {
    // ZEN en H7 (Z en H7). On pose O en I7 et O en J7 : ZOO vertical depuis H7.
    const p = ecrire(vide(), 7, 6, 'H', 'ZEN')
    const a = analyserCoup(p, posesDe(p, 7, 6, 'V', 'ZOO'), dico)
    expect(a.valide).toBe(true)
    // Z(10) existant + O(I7, LD → 2) + O(J7) = 13
    expect(a.points).toBe(13)
  })

  it('joker : valeur nulle, même sur une case bonus', () => {
    const a = analyserCoup(vide(), [
      { pos: index(7, 3), lettre: 'm' },
      ...posesDe(vide(), 7, 4, 'H', 'AISON'),
    ], dico)
    expect(a.valide).toBe(true)
    expect(a.mots[0].affichage).toBe('mAISON')
    expect(a.points).toBe((0 + 1 + 1 + 1 + 1 + 1) * 2)
    expect(jetonsUtilises(a.coup!.poses).sort()).toEqual(['?', 'A', 'I', 'N', 'O', 'S'])
  })

  it('mot inconnu : score calculé mais coup refusé', () => {
    const a = analyserCoup(vide(), posesDe(vide(), 7, 7, 'H', 'ZZZ'), dico)
    expect(a.valide).toBe(false)
    expect(a.motsInconnus).toEqual(['ZZZ'])
    expect(a.points).toBeGreaterThan(0)
  })

  it('coups invalides', () => {
    const p = ecrire(vide(), 7, 3, 'H', 'MAISON')
    expect(analyserCoup(vide(), [], dico).erreur).toBeDefined()
    expect(analyserCoup(vide(), posesDe(vide(), 0, 0, 'H', 'ZEN'), dico).erreur).toMatch(/étoile/)
    expect(analyserCoup(vide(), [{ pos: CENTRE, lettre: 'A' }], dico).erreur).toMatch(/deux lettres/)
    // Lettres non alignées.
    expect(analyserCoup(p, [{ pos: index(8, 3), lettre: 'A' }, { pos: index(9, 4), lettre: 'I' }], dico).erreur).toMatch(/alignées/)
    // Trou dans le mot.
    expect(analyserCoup(p, [{ pos: index(9, 3), lettre: 'A' }, { pos: index(9, 5), lettre: 'I' }], dico).erreur).toMatch(/continu/)
    // Mot isolé.
    expect(analyserCoup(p, posesDe(p, 0, 0, 'H', 'ZEN'), dico).erreur).toMatch(/toucher/)
    // Case occupée.
    expect(analyserCoup(p, [{ pos: index(7, 3), lettre: 'A' }], dico).erreur).toMatch(/occupée/)
    // Deux fois la même case.
    expect(analyserCoup(p, [{ pos: index(8, 3), lettre: 'A' }, { pos: index(8, 3), lettre: 'I' }], dico).erreur).toBeDefined()
  })

  it('retirer des lettres du chevalet', () => {
    expect(retirerDuChevalet(['A', 'B', '?'], ['?', 'A'])).toEqual(['B'])
    expect(retirerDuChevalet(['A', 'B'], ['C'])).toBeNull()
  })
})
