// Conseil affiché sur iPhone et iPad, dans Safari : ajouter l'appli à l'écran d'accueil.

import { useState } from 'react'
import { conseillerInstallation, plateformeActuelle } from '../lib/sauvegardeAppareil'
import { ecrire, lire } from '../lib/stockage'

const CLE = 'installation.ecarte'

export function ConseilInstallation() {
  const [ecarte, setEcarte] = useState(() => lire(CLE, false))
  if (ecarte || !conseillerInstallation(plateformeActuelle())) return null
  return (
    <div className="carte carte-accent">
      <b>Installe l’appli sur ton écran d’accueil</b>
      <span className="note">
        Touche le bouton Partager de Safari, puis « Sur l’écran d’accueil ». Tes parties et tes statistiques sont alors à l’abri, et
        les notifications deviennent possibles.
      </span>
      <div className="actions">
        <button
          type="button"
          className="bouton large"
          onClick={() => {
            ecrire(CLE, true)
            setEcarte(true)
          }}
        >
          Masquer
        </button>
      </div>
    </div>
  )
}
