// Connexion à Firebase : Authentication par nom d'utilisateur (sans mot de passe) et Cloud Firestore (offre
// gratuite Spark).
// La configuration est lue dans firebase.config.json, à la racine du dépôt (modèle : firebase.config.example.json).
// Elle n'a rien de secret : la sécurité repose sur les règles Firestore (firestore.rules).

import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { ecrire } from '../lib/stockage'

// Fichier facultatif : sans lui, l'appli marche en solo et l'onglet « Mes parties » explique quoi faire.
// Avec « "emulateurs": true », l'appli utilise les émulateurs Firebase locaux (tests, voir le README).
type Configuration = FirebaseOptions & { emulateurs?: boolean }
const fichiers = import.meta.glob<Configuration>('/firebase.config.json', { eager: true, import: 'default' })
export const configuration: Configuration | null = Object.values(fichiers)[0] ?? null

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function initialiser() {
  if (!configuration) throw new Error('Firebase n’est pas configuré')
  if (!app) {
    const { emulateurs, ...options } = configuration
    app = initializeApp(options)
    auth = getAuth(app)
    // Cache local persistant : les parties s'affichent hors ligne et les coups joués sans réseau sont mis en
    // file, puis envoyés au retour du réseau.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
    if (emulateurs) {
      connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true })
      connectFirestoreEmulator(db, location.hostname, 8080)
    }
  }
  return { auth: auth!, db: db! }
}

export const base = (): Firestore => initialiser().db

/** Utilisateur connecté, ou null s'il ne l'est pas (la session est gardée sur l'appareil, Firebase la relit). */
export function utilisateur(): Promise<User | null> {
  const { auth } = initialiser()
  return new Promise((resoudre, rejeter) => {
    const fin = onAuthStateChanged(
      auth,
      (u) => {
        fin()
        resoudre(u)
      },
      (e) => {
        fin()
        rejeter(e)
      },
    )
  })
}

/** Utilisateur connecté ; erreur s'il ne l'est pas (la connexion se fait dans compte.tsx). */
export async function connexion(): Promise<User> {
  const u = await utilisateur()
  if (!u) throw new Error('Non connecté')
  return u
}

// Un nom d'utilisateur tient lieu de compte, sans mot de passe : Firebase n'offre pas ce mode, on le simule avec
// une connexion « adresse + mot de passe » dont les deux dérivent du nom (l'adresse n'existe pas, aucun e-mail
// n'est envoyé). Saisir le même nom sur un autre appareil ouvre donc le même compte. Revers : quiconque connaît le
// nom peut s'y connecter. Pour l'éviter, il faudrait un secret que l'utilisateur seul connaît (voir le README).
const DOMAINE_JOUEURS = 'joueurs.scrabble.pbailly.fr'

/** Forme normalisée d'un nom : sans accents ni majuscules, « Jean Luc » et « jean-luc » désignent le même compte. */
export const identifiant = (nom: string): string =>
  nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Se connecte avec ce nom d'utilisateur ; le compte est créé la première fois. */
export async function connecterNom(nom: string): Promise<User> {
  const id = identifiant(nom)
  if (!id) throw new Error('Utilise des lettres ou des chiffres dans ton nom.')
  const { auth } = initialiser()
  const email = `${id}@${DOMAINE_JOUEURS}`
  const mdp = `scrabble-${id}`
  try {
    return (await signInWithEmailAndPassword(auth, email, mdp)).user
  } catch (e) {
    // Compte inconnu (Firebase ne distingue pas « inconnu » de « mauvais mot de passe ») : on le crée.
    const code = (e as { code?: string }).code
    if (code !== 'auth/invalid-credential' && code !== 'auth/user-not-found') throw e
  }
  try {
    return (await createUserWithEmailAndPassword(auth, email, mdp)).user
  } catch (e) {
    // Créé entre-temps depuis un autre appareil : on s'y connecte.
    if ((e as { code?: string }).code === 'auth/email-already-in-use') return (await signInWithEmailAndPassword(auth, email, mdp)).user
    throw e
  }
}

export async function deconnexion(): Promise<void> {
  await signOut(initialiser().auth)
  ecrire('multi.pseudo', null) // le pseudo est celui du compte : le suivant le retrouvera dans Firestore
}
