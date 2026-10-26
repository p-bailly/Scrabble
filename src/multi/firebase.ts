// Connexion à Firebase : Authentication par lien envoyé par e-mail (sans mot de passe) et Cloud Firestore
// (offre gratuite Spark).
// La configuration est lue dans firebase.config.json, à la racine du dépôt (modèle : firebase.config.example.json).
// Elle n'a rien de secret : la sécurité repose sur les règles Firestore (firestore.rules).

import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
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
import { natif } from '../lib/notifications'
import { ecrire } from '../lib/stockage'

/** Adresse publique de la version web : liens d'invitation et retour des liens de connexion. */
export const ADRESSE_WEB = 'https://scrabble.pbailly.fr/'

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
    auth.languageCode = 'fr' // l'e-mail du lien de connexion part en français
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

/**
 * Envoie le lien de connexion par e-mail. Le lien ramène sur `chemin` (ex. « rejoindre/K7P2QX » : après la
 * connexion, on rejoint directement la partie). L'adresse est gardée pour valider le lien sur cet appareil.
 */
export async function envoyerLien(email: string, chemin: string): Promise<void> {
  const { auth } = initialiser()
  const retour = (natif ? ADRESSE_WEB : location.origin + location.pathname) + '#/' + chemin
  await sendSignInLinkToEmail(auth, email, { url: retour, handleCodeInApp: true })
  ecrire('multi.email', email)
}

/** Vrai si l'adresse (par défaut celle de la page) est un lien de connexion reçu par e-mail. */
export const estLienDeConnexion = (lien: string = location.href): boolean => isSignInWithEmailLink(initialiser().auth, lien)

/** Termine la connexion avec le lien reçu par e-mail. */
export async function terminerConnexion(email: string, lien: string = location.href): Promise<User> {
  const { user } = await signInWithEmailLink(initialiser().auth, email, lien)
  ecrire('multi.email', null)
  return user
}

export async function deconnexion(): Promise<void> {
  await signOut(initialiser().auth)
  ecrire('multi.pseudo', null) // le pseudo est celui du compte : le suivant le retrouvera dans Firestore
}
