// Tout ce qui est synchronisé avec le compte, rassemblé : chaque sauvegarde locale fournit son adaptateur.

import { adapteursIA } from '../solo/sauvegardeIA'
import { adapteursDuplicate } from '../solo/sauvegarde'
import type { Adapteurs } from './moteurSynchro'
import { adapteurReglages } from './reglages'
import type { Adapteur } from './synchro'

/** Les trois groupes de réglages (« app », « duplicate », « ia ») forment une seule sorte d'éléments. */
const reglages: Adapteur = {
  lister: () => [...adapteurReglages.lister(), ...adapteursDuplicate.reglages.lister(), ...adapteursIA.reglages.lister()],
  appliquer(id, donnees, majLe) {
    const groupes: Record<string, Adapteur> = { app: adapteurReglages, duplicate: adapteursDuplicate.reglages, ia: adapteursIA.reglages }
    groupes[id]?.appliquer(id, donnees, majLe)
  },
}

export const adapteurs: Adapteurs = {
  'duplicate-encours': adapteursDuplicate.encours,
  'duplicate-histo': adapteursDuplicate.histo,
  'ia-encours': adapteursIA.encours,
  'ia-histo': adapteursIA.histo,
  'ia-partie': adapteursIA.partie,
  reglages,
}
