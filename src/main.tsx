import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AppNative } from '@capacitor/app'
import '@fontsource-variable/outfit'
import { App } from './App'
import { natif, surOuvertureNotification } from './lib/notifications'
import { naviguer } from './lib/routeur'
import { lire } from './lib/stockage'
import { chargerDico } from './moteur/moteur'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Le dictionnaire se charge dès l'ouverture, en arrière-plan (Web Worker).
chargerDico().catch(() => {})

// Parties à deux déjà commencées sur cet appareil : on surveille les coups de l'adversaire dès l'ouverture.
if (lire('multi.pseudo', null)) import('./multi/veille').then((m) => m.demarrerVeille()).catch(() => {})

// Toucher une notification « À toi de jouer » ouvre la partie.
surOuvertureNotification((hash) => naviguer(hash.replace(/^#\/?/, '')))

// Liens d'invitation ouverts dans l'appli Android : https://p-bailly.github.io/Scrabble/#/rejoindre/CODE
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
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
}
