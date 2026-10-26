// Sauvegarde des parties contre l'IA sur l'appareil : partie en cours (reprise à l'ouverture), historique et réglages.

import { resumeIA, type PartieIA, type ResumeIA } from '../jeu/contreIA'
import { NIVEAUX, type NiveauIA } from '../jeu/ia'
import { ecrire, lire } from '../lib/stockage'

const PARTIE = 'ia.partie'
const HISTORIQUE = 'ia.historique'
const REGLAGES = 'ia.reglages'
const PARTIES = 'ia.parties'
const MAX_HISTORIQUE = 100
/** Parties terminées gardées en entier (avec leurs coups) pour pouvoir les analyser plus tard. */
const MAX_PARTIES = 10

export const lirePartieIA = (): PartieIA | null => lire<PartieIA | null>(PARTIE, null)
export const ecrirePartieIA = (p: PartieIA | null) => ecrire(PARTIE, p)

export interface ReglagesIA {
  niveau: NiveauIA
  /** Qui joue le premier coup. */
  premier: 'moi' | 'ia' | 'hasard'
}

export const lireReglagesIA = (): ReglagesIA => ({ niveau: 'amateur', premier: 'hasard', ...lire<Partial<ReglagesIA>>(REGLAGES, {}) })
export const ecrireReglagesIA = (r: ReglagesIA) => ecrire(REGLAGES, r)

/** Parties terminées, la plus récente en premier. */
export const lireHistoriqueIA = (): ResumeIA[] => lire<ResumeIA[]>(HISTORIQUE, [])

export function archiverIA(p: PartieIA) {
  const h = lireHistoriqueIA().filter((x) => x.id !== p.id)
  ecrire(HISTORIQUE, [resumeIA(p), ...h].slice(0, MAX_HISTORIQUE))
  if (p.coups.length) ecrire(PARTIES, [p, ...lirePartiesIA().filter((x) => x.id !== p.id)].slice(0, MAX_PARTIES))
}

/** Les dernières parties terminées, avec leurs coups, la plus récente en premier. */
export const lirePartiesIA = (): PartieIA[] => lire<PartieIA[]>(PARTIES, [])

/** Une partie à analyser : la partie en cours de l'appareil (si c'est elle) ou une partie terminée gardée. */
export function trouverPartieIA(id: string): PartieIA | null {
  const courante = lirePartieIA()
  if (courante && (id === 'courante' || courante.id === id)) return courante
  return lirePartiesIA().find((p) => p.id === id) ?? null
}

export function supprimerHistoriqueIA() {
  ecrire(HISTORIQUE, [])
  ecrire(PARTIES, [])
}

export interface BilanNiveau {
  niveau: NiveauIA
  parties: number
  victoires: number
  egalites: number
  defaites: number
  /** Meilleur score du joueur dans une partie gagnée contre ce niveau. */
  meilleur: number
}

/** Victoires, égalités et défaites contre chaque niveau (les abandons comptent comme des défaites). */
export function bilanParNiveau(historique: readonly ResumeIA[] = lireHistoriqueIA()): BilanNiveau[] {
  return NIVEAUX.map((niveau) => {
    const parties = historique.filter((p) => p.niveau === niveau)
    const victoires = parties.filter((p) => p.gagnant === 'moi')
    return {
      niveau,
      parties: parties.length,
      victoires: victoires.length,
      egalites: parties.filter((p) => p.gagnant === null).length,
      defaites: parties.filter((p) => p.gagnant === 'ia').length,
      meilleur: victoires.reduce((m, p) => Math.max(m, p.moi), 0),
    }
  })
}
