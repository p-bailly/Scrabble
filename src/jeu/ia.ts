// Adversaire artificiel : cinq niveaux, du débutant (petits mots, loin du meilleur coup) au champion (meilleur
// coup en tenant compte des lettres gardées, échanges, et en fin de partie la réponse de l'adversaire).
//
// Le moteur génère tous les coups légaux (generateur.ts) ; le niveau règle seulement le choix :
//  - longueur maximale du mot principal et part du meilleur score visée, pour les niveaux qui « ne voient pas tout » ;
//  - probabilité de repérer un scrabble (7 lettres posées d'un coup) ;
//  - poids de la valeur des lettres gardées (le « reste ») pour les niveaux qui jouent le meilleur coup ;
//  - seuil sous lequel il préfère changer des lettres ;
//  - fin de partie : regarder la meilleure réponse de l'adversaire quand son chevalet est connu (sac vide).

import { MIN_SAC_POUR_CHANGER } from './classique'
import { jetonsUtilises, jouer, retirerDuChevalet, type Coup } from './coup'
import type { Dawg } from './dawg'
import { genererCoups } from './generateur'
import { JOKER, VOYELLES, sommeValeurs } from './lettres'
import type { Plateau } from './plateau'

export type NiveauIA = 'debutant' | 'amateur' | 'confirme' | 'expert' | 'champion'

export const NIVEAUX: readonly NiveauIA[] = ['debutant', 'amateur', 'confirme', 'expert', 'champion']

export interface ProfilIA {
  nom: string
  description: string
  /** Longueur maximale du mot principal qu'il pense à jouer. */
  longueurMax: number
  /** Part du meilleur score qu'il vise (tirée entre les deux bornes) ; null : il cherche le meilleur coup. */
  cible: readonly [number, number] | null
  /** Probabilité de repérer un scrabble (7 lettres d'un coup) quand il y en a un. */
  scrabble: number
  /** Poids de la valeur des lettres gardées dans le choix du coup (0 : il ne s'en soucie pas). */
  reste: number
  /** Écart de score accepté avec le meilleur coup (valeur du reste comprise), pour varier le jeu. */
  marge: number
  /** Valeur du coup en dessous de laquelle il préfère changer des lettres ; null : il ne le fait que sans coup. */
  echange: number | null
  /** En fin de partie, regarde la meilleure réponse de l'adversaire. */
  anticipe: boolean
}

export const PROFILS: Readonly<Record<NiveauIA, ProfilIA>> = {
  debutant: {
    nom: 'Débutant',
    description: 'Petits mots de 2 à 4 lettres, loin du meilleur coup.',
    longueurMax: 4,
    cible: [0.15, 0.5],
    scrabble: 0,
    reste: 0,
    marge: 0,
    echange: null,
    anticipe: false,
  },
  amateur: {
    nom: 'Amateur',
    description: 'Mots courants jusqu’à 5 lettres, un bon coup de temps en temps.',
    longueurMax: 5,
    cible: [0.4, 0.75],
    scrabble: 0.02,
    reste: 0,
    marge: 0,
    echange: null,
    anticipe: false,
  },
  confirme: {
    nom: 'Confirmé',
    description: 'Joue de bons coups, repère un scrabble une fois sur deux.',
    longueurMax: 7,
    cible: [0.55, 0.9],
    scrabble: 0.3,
    reste: 0,
    marge: 0,
    echange: null,
    anticipe: false,
  },
  expert: {
    nom: 'Expert',
    description: 'Presque toujours le meilleur coup, et il garde les bonnes lettres.',
    longueurMax: 15,
    cible: null,
    scrabble: 0.8,
    reste: 0.3,
    marge: 12,
    echange: null,
    anticipe: false,
  },
  champion: {
    nom: 'Champion',
    description: 'Meilleur coup, bon reste, échanges, et calcul de la fin de partie.',
    longueurMax: 15,
    cible: null,
    scrabble: 1,
    reste: 1,
    marge: 0,
    echange: 12,
    anticipe: true,
  },
}

