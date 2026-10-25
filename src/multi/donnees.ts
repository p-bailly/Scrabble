// Parties à deux stockées dans Firestore.
//
//   joueurs/{uid}                      { pseudo }
//   parties/{code}                     état public de la partie (plateau, sac, scores, à qui le tour…)
//   parties/{code}/chevalets/{uid}     les lettres d'un joueur, lisibles par lui seul
//   parties/{code}/coups/{n}           historique des coups (mot, position, points)
//
// Toutes les écritures d'un coup partent dans un même lot (writeBatch) : hors ligne, le lot est mis en file par
// Firestore et envoyé au retour du réseau. Le contenu du sac est lisible par les deux joueurs : sans serveur, la
// triche reste possible, ce qui est accepté pour un usage entre amis.

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  deleteDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { changer, finDePartie, lettresAdversaire, piocher } from '../jeu/classique'
import { jetonsUtilises, jouer, reference, retirerDuChevalet, type Analyse, type Pose } from '../jeu/coup'
import { tousLesJetons } from '../jeu/lettres'
import { plateauDepuisTexte, plateauEnTexte, plateauVide } from '../jeu/plateau'
import { base } from './firebase'

export type Etat = 'attente' | 'encours' | 'finie'

export interface Dernier {
  uid: string
  type: 'mot' | 'change' | 'passe' | 'abandon'
  mot?: string
  points: number
}

export interface Partie {
  code: string
  createur: string
  joueurs: string[]
  pseudos: Record<string, string>
  etat: Etat
  tour: string | null
  plateau: string
  sac: string
  scores: Record<string, number>
  /** Passes de suite (six : fin de partie). */
  passes: number
  nbCoups: number
  dernier: Dernier | null
  fin: { ajustements: Record<string, number>; raison: 'chevalet-vide' | 'passes' | 'abandon'; gagnant: string | null } | null
  creeLe: Timestamp | null
  majLe: Timestamp | null
  /** Écriture locale pas encore envoyée (hors ligne). */
  enAttente?: boolean
}

export interface CoupMulti {
  n: number
  uid: string
  type: 'mot' | 'change' | 'passe'
  poses?: Pose[]
  mot?: string
  ref?: string
  mots?: string[]
  points: number
  nbChanges?: number
}

const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function nouveauCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET_CODE[Math.floor(Math.random() * ALPHABET_CODE.length)]
  return s
}

export const normaliserCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

export const autre = (p: Partie, uid: string) => p.joueurs.find((j) => j !== uid) ?? null

export async function enregistrerPseudo(uid: string, pseudo: string) {
  await setDoc(doc(base(), 'joueurs', uid), { pseudo })
}

export async function lirePseudo(uid: string): Promise<string | null> {
  const d = await getDoc(doc(base(), 'joueurs', uid))
  return d.exists() ? (d.data().pseudo as string) : null
}

/** Crée une partie et renvoie son code. */
export async function creerPartie(uid: string, pseudo: string): Promise<string> {
  const code = nouveauCode()
  const { tires, sac } = piocher(tousLesJetons(), 7)
  const b = writeBatch(base())
  const partie: Omit<Partie, 'creeLe' | 'majLe'> & { creeLe: unknown; majLe: unknown } = {
    code,
    createur: uid,
    joueurs: [uid],
    pseudos: { [uid]: pseudo },
    etat: 'attente',
    tour: null,
    plateau: plateauEnTexte(plateauVide()),
    sac: sac.join(''),
    scores: { [uid]: 0 },
    passes: 0,
    nbCoups: 0,
    dernier: null,
    fin: null,
    creeLe: serverTimestamp(),
    majLe: serverTimestamp(),
  }
  b.set(doc(base(), 'parties', code), partie)
  b.set(doc(base(), 'parties', code, 'chevalets', uid), { lettres: tires.join('') })
  await b.commit()
  return code
}

