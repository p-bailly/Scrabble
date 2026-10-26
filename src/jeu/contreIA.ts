// Partie classique contre l'IA : chacun son chevalet, on joue à tour de rôle. Mêmes règles que les parties à deux
// (classique.ts), mais tout se passe sur l'appareil : l'état de la partie est un objet qu'on sauvegarde tel quel.
//
// Toutes les fonctions sont pures : elles renvoient une nouvelle partie (ou un message d'erreur).

import { MIN_SAC_POUR_CHANGER, changer, finDePartie, lettresAdversaire, piocher } from './classique'
import { jetonsUtilises, jouer, retirerDuChevalet, type Coup } from './coup'
import type { Indice } from './duplicate'
import type { Decision, NiveauIA } from './ia'
import { tousLesJetons } from './lettres'
import { plateauDepuisTexte, plateauEnTexte, plateauVide } from './plateau'

export type Camp = 'moi' | 'ia'

export const autreCamp = (c: Camp): Camp => (c === 'moi' ? 'ia' : 'moi')

export interface CoupIA {
  numero: number
  camp: Camp
  type: 'mot' | 'change' | 'passe'
  coup?: Coup
  nbChanges?: number
  points: number
  /** Chevalet du joueur avant ce tour, gardé pour l'analyse de la partie (absent des parties d'avant l'analyse). */
  chevalet?: string[]
}

export interface FinIA {
  gagnant: Camp | null
  raison: 'chevalet-vide' | 'passes' | 'abandon'
  /** Points ajoutés ou retirés à chacun en fin de partie. */
  ajustements: Record<Camp, number>
}

export interface PartieIA {
  version: 1
  id: string
  niveau: NiveauIA
  creeLe: number
  /** Dernière sauvegarde de la partie en cours (la liste des parties en cours s'ordonne dessus). */
  majLe?: number
  plateau: string
  sac: string[]
  chevalets: Record<Camp, string[]>
  scores: Record<Camp, number>
  tour: Camp
  /** Tours sans mot posé à la suite (passes). */
  passes: number
  coups: CoupIA[]
  finie: boolean
  fin: FinIA | null
  /** La partie telle qu'elle était au début de mon dernier tour, avant mon coup : de quoi l'annuler. */
  avant?: Omit<PartieIA, 'avant'>
  /** Nombre de coups annulés. */
  annulations?: number
  /** Indices révélés pour le tour `tour` (le numéro du coup à jouer) ; ils ne valent que pour ce tour. */
  indices?: { tour: number; reveles: Indice[] }
  /** Nombre d'indices demandés dans la partie. */
  nbIndices?: number
}

export function nouvellePartieIA(
  niveau: NiveauIA,
  premier: Camp = Math.random() < 0.5 ? 'moi' : 'ia',
  hasard: () => number = Math.random,
  id = `ia-${Date.now()}`,
): PartieIA {
  const moi = piocher(tousLesJetons(), 7, hasard)
  const ia = piocher(moi.sac, 7, hasard)
  return {
    version: 1,
    id,
    niveau,
    creeLe: Date.now(),
    plateau: plateauEnTexte(plateauVide()),
    sac: ia.sac,
    chevalets: { moi: moi.tires, ia: ia.tires },
    scores: { moi: 0, ia: 0 },
    tour: premier,
    passes: 0,
    coups: [],
    finie: false,
    fin: null,
  }
}

/** Vérifie la fin de partie après un coup, et la prononce s'il y a lieu. */
function conclure(p: PartieIA): PartieIA {
  const fin = finDePartie(p.sac, [p.chevalets.moi, p.chevalets.ia], p.passes)
  if (!fin) return p
  const ajustements: Record<Camp, number> = { moi: fin.ajustements[0], ia: fin.ajustements[1] }
  const scores = { moi: p.scores.moi + ajustements.moi, ia: p.scores.ia + ajustements.ia }
  const gagnant = scores.moi === scores.ia ? null : scores.moi > scores.ia ? 'moi' : 'ia'
  return { ...p, scores, finie: true, fin: { gagnant, raison: fin.raison, ajustements } }
}

const verifierTour = (p: PartieIA, camp: Camp): string | null =>
  p.finie ? 'La partie est terminée' : p.tour !== camp ? 'Ce n’est pas le tour de ce joueur' : null

/** Pose un mot déjà validé (présent dans le dictionnaire) : retire les lettres du chevalet, pioche, marque les points. */
export function jouerMotIA(p: PartieIA, camp: Camp, coup: Coup, hasard?: () => number): PartieIA | { erreur: string } {
  const refus = verifierTour(p, camp)
  if (refus) return { erreur: refus }
  const reste = retirerDuChevalet(p.chevalets[camp], jetonsUtilises(coup.poses))
  if (!reste) return { erreur: 'Ces lettres ne sont pas sur le chevalet' }
  const pioche = piocher(p.sac, 7 - reste.length, hasard)
  const suite: PartieIA = {
    ...p,
    plateau: plateauEnTexte(jouer(plateauDepuisTexte(p.plateau), coup.poses)),
    sac: pioche.sac,
    chevalets: { ...p.chevalets, [camp]: [...reste, ...pioche.tires] },
    scores: { ...p.scores, [camp]: p.scores[camp] + coup.points },
    tour: autreCamp(camp),
    passes: 0,
    coups: [...p.coups, { numero: p.coups.length + 1, camp, type: 'mot', coup, points: coup.points, chevalet: p.chevalets[camp] }],
  }
  return conclure(suite)
}