/** Ce que l'IA sait au moment de jouer. */
export interface ContexteIA {
  niveau: NiveauIA
  plateau: Plateau
  chevalet: string[]
  /** Nombre de jetons dans le sac. */
  sac: number
  /** Chevalet de l'adversaire s'il se déduit (sac vide), sinon null. */
  adversaire: string[] | null
}

export type Decision = { type: 'mot'; coup: Coup } | { type: 'change'; lettres: string[] } | { type: 'passe' }

// ---------------------------------------------------------------------------------------------------------------
// Valeur des lettres gardées

/** Valeur (en points) de garder cette lettre, d'après l'expérience du jeu : le joker et le S valent cher. */
const VALEUR_GARDEE: Readonly<Record<string, number>> = {
  [JOKER]: 25, S: 7, E: 2.5, R: 1, A: 0.5, N: 0.5, T: 0.5, X: 1, Z: 0.5, L: 0.3, I: 0, D: -0.3, M: -0.5, C: -0.5,
  P: -0.8, O: -1, J: -1.5, G: -2, B: -2, H: -2, Y: -2, F: -2.5, U: -3, K: -3.5, V: -4, W: -4.5, Q: -8,
}

/** Estimation de ce que valent, pour la suite de la partie, les lettres qu'on garde. */
export function valeurReste(reste: readonly string[]): number {
  if (reste.length === 0) return 0
  let v = 0
  const nb = new Map<string, number>()
  let voyelles = 0
  let consonnes = 0
  for (const l of reste) {
    v += VALEUR_GARDEE[l] ?? 0
    nb.set(l, (nb.get(l) ?? 0) + 1)
    if (l === JOKER) continue
    if (VOYELLES.has(l) && l !== 'Y') voyelles++
    else consonnes++
  }
  // Les doublons gênent (sauf le E, très fréquent).
  for (const [l, n] of nb) if (l !== JOKER && n > 1) v -= (n - 1) * (l === 'E' ? 1.5 : 3.5)
  // Un chevalet équilibré (environ 4 voyelles sur 10) se joue mieux.
  const total = voyelles + consonnes
  if (total >= 2) v -= 2 * Math.max(0, Math.abs(voyelles - total * 0.42) - 1)
  return v
}

/** Lettres à rendre pour garder le meilleur reste (au moins une lettre rendue). */
export function meilleurEchange(chevalet: readonly string[]): string[] {
  const n = chevalet.length
  let meilleur = -Infinity
  let rendre: string[] = [...chevalet]
  for (let garde = 0; garde < (1 << n) - 1; garde++) {
    const gardees: string[] = []
    const rendues: string[] = []
    for (let i = 0; i < n; i++) (garde & (1 << i) ? gardees : rendues).push(chevalet[i])
    const v = valeurReste(gardees)
    if (v > meilleur) {
      meilleur = v
      rendre = rendues
    }
  }
  return rendre
}

// ---------------------------------------------------------------------------------------------------------------
// Choix du coup

/** Cherche la meilleure réponse de l'adversaire sur ce plateau avec ce chevalet. */
export type Reponse = (plateau: Plateau, chevalet: string[]) => Coup | null

const resteApres = (chevalet: readonly string[], c: Coup): string[] =>
  retirerDuChevalet(chevalet, jetonsUtilises(c.poses)) ?? []

/** Évalue un coup de fin de partie, le chevalet de l'adversaire étant connu : écart de points jusqu'à la fin. */
function valeurFinale(c: Coup, ctx: ContexteIA, reponse: Reponse): number {
  const adversaire = ctx.adversaire!
  const reste = resteApres(ctx.chevalet, c)
  // Je finis : l'adversaire perd ses lettres et je les gagne.
  if (reste.length === 0) return c.points + 2 * sommeValeurs(adversaire)
  const r = reponse(jouer(ctx.plateau, c.poses), adversaire)
  if (!r) return c.points
  let v = c.points - r.points
  // Il finit à son tour : je perds mes lettres et il les gagne.
  if (r.poses.length === adversaire.length) v -= 2 * sommeValeurs(reste)
  return v
}

