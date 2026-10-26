import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AppNative } from '@capacitor/app'
import { App, prechargerEcrans } from './App'
import { natif, surOuvertureNotification } from './lib/notifications'
import { demarrerReglages } from './lib/reglages'
import { naviguer } from './lib/routeur'
import { demanderStockagePersistant } from './lib/sauvegardeAppareil'
import { lire } from './lib/stockage'
import { chargerDico } from './moteur/moteur'
import './styles.css'

// Thème, étiquettes du plateau : appliqués avant le premier rendu.
demarrerReglages()

// Premier lancement sur cet appareil : on commence par le nom d'utilisateur (écran « Mes parties », multi/Compte.tsx).
// Le solo reste à un toucher (« Jouer en solo sans compte ») et marche sans compte ni réseau.
if (!location.hash && !lire('multi.pseudo', null) && !lire('multi.sansCompte', false)) {
  history.replaceState(null, '', '#/parties')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Version web : on demande au navigateur de ne pas purger les parties et statistiques gardées sur l'appareil.
if (!natif) demanderStockagePersistant()

// Le dictionnaire se charge dès l'ouverture, en arrière-plan (Web Worker).
chargerDico().catch(() => {})

// Une fois l'appli affichée, on prépare le reste sans gêner le premier rendu : les écrans moins courants (pour qu'ils
// s'ouvrent aussi hors ligne) et, si des parties à deux ont été commencées sur cet appareil, la veille des coups de
// l'adversaire (Firebase, la partie la plus lourde de l'appli).
const apresAffichage = (tache: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(tache, { timeout: 2000 }) : setTimeout(tache, 500))
apresAffichage(() => {
  prechargerEcrans()
  if (lire('multi.pseudo', null)) {
    import('./multi/veille').then((m) => m.demarrerVeille()).catch(() => {})
    import('./multi/synchro').then((m) => m.demarrerSynchro()).catch(() => {})
  }
})

// Toucher une notification « À toi de jouer » ouvre la partie.
surOuvertureNotification((hash) => naviguer(hash.replace(/^#\/?/, '')))

// Liens d'invitation ouverts dans l'appli Android : https://scrabble.pbailly.fr/#/rejoindre/CODE
// ou fr.perso.scrabble://rejoindre/CODE.
if (natif) {
  AppNative.addListener('appUrlOpen', ({ url }) => {
    const hash = url.split('#/')[1]
    const chemin = hash ?? url.replace(/^fr\.perso\.scrabble:\/\//, '')
    if (chemin) naviguer(chemin)
  })
}

// Service worker (installation sur l'écran d'accueil, ouverture hors ligne).
// Inutile dans l'appli Android, qui embarque déjà les fichiers.
if ('serviceWorker' in navigator && import.meta.env.PROD && !natif) {
  // Mise à jour : au lancement (et à chaque retour au premier plan) on cherche un nouveau service worker ; s'il
  // en existe un, il prend la main tout de suite (skipWaiting) et la page se recharge pour passer à la nouvelle version.
  const avaitUnControleur = !!navigator.serviceWorker.controller
  let recharge = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!avaitUnControleur || recharge) return
    recharge = true
    location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        void reg.update()
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update()
        })
      })
      .catch(() => {})
  })
}
