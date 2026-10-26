// Sauvegarde du duplicate sur l'appareil : partie en cours (reprise à l'ouverture) et historique.

import type { Coup } from '../jeu/coup'
import { modeDe, totaux, type Essai, type Indice, type ModeDuplicate, type PartieDuplicate } from '../jeu/duplicate'
import { ecrire, lire } from '../lib/stockage'

const PARTIE = 'solo.partie'
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

export const lirePartie = (): PartieDuplicate | null => lire<PartieDuplicate | null>(PARTIE, null)
export const ecrirePartie = (p: PartieDuplicate | null) => ecrire(PARTIE, p)

export const lireCoup = (numero: number): EtatCoup => {
  const c = lire<Partial<EtatCoup> | null>(COUP, null)
  return c && c.numero === numero
    ? { numero, ecoule: c.ecoule ?? 0, bulletin: c.bulletin ?? null, indices: c.indices ?? [], essais: c.essais ?? [] }
    : { numero, ecoule: 0, bulletin: null, indices: [], essais: [] }
}
export const ecrireCoup = (c: EtatCoup | null) => ecrire(COUP, c)

export const lireReglages = (): Reglages => ({ temps: 180, mode: 'entrainement', ...lire<Partial<Reglages>>(REGLAGES, {}) })
export const ecrireReglages = (r: Reglages) => ecrire(REGLAGES, r)

/** Parties terminées, la plus récente en premier (avec leurs coups, pour la correction). */
export const lireHistorique = (): PartieDuplicate[] => lire<PartieDuplicate[]>(HISTORIQUE, [])

export function archiver(p: PartieDuplicate) {
  // On allège les « autres coups » pour garder de la place.
  const allegee: PartieDuplicate = { ...p, coups: p.coups.map((c) => ({ ...c, autres: c.autres.slice(0, 8) })) }
  const h = lireHistorique().filter((x) => x.id !== p.id)
  ecrire(HISTORIQUE, [allegee, ...h].slice(0, MAX_HISTORIQUE))
}

export function supprimerDeHistorique(id: string) {
  ecrire(HISTORIQUE, lireHistorique().filter((x) => x.id !== id))
}

export function viderHistorique() {
  ecrire(HISTORIQUE, [])
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
