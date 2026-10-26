// Parties à deux stockées dans Firestore.
//
//   joueurs/{uid}                      { pseudo, visible, recherche } ; `recherche` (le pseudo simplifié) n'est écrit que si
//                                      le joueur accepte d'être trouvé : c'est ce qu'interroge la recherche de joueurs
//   parties/{code}                     état public de la partie (plateau, sac, scores, à qui le tour…) ; `invites`
//                                      est le joueur invité directement (il y voit l'invitation), `refus` ceux qui ont dit non

//   parties/{code}/chevalets/{uid}     les lettres d'un joueur, lisibles par lui seul
//   parties/{code}/coups/{n}           historique des coups (mot, position, points)
//
// Toutes les écritures d'un coup partent dans un même lot (writeBatch) : hors ligne, le lot est mis en file par
// Firestore et envoyé au retour du réseau. Le contenu du sac est lisible par les deux joueurs : sans serveur, la
// triche reste possible, ce qui est accepté pour un usage entre amis.

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { changer, finDePartie, lettresAdversaire, piocher } from '../jeu/classique'
import type { TourAnalysable } from '../jeu/analyse'
import { jetonsUtilises, jouer, lireReference, reference, retirerDuChevalet, type Analyse, type Pose } from '../jeu/coup'
import { tousLesJetons } from '../jeu/lettres'
import { plateauDepuisTexte, plateauEnTexte, plateauVide } from '../jeu/plateau'
import { base, identifiant } from './firebase'

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
  /** Joueur invité directement (au plus un) tant que la partie attend son adversaire. Absent des parties anciennes. */
  invites?: string[]
  /** Joueurs qui ont refusé l'invitation. */
  refus?: string[]
  /** Écriture locale pas encore envoyée (hors ligne). */
  enAttente?: boolean
}

/** Fiche publique d'un joueur. */
export interface Joueur {
  pseudo: string
  /** Peut-on le trouver en tapant son nom pour l'inviter ? */
  visible: boolean
  /** Clé de recherche enregistrée (absente si le joueur n'est pas visible, ou si la fiche date d'avant les invitations). */
  recherche?: string
}

/** Un joueur trouvé, qu'on peut inviter. */
export interface JoueurTrouve {
  uid: string
  pseudo: string
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
  /**
   * Chevalet de celui qui joue, avant son coup (analyse de fin de partie). L'adversaire pouvait déjà le déduire du sac.
   * Absent des coups joués avant l'analyse.
   */
  chevalet?: string
}

const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function nouveauCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET_CODE[Math.floor(Math.random() * ALPHABET_CODE.length)]
  return s
}

export const normaliserCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

export const autre = (p: Partie, uid: string) => p.joueurs.find((j) => j !== uid) ?? null

/** Message lisible pour une erreur Firestore (hors ligne, règles de sécurité pas à jour…). */
export function messageErreur(e: unknown): string {
  const code = (e as { code?: string })?.code
  if (code === 'permission-denied')
    return 'Refusé par le serveur. Si cela dure, les règles Firestore du projet ne sont peut-être pas à jour (voir CLAUDE.md, « Firebase »).'
  if (code === 'unavailable') return 'Pas de connexion à Internet.'
  return e instanceof Error ? e.message : String(e)
}

/** Clé de recherche d'un pseudo : sans accents, majuscules ni ponctuation (« Jean Luc » et « jean-luc » se valent). */
export const cleRecherche = identifiant

/** Une recherche de joueur commence à deux caractères (un seul rendrait presque tout le monde). */
export const MIN_RECHERCHE = 2

export async function lireJoueur(uid: string): Promise<Joueur | null> {
  const d = await getDoc(doc(base(), 'joueurs', uid))
  if (!d.exists()) return null
  const { pseudo, visible, recherche } = d.data()
  return { pseudo: pseudo as string, visible: visible !== false, recherche: recherche as string | undefined }
}

/** Écrit la fiche du joueur. Visible, elle porte la clé de recherche : les autres peuvent l'inviter en tapant son nom. */
export async function enregistrerJoueur(uid: string, pseudo: string, visible: boolean) {
  await setDoc(doc(base(), 'joueurs', uid), { pseudo, visible, ...(visible ? { recherche: cleRecherche(pseudo) } : {}) })
}

/** Change le pseudo en gardant le choix « visible » déjà enregistré (visible par défaut). */
export async function enregistrerPseudo(uid: string, pseudo: string) {
  const j = await lireJoueur(uid).catch(() => null)
  await enregistrerJoueur(uid, pseudo, j?.visible ?? true)
}

