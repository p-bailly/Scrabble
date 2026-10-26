// Analyse d'une partie classique terminée : à chaque tour, les meilleurs coups possibles avec le chevalet du joueur,
// comparés au coup joué. Ces fonctions sont pures ; la recherche des coups (le générateur) se fait dans le Web Worker.
//
// « Meilleur » veut dire « qui rapporte le plus de points » : l'analyse ne juge pas les lettres gardées pour la suite.

import { jouer, type Coup } from './coup'
import type { PartieIA } from './contreIA'
import { plateauVide, type Plateau } from './plateau'

/** Un tour d'une partie classique (contre l'IA ou à deux), tel que l'analyse le lit. */
export interface TourAnalysable {
  numero: number
  /** Qui a joué : une clé stable (le camp, ou l'identifiant du joueur). */
  joueur: string
  type: 'mot' | 'change' | 'passe'
  /** Chevalet du joueur avant le tour ; absent des parties jouées avant l'analyse (impossible alors de l'analyser). */
  chevalet?: string[]
  coup?: Coup
  nbChanges?: number
  points: number
}

/** Les meilleurs coups trouvés pour un tour, du meilleur au moins bon, et combien il y en avait en tout. */
export interface Meilleurs {
  coups: Coup[]
  total: number
}

export const toursDeIA = (p: PartieIA): TourAnalysable[] =>
  p.coups.map((c) => ({
    numero: c.numero,
    joueur: c.camp,
    type: c.type,
    chevalet: c.chevalet,
    coup: c.coup,
    nbChanges: c.nbChanges,
    points: c.points,
  }))

/** Le plateau tel qu'il était avant chaque tour : `plateaux[i]` précède le tour d'indice `i`. */
export function plateauxAvant(tours: readonly TourAnalysable[]): Plateau[] {
  const plateaux: Plateau[] = []
  let p = plateauVide()
  for (const t of tours) {
    plateaux.push(p)
    if (t.coup) p = jouer(p, t.coup.poses)
  }
  return plateaux
}

/** Points du meilleur coup possible (0 s'il n'y en avait aucun : on ne pouvait que passer ou changer). */
export const meilleurScore = (m: Meilleurs): number => m.coups[0]?.points ?? 0

/** Ce que le tour a laissé : points du meilleur coup moins points marqués (jamais négatif). */
export const manqueAGagner = (t: TourAnalysable, m: Meilleurs): number => Math.max(0, meilleurScore(m) - t.points)

export interface BilanJoueur {
  joueur: string
  /** Tours analysés (ceux dont on a le chevalet et le résultat de la recherche). */
  tours: number
  /** Points marqués à ces tours, hors ajustements de fin de partie. */
  points: number
  /** Points qu'auraient rapportés les meilleurs coups à ces mêmes tours. */
  meilleur: number
  /** Tours où le coup joué valait le meilleur coup. */
  parfaits: number
  /** Points marqués en % du meilleur possible (100 s'il n'y avait rien à gagner). */
  pourcentage: number
  /** Le tour où le plus de points ont été laissés, s'il y en a un. */
  plusGrosEcart: { numero: number; manque: number } | null
}

/** Bilan de chaque joueur (dans l'ordre donné) ; `resultats[i]` est ce que l'analyse a trouvé pour `tours[i]`. */
export function bilanParJoueur(
  tours: readonly TourAnalysable[],
  resultats: readonly (Meilleurs | undefined)[],
  joueurs: readonly string[],
): BilanJoueur[] {
  return joueurs.map((joueur) => {
    const b: BilanJoueur = { joueur, tours: 0, points: 0, meilleur: 0, parfaits: 0, pourcentage: 100, plusGrosEcart: null }
    tours.forEach((t, i) => {
      const m = resultats[i]
      if (t.joueur !== joueur || !m) return
      const manque = manqueAGagner(t, m)
      b.tours++
      b.points += t.points
      b.meilleur += meilleurScore(m)
      if (manque === 0) b.parfaits++
      else if (!b.plusGrosEcart || manque > b.plusGrosEcart.manque) b.plusGrosEcart = { numero: t.numero, manque }
    })
    if (b.meilleur > 0) b.pourcentage = (100 * b.points) / b.meilleur
    return b
  })
}
