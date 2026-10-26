// Sauvegarde du duplicate sur l'appareil : parties en cours (on peut en avoir plusieurs, chacune reprise là où elle
// en était) et historique.

import type { Coup } from '../jeu/coup'
import { modeDe, totaux, type Essai, type Indice, type ModeDuplicate, type PartieDuplicate } from '../jeu/duplicate'
import { ecrire, lire } from '../lib/stockage'
import { ecrireEstampille, lireEstampille, signaler, type Adapteur } from '../lib/synchro'

const PARTIES = 'solo.parties'
/** Ancien emplacement de l'unique partie en cours et de son coup, repris dans PARTIES au premier accès. */
const ANCIENNE_PARTIE = 'solo.partie'
const COUP = 'solo.coup'
const HISTORIQUE = 'solo.historique'
const REGLAGES = 'solo.reglages'
const MAX_HISTORIQUE = 60

/** Ce qui concerne le coup en cours : temps écoulé, coup noté et indices demandés (topping). */
export interface EtatCoup {
  numero: number
  ecoule: number
  bulletin: Coup | null
  indices: Indice[]
  /** Mots proposés (topping). */
  essais: Essai[]
}

export interface ResumePartie {
  id: string
  mode: ModeDuplicate
  graine: string
  temps: number
  date: number
  joueur: number
  top: number
  pourcentage: number
  nbCoups: number
  /** Nombre de tops trouvés. */
  trouves: number
}

export interface Reglages {
  temps: number
  mode: ModeDuplicate
}

/** État du coup en cours de chaque partie, sous une clé à part : le chrono l'écrit toutes les secondes. */
const cleCoup = (id: string) => `${COUP}.${id}`

/**
 * Parties en cours, la dernière jouée en premier. Avant, l'appli n'en gardait qu'une : si l'appareil en a encore une à
 * l'ancien emplacement, elle est reprise ici avec le chrono de son coup.
 */
export function lirePartiesEnCours(): PartieDuplicate[] {
  const liste = lire<PartieDuplicate[]>(PARTIES, [])
  const ancienne = lire<PartieDuplicate | null>(ANCIENNE_PARTIE, null)
  if (!ancienne) return liste
  const coup = lire<EtatCoup | null>(COUP, null)
  ecrire(ANCIENNE_PARTIE, null)
  ecrire(COUP, null)
  if (ancienne.finie || liste.some((p) => p.id === ancienne.id)) return liste
  if (coup) ecrire(cleCoup(ancienne.id), coup)
  const suite = [ancienne, ...liste]
  ecrire(PARTIES, suite)
  return suite
}

export const trouverPartieEnCours = (id: string): PartieDuplicate | null => lirePartiesEnCours().find((p) => p.id === id) ?? null

/** Enregistre une partie en cours, nouvelle ou mise à jour : elle passe en tête, c'est la dernière jouée. */
export function enregistrerPartie(p: PartieDuplicate) {
  const enregistree = { ...p, majLe: Date.now() }
  ecrire(PARTIES, [enregistree, ...lirePartiesEnCours().filter((x) => x.id !== p.id)])
  signaler('duplicate-encours', p.id, enregistree, enregistree.majLe)
}

/** La partie n'est plus en cours (terminée ou abandonnée) : elle et son coup en cours sont oubliés. */
export function retirerPartie(id: string) {
  ecrire(PARTIES, lirePartiesEnCours().filter((p) => p.id !== id))
  ecrire(cleCoup(id), null)
  signaler('duplicate-encours', id, null)
}

/** Abandon : si des coups ont été joués, la partie est rangée dans l'historique (avec sa correction) ; sinon elle disparaît. */
export function abandonnerPartie(p: PartieDuplicate) {
  if (p.coups.length) archiver({ ...p, finie: true, courant: null })
  retirerPartie(p.id)
}

export const lireCoup = (id: string, numero: number): EtatCoup => {
  const c = lire<Partial<EtatCoup> | null>(cleCoup(id), null)
  return c && c.numero === numero
    ? { numero, ecoule: c.ecoule ?? 0, bulletin: c.bulletin ?? null, indices: c.indices ?? [], essais: c.essais ?? [] }
    : { numero, ecoule: 0, bulletin: null, indices: [], essais: [] }
}
export const ecrireCoup = (id: string, c: EtatCoup | null) => ecrire(cleCoup(id), c)

export const lireReglages = (): Reglages => ({ temps: 180, mode: 'entrainement', ...lire<Partial<Reglages>>(REGLAGES, {}) })
export function ecrireReglages(r: Reglages) {
  ecrire(REGLAGES, r)
  signaler('reglages', 'duplicate', r)
}