/** Rejoint une partie en attente (il faut être en ligne). */
export async function rejoindre(code: string, uid: string, pseudo: string): Promise<void> {
  const ref = doc(base(), 'parties', code)
  const d = await getDoc(ref)
  if (!d.exists()) throw new Error('Aucune partie avec ce code')
  const p = d.data() as Partie
  if (p.joueurs.includes(uid)) return
  if (p.etat !== 'attente') throw new Error('Cette partie a déjà deux joueurs')
  const { tires, sac } = piocher([...p.sac], 7)
  const b = writeBatch(base())
  b.update(ref, {
    joueurs: [p.createur, uid],
    [`pseudos.${uid}`]: pseudo,
    [`scores.${uid}`]: 0,
    etat: 'encours',
    tour: p.createur,
    sac: sac.join(''),
    majLe: serverTimestamp(),
  })
  b.set(doc(base(), 'parties', code, 'chevalets', uid), { lettres: tires.join('') })
  await b.commit()
}

export async function supprimerPartie(code: string) {
  await deleteDoc(doc(base(), 'parties', code))
}

/** Parties où je joue (mise à jour en direct). */
export function ecouterMesParties(uid: string, rappel: (parties: Partie[]) => void, erreur?: (e: Error) => void): Unsubscribe {
  const q = query(collection(base(), 'parties'), where('joueurs', 'array-contains', uid))
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (s) => rappel(s.docs.map((d) => ({ ...(d.data() as Partie), enAttente: d.metadata.hasPendingWrites }))),
    erreur,
  )
}

export function ecouterPartie(code: string, rappel: (p: Partie | null) => void, erreur?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(base(), 'parties', code),
    { includeMetadataChanges: true },
    (d) => rappel(d.exists() ? { ...(d.data() as Partie), enAttente: d.metadata.hasPendingWrites } : null),
    erreur,
  )
}

export function ecouterChevalet(code: string, uid: string, rappel: (lettres: string[]) => void): Unsubscribe {
  return onSnapshot(doc(base(), 'parties', code, 'chevalets', uid), (d) => rappel(d.exists() ? [...(d.data().lettres as string)] : []))
}

export function ecouterCoups(code: string, rappel: (coups: CoupMulti[]) => void): Unsubscribe {
  return onSnapshot(query(collection(base(), 'parties', code, 'coups'), orderBy('n')), (s) =>
    rappel(s.docs.map((d) => d.data() as CoupMulti)),
  )
}

/** Un mot est joué avec son analyse (faite par le worker, qui détient le dictionnaire). */
type Action = { type: 'mot'; analyse: Analyse } | { type: 'change'; lettres: string[] } | { type: 'passe' }

/**
 * Joue un coup. Le lot d'écritures est envoyé sans attendre la réponse du serveur : hors ligne, il part au retour
 * du réseau. Renvoie un message d'erreur si le coup n'est pas permis.
 */
