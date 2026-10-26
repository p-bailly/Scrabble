import { describe, expect, it } from 'vitest'
import {
  bilanParJoueur,
  manqueAGagner,
  meilleurScore,
  plateauxAvant,
  toursDeIA,
  type Meilleurs,
  type TourAnalysable,
} from './analyse'
import { appliquerDecision, chevaletAdverseConnu, nouvellePartieIA, type Camp, type PartieIA } from './contreIA'
import { jetonsUtilises, jouer, retirerDuChevalet, type Coup } from './coup'
import { genererCoups } from './generateur'
import { Hasard, graineEnNombre } from './hasard'
import { decider, type NiveauIA } from './ia'
import { plateauDepuisTexte, plateauVide } from './plateau'
import { dicoAppli } from './outils-test'

const hasardDe = (graine: string) => {
  const h = new Hasard(graineEnNombre(graine))
  return () => h.entier(1_000_000) / 1_000_000
}

/** Partie complète entre deux niveaux, jouée par le moteur. */
function jouerPartie(niveaux: Record<Camp, NiveauIA>, graine: string): PartieIA {
  const ods = dicoAppli()
  const hasard = hasardDe(graine)
  let p = nouvellePartieIA(niveaux.moi, 'moi', hasard, graine)
  while (!p.finie && p.coups.length < 200) {
    const camp = p.tour
    const contexte = {
      niveau: niveaux[camp],
      plateau: plateauDepuisTexte(p.plateau),
      chevalet: p.chevalets[camp],
      sac: p.sac.length,
      adversaire: chevaletAdverseConnu(p, camp),
    }
    const r = appliquerDecision(p, decider(ods, contexte, hasard), hasard, camp)
    if ('erreur' in r) throw new Error(r.erreur)
    p = r
  }
  return p
}

const coup = (points: number): Coup => ({ poses: [], mot: 'X', dir: 'H', debut: 0, points })
const tour = (numero: number, joueur: string, points: number): TourAnalysable => ({
  numero,
  joueur,
  type: points ? 'mot' : 'passe',
  chevalet: [],
  points,
})
const meilleurs = (...points: number[]): Meilleurs => ({ coups: points.map(coup), total: points.length })

describe('bilan d’une partie', () => {
  it('manque à gagner : écart avec le meilleur coup, jamais négatif', () => {
    expect(manqueAGagner(tour(1, 'a', 20), meilleurs(30, 25))).toBe(10)
    expect(manqueAGagner(tour(1, 'a', 30), meilleurs(30))).toBe(0)
    expect(manqueAGagner(tour(1, 'a', 35), meilleurs(30))).toBe(0)
    // Rien de possible : passer n'a rien coûté.
    expect(manqueAGagner(tour(1, 'a', 0), meilleurs())).toBe(0)
    expect(meilleurScore(meilleurs())).toBe(0)
  })

  it('points, meilleur possible, coups parfaits et plus gros écart de chaque joueur', () => {
    const tours = [tour(1, 'a', 30), tour(2, 'b', 10), tour(3, 'a', 12), tour(4, 'b', 0), tour(5, 'a', 40)]
    const resultats = [meilleurs(30), meilleurs(40), meilleurs(30), meilleurs(), meilleurs(40, 38)]
    const [a, b] = bilanParJoueur(tours, resultats, ['a', 'b'])
    expect(a).toMatchObject({ joueur: 'a', tours: 3, points: 82, meilleur: 100, parfaits: 2, plusGrosEcart: { numero: 3, manque: 18 } })
    expect(a.pourcentage).toBeCloseTo(82, 5)
    // Pour b : 10 sur 40, puis une passe sans rien à jouer (parfaite).
    expect(b).toMatchObject({ tours: 2, points: 10, meilleur: 40, parfaits: 1, plusGrosEcart: { numero: 2, manque: 30 } })
    expect(b.pourcentage).toBeCloseTo(25, 5)
  })

  it('les tours pas encore analysés ne comptent pas, et sans rien à gagner on est à 100 %', () => {
    const tours = [tour(1, 'a', 30), tour(2, 'a', 20)]
    const [a] = bilanParJoueur(tours, [meilleurs(50), undefined], ['a'])
    expect(a).toMatchObject({ tours: 1, points: 30, meilleur: 50 })
    expect(bilanParJoueur(tours, [], ['a'])[0]).toMatchObject({ tours: 0, pourcentage: 100, plusGrosEcart: null })
  })
})