/** Remet la fiche à jour si besoin : celles d'avant les invitations n'ont pas de clé de recherche. */
export async function synchroniserJoueur(uid: string): Promise<Joueur | null> {
  const j = await lireJoueur(uid)
  if (j?.visible && j.recherche !== cleRecherche(j.pseudo)) await enregistrerJoueur(uid, j.pseudo, true)
  return j
}

/**
 * Joueurs dont le pseudo commence par ce texte (8 au plus, moi exclu). Ceux qui ne veulent pas être trouvés n'y sont
 * pas. Demande une connexion : hors ligne, le cache ne dirait que ce qu'il connaît déjà.
 */
export async function chercherJoueurs(texte: string, moi: string): Promise<JoueurTrouve[]> {
  const cle = cleRecherche(texte)
  if (cle.length < MIN_RECHERCHE) return []
  const s = await getDocs(
    query(collection(base(), 'joueurs'), where('recherche', '>=', cle), where('recherche', '<=', cle + ''), orderBy('recherche'), limit(10)),
  )
  if (s.metadata.fromCache) throw new Error('Pas de connexion : la recherche demande Internet.')
  return s.docs
    .filter((d) => d.id !== moi)
    .slice(0, 8)
    .map((d) => ({ uid: d.id, pseudo: d.data().pseudo as string }))
}

/** Adversaires déjà rencontrés, du plus récent au plus ancien : on peut les réinviter d'un geste. */
export function adversairesRecents(parties: readonly Partie[], uid: string): JoueurTrouve[] {
  const date = (p: Partie) => p.majLe?.toMillis?.() ?? Date.now()
  const vus = new Map<string, JoueurTrouve>()
  for (const p of [...parties].sort((a, b) => date(b) - date(a))) {
    const adv = autre(p, uid)
    if (adv && !vus.has(adv)) vus.set(adv, { uid: adv, pseudo: p.pseudos[adv] ?? '?' })
  }
  return [...vus.values()]
}

/** Résultats contre un adversaire, sur les parties terminées. */
export interface Bilan {
  uid: string
  pseudo: string
  victoires: number
  defaites: number
  egalites: number
}

/**
 * Bilan face à face avec chaque adversaire, sur les parties terminées (abandons compris : l'abandon donne la victoire à
 * l'autre). Le plus joué d'abord, puis par ordre alphabétique du pseudo ; le pseudo est celui de la partie la plus récente.
 */
export function bilansFaceAFace(parties: readonly Partie[], uid: string): Bilan[] {
  const date = (p: Partie) => p.majLe?.toMillis?.() ?? Date.now()
  const bilans = new Map<string, Bilan>()
  for (const p of [...parties].sort((a, b) => date(b) - date(a))) {
    const adv = autre(p, uid)
    if (p.etat !== 'finie' || !adv) continue
    const b = bilans.get(adv) ?? { uid: adv, pseudo: p.pseudos[adv] ?? '?', victoires: 0, defaites: 0, egalites: 0 }
    const gagnant = p.fin?.gagnant ?? null
    if (gagnant === null) b.egalites++
    else if (gagnant === uid) b.victoires++
    else b.defaites++
    bilans.set(adv, b)
  }
  const total = (b: Bilan) => b.victoires + b.defaites + b.egalites
  return [...bilans.values()].sort((a, b) => total(b) - total(a) || a.pseudo.localeCompare(b.pseudo))
}

/** Crée une partie et renvoie son code ; `invite` : joueur à inviter tout de suite (il voit l'invitation dans l'appli). */
export async function creerPartie(uid: string, pseudo: string, invite?: JoueurTrouve): Promise<string> {
  const code = nouveauCode()
  const { tires, sac } = piocher(tousLesJetons(), 7)
  const b = writeBatch(base())
  const partie: Omit<Partie, 'creeLe' | 'majLe'> & { creeLe: unknown; majLe: unknown } = {
    code,
    createur: uid,
    joueurs: [uid],
    pseudos: { [uid]: pseudo, ...(invite ? { [invite.uid]: invite.pseudo } : {}) },
    invites: invite ? [invite.uid] : [],
    refus: [],
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
    invites: [],
    sac: sac.join(''),
    majLe: serverTimestamp(),
  })
  b.set(doc(base(), 'parties', code, 'chevalets', uid), { lettres: tires.join('') })
  await b.commit()
}

export async function supprimerPartie(code: string) {
  await deleteDoc(doc(base(), 'parties', code))
}

