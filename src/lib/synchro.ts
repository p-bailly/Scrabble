// Synchronisation des données solo avec le compte (Firestore, joueurs/{uid}/solo) : parties en cours, historiques,
// résultats contre l'IA et réglages. Ce module est léger (pas de Firebase) : les sauvegardes locales y signalent
// chaque changement ; la liaison Firestore (multi/synchro.ts) s'y abonne quand un compte existe.
//
// Règle de fusion : par élément, la version la plus récente (`majLe`) gagne. Une suppression est une version comme une
// autre (elle porte la date où on a supprimé) : elle est gardée dans un journal local, même sans compte, pour qu'un
// élément supprimé ne ressuscite pas à la première synchronisation.

import { useEffect, useState } from 'react'
import { ecrire, lire } from './stockage'

/** Sortes d'éléments synchronisés. Un élément se désigne par sa sorte et son identifiant. */
export type TypeSynchro = 'duplicate-encours' | 'duplicate-histo' | 'ia-encours' | 'ia-histo' | 'ia-partie' | 'reglages'

/** Un élément tel que le signale une sauvegarde locale ; `donnees` null : l'élément vient d'être supprimé. */
export interface Signal {
  type: TypeSynchro
  id: string
  majLe: number
  donnees: unknown | null
}

export interface ElementLocal {
  id: string
  majLe: number
  donnees: unknown
}

/** Ce qu'une sauvegarde locale sait faire pour la synchro : dire ce qu'elle contient, et y poser ce qui vient d'ailleurs. */
export interface Adapteur {
  lister(): ElementLocal[]
  /** `donnees` null : supprimer l'élément. Ne signale rien (appelé depuis `sansSignal`). */
  appliquer(id: string, donnees: unknown | null, majLe: number): void
  /** Pour une liste plafonnée : ramène la liste à son plafond après un apport du serveur, en signalant ce qui part. */
  elaguer?(): void
}

/** Identifiant d'un élément dans Firestore (sans « / », interdit dans un identifiant de document). */
export const cleDe = (type: TypeSynchro, id: string): string => `${type}~${encodeURIComponent(id)}`

export function lireCle(cle: string): { type: TypeSynchro; id: string } {
  const i = cle.indexOf('~')
  return { type: cle.slice(0, i) as TypeSynchro, id: decodeURIComponent(cle.slice(i + 1)) }
}

// --- Journal des suppressions et dates des réglages, gardés sur l'appareil ---

const CLE_SUPPRESSIONS = 'synchro.suppressions'
const CLE_ESTAMPILLES = 'synchro.estampilles'
/** Au-delà, on oublie une suppression (les autres appareils l'ont reçue depuis longtemps). */
export const DUREE_JOURNAL = 180 * 24 * 3600 * 1000

/** Suppressions faites sur cet appareil : clé de l'élément → date. */
export function lireSuppressions(maintenant = Date.now()): Record<string, number> {
  const tout = lire<Record<string, number>>(CLE_SUPPRESSIONS, {})
  return Object.fromEntries(Object.entries(tout).filter(([, majLe]) => maintenant - majLe < DUREE_JOURNAL))
}
const ecrireSuppressions = (s: Record<string, number>) => ecrire(CLE_SUPPRESSIONS, Object.keys(s).length ? s : null)

export function noterSuppression(cle: string, majLe: number) {
  ecrireSuppressions({ ...lireSuppressions(), [cle]: majLe })
}
export function oublierSuppression(cle: string) {
  const s = lireSuppressions()
  if (cle in s) {
    delete s[cle]
    ecrireSuppressions(s)
  }
}
export function viderJournal() {
  ecrire(CLE_SUPPRESSIONS, null)
  ecrire(CLE_ESTAMPILLES, null)
}

/** Date de la dernière modification locale de chaque groupe de réglages (« app », « duplicate », « ia »). */
export const lireEstampille = (id: string): number => lire<Record<string, number>>(CLE_ESTAMPILLES, {})[id] ?? 0
export const ecrireEstampille = (id: string, majLe: number) => ecrire(CLE_ESTAMPILLES, { ...lire<Record<string, number>>(CLE_ESTAMPILLES, {}), [id]: majLe })

// --- Signaux ---

const ecouteurs = new Set<(s: Signal) => void>()
let muet = 0

/** S'abonner aux changements locaux ; renvoie la fonction qui se désabonne. */
export function surSignal(f: (s: Signal) => void): () => void {
  ecouteurs.add(f)
  return () => void ecouteurs.delete(f)
}

/** Exécute `f` sans que ses écritures soient signalées (on y pose ce qui vient du serveur). */
export function sansSignal<T>(f: () => T): T {
  muet++
  try {
    return f()
  } finally {
    muet--
  }
}

/**
 * Une sauvegarde locale vient de changer un élément : `donnees` est sa nouvelle valeur, ou null s'il est supprimé.
 * `majLe` : la date de cette version (par défaut maintenant ; un historique, qui ne change plus, garde sa date de création).
 */
export function signaler(type: TypeSynchro, id: string, donnees: unknown | null, majLe = Date.now()) {
  if (muet) return
  const cle = cleDe(type, id)
  if (donnees === null) noterSuppression(cle, majLe)
  else {
    oublierSuppression(cle)
    if (type === 'reglages') ecrireEstampille(id, majLe)
  }
  for (const f of [...ecouteurs]) f({ type, id, majLe, donnees })
}

// --- Décision ---

/** La version d'un élément d'un côté : sa date, et s'il y est supprimé. */
export interface Version {
  majLe: number
  supprime: boolean
}

export type Action = 'rien' | 'envoyer' | 'appliquer' | 'supprimer-local'

/**
 * Que faire d'un élément connu de chaque côté ? `local` ou `distant` null : on n'en sait rien de ce côté.
 * - la version la plus récente gagne ; à date égale, la suppression l'emporte ;
 * - rien à envoyer pour une suppression que le serveur ignore (il n'a rien à supprimer), ni à appliquer pour une
 *   suppression d'un élément qu'on n'a pas.
 */
export function decider(local: Version | null, distant: Version | null): Action {
  if (!local && !distant) return 'rien'
  if (!local) return distant!.supprime ? 'rien' : 'appliquer'
  if (!distant) return local.supprime ? 'rien' : 'envoyer'
  if (local.majLe > distant.majLe) return 'envoyer'
  if (local.majLe < distant.majLe) return distant.supprime ? 'supprimer-local' : 'appliquer'
  if (local.supprime === distant.supprime) return 'rien'
  return local.supprime ? 'envoyer' : 'supprimer-local'
}

// --- Rafraîchir les écrans ---

export const EVENEMENT_SYNCHRO = 'scrabble:synchro'

/** Des données ont changé à cause de la synchro : les écrans qui les affichent se relisent. */
export function notifierSynchro() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENEMENT_SYNCHRO))
}

/** À appeler dans un écran qui affiche des données synchronisées : il se redessine quand la synchro les change. */
export function useSynchro() {
  const [, rafraichir] = useState(0)
  useEffect(() => {
    const maj = () => rafraichir((n) => n + 1)
    window.addEventListener(EVENEMENT_SYNCHRO, maj)
    return () => window.removeEventListener(EVENEMENT_SYNCHRO, maj)
  }, [])
}
