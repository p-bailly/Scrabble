// Dictionnaire : vérifier qu'un mot est valable (ODS) et lire sa définition. Volontairement pas de recherche (début,
// fin, lettres…) : on vérifie un mot précis, on ne cherche pas de mots à jouer.

import { Entete } from '../composants/Entete'
import { VerifierMot } from '../composants/VerifierMot'

export function Dictionnaire() {
  return (
    <div className="contenu">
      <Entete titre="Dictionnaire" />
      <VerifierMot />
    </div>
  )
}
