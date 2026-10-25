// Sauvegarde du duplicate sur l'appareil : partie en cours (reprise à l'ouverture) et historique.

import type { Coup } from '../jeu/coup'
import { totaux, type PartieDuplicate } from '../jeu/duplicate'
import { ecrire, lire } from '../lib/stockage'

const PARTIE = 'solo.partie'
const COUP = 'solo.coup'
const HISTORIQUE = 'solo.historique'
const REGLAGES = 'solo.reglages'
const MAX_HISTORIQUE = 60

/** Ce qui concerne le coup en cours : temps écoulé et coup noté. */
export interface EtatCoup {
  numero: number
  ecoule: number
  bulletin: Coup | null
}

export interface ResumePartie {
  id: string
  graine: string
  temps: number
  date: number
  joueur: number
  top: number
  pourcentage: number
  nbCoups: number
}

export const lirePartie = (): PartieDuplicate | null => lire<PartieDuplicate | null>(PARTIE, null)
export const ecrirePartie = (p: PartieDuplicate | null) => ecrire(PARTIE, p)

export const lireCoup = (numero: number): EtatCoup => {
  const c = lire<EtatCoup | null>(COUP, null)
  return c && c.numero === numero ? c : { numero, ecoule: 0, bulletin: null }
}
export const ecrireCoup = (c: EtatCoup | null) => ecrire(COUP, c)

export const lireReglages = () => lire(REGLAGES, { temps: 180 })
export const ecrireReglages = (r: { temps: number }) => ecrire(REGLAGES, r)

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

export const resume = (p: PartieDuplicate): ResumePartie => {
  const t = totaux(p)
  return {
    id: p.id,
    graine: p.graine,
    temps: p.temps,
    date: p.creeLe,
    joueur: t.joueur,
    top: t.top,
    pourcentage: t.pourcentage,
    nbCoups: p.coups.length,
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

export const formatTemps = (s: number) => (s === 0 ? 'Sans limite' : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60}`)