describe('analyse d’une vraie partie', () => {
  // Une seule partie pour tout le groupe : le débutant joue de petits coups, l'expert presque les meilleurs.
  const partie = jouerPartie({ moi: 'debutant', ia: 'expert' }, 'analyse')
  const tours = toursDeIA(partie)
  const plateaux = plateauxAvant(tours)

  it('chaque tour garde le chevalet d’avant le coup : il contient les lettres posées', () => {
    expect(tours.length).toBeGreaterThan(10)
    for (const t of tours) {
      expect(t.chevalet).toBeDefined()
      expect(t.chevalet!.length).toBeGreaterThan(0)
      expect(t.chevalet!.length).toBeLessThanOrEqual(7)
      if (t.coup) expect(retirerDuChevalet(t.chevalet!, jetonsUtilises(t.coup.poses))).not.toBeNull()
    }
    // Le premier chevalet de chacun est celui de départ de la partie, qu'on retrouve depuis un coup de chaque camp.
    expect(tours[0].chevalet).toHaveLength(7)
    expect(tours[1].chevalet).toHaveLength(7)
  })

  it('le plateau avant chaque tour se reconstruit à partir des coups précédents', () => {
    expect(plateaux).toHaveLength(tours.length)
    expect(plateaux[0]).toEqual(plateauVide())
    let p = plateauVide()
    tours.forEach((t, i) => {
      expect(plateaux[i]).toEqual(p)
      if (t.coup) p = jouer(p, t.coup.poses)
    })
    expect(p).toEqual(plateauDepuisTexte(partie.plateau))
  })

  it('aucun coup joué ne dépasse le meilleur coup trouvé pour son chevalet, et l’expert s’en approche', () => {
    const ods = dicoAppli()
    const resultats: Meilleurs[] = tours.map((t, i) => {
      const tous = genererCoups(ods, plateaux[i], t.chevalet!)
      return { coups: tous.slice(0, 10), total: tous.length }
    })
    tours.forEach((t, i) => {
      if (t.type === 'mot') expect(resultats[i].coups[0].points).toBeGreaterThanOrEqual(t.points)
      else expect(t.points).toBe(0)
    })
    const [debutant, expert] = bilanParJoueur(tours, resultats, ['moi', 'ia'])
    for (const b of [debutant, expert]) {
      expect(b.points).toBeLessThanOrEqual(b.meilleur)
      expect(b.pourcentage).toBeLessThanOrEqual(100)
      expect(b.parfaits).toBeLessThanOrEqual(b.tours)
    }
    expect(debutant.tours + expert.tours).toBe(tours.length)
    // Le débutant laisse beaucoup de points (environ 30 % du meilleur possible sur les parties essayées) ; l'expert
    // en laisse peu (70 à 90 % : il garde de bonnes lettres plutôt que de jouer le coup brut le plus fort).
    expect(debutant.pourcentage).toBeLessThan(50)
    expect(expert.pourcentage).toBeGreaterThan(65)
    expect(expert.pourcentage).toBeGreaterThan(debutant.pourcentage + 25)
    expect(debutant.plusGrosEcart).not.toBeNull()
  })

  it('une partie d’avant l’analyse (sans chevalets gardés) se lit sans erreur', () => {
    const ancienne = { ...partie, coups: partie.coups.map(({ chevalet: _chevalet, ...c }) => c) }
    const anciens = toursDeIA(ancienne)
    expect(anciens.every((t) => t.chevalet === undefined)).toBe(true)
    expect(plateauxAvant(anciens)).toHaveLength(anciens.length)
  })
})