export function jouerCoup(p: Partie, uid: string, chevalet: string[], action: Action): string | null {
  if (p.etat !== 'encours' || p.tour !== uid) return 'Ce n’est pas ton tour'
  const adversaire = autre(p, uid)!
  const plateau = plateauDepuisTexte(p.plateau)
  const sac = [...p.sac]
  const n = p.nbCoups + 1
  let nouveauPlateau = plateau
  let nouveauSac = sac
  let nouveauChevalet = chevalet
  let points = 0
  let passes = p.passes
  let coup: CoupMulti
  if (action.type === 'mot') {
    const a = action.analyse
    if (a.erreur || !a.coup) return a.erreur ?? 'Coup invalide'
    if (!a.valide) return `Mot inconnu : ${a.motsInconnus.join(', ')}`
    const reste = retirerDuChevalet(chevalet, jetonsUtilises(a.coup.poses))
    if (!reste) return 'Ces lettres ne sont pas sur le chevalet'
    const pioche = piocher(sac, 7 - reste.length)
    nouveauPlateau = jouer(plateau, a.coup.poses)
    nouveauSac = pioche.sac
    nouveauChevalet = [...reste, ...pioche.tires]
    points = a.points
    passes = 0
    const c = a.coup
    coup = { n, uid, type: 'mot', poses: c.poses, mot: c.mot, ref: reference(c.debut, c.dir), mots: a.mots.map((m) => m.affichage), points }
  } else if (action.type === 'change') {
    const r = changer(chevalet, sac, action.lettres)
    if ('erreur' in r) return r.erreur
    nouveauSac = r.sac
    nouveauChevalet = r.chevalet
    passes = 0
    coup = { n, uid, type: 'change', points: 0, nbChanges: action.lettres.length }
  } else {
    passes += 1
    coup = { n, uid, type: 'passe', points: 0 }
  }

  const scores = { ...p.scores, [uid]: (p.scores[uid] ?? 0) + points }
  // Les lettres de l'adversaire se déduisent du reste (utile pour les points de fin de partie).
  const lettresAutre = lettresAdversaire(nouveauPlateau, nouveauSac, nouveauChevalet)
  const fin = finDePartie(nouveauSac, [nouveauChevalet, lettresAutre], passes)
  let etat: Etat = 'encours'
  let finPartie: Partie['fin'] = null
  if (fin) {
    etat = 'finie'
    scores[uid] += fin.ajustements[0]
    scores[adversaire] = (scores[adversaire] ?? 0) + fin.ajustements[1]
    const gagnant = scores[uid] === scores[adversaire] ? null : scores[uid] > scores[adversaire] ? uid : adversaire
    finPartie = { ajustements: { [uid]: fin.ajustements[0], [adversaire]: fin.ajustements[1] }, raison: fin.raison, gagnant }
  }

  const b = writeBatch(base())
  b.update(doc(base(), 'parties', p.code), {
    plateau: plateauEnTexte(nouveauPlateau),
    sac: nouveauSac.join(''),
    scores,
    passes,
    nbCoups: n,
    tour: etat === 'finie' ? null : adversaire,
    etat,
    fin: finPartie,
    dernier: { uid, type: coup.type, ...(coup.mot ? { mot: coup.mot } : {}), points },
    majLe: serverTimestamp(),
  })
  b.set(doc(base(), 'parties', p.code, 'chevalets', uid), { lettres: nouveauChevalet.join('') })
  b.set(doc(base(), 'parties', p.code, 'coups', String(n)), { ...coup, le: serverTimestamp() })
  b.commit().catch((e) => console.error('Coup refusé par le serveur', e))
  return null
}

/** Abandon : la partie s'arrête, l'adversaire gagne. */
export function abandonner(p: Partie, uid: string) {
  const adversaire = autre(p, uid)
  const b = writeBatch(base())
  b.update(doc(base(), 'parties', p.code), {
    etat: 'finie',
    tour: null,
    fin: { ajustements: {}, raison: 'abandon', gagnant: adversaire },
    dernier: { uid, type: 'abandon', points: 0 },
    majLe: serverTimestamp(),
  })
  b.commit().catch((e) => console.error('Abandon refusé', e))
}

/**
 * Revérifie l'historique reçu : chaque mot doit être dans le dictionnaire et rapporter les points annoncés, et le
 * plateau final doit correspondre. `analyser` est l'analyse du worker. Renvoie les numéros des coups suspects.
 */
export async function verifierCoups(
  coups: CoupMulti[],
  plateauFinal: string,
  analyser: (plateau: string[], poses: Pose[]) => Promise<Analyse>,
): Promise<Set<number>> {
  const suspects = new Set<number>()
  let p = plateauVide()
  for (const c of coups) {
    if (c.type !== 'mot' || !c.poses) continue
    const a = await analyser(p, c.poses)
    if (!a.valide || a.points !== c.points) suspects.add(c.n)
    p = jouer(p, c.poses)
  }
  // Le plateau de la partie doit être exactement celui que donnent les coups de l'historique.
  if (coups.length && plateauEnTexte(p) !== plateauFinal) suspects.add(coups[coups.length - 1].n)
  return suspects
}