/**
 * Les invitations demandent une connexion : hors ligne, Firestore garderait l'écriture en file et ne répondrait qu'au
 * retour du réseau, laissant l'écran en attente (comme pour rejoindre une partie, voir plus haut).
 */
function exigerConnexion() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Pas de connexion à Internet.')
}

/** Invite un joueur de l'appli à une partie en attente (un seul invité à la fois : le nouveau remplace l'ancien). */
export async function inviter(p: Partie, invite: JoueurTrouve) {
  exigerConnexion()
  const ancien = p.invites?.[0]
  await updateDoc(doc(base(), 'parties', p.code), {
    invites: [invite.uid],
    refus: [],
    [`pseudos.${invite.uid}`]: invite.pseudo,
    ...(ancien && ancien !== invite.uid ? { [`pseudos.${ancien}`]: deleteField() } : {}),
    majLe: serverTimestamp(),
  })
}

/** Retire l'invitation envoyée (la partie reste, avec son code et son lien). */
export async function annulerInvitation(p: Partie) {
  exigerConnexion()
  const ancien = p.invites?.[0]
  await updateDoc(doc(base(), 'parties', p.code), {
    invites: [],
    refus: [],
    ...(ancien ? { [`pseudos.${ancien}`]: deleteField() } : {}),
    majLe: serverTimestamp(),
  })
}

/** Refuse une invitation reçue : le créateur le voit, la partie reste ouverte pour quelqu'un d'autre. */
export async function refuserInvitation(code: string, uid: string) {
  exigerConnexion()
  await updateDoc(doc(base(), 'parties', code), { invites: arrayRemove(uid), refus: arrayUnion(uid), majLe: serverTimestamp() })
}

/** Invitations reçues, pas encore acceptées ni refusées (mise à jour en direct). */
export function ecouterInvitations(uid: string, rappel: (parties: Partie[]) => void, erreur?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(base(), 'parties'), where('invites', 'array-contains', uid)),
    (s) => rappel(s.docs.map((d) => d.data() as Partie).filter((p) => p.etat === 'attente')),
    erreur,
  )
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

/** L'historique d'une partie à deux, tel que l'analyse de fin de partie le lit (le joueur est son identifiant). */
export function toursDeMulti(coups: readonly CoupMulti[]): TourAnalysable[] {
  return coups.map((c) => {
    const lieu = c.ref ? lireReference(c.ref) : null
    return {
      numero: c.n,
      joueur: c.uid,
      type: c.type,
      chevalet: c.chevalet ? [...c.chevalet] : undefined,
      coup: c.type === 'mot' && c.poses && c.mot && lieu ? { poses: c.poses, mot: c.mot, dir: lieu.dir, debut: lieu.debut, points: c.points } : undefined,
      nbChanges: c.nbChanges,
      points: c.points,
    }
  })
}

/** Un mot est joué avec son analyse (faite par le worker, qui détient le dictionnaire). */
type Action = { type: 'mot'; analyse: Analyse } | { type: 'change'; lettres: string[] } | { type: 'passe' }

/**
 * Joue un coup. Le lot d'écritures est envoyé sans attendre la réponse du serveur : hors ligne, il part au retour
 * du réseau. Renvoie un message d'erreur si le coup n'est pas permis ; si le serveur le refuse ensuite (règles de
 * sécurité, par exemple), `surRefus` en reçoit la raison, car l'écran revient alors à l'état d'avant le coup.
 */
export function jouerCoup(p: Partie, uid: string, chevalet: string[], action: Action, surRefus?: (message: string) => void): string | null {
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

  coup.chevalet = chevalet.join('')

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
  b.commit().catch((e) => {
    console.error('Coup refusé par le serveur', e)
    surRefus?.('Coup non enregistré : ' + messageErreur(e))
  })
  return null
}

/** Abandon : la partie s'arrête, l'adversaire gagne. `surRefus` : voir `jouerCoup`. */
export function abandonner(p: Partie, uid: string, surRefus?: (message: string) => void) {
  const adversaire = autre(p, uid)
  const b = writeBatch(base())
  b.update(doc(base(), 'parties', p.code), {
    etat: 'finie',
    tour: null,
    fin: { ajustements: {}, raison: 'abandon', gagnant: adversaire },
    dernier: { uid, type: 'abandon', points: 0 },
    majLe: serverTimestamp(),
  })
  b.commit().catch((e) => {
    console.error('Abandon refusé', e)
    surRefus?.('Abandon non enregistré : ' + messageErreur(e))
  })
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
