// Sauvegarde des parties contre l'IA sur l'appareil : parties en cours (on peut en avoir plusieurs), historique et réglages.

import { abandonnerIA, resumeIA, type PartieIA, type ResumeIA } from '../jeu/contreIA'
import { NIVEAUX, type NiveauIA } from '../jeu/ia'
import { ecrire, lire } from '../lib/stockage'
import { ecrireEstampille, lireEstampille, signaler, type Adapteur } from '../lib/synchro'

const ENCOURS = 'ia.encours'
/** Ancien emplacement de l'unique partie en cours, reprise dans ENCOURS au premier accès. */
const ANCIENNE_PARTIE = 'ia.partie'
const HISTORIQUE = 'ia.historique'
const REGLAGES = 'ia.reglages'
const PARTIES = 'ia.parties'
const MAX_HISTORIQUE = 100
/** Parties terminées gardées en entier (avec leurs coups) pour pouvoir les analyser plus tard. */
const MAX_PARTIES = 10

/**
 * Parties en cours, la dernière jouée en premier. Avant, l'appli n'en gardait qu'une : si l'appareil en a encore une à
 * l'ancien emplacement, elle est reprise ici.
 */
export function lirePartiesIAEnCours(): PartieIA[] {
  const liste = lire<PartieIA[]>(ENCOURS, [])
  const ancienne = lire<PartieIA | null>(ANCIENNE_PARTIE, null)
  if (!ancienne) return liste
  ecrire(ANCIENNE_PARTIE, null)
  if (ancienne.finie || liste.some((p) => p.id === ancienne.id)) return liste
  const suite = [ancienne, ...liste]
  ecrire(ENCOURS, suite)
  return suite
}

export const trouverPartieIAEnCours = (id: string): PartieIA | null => lirePartiesIAEnCours().find((p) => p.id === id) ?? null

/** Enregistre une partie en cours, nouvelle ou mise à jour : elle passe en tête, c'est la dernière jouée. */
export function enregistrerPartieIA(p: PartieIA) {
  const enregistree = { ...p, majLe: Date.now() }
  ecrire(ENCOURS, [enregistree, ...lirePartiesIAEnCours().filter((x) => x.id !== p.id)])
  signaler('ia-encours', p.id, enregistree, enregistree.majLe)
}

/** La partie n'est plus en cours (terminée ou abandonnée). */
export function retirerPartieIA(id: string) {
  ecrire(ENCOURS, lirePartiesIAEnCours().filter((p) => p.id !== id))
  signaler('ia-encours', id, null)
}

/** Abandon : si des coups ont été joués, l'IA gagne et la partie est rangée dans l'historique ; sinon elle disparaît. */
export function abandonnerPartieIA(p: PartieIA) {
  if (p.coups.length) archiverIA(abandonnerIA(p))
  retirerPartieIA(p.id)
}

export interface ReglagesIA {
  niveau: NiveauIA
  /** Qui joue le premier coup. */
  premier: 'moi' | 'ia' | 'hasard'
}

export const lireReglagesIA = (): ReglagesIA => ({ niveau: 'amateur', premier: 'hasard', ...lire<Partial<ReglagesIA>>(REGLAGES, {}) })
export function ecrireReglagesIA(r: ReglagesIA) {
  ecrire(REGLAGES, r)
  signaler('reglages', 'ia', r)
}

/** Parties terminées, la plus récente en premier. */
export const lireHistoriqueIA = (): ResumeIA[] => lire<ResumeIA[]>(HISTORIQUE, [])

export function archiverIA(p: PartieIA) {
  const resume = resumeIA(p)
  const h = [resume, ...lireHistoriqueIA().filter((x) => x.id !== p.id)]
  ecrire(HISTORIQUE, h.slice(0, MAX_HISTORIQUE))
  signaler('ia-histo', p.id, resume, p.creeLe)
  // Ce que les plafonds font partir est supprimé partout, pour que tous les appareils gardent les mêmes parties.
  for (const x of h.slice(MAX_HISTORIQUE)) signaler('ia-histo', x.id, null)
  if (p.coups.length) {
    const gardees = [p, ...lirePartiesIA().filter((x) => x.id !== p.id)]
    ecrire(PARTIES, gardees.slice(0, MAX_PARTIES))
    signaler('ia-partie', p.id, p, p.creeLe)
    for (const x of gardees.slice(MAX_PARTIES)) signaler('ia-partie', x.id, null)
  }
}

