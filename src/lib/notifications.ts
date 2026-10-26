// Notifications locales : plugin natif dans l'appli Android, API du navigateur (via le service worker) en web.
// Elles partent quand l'appli est ouverte ou revient au premier plan. Appli fermée, ce sont les notifications push du
// serveur (lib/push.ts, functions/), si le projet Firebase les a configurées : voir CLAUDE.md, « Notifications push ».

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { notificationVoulue, type GenreNotification } from './reglages'
import { lire } from './stockage'

export const natif = Capacitor.isNativePlatform()

/** Clé du jeton d'enregistrement aux notifications appli fermée (lib/push.ts) ; présent tant que cet appareil les reçoit. */
export const CLE_JETON = 'push.jeton'

/** Cet appareil reçoit-il les notifications appli fermée ? (Le système les affiche alors quand l'appli est en arrière-plan.) */
export const pushActif = (): boolean => lire<string | null>(CLE_JETON, null) !== null

/** Le système autorise-t-il les notifications ? `null` si cet appareil ne les propose pas. */
export async function notificationsAutorisees(): Promise<boolean | null> {
  try {
    if (natif) return (await LocalNotifications.checkPermissions()).display === 'granted'
    return 'Notification' in window ? Notification.permission === 'granted' : null
  } catch {
    return null
  }
}

export async function demanderPermission(): Promise<boolean> {
  try {
    if (natif) return (await LocalNotifications.requestPermissions()).display === 'granted'
    if (!('Notification' in window)) return false
    if (Notification.permission === 'default') return (await Notification.requestPermission()) === 'granted'
    return Notification.permission === 'granted'
  } catch {
    return false
  }
}

/** Identifiant numérique stable dérivé d'une clé (le plugin natif exige un entier 32 bits). */
function idNumerique(cle: string): number {
  let h = 5381
  for (let i = 0; i < cle.length; i++) h = (h * 33 + cle.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Affiche une notification qui, touchée, ouvre `hash` (ex. « #/partie/K7P2QX »), si les réglages la permettent. */
export async function notifier(cle: string, titre: string, texte: string, hash: string, genre?: GenreNotification) {
  if (!notificationVoulue(genre)) return
  // Appli cachée et notifications appli fermée actives : c'est le serveur qui prévient, pas la peine de doubler.
  if (pushActif() && typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  try {
    if (natif) {
      await LocalNotifications.schedule({ notifications: [{ id: idNumerique(cle), title: titre, body: texte, extra: { hash } }] })
      return
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const options = { body: texte, tag: cle, icon: './icon-192.png', badge: './icon-192.png', data: { url: hash } }
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(titre, options)
    else new Notification(titre, options)
  } catch {
    /* certaines plateformes refusent les notifications hors service worker */
  }
}

/** Appelle `ouvrir` avec le hash de la partie quand on touche une notification. */
export function surOuvertureNotification(ouvrir: (hash: string) => void): () => void {
  if (natif) {
    const h = LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
      const hash = a.notification.extra?.hash
      if (typeof hash === 'string') ouvrir(hash)
    })
    // Une notification appli fermée (envoyée par le serveur) touchée : elle porte le même lien.
    const p = import('@capacitor/push-notifications').then(({ PushNotifications }) =>
      PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
        const hash = a.notification.data?.hash
        if (typeof hash === 'string') ouvrir(hash)
      }),
    )
    return () => {
      void h.then((x) => x.remove())
      void p.then((x) => x.remove()).catch(() => {})
    }
  }
  const surMessage = (e: MessageEvent) => {
    if (e.data?.type === 'ouvrir' && typeof e.data.hash === 'string') ouvrir(e.data.hash)
  }
  navigator.serviceWorker?.addEventListener('message', surMessage)
  return () => navigator.serviceWorker?.removeEventListener('message', surMessage)
}
