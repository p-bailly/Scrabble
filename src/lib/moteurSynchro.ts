// Cœur de la synchronisation, sans Firebase : compare ce que l'appareil contient à ce que dit le serveur, applique ce qui
// vient du serveur et dit ce qu'il reste à lui envoyer. La liaison Firestore (multi/synchro.ts) ne fait que lui passer
// les documents et envoyer ce qu'il demande ; tout le raisonnement est ici, et testé.

import {
  cleDe,
  decider,
  lireCle,
  lireSuppressions,
  notifierSynchro,
  oublierSuppression,
  sansSignal,
  type Adapteur,
  type Signal,
  type TypeSynchro,
  type Version,
} from './synchro'

/** Un document de joueurs/{uid}/solo : un élément, ou la trace de sa suppression. */
export interface DocumentDistant {
  cle: string
  type: TypeSynchro
  id: string
  majLe: number
  supprime: boolean
  /** Les données en JSON (vide pour une suppression). */
  donnees: string
}

export type Adapteurs = Record<TypeSynchro, Adapteur>

/** Au-delà, un document dépasse la limite de Firestore (1 Mo) : on ne l'envoie pas. */
export const TAILLE_MAX = 900_000

export function documentDe(s: Signal): DocumentDistant {
  return {
    cle: cleDe(s.type, s.id),
    type: s.type,
    id: s.id,
    majLe: s.majLe,
    supprime: s.donnees === null,
    donnees: s.donnees === null ? '' : JSON.stringify(s.donnees),
  }
}

interface Local {
  version: Version
  /** Le signal qui reproduit cet élément (pour l'envoyer) ; pour une suppression, des données null. */
  signal: Signal
}

/** Tout ce que l'appareil contient et sait avoir supprimé, par clé. */
export function lireLocaux(adapteurs: Adapteurs): Map<string, Local> {
  const locaux = new Map<string, Local>()
  for (const [type, adapteur] of Object.entries(adapteurs) as [TypeSynchro, Adapteur][])
    for (const e of adapteur.lister())
      locaux.set(cleDe(type, e.id), { version: { majLe: e.majLe, supprime: false }, signal: { type, id: e.id, majLe: e.majLe, donnees: e.donnees } })
  for (const [cle, majLe] of Object.entries(lireSuppressions())) {
    if (locaux.has(cle)) continue // recréé depuis : l'élément l'emporte
    const { type, id } = lireCle(cle)
    locaux.set(cle, { version: { majLe, supprime: true }, signal: { type, id, majLe, donnees: null } })
  }
  return locaux
}

export interface Resultat {
  /** Ce que le serveur doit recevoir (versions locales plus récentes que les siennes). */
  aEnvoyer: DocumentDistant[]
  /** Des éléments de l'appareil ont changé : les écrans doivent se relire. */
  modifie: boolean
}

/**
 * Traite des documents venus du serveur (`null` : le document n'existe pas ou plus) : applique ceux qui sont plus
 * récents que l'appareil, relève ceux que l'appareil connaît en plus récent.
 */
export function traiterDistants(adapteurs: Adapteurs, distants: Iterable<[string, DocumentDistant | null]>): Resultat {
  const locaux = lireLocaux(adapteurs)
  const resultat: Resultat = { aEnvoyer: [], modifie: false }
  for (const [cle, distant] of distants) {
    const local = locaux.get(cle) ?? null
    const action = decider(local?.version ?? null, distant && { majLe: distant.majLe, supprime: distant.supprime })
    if (action === 'envoyer' && local) {
      const doc = documentDe(local.signal)
      if (doc.donnees.length <= TAILLE_MAX) resultat.aEnvoyer.push(doc)
    } else if (action === 'appliquer' && distant) {
      try {
        sansSignal(() => adapteurs[distant.type].appliquer(distant.id, JSON.parse(distant.donnees) as unknown, distant.majLe))
        oublierSuppression(distant.cle)
        resultat.modifie = true
      } catch (e) {
        console.warn('Élément synchronisé illisible', distant.cle, e)
      }
    } else if (action === 'supprimer-local' && distant) {
      sansSignal(() => adapteurs[distant.type].appliquer(distant.id, null, distant.majLe))
      resultat.modifie = true
    }
  }
  if (resultat.modifie) {
    // Les listes plafonnées (historiques) se ramènent à leur plafond, et ce qui part est signalé comme supprimé.
    for (const adapteur of Object.values(adapteurs)) adapteur.elaguer?.()
    notifierSynchro()
  }
  return resultat
}

/**
 * Éléments de l'appareil que le serveur ne connaît pas du tout (`cles` : tout ce qu'il contient). À appeler une fois,
 * sur la liste complète confirmée par le serveur : c'est ainsi que les données d'avant la synchro montent au compte.
 */
export function inconnusDuServeur(adapteurs: Adapteurs, cles: ReadonlySet<string>): DocumentDistant[] {
  const docs: DocumentDistant[] = []
  for (const [cle, local] of lireLocaux(adapteurs)) {
    if (cles.has(cle) || local.version.supprime) continue
    const doc = documentDe(local.signal)
    if (doc.donnees.length <= TAILLE_MAX) docs.push(doc)
  }
  return docs
}

/** Efface les données synchronisées de l'appareil (changement de compte), sans rien signaler. */
export function viderLocal(adapteurs: Adapteurs) {
  sansSignal(() => {
    for (const adapteur of Object.values(adapteurs)) for (const e of adapteur.lister()) adapteur.appliquer(e.id, null, Date.now())
  })
  notifierSynchro()
}

/** Y a-t-il des données locales à synchroniser ? */
export const aDesDonnees = (adapteurs: Adapteurs): boolean => Object.values(adapteurs).some((a) => a.lister().length > 0)
