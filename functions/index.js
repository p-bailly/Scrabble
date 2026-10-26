// Notifications push des parties à deux (Cloud Functions pour Firebase, offre Blaze) : quand une partie change dans
// Firestore, on prévient les appareils du joueur concerné, appli fermée. Voir CLAUDE.md, « Notifications push ».

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { notificationsPartie } from './messages.js'

// À adapter : la région de la fonction doit être celle de la base Firestore (console Firebase → Firestore → Paramètres).
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })

initializeApp()

/** Envoie une notification aux appareils d'un joueur qui veulent ce genre de notification. */
async function envoyer(n) {
  const appareils = await getFirestore().collection(`joueurs/${n.uid}/appareils`).get()
  const cibles = appareils.docs.filter((d) => (d.get('genres') ?? []).includes(n.genre))
  if (cibles.length === 0) return
  const reponse = await getMessaging().sendEachForMulticast({
    tokens: cibles.map((d) => d.get('token')),
    notification: { title: n.titre, body: n.texte },
    // Le lien et le tag servent à l'appli : ouvrir la partie au toucher, et remplacer la notification locale du même coup.
    data: { hash: n.hash, tag: n.tag, titre: n.titre, texte: n.texte },
    android: { notification: { icon: 'ic_stat_notify', color: '#4C5FD5', tag: n.tag } },
  })
  // Un jeton refusé par FCM (appli désinstallée, données effacées) ne servira plus : on l'oublie.
  const perimes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']
  await Promise.all(
    reponse.responses.map((r, i) => (!r.success && perimes.includes(r.error?.code ?? '') ? cibles[i].ref.delete() : null)),
  )
}

export const surPartie = onDocumentWritten('parties/{code}', async (event) => {
  const avant = event.data?.before?.exists ? event.data.before.data() : null
  const apres = event.data?.after?.exists ? event.data.after.data() : null
  await Promise.all(notificationsPartie(avant, apres).map(envoyer))
})
