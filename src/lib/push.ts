// Notifications appli fermée (push) : l'appareil s'enregistre auprès de Firebase Cloud Messaging et dépose son jeton dans
// Firestore ; une Cloud Function (dossier functions/) l'utilise pour prévenir quand l'adversaire joue. Chargé à la demande
// (il dépend de Firebase), seulement quand le projet l'a configuré (« push » dans firebase.config.json, voir CLAUDE.md, « Notifications push »).

import { deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { configuration } from './configFirebase'
import { CLE_JETON, natif } from './notifications'
import { genresVoulus } from './reglages'
import { ecrire, lire } from './stockage'
import { application, base } from '../multi/firebase'

export type ResultatPush = 'ok' | 'refuse' | 'indisponible'

/** Jeton FCM de cet appareil (Android : plugin natif ; web : service worker de l'appli). */
async function obtenirJeton(): Promise<{ jeton: string; plateforme: 'android' | 'web' } | 'refuse' | 'indisponible'> {
  if (natif) {
    // Sans google-services.json dans l'APK, Firebase n'est pas initialisé côté Android : on n'essaie pas.
    if (!configuration?.pushAndroid) return 'indisponible'
    const { PushNotifications } = await import('@capacitor/push-notifications')
    if ((await PushNotifications.requestPermissions()).receive !== 'granted') return 'refuse'
    let resoudre!: (jeton: string) => void
    let rejeter!: (e: Error) => void
    const attente = new Promise<string>((ok, ko) => {
      resoudre = ok
      rejeter = ko
    })
    const ecouteurs = await Promise.all([
      PushNotifications.addListener('registration', (t) => resoudre(t.value)),
      PushNotifications.addListener('registrationError', (e) => rejeter(new Error(e.error))),
    ])
    try {
      await PushNotifications.register()
      return { jeton: await attente, plateforme: 'android' }
    } finally {
      for (const e of ecouteurs) void e.remove()
    }
  }
  const messagerie = await import('firebase/messaging')
  if (!(await messagerie.isSupported()) || !('serviceWorker' in navigator) || !configuration?.vapidKey) return 'indisponible'
  if ((await Notification.requestPermission()) !== 'granted') return 'refuse'
  // Le service worker de l'appli (public/sw.js) affiche les notifications : il n'existe que dans la version publiée.
  const enregistrement = await navigator.serviceWorker.getRegistration()
  if (!enregistrement) return 'indisponible'
  const jeton = await messagerie.getToken(messagerie.getMessaging(application()), {
    vapidKey: configuration.vapidKey,
    serviceWorkerRegistration: enregistrement,
  })
  return { jeton, plateforme: 'web' }
}

/** Enregistre cet appareil pour les notifications appli fermée (demande l'autorisation au système si besoin). */
export async function activerPush(uid: string): Promise<ResultatPush> {
  const r = await obtenirJeton()
  if (typeof r === 'string') return r
  await setDoc(doc(base(), 'joueurs', uid, 'appareils', r.jeton), {
    token: r.jeton,
    plateforme: r.plateforme,
    genres: genresVoulus(),
    majLe: serverTimestamp(),
  })
  ecrire(CLE_JETON, r.jeton)
  return 'ok'
}

/** Met à jour, côté serveur, les genres de notification voulus (après un changement dans les réglages). */
export async function synchroniserPush(uid: string): Promise<void> {
  const jeton = lire<string | null>(CLE_JETON, null)
  if (!jeton) return
  await setDoc(doc(base(), 'joueurs', uid, 'appareils', jeton), { genres: genresVoulus(), majLe: serverTimestamp() }, { merge: true })
}

/** Cet appareil ne reçoit plus de notifications appli fermée (réglage coupé, déconnexion). */
export async function desactiverPush(uid: string): Promise<void> {
  const jeton = lire<string | null>(CLE_JETON, null)
  if (!jeton) return
  ecrire(CLE_JETON, null)
  await deleteDoc(doc(base(), 'joueurs', uid, 'appareils', jeton)).catch(() => {})
  if (!natif) {
    const messagerie = await import('firebase/messaging')
    await messagerie.deleteToken(messagerie.getMessaging(application())).catch(() => {})
  }
}
