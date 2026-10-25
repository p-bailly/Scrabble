// Plateau 15 × 15 et cases bonus.
//
// Le plateau est un tableau de 225 cases, lues ligne par ligne : '' pour une case vide, sinon le jeton posé
// (majuscule, ou minuscule pour un joker). Lignes A à O de haut en bas, colonnes 1 à 15 de gauche à droite.

export const TAILLE = 15
export const NB_CASES = TAILLE * TAILLE
/** Case centrale (H8), l'étoile : mot compte double, le premier mot doit la couvrir. */
export const CENTRE = 7 * TAILLE + 7

export type Plateau = string[]

/** LD / LT : lettre compte double / triple ; MD / MT : mot compte double / triple. */
export type Bonus = '' | 'LD' | 'LT' | 'MD' | 'MT'

export const index = (ligne: number, colonne: number): number => ligne * TAILLE + colonne
export const ligneDe = (pos: number): number => Math.floor(pos / TAILLE)
export const colonneDe = (pos: number): number => pos % TAILLE

function construireBonus(): Bonus[] {
  const b: Bonus[] = new Array(NB_CASES).fill('')
  // Un quart du plateau suffit : les cases bonus sont symétriques par rapport aux deux médianes.
  const quart: [Bonus, [number, number][]][] = [
    ['MT', [[0, 0], [0, 7], [7, 0]]],
    ['MD', [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]]],
    ['LT', [[1, 5], [5, 1], [5, 5]]],
    ['LD', [[0, 3], [3, 0], [2, 6], [6, 2], [6, 6], [3, 7], [7, 3]]],
  ]
  for (const [type, cases] of quart)
    for (const [l, c] of cases)
      for (const [ll, cc] of [[l, c], [l, 14 - c], [14 - l, c], [14 - l, 14 - c]]) b[index(ll, cc)] = type
  return b
}

export const BONUS: readonly Bonus[] = construireBonus()

/** Multiplicateur de lettre de chaque case (1, 2 ou 3). */
export const MULT_LETTRE: readonly number[] = BONUS.map((b) => (b === 'LD' ? 2 : b === 'LT' ? 3 : 1))
/** Multiplicateur de mot de chaque case (1, 2 ou 3). */
export const MULT_MOT: readonly number[] = BONUS.map((b) => (b === 'MD' ? 2 : b === 'MT' ? 3 : 1))

export const plateauVide = (): Plateau => new Array(NB_CASES).fill('')

export const estVide = (p: Plateau): boolean => p.every((c) => c === '')

/** Plateau en texte compact de 225 caractères (« . » pour une case vide), pour la sauvegarde. */
export const plateauEnTexte = (p: Plateau): string => p.map((c) => c || '.').join('')

export function plateauDepuisTexte(t: string): Plateau {
  if (t.length !== NB_CASES) throw new Error('Plateau invalide')
  return [...t].map((c) => (c === '.' ? '' : c))
}

/** Coordonnée d'une case, ex. « H8 ». */
export const nomCase = (pos: number): string => String.fromCharCode(65 + ligneDe(pos)) + (colonneDe(pos) + 1)
