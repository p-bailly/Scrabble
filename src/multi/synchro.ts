// Liaison Firestore de la synchronisation des données solo (voir lib/synchro.ts pour le principe, lib/moteurSynchro.ts
// pour le raisonnement). Tout est dans joueurs/{uid}/solo/{élément}, lisible par son propriétaire seul : on y écoute les
// changements des autres appareils en direct, et on y envoie ce que celui-ci change. Hors ligne, Firestore garde les
// envois en file et les poste au retour du réseau ; les règles refusent une version plus ancienne que celle du serveur.

import { collection, deleteDoc, doc, onSnapshot, setDoc, type QueryDocumentSnapshot } from 'firebase/firestore'
import {
  aDesDonnees,
  documentDe,
  inconnusDuServeur,
  traiterDistants,
  viderLocal,
  TAILLE_MAX,
  type DocumentDistant,
} from '../lib/moteurSynchro'
import { ecrire, lire } from '../lib/stockage'
import { cleDe, DUREE_JOURNAL, notifierSynchro, surSignal, viderJournal, type Signal, type TypeSynchro } from '../lib/synchro'
import { adapteurs } from '../lib/synchroTypes'
import { base, connexion } from './firebase'

/** Compte avec lequel les données de cet appareil sont synchronisées (posé après la première synchro réussie). */
export const CLE_COMPTE = 'synchro.uid'
/** Date de la dernière réponse du serveur. */
export const CLE_DERNIERE = 'synchro.derniere'

const TYPES: readonly TypeSynchro[] = ['duplicate-encours', 'duplicate-histo', 'ia-encours', 'ia-histo', 'ia-partie', 'reglages']

let arret: (() => void) | null = null
let demarrage = false
/** Compte dont l'utilisateur a refusé de remplacer les données de l'appareil, pour ne pas le redemander dans la session. */
let refuse: string | null = null

/** Lit un document Firestore ; null s'il n'a pas la forme attendue (on l'ignore). */
function lireDocument(d: QueryDocumentSnapshot): DocumentDistant | null {
  const { type, id, majLe, supprime, donnees } = d.data()
  if (!TYPES.includes(type) || typeof id !== 'string' || typeof majLe !== 'number' || typeof donnees !== 'string') return null
  return { cle: d.id, type, id, majLe, supprime: supprime === true, donnees }
}

/** Démarre la synchronisation du compte connecté (sans effet s'il n'y en a pas, ou si elle tourne déjà). */
export async function demarrerSynchro(): Promise<void> {
  if (arret || demarrage) return
  demarrage = true
  try {
    const moi = await connexion()
    if (refuse === moi.uid) return
    const precedent = lire<string | null>(CLE_COMPTE, null)
    if (precedent && precedent !== moi.uid && aDesDonnees(adapteurs)) {
      // Les données de l'appareil sont celles d'un autre compte (déjà sur ce compte-là) : on ne les mélange pas.
      if (!confirm('Cet appareil garde les parties solo d’un autre compte. Les remplacer par celles de ce compte ?')) {
        refuse = moi.uid
        return
      }
      viderLocal(adapteurs)
      viderJournal()
    }

    const dossier = collection(base(), 'joueurs', moi.uid, 'solo')
    const envoyer = (d: DocumentDistant) => {
      if (d.donnees.length > TAILLE_MAX) return console.warn('Élément trop gros pour être synchronisé', d.cle)
      const { cle, ...champs } = d
      // Un refus est normal quand un autre appareil a déjà une version plus récente : sa version nous arrive par l'écoute.
      setDoc(doc(dossier, cle), champs).catch((e) => console.info('Envoi refusé', cle, (e as { code?: string }).code))
    }

    // Les changements locaux sont regroupés une fraction de seconde (un coup en écrit plusieurs) avant d'être envoyés.
    const file = new Map<string, Signal>()
    let minuteur: ReturnType<typeof setTimeout> | undefined
    const arreterSignaux = surSignal((s) => {
      file.set(cleDe(s.type, s.id), s)
      clearTimeout(minuteur)
      minuteur = setTimeout(() => {
        for (const signal of file.values()) envoyer(documentDe(signal))
        file.clear()
      }, 500)
    })

    let listeComplete = false
    const arreterEcoute = onSnapshot(
      dossier,
      (snap) => {
        const distants = new Map<string, DocumentDistant | null>()
        for (const c of snap.docChanges()) {
          if (c.doc.metadata.hasPendingWrites) continue // notre propre envoi, pas encore confirmé
          const d = c.type === 'removed' ? null : lireDocument(c.doc)
          distants.set(c.doc.id, d)
          // Une trace de suppression que tous les appareils ont reçue depuis longtemps n'a plus d'utilité.
          if (d?.supprime && Date.now() - d.majLe > DUREE_JOURNAL) void deleteDoc(c.doc.ref).catch(() => {})
        }
        traiterDistants(adapteurs, distants).aEnvoyer.forEach(envoyer)
        if (snap.metadata.fromCache) return
        // Réponse confirmée par le serveur : ce qu'il ne connaît pas encore (données d'avant la synchro) monte au compte.
        if (!listeComplete) {
          listeComplete = true
          for (const d of inconnusDuServeur(adapteurs, new Set(snap.docs.map((x) => x.id)))) envoyer(d)
          ecrire(CLE_COMPTE, moi.uid)
        }
        ecrire(CLE_DERNIERE, Date.now())
        notifierSynchro()
      },
      (e) => console.warn('Synchronisation indisponible', e.message),
    )
    arret = () => {
      clearTimeout(minuteur)
      arreterSignaux()
      arreterEcoute()
    }
  } catch {
    /* pas de compte, ou pas de réseau : la synchro repartira au prochain lancement */
  } finally {
    demarrage = false
  }
}

/** Arrête la synchronisation (déconnexion) ; les données restent sur l'appareil. */
export function arreterSynchro() {
  arret?.()
  arret = null
  refuse = null
}