/** Parties terminées, la plus récente en premier (avec leurs coups, pour la correction). */
export const lireHistorique = (): PartieDuplicate[] => lire<PartieDuplicate[]>(HISTORIQUE, [])

export function archiver(p: PartieDuplicate) {
  // On allège les « autres coups » pour garder de la place.
  const allegee: PartieDuplicate = { ...p, coups: p.coups.map((c) => ({ ...c, autres: c.autres.slice(0, 8) })) }
  const h = lireHistorique().filter((x) => x.id !== p.id)
  const liste = [allegee, ...h]
  ecrire(HISTORIQUE, liste.slice(0, MAX_HISTORIQUE))
  signaler('duplicate-histo', p.id, allegee, p.creeLe)
  // Ce que le plafond fait partir est supprimé partout, pour que tous les appareils gardent les mêmes parties.
  for (const x of liste.slice(MAX_HISTORIQUE)) signaler('duplicate-histo', x.id, null)
}

export function supprimerDeHistorique(id: string) {
  ecrire(HISTORIQUE, lireHistorique().filter((x) => x.id !== id))
  signaler('duplicate-histo', id, null)
}

export function viderHistorique() {
  const ids = lireHistorique().map((p) => p.id)
  ecrire(HISTORIQUE, [])
  for (const id of ids) signaler('duplicate-histo', id, null)
}

// --- Synchronisation avec le compte (voir lib/synchro.ts) ---

const parDate = (a: PartieDuplicate, b: PartieDuplicate) => (b.majLe ?? b.creeLe) - (a.majLe ?? a.creeLe)

export const adapteursDuplicate: Record<'encours' | 'histo' | 'reglages', Adapteur> = {
  encours: {
    lister: () => lirePartiesEnCours().map((p) => ({ id: p.id, majLe: p.majLe ?? p.creeLe, donnees: p })),
    appliquer(id, donnees, majLe) {
      const reste = lirePartiesEnCours().filter((p) => p.id !== id)
      ecrire(PARTIES, donnees ? [{ ...(donnees as PartieDuplicate), majLe }, ...reste].sort(parDate) : reste)
      if (!donnees) ecrire(cleCoup(id), null)
    },
  },
  histo: {
    lister: () => lireHistorique().map((p) => ({ id: p.id, majLe: p.creeLe, donnees: p })),
    appliquer(id, donnees) {
      const reste = lireHistorique().filter((p) => p.id !== id)
      ecrire(HISTORIQUE, donnees ? [donnees as PartieDuplicate, ...reste].sort((a, b) => b.creeLe - a.creeLe) : reste)
    },
    elaguer() {
      const liste = lireHistorique()
      if (liste.length <= MAX_HISTORIQUE) return
      ecrire(HISTORIQUE, liste.slice(0, MAX_HISTORIQUE))
      for (const x of liste.slice(MAX_HISTORIQUE)) signaler('duplicate-histo', x.id, null)
    },
  },
  reglages: {
    lister: () => (lireEstampille('duplicate') ? [{ id: 'duplicate', majLe: lireEstampille('duplicate'), donnees: lireReglages() }] : []),
    appliquer(_id, donnees, majLe) {
      if (!donnees) return
      ecrire(REGLAGES, donnees)
      ecrireEstampille('duplicate', majLe)
    },
  },
}

export const resume = (p: PartieDuplicate): ResumePartie => {
  const t = totaux(p)
  return {
    id: p.id,
    mode: modeDe(p),
    graine: p.graine,
    temps: p.temps,
    date: p.creeLe,
    joueur: t.joueur,
    top: t.top,
    pourcentage: t.pourcentage,
    nbCoups: p.coups.length,
    trouves: t.trouves,
  }
}

export function statistiques() {
  const parties = lireHistorique().filter((p) => p.coups.length > 0).map(resume)
  const moyenne = parties.length ? parties.reduce((s, p) => s + p.pourcentage, 0) / parties.length : 0
  const meilleure = parties.reduce<ResumePartie | null>((m, p) => (!m || p.pourcentage > m.pourcentage ? p : m), null)
  const tops = lireHistorique().reduce(
    (n, p) => n + p.coups.filter((c) => c.joueur && c.joueur.points >= c.top.points).length,
    0,
  )
  return { parties, moyenne, meilleure, tops }
}

export const formatPct = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %'

export const formatTemps = (s: number) =>
  s === 0 ? 'Sans limite' : s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60}`

/** Durée courte pour un chrono : « 1:05 ». */
export const formatChrono = (s: number) => {
  const t = Math.round(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
