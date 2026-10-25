// Notifications locales : plugin natif dans l'appli Android, API du navigateur (via le service worker) en web.
// Pas de push quand l'appli est fermée : il faudrait Cloud Functions (offre payante Blaze), voir le README.

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export const natif = Capacitor.isNativePlatform()

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

/** Affiche une notification qui, touchée, ouvre `hash` (ex. « #/partie/K7P2QX »). */
export async function notifier(cle: string, titre: string, texte: string, hash: string) {
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
    return () => void h.then((x) => x.remove())
  }
  const surMessage = (e: MessageEvent) => {
    if (e.data?.type === 'ouvrir' && typeof e.data.hash === 'string') ouvrir(e.data.hash)
  }
  navigator.serviceWorker?.addEventListener('message', surMessage)
  return () => navigator.serviceWorker?.removeEventListener('message', surMessage)
}
