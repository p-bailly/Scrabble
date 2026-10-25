// Connexion à Firebase : Authentication anonyme et Cloud Firestore (offre gratuite Spark).
// La configuration est lue dans firebase.config.json, à la racine du dépôt (modèle : firebase.config.example.json).
// Elle n'a rien de secret : la sécurité repose sur les règles Firestore (firestore.rules).

import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore'

// Fichier facultatif : sans lui, l'appli marche en solo et l'onglet « Mes parties » explique quoi faire.
const fichiers = import.meta.glob<FirebaseOptions>('/firebase.config.json', { eager: true, import: 'default' })
export const configuration: FirebaseOptions | null = Object.values(fichiers)[0] ?? null

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function initialiser() {
  if (!configuration) throw new Error('Firebase n’est pas configuré')
  if (!app) {
    app = initializeApp(configuration)
    auth = getAuth(app)
    // Cache local persistant : les parties s'affichent hors ligne et les coups joués sans réseau sont mis en
    // file, puis envoyés au retour du réseau.
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  }
  return { auth: auth!, db: db! }
}

export const base = (): Firestore => initialiser().db

/** Utilisateur connecté (connexion anonyme au premier appel, gardée ensuite sur l'appareil). */
export function connexion(): Promise<User> {
  const { auth } = initialiser()
  return new Promise((resoudre, rejeter) => {
    const fin = onAuthStateChanged(
      auth,
      (u) => {
        if (u) {
          fin()
          resoudre(u)
        } else signInAnonymously(auth).catch((e) => {
          fin()
          rejeter(e)
        })
      },
      (e) => {
        fin()
        rejeter(e)
      },
    )
  })
}
