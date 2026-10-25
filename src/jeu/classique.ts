// Partie classique à deux joueurs (mode multijoueur) : chacun son chevalet, on joue à tour de rôle.
//
// À son tour, un joueur pose un mot, change des lettres (s'il en reste au moins 7 dans le sac) ou passe.
// Fin de partie : le sac est vide et un joueur a vidé son chevalet (il gagne la valeur des lettres restant à
// l'adversaire, qui les perd), ou six passes de suite (chacun perd la valeur de ses lettres restantes).

import { analyserCoup, jetonsUtilises, jouer, retirerDuChevalet, type Analyse, type Dico, type Pose } from './coup'
import { sommeValeurs, tousLesJetons } from './lettres'
import { NB_CASES, plateauDepuisTexte, type Plateau } from './plateau'

export const PASSES_MAX = 6
export const MIN_SAC_POUR_CHANGER = 7

/** Tire `n` jetons au hasard dans le sac. */
export function piocher(sac: readonly string[], n: number, hasard: () => number = Math.random): { tires: string[]; sac: string[] } {
  const s = [...sac]
  const tires: string[] = []
  while (tires.length < n && s.length) tires.push(s.splice(Math.floor(hasard() * s.length), 1)[0])
  return { tires, sac: s }
}

export interface ResultatMot {
  analyse: Analyse
  plateau: Plateau
  chevalet: string[]
  sac: string[]
}

/** Joue un mot : vérifie qu'il est valable et que le chevalet contient les lettres, puis complète le chevalet. */
export function jouerMot(
  plateau: Plateau,
  chevalet: readonly string[],
  sac: readonly string[],
  poses: readonly Pose[],
  dico: Dico,
  hasard?: () => number,
): ResultatMot | { erreur: string } {
  const analyse = analyserCoup(plateau, poses, dico)
  if (analyse.erreur) return { erreur: analyse.erreur }
  if (!analyse.valide) return { erreur: `Mot inconnu : ${analyse.motsInconnus.join(', ')}` }
  const reste = retirerDuChevalet(chevalet, jetonsUtilises(poses))
  if (!reste) return { erreur: 'Ces lettres ne sont pas sur le chevalet' }
  const p = piocher(sac, 7 - reste.length, hasard)
  return { analyse, plateau: jouer(plateau, poses), chevalet: [...reste, ...p.tires], sac: p.sac }
}

/** Change des lettres : on pioche d'abord, puis les lettres rendues retournent dans le sac. */
export function changer(
  chevalet: readonly string[],
  sac: readonly string[],
  rendues: readonly string[],
  hasard?: () => number,
): { chevalet: string[]; sac: string[] } | { erreur: string } {
  if (sac.length < MIN_SAC_POUR_CHANGER) return { erreur: 'Il faut au moins 7 lettres dans le sac pour changer' }
  if (rendues.length === 0) return { erreur: 'Choisis les lettres à changer' }
  const reste = retirerDuChevalet(chevalet, rendues)
  if (!reste) return { erreur: 'Ces lettres ne sont pas sur le chevalet' }
  const p = piocher(sac, rendues.length, hasard)
  return { chevalet: [...reste, ...p.tires], sac: [...p.sac, ...rendues] }
}

/**
 * Lettres de l'adversaire, déduites du reste : tout ce qui n'est ni sur le plateau, ni dans le sac, ni sur mon
 * chevalet. (Sans serveur, rien n'est vraiment caché : c'est aussi ce qui permet de calculer la fin de partie.)
 */
export function lettresAdversaire(plateau: Plateau, sac: readonly string[], monChevalet: readonly string[]): string[] {
  const reste = tousLesJetons()
  const enlever = (j: string) => {
    const i = reste.indexOf(j)
    if (i >= 0) reste.splice(i, 1)
  }
  for (const t of plateau) if (t) enlever(t >= 'a' ? '?' : t)
  for (const j of sac) enlever(j)
  for (const j of monChevalet) enlever(j)
  return reste
}

export interface Fin {
  /** Points à ajouter (ou retirer) à chaque joueur, dans l'ordre des chevalets fournis. */
  ajustements: number[]
  raison: 'chevalet-vide' | 'passes'
}

/**
 * Fin de partie éventuelle, après un coup. `chevalets` : les lettres restantes de chaque joueur.
 * Renvoie null si la partie continue.
 */
export function finDePartie(sac: readonly string[], chevalets: readonly (readonly string[])[], passesDeSuite: number): Fin | null {
  const vide = chevalets.findIndex((c) => c.length === 0)
  if (sac.length === 0 && vide >= 0) {
    const restes = chevalets.map((c) => sommeValeurs(c))
    const total = restes.reduce((a, b) => a + b, 0)
    return { ajustements: restes.map((r, i) => (i === vide ? total : -r)), raison: 'chevalet-vide' }
  }
  if (passesDeSuite >= PASSES_MAX) return { ajustements: chevalets.map((c) => -sommeValeurs(c)), raison: 'passes' }
  return null
}

/** Vérifie un plateau reçu (225 cases, lettres correctes). */
export function plateauValide(texte: string): boolean {
  if (texte.length !== NB_CASES) return false
  try {
    return plateauDepuisTexte(texte).every((c) => c === '' || /^[A-Za-z]$/.test(c))
  } catch {
    return false
  }
}