/**
 * Choisit le coup à jouer parmi `coups` (tous les coups légaux, du meilleur au moins bon).
 * `reponse` n'est utilisé que par le champion, en fin de partie.
 */
export function choisir(coups: readonly Coup[], ctx: ContexteIA, hasard: () => number, reponse?: Reponse): Decision {
  const p = PROFILS[ctx.niveau]
  const peutChanger = ctx.sac >= MIN_SAC_POUR_CHANGER

  if (coups.length === 0) {
    if (!peutChanger) return { type: 'passe' }
    return { type: 'change', lettres: p.reste > 0 ? meilleurEchange(ctx.chevalet) : [...ctx.chevalet] }
  }

  // Un scrabble repéré est joué ; un scrabble raté n'existe pas pour lui.
  let candidats: readonly Coup[] = coups
  if (coups.some((c) => c.poses.length === 7)) {
    if (hasard() < p.scrabble) return { type: 'mot', coup: coups.find((c) => c.poses.length === 7)! }
    candidats = coups.filter((c) => c.poses.length < 7)
  }
  const courts = candidats.filter((c) => c.mot.length <= p.longueurMax)
  if (courts.length) candidats = courts
  if (candidats.length === 0) candidats = coups

  // Niveaux qui visent une part du meilleur score.
  if (p.cible) {
    const [bas, haut] = p.cible
    const but = candidats[0].points * (bas + (haut - bas) * hasard())
    let choisi = candidats[0]
    for (const c of candidats) if (Math.abs(c.points - but) < Math.abs(choisi.points - but)) choisi = c
    return { type: 'mot', coup: choisi }
  }

  // Fin de partie du champion : on connaît le chevalet adverse, on compare coup et réponse.
  if (p.anticipe && ctx.adversaire && reponse) {
    const sorties = candidats.filter((c) => c.poses.length === ctx.chevalet.length).slice(0, 3)
    const essais = new Set([...candidats.slice(0, 8), ...sorties])
    let meilleur: Coup | null = null
    let valeur = -Infinity
    for (const c of essais) {
      const v = valeurFinale(c, ctx, reponse)
      if (v > valeur) {
        valeur = v
        meilleur = c
      }
    }
    if (meilleur) return { type: 'mot', coup: meilleur }
  }

  // Meilleur coup en tenant compte des lettres gardées.
  const plancher = candidats[0].points - 40
  const equite = new Map<Coup, number>()
  for (const c of candidats) {
    if (c.points < plancher || equite.size >= 400) break
    equite.set(c, c.points + p.reste * valeurReste(resteApres(ctx.chevalet, c)))
  }
  let max = -Infinity
  for (const e of equite.values()) max = Math.max(max, e)

  if (p.echange !== null && peutChanger && max < p.echange) {
    return { type: 'change', lettres: meilleurEchange(ctx.chevalet) }
  }
  const bons = [...equite].filter(([, e]) => e >= max - p.marge)
  return { type: 'mot', coup: bons[Math.floor(hasard() * bons.length)][0] }
}

/** Décide du coup de l'IA : génère tous les coups légaux, puis choisit selon le niveau. */
export function decider(dawg: Dawg, ctx: ContexteIA, hasard: () => number = Math.random): Decision {
  const coups = genererCoups(dawg, ctx.plateau, ctx.chevalet)
  const reponse: Reponse = (plateau, chevalet) => genererCoups(dawg, plateau, chevalet, { limite: 1 })[0] ?? null
  return choisir(coups, ctx, hasard, reponse)
}
