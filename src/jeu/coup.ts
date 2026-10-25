// Analyse d'un coup : règles de pose, mots formés, validité dans le dictionnaire et score.

import { estJoker, valeur } from './lettres'
import { CENTRE, MULT_LETTRE, MULT_MOT, TAILLE, colonneDe, estVide, ligneDe, type Plateau } from './plateau'

export type Direction = 'H' | 'V'

/** Un jeton posé pendant le coup : « A »…« Z », ou minuscule pour un joker (« e » = joker joué en E). */
export interface Pose {
  pos: number
  lettre: string
}

/** Un coup joué ou proposé. */
export interface Coup {
  poses: Pose[]
  /** Mot principal, jokers en minuscules. */
  mot: string
  dir: Direction
  /** Case de la première lettre du mot principal. */
  debut: number
  points: number
}

export interface MotForme {
  /** Le mot en majuscules (tel qu'il est cherché dans le dictionnaire). */
  mot: string
  /** Le mot avec les jokers en minuscules. */
  affichage: string
  dir: Direction
  debut: number
  points: number
}

export interface Analyse {
  /** Coup jouable : pose correcte et (si un dictionnaire est fourni) tous les mots connus. */
  valide: boolean
  /** Erreur de pose, en français, s'il y en a une. */
  erreur?: string
  /** Mots formés absents du dictionnaire. */
  motsInconnus: string[]
  /** Mots formés, le principal en premier. */
  mots: MotForme[]
  /** Score du coup (bonus de 50 compris). Calculé dès que la pose est correcte, même si un mot est inconnu. */
  points: number
  scrabble: boolean
  coup?: Coup
}

export interface Dico {
  contient(mot: string): boolean
}

export const BONUS_SCRABBLE = 50

const pas = (dir: Direction): number => (dir === 'H' ? 1 : TAILLE)

/** Lecture du mot qui passe par `pos` dans la direction `dir`, en tenant compte des jetons en cours de pose. */
function lireMot(plateau: Plateau, nouveaux: Map<number, string>, pos: number, dir: Direction): MotForme {
  const s = pas(dir)
  const lettre = (p: number) => nouveaux.get(p) ?? plateau[p]
  const memeLigne = (a: number, b: number) => (dir === 'H' ? ligneDe(a) === ligneDe(b) : true)
  let debut = pos
  while (debut - s >= 0 && memeLigne(debut - s, pos) && lettre(debut - s)) debut -= s
  let affichage = ''
  let somme = 0
  let mult = 1
  let p = debut
  while (p < TAILLE * TAILLE && memeLigne(p, pos) && lettre(p)) {
    const t = lettre(p)
    affichage += t
    if (nouveaux.has(p)) {
      somme += valeur(t) * MULT_LETTRE[p]
      mult *= MULT_MOT[p]
    } else somme += valeur(t)
    p += s
  }
  return { mot: affichage.toUpperCase(), affichage, dir, debut, points: somme * mult }
}

const echec = (erreur: string): Analyse => ({ valide: false, erreur, motsInconnus: [], mots: [], points: 0, scrabble: false })

/**
 * Analyse un coup : `poses` sont les jetons ajoutés au plateau. Sans dictionnaire, seuls la pose et le score sont
 * vérifiés.
 */