/** Change des lettres (au moins 7 dans le sac) : le tour passe. */
export function changerIA(p: PartieIA, camp: Camp, rendues: readonly string[], hasard?: () => number): PartieIA | { erreur: string } {
  const refus = verifierTour(p, camp)
  if (refus) return { erreur: refus }
  const r = changer(p.chevalets[camp], p.sac, rendues, hasard)
  if ('erreur' in r) return r
  return conclure({
    ...p,
    sac: r.sac,
    chevalets: { ...p.chevalets, [camp]: r.chevalet },
    tour: autreCamp(camp),
    passes: 0,
    coups: [...p.coups, { numero: p.coups.length + 1, camp, type: 'change', nbChanges: rendues.length, points: 0, chevalet: p.chevalets[camp] }],
  })
}

export function passerIA(p: PartieIA, camp: Camp): PartieIA | { erreur: string } {
  const refus = verifierTour(p, camp)
  if (refus) return { erreur: refus }
  return conclure({
    ...p,
    tour: autreCamp(camp),
    passes: p.passes + 1,
    coups: [...p.coups, { numero: p.coups.length + 1, camp, type: 'passe', points: 0, chevalet: p.chevalets[camp] }],
  })
}

/** Applique la décision de l'IA (qui joue le camp `ia`, sauf dans les parties IA contre IA des tests). */
export function appliquerDecision(
  p: PartieIA,
  d: Decision,
  hasard?: () => number,
  camp: Camp = 'ia',
): PartieIA | { erreur: string } {
  if (d.type === 'mot') return jouerMotIA(p, camp, d.coup, hasard)
  if (d.type === 'change') return changerIA(p, camp, d.lettres, hasard)
  return passerIA(p, camp)
}

/** La partie sans sa mémoire du tour précédent (pour ne pas empiler les mémoires les unes dans les autres). */
const sansAvant = ({ avant: _avant, ...reste }: PartieIA): Omit<PartieIA, 'avant'> => reste

/** `apres` : ma partie après mon coup. On y garde la partie d'avant, pour pouvoir annuler ce coup. */
export const memoriserAvant = (avant: PartieIA, apres: PartieIA): PartieIA => ({ ...apres, avant: sansAvant(avant) })

/** Mon dernier coup peut-il être annulé ? (Même si l'IA y a déjà répondu.) */
export const peutAnnuler = (p: PartieIA): boolean => !p.finie && !!p.avant

/**
 * Annule mon dernier coup, et la réponse de l'IA s'il y en a eu une : on repart de mon tour, avec les mêmes lettres.
 * On ne peut annuler qu'un coup à la fois. Les indices déjà demandés restent comptés.
 */
export function annulerCoup(p: PartieIA): PartieIA | { erreur: string } {
  if (!peutAnnuler(p) || !p.avant) return { erreur: 'Il n’y a rien à annuler' }
  return { ...p.avant, annulations: (p.annulations ?? 0) + 1, nbIndices: p.nbIndices }
}

/** Indices déjà révélés pour le coup à jouer. */
export const indicesDuTour = (p: PartieIA): Indice[] => (p.indices?.tour === p.coups.length + 1 ? p.indices.reveles : [])

/** Révèle un indice pour le coup à jouer (sans effet s'il l'est déjà) et le compte. */
export function demanderIndiceIA(p: PartieIA, indice: Indice): PartieIA {
  const deja = indicesDuTour(p)
  if (deja.includes(indice)) return p
  return { ...p, indices: { tour: p.coups.length + 1, reveles: [...deja, indice] }, nbIndices: (p.nbIndices ?? 0) + 1 }
}

/** Les coups annulés et les indices demandés, en une phrase (vide si aucune aide). */
export function aides(p: { annulations?: number; nbIndices?: number }): string {
  const a = p.annulations ?? 0
  const i = p.nbIndices ?? 0
  return [a && `${a} coup${a > 1 ? 's' : ''} annulé${a > 1 ? 's' : ''}`, i && `${i} indice${i > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
}

/** Abandon du joueur : l'IA gagne, sans ajustement de fin de partie. */
export function abandonnerIA(p: PartieIA): PartieIA {
  if (p.finie) return p
  return { ...p, finie: true, fin: { gagnant: 'ia', raison: 'abandon', ajustements: { moi: 0, ia: 0 } } }
}

export const peutChangerIA = (p: PartieIA): boolean => p.sac.length >= MIN_SAC_POUR_CHANGER

/**
 * Chevalet de l'adversaire de `camp`, déduit des lettres vues quand le sac est vide : sert à l'IA pour sa fin de
 * partie. Renvoie null tant que le sac n'est pas vide (le chevalet de l'adversaire est alors inconnu).
 */
export function chevaletAdverseConnu(p: PartieIA, camp: Camp): string[] | null {
  if (p.sac.length > 0) return null
  return lettresAdversaire(plateauDepuisTexte(p.plateau), p.sac, p.chevalets[camp])
}

export interface ResumeIA {
  id: string
  niveau: NiveauIA
  date: number
  moi: number
  ia: number
  gagnant: Camp | null
  abandon: boolean
  /** Coups annulés et indices demandés (absents des parties d'avant ces aides). */
  annulations?: number
  indices?: number
}

export const resumeIA = (p: PartieIA): ResumeIA => ({
  id: p.id,
  niveau: p.niveau,
  date: p.creeLe,
  moi: p.scores.moi,
  ia: p.scores.ia,
  gagnant: p.fin?.gagnant ?? null,
  abandon: p.fin?.raison === 'abandon',
  ...(p.annulations ? { annulations: p.annulations } : {}),
  ...(p.nbIndices ? { indices: p.nbIndices } : {}),
})