/** Les dernières parties terminées, avec leurs coups, la plus récente en premier. */
export const lirePartiesIA = (): PartieIA[] => lire<PartieIA[]>(PARTIES, [])

/** Une partie à analyser : une partie en cours (« courante » : la dernière jouée) ou une partie terminée gardée. */
export function trouverPartieIA(id: string): PartieIA | null {
  const enCours = lirePartiesIAEnCours()
  const courante = id === 'courante' ? enCours[0] : enCours.find((p) => p.id === id)
  return courante ?? lirePartiesIA().find((p) => p.id === id) ?? null
}

export function supprimerHistoriqueIA() {
  const resumes = lireHistoriqueIA()
  const parties = lirePartiesIA()
  ecrire(HISTORIQUE, [])
  ecrire(PARTIES, [])
  for (const r of resumes) signaler('ia-histo', r.id, null)
  for (const p of parties) signaler('ia-partie', p.id, null)
}

// --- Synchronisation avec le compte (voir lib/synchro.ts) ---

const parDate = (a: PartieIA, b: PartieIA) => (b.majLe ?? b.creeLe) - (a.majLe ?? a.creeLe)

export const adapteursIA: Record<'encours' | 'histo' | 'partie' | 'reglages', Adapteur> = {
  encours: {
    lister: () => lirePartiesIAEnCours().map((p) => ({ id: p.id, majLe: p.majLe ?? p.creeLe, donnees: p })),
    appliquer(id, donnees, majLe) {
      const reste = lirePartiesIAEnCours().filter((p) => p.id !== id)
      ecrire(ENCOURS, donnees ? [{ ...(donnees as PartieIA), majLe }, ...reste].sort(parDate) : reste)
    },
  },
  histo: {
    lister: () => lireHistoriqueIA().map((r) => ({ id: r.id, majLe: r.date, donnees: r })),
    appliquer(id, donnees) {
      const reste = lireHistoriqueIA().filter((r) => r.id !== id)
      ecrire(HISTORIQUE, donnees ? [donnees as ResumeIA, ...reste].sort((a, b) => b.date - a.date) : reste)
    },
    elaguer() {
      const liste = lireHistoriqueIA()
      if (liste.length <= MAX_HISTORIQUE) return
      ecrire(HISTORIQUE, liste.slice(0, MAX_HISTORIQUE))
      for (const x of liste.slice(MAX_HISTORIQUE)) signaler('ia-histo', x.id, null)
    },
  },
  partie: {
    lister: () => lirePartiesIA().map((p) => ({ id: p.id, majLe: p.creeLe, donnees: p })),
    appliquer(id, donnees) {
      const reste = lirePartiesIA().filter((p) => p.id !== id)
      ecrire(PARTIES, donnees ? [donnees as PartieIA, ...reste].sort((a, b) => b.creeLe - a.creeLe) : reste)
    },
    elaguer() {
      const liste = lirePartiesIA()
      if (liste.length <= MAX_PARTIES) return
      ecrire(PARTIES, liste.slice(0, MAX_PARTIES))
      for (const x of liste.slice(MAX_PARTIES)) signaler('ia-partie', x.id, null)
    },
  },
  reglages: {
    lister: () => (lireEstampille('ia') ? [{ id: 'ia', majLe: lireEstampille('ia'), donnees: lireReglagesIA() }] : []),
    appliquer(_id, donnees, majLe) {
      if (!donnees) return
      ecrire(REGLAGES, donnees)
      ecrireEstampille('ia', majLe)
    },
  },
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