export function analyserCoup(plateau: Plateau, poses: readonly Pose[], dico?: Dico): Analyse {
  if (poses.length === 0) return echec('Aucune lettre posée')
  if (poses.length > 7) return echec('Sept lettres au plus')
  const nouveaux = new Map<number, string>()
  for (const { pos, lettre } of poses) {
    if (pos < 0 || pos >= TAILLE * TAILLE) return echec('Case hors du plateau')
    if (plateau[pos]) return echec('Case déjà occupée')
    if (nouveaux.has(pos)) return echec('Deux lettres sur la même case')
    if (!/^[A-Za-z]$/.test(lettre)) return echec('Lettre invalide')
    nouveaux.set(pos, lettre)
  }

  const positions = [...nouveaux.keys()].sort((a, b) => a - b)
  const lignes = new Set(positions.map(ligneDe))
  const colonnes = new Set(positions.map(colonneDe))
  let dir: Direction
  if (positions.length === 1) {
    // Une seule lettre : le mot principal est celui qui fait au moins deux lettres (horizontal en priorité).
    const p = positions[0]
    const h = lireMot(plateau, nouveaux, p, 'H')
    dir = h.mot.length >= 2 ? 'H' : 'V'
  } else if (lignes.size === 1) dir = 'H'
  else if (colonnes.size === 1) dir = 'V'
  else return echec('Les lettres doivent être alignées')

  // Pas de trou entre la première et la dernière lettre posée.
  const s = pas(dir)
  for (let p = positions[0]; p <= positions[positions.length - 1]; p += s)
    if (!nouveaux.has(p) && !plateau[p]) return echec('Le mot doit être continu')

  const principal = lireMot(plateau, nouveaux, positions[0], dir)
  if (principal.mot.length < 2) return echec('Un mot fait au moins deux lettres')

  if (estVide(plateau)) {
    if (!nouveaux.has(CENTRE)) return echec('Le premier mot doit passer par l’étoile')
  } else {
    // Le coup doit toucher une lettre déjà posée.
    const voisins = (p: number) => {
      const v: number[] = []
      if (colonneDe(p) > 0) v.push(p - 1)
      if (colonneDe(p) < TAILLE - 1) v.push(p + 1)
      if (p >= TAILLE) v.push(p - TAILLE)
      if (p < TAILLE * (TAILLE - 1)) v.push(p + TAILLE)
      return v
    }
    if (!positions.some((p) => voisins(p).some((v) => plateau[v])))
      return echec('Le mot doit toucher une lettre déjà posée')
  }

  const mots: MotForme[] = [principal]
  const autre: Direction = dir === 'H' ? 'V' : 'H'
  for (const p of positions) {
    const m = lireMot(plateau, nouveaux, p, autre)
    if (m.mot.length >= 2) mots.push(m)
  }

  const scrabble = poses.length === 7
  const points = mots.reduce((t, m) => t + m.points, 0) + (scrabble ? BONUS_SCRABBLE : 0)
  const motsInconnus = dico ? mots.filter((m) => !dico.contient(m.mot)).map((m) => m.mot) : []
  const coup: Coup = {
    poses: positions.map((pos) => ({ pos, lettre: nouveaux.get(pos)! })),
    mot: principal.affichage,
    dir,
    debut: principal.debut,
    points,
  }
  return { valide: motsInconnus.length === 0, motsInconnus, mots, points, scrabble, coup }
}

/** Pose les jetons d'un coup sur une copie du plateau. */
export function jouer(plateau: Plateau, poses: readonly Pose[]): Plateau {
  const p = plateau.slice()
  for (const { pos, lettre } of poses) p[pos] = lettre
  return p
}

/** Jetons du chevalet utilisés par un coup (« ? » pour chaque joker). */
export const jetonsUtilises = (poses: readonly Pose[]): string[] => poses.map((p) => (estJoker(p.lettre) ? '?' : p.lettre))

/** Retire du chevalet les jetons utilisés ; renvoie null si le chevalet ne les contient pas. */
export function retirerDuChevalet(chevalet: readonly string[], jetons: readonly string[]): string[] | null {
  const reste = chevalet.slice()
  for (const j of jetons) {
    const i = reste.indexOf(j)
    if (i < 0) return null
    reste.splice(i, 1)
  }
  return reste
}

/** Référence du coup à la française : « H4 » pour un mot horizontal (ligne puis colonne), « 4H » en vertical. */
export function reference(debut: number, dir: Direction): string {
  const ligne = String.fromCharCode(65 + ligneDe(debut))
  const col = String(colonneDe(debut) + 1)
  return dir === 'H' ? ligne + col : col + ligne
}

/** Inverse de `reference` ; null si la référence est invalide. */
export function lireReference(ref: string): { debut: number; dir: Direction } | null {
  const r = ref.trim().toUpperCase()
  let m = /^([A-O])(1[0-5]|[1-9])$/.exec(r)
  if (m) return { debut: (m[1].charCodeAt(0) - 65) * TAILLE + Number(m[2]) - 1, dir: 'H' }
  m = /^(1[0-5]|[1-9])([A-O])$/.exec(r)
  if (m) return { debut: (m[2].charCodeAt(0) - 65) * TAILLE + Number(m[1]) - 1, dir: 'V' }
  return null
}
