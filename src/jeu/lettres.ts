// Lettres du Scrabble francophone : répartition des 102 jetons et valeurs.
//
// Conventions utilisées dans tout le module :
//  - une lettre « normale » est une majuscule de A à Z ;
//  - le joker sur le chevalet ou dans le sac est « ? » ;
//  - un joker posé sur le plateau est la minuscule de la lettre qu'il représente (« e » = joker joué en E).

export const JOKER = '?'

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Nombre de jetons de chaque lettre (102 au total). */
export const DISTRIBUTION: Readonly<Record<string, number>> = {
  A: 9, B: 2, C: 2, D: 3, E: 15, F: 2, G: 2, H: 2, I: 8, J: 1, K: 1, L: 5, M: 3,
  N: 6, O: 6, P: 2, Q: 1, R: 6, S: 6, T: 6, U: 6, V: 2, W: 1, X: 1, Y: 1, Z: 1,
  [JOKER]: 2,
}

/** Valeur de chaque lettre. */
export const VALEURS: Readonly<Record<string, number>> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
  N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
  [JOKER]: 0,
}

/** Valeur indexée par code de lettre (0 = A … 25 = Z), pour les calculs rapides. */
export const VALEUR_CODE: readonly number[] = [...ALPHABET].map((l) => VALEURS[l])

/** Voyelles pour la validation des tirages. Convention de l'appli : le Y est une voyelle. */
export const VOYELLES = new Set(['A', 'E', 'I', 'O', 'U', 'Y'])

/**
 * Un mot proposé doit compter au moins 2 voyelles ou au moins 2 consonnes. Le Y et l'apostrophe comptent à la
 * fois comme voyelle et comme consonne ; un joker posé (minuscule) compte pour la lettre qu'il représente.
 */
export function motConforme(mot: string): boolean {
  let voyelles = 0
  let consonnes = 0
  for (const c of mot.toUpperCase()) {
    if (c === 'Y' || c === "'" || c === '’') {
      voyelles++
      consonnes++
    } else if (VOYELLES.has(c)) voyelles++
    else if (c >= 'A' && c <= 'Z') consonnes++
  }
  return voyelles >= 2 || consonnes >= 2
}

export const estJoker = (t: string): boolean => t === JOKER || (t >= 'a' && t <= 'z')

/** Valeur d'un jeton : 0 pour un joker (sur le chevalet ou posé), sinon la valeur de la lettre. */
export function valeur(t: string): number {
  return estJoker(t) ? 0 : (VALEURS[t] ?? 0)
}

/** Code 0..25 d'une lettre, majuscule ou minuscule (joker posé). */
export const code = (l: string): number => (l.toUpperCase().charCodeAt(0) - 65)

/** Les 102 jetons du jeu, dans l'ordre alphabétique. */
export function tousLesJetons(): string[] {
  const jetons: string[] = []
  for (const [lettre, n] of Object.entries(DISTRIBUTION)) for (let i = 0; i < n; i++) jetons.push(lettre)
  return jetons
}

/** Somme des valeurs d'un ensemble de jetons. */
export const sommeValeurs = (jetons: readonly string[]): number => jetons.reduce((s, t) => s + valeur(t), 0)
