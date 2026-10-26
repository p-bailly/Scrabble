// Sauvegarde des parties contre l'IA sur l'appareil : partie en cours (reprise à l'ouverture), historique et réglages.

import { resumeIA, type PartieIA, type ResumeIA } from '../jeu/contreIA'
import { NIVEAUX, type NiveauIA } from '../jeu/ia'
import { ecrire, lire } from '../lib/stockage'

const PARTIE = 'ia.partie'
const HISTORIQUE = 'ia.historique'
const REGLAGES = 'ia.reglages'
const MAX_HISTORIQUE = 100

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
}

export function supprimerHistoriqueIA() {
  ecrire(HISTORIQUE, [])
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
