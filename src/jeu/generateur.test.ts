import { describe, expect, it } from 'vitest'
import { analyserCoup, jouer, reference } from './coup'
import { Dawg } from './dawg'
import { genererCoups, meilleurCoup } from './generateur'
import { Hasard } from './hasard'
import { tousLesJetons } from './lettres'
import { index, type Plateau } from './plateau'
import { cleNormalisee, dicoAppli, dicoDe, ecrire, formables, oracle, vide } from './outils-test'

const cles = (coups: ReturnType<typeof genererCoups>) =>
  new Map(coups.map((c) => [cleNormalisee(c.poses, c.dir, c.debut, c.mot), c.points]))

/** Compare le générateur à l'oracle par force brute ; renvoie le nombre de coups. */
function verifier(dawg: Dawg, mots: string[], plateau: Plateau, tirage: string[]): number {
  const attendu = oracle(dawg, mots, plateau, tirage)
  const coups = genererCoups(dawg, plateau, tirage)
  const obtenu = cles(coups)
  // Sur un plateau vide, le générateur ne donne que les coups horizontaux (les verticaux sont symétriques).
  if (plateau.every((c) => !c)) for (const k of [...attendu.keys()]) if (k.startsWith('V:')) attendu.delete(k)
  expect(obtenu).toEqual(attendu)
  // Chaque coup généré est validé par l'analyse, avec le même score.
  for (const c of coups) {
    const a = analyserCoup(plateau, c.poses, dawg)
    expect(a.valide).toBe(true)
    expect(a.points).toBe(c.points)
    expect(a.coup?.mot).toBe(c.mot)
  }
  return coups.length
}

describe('générateur de coups', () => {
  it('petit dictionnaire : identique à la force brute, plateau vide', () => {
    const mots = ['AA', 'AS', 'SA', 'RAS', 'RATS', 'ARTS', 'STAR', 'TAS', 'RAT', 'ART', 'TARS', 'TRAS', 'ETRAS']
    const dawg = dicoDe(mots)
    expect(verifier(dawg, mots, vide(), ['R', 'A', 'T', 'S', 'E', 'A', '?'])).toBeGreaterThan(10)
  })

  it('petit dictionnaire tiré de l’ODS : identique à la force brute sur des parties aléatoires', () => {
    // Environ 2 000 mots courts tirés de l'ODS (reproductible), tous les mots de 2 lettres compris.
    const h = new Hasard(42)
    const mots: string[] = []
    for (const m of dicoAppli().mots()) if (m.length === 2 || (m.length <= 6 && h.entier(100) < 3)) mots.push(m)
    const dawg = dicoDe(mots)
    let total = 0
    for (let partie = 0; partie < 2; partie++) {
      let plateau = vide()
      let sac = tousLesJetons()
      for (let coup = 0; coup < 6; coup++) {
        const tirage: string[] = []
        for (let i = 0; i < 7 && sac.length; i++) tirage.push(sac.splice(h.entier(sac.length), 1)[0])
        // Au moins un joker de temps en temps.
        if (coup % 2 === 1) tirage[0] = '?'
        total += verifier(dawg, formables(mots, tirage, plateau), plateau, tirage)
        const coups = genererCoups(dawg, plateau, tirage)
        if (!coups.length) continue
        const choisi = coups[h.entier(Math.min(coups.length, 5))]
        plateau = jouer(plateau, choisi.poses)
      }
    }
    expect(total).toBeGreaterThan(100)
  })

  it('ODS complet : identique à la force brute en milieu de partie', () => {
    const ods = dicoAppli()
    let p = ecrire(vide(), 7, 3, 'H', 'MAISON')
    p = ecrire(p, 3, 6, 'V', 'CASES') // CASES de D7 à H7 : son dernier S est celui de MAISON
    p = ecrire(p, 9, 5, 'H', 'KIWI')
    const tirage = ['E', 'R', 'T', 'A', 'N', 'U', '?']
    verifier(ods, formables(ods.mots(), tirage, p), p, tirage)
  })

  it('tops connus', () => {
    const ods = dicoAppli()
    // Premier coup avec EXAMENS : scrabble placé pour mettre le X sur une case lettre compte double.
    const t1 = meilleurCoup(ods, vide(), ['E', 'X', 'A', 'M', 'E', 'N', 'S'])!
    expect(t1.mot).toBe('EXAMENS')
    expect(t1.points).toBe((1 + 20 + 1 + 2 + 1 + 1 + 1) * 2 + 50) // X en H4 (LD)
    expect(reference(t1.debut, t1.dir)).toBe('H3')

    // Sans aucun coup possible.
    expect(meilleurCoup(ods, vide(), ['Q', 'Q', 'K', 'W'])).toBeNull()

    // Un seul joker à placer à côté d'un mot existant : le joker vaut 0.
    const p = ecrire(vide(), 7, 7, 'H', 'ZEN')
    const coups = genererCoups(ods, p, ['?'])
    expect(coups.length).toBeGreaterThan(0)
    expect(coups.every((c) => c.poses.length === 1 && c.poses[0].lettre >= 'a')).toBe(true)
  })

  it('moins d’une seconde en milieu de partie avec deux jokers', () => {
    const ods = dicoAppli()
    let p = ecrire(vide(), 7, 3, 'H', 'MAISON')
    p = ecrire(p, 3, 6, 'V', 'POISSON')
    p = ecrire(p, 9, 1, 'H', 'TABLES')
    p = ecrire(p, 2, 4, 'H', 'CAPOT')
    jouer(p, [])
    const debut = performance.now()
    const coups = genererCoups(ods, p, ['?', '?', 'E', 'S', 'R', 'A', 'T'])
    const duree = performance.now() - debut
    console.log(`${coups.length} coups en ${Math.round(duree)} ms, top ${coups[0].mot} ${coups[0].points}`)
    expect(coups.length).toBeGreaterThan(1000)
    expect(duree).toBeLessThan(1000)
    // Le top est trié en premier.
    for (let i = 1; i < coups.length; i++) expect(coups[i].points).toBeLessThanOrEqual(coups[i - 1].points)
  })

  it('positions sur les bords du plateau', () => {
    const ods = dicoAppli()
    let p = ecrire(vide(), 0, 0, 'H', 'ZOO')
    p = ecrire(p, 14, 10, 'H', 'KIWIS')
    p = ecrire(p, 0, 14, 'V', 'ZEBU')
    const tirage = ['A', 'E', 'I', 'S', 'T', 'R', '?']
    verifier(ods, formables(ods.mots(), tirage, p), p, tirage)
    expect(index(0, 0)).toBe(0)
  })
})
