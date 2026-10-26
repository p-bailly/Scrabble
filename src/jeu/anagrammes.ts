// Mots qu'on peut écrire avec des lettres données (un chevalet, par exemple), joker « ? » compris.

import { enfantArc, dernierArc, finDeMot, lettreArc, RACINE, type Dawg } from './dawg'
import { ALPHABET, JOKER, VALEURS } from './lettres'

export interface MotPossible {
  /** Le mot en majuscules, les lettres tenues par un joker en minuscules (comme sur le plateau). */
  mot: string
  /** Somme des valeurs des lettres (un joker vaut 0), sans case bonus. */
  points: number
}

export interface Possibles {
  mots: MotPossible[]
  /** La liste a été coupée à `limite` mots (les plus longs et les plus chers sont gardés). */
  tronque: boolean
}

/** Lettres utilisables dans une saisie : A à Z (accents et casse ignorés) et « ? » pour le joker. */
export function nettoyerLettres(saisie: string): string {
  return saisie
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z?]/g, '')
}

/**
 * Tous les mots du dictionnaire d'au moins `min` lettres qu'on écrit avec ces lettres, chacune au plus une fois.
 * Les plus longs d'abord, puis les plus chers, puis par ordre alphabétique. `toutes` : seulement les mots qui
 * emploient toutes les lettres (anagrammes).
 */
export function motsAvecLettres(d: Dawg, saisie: string, options: { min?: number; limite?: number; toutes?: boolean } = {}): Possibles {
  const { min = 2, limite = 500, toutes = false } = options
  const lettres = nettoyerLettres(saisie)
  const compte = new Array<number>(26).fill(0)
  let jokers = 0
  for (const l of lettres) {
    if (l === JOKER) jokers++
    else compte[l.charCodeAt(0) - 65]++
  }
  const total = lettres.length
  const trouves: MotPossible[] = []

  // Un seul chemin par mot dans le DAWG : à chaque lettre, on prend une vraie lettre si on en a, sinon un joker
  // (jamais un joker quand une vraie lettre est disponible : même mot, plus de points, et autant de lettres restantes).
  const parcourir = (noeud: number, mot: string, points: number): void => {
    if (noeud === 0) return
    for (let i = noeud; ; i++) {
      const a = d.arcs[i]
      const code = lettreArc(a)
      let suite: string | null = null
      let gain = 0
      let parJoker = false
      if (compte[code] > 0) {
        compte[code]--
        suite = mot + ALPHABET[code]
        gain = VALEURS[ALPHABET[code]]
      } else if (jokers > 0) {
        jokers--
        parJoker = true
        suite = mot + ALPHABET[code].toLowerCase()
      }
      if (suite !== null) {
        if (finDeMot(a) && suite.length >= min && (!toutes || suite.length === total)) trouves.push({ mot: suite, points: points + gain })
        parcourir(enfantArc(a), suite, points + gain)
        // On remet la lettre (ou le joker) utilisée.
        if (parJoker) jokers++
        else compte[code]++
      }
      if (dernierArc(a)) break
    }
  }
  parcourir(RACINE, '', 0)

  trouves.sort((a, b) => b.mot.length - a.mot.length || b.points - a.points || a.mot.localeCompare(b.mot))
  return { mots: trouves.slice(0, limite), tronque: trouves.length > limite }
}
