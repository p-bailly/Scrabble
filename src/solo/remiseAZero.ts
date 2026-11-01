// Remise à zéro des statistiques solo : historiques du duplicate et des parties contre l'ordinateur. Les parties en cours
// ne sont jamais touchées. Seules les parties commencées avant `depuis` partent, pour qu'une remise à zéro reçue tard
// (appareil resté hors ligne) n'efface pas ce qui a été joué depuis.

import { ecrire, lire } from '../lib/stockage'
import { lireHistorique, supprimerDeHistorique } from './sauvegarde'
import { lireHistoriqueIA, lirePartiesIA, supprimerPartieIAGardee, supprimerResumeIA } from './sauvegardeIA'

/** Date de la dernière remise à zéro (ms) : le bilan face à face ignore les parties terminées avant. */
export const CLE_DEPUIS = 'stats.depuis'

/**
 * Remise à zéro unique pour tous les appareils (1er novembre 2026) : chaque appareil l'applique une fois, au lancement de
 * la version qui la contient. Pour en refaire une, mettre la date du jour ici (Date.now()).
 */
export const REMISE_A_ZERO = 1793539284648

export const depuisRemiseAZero = () => lire<number>(CLE_DEPUIS, 0)

/** Applique une remise à zéro faite à la date `depuis` ; renvoie false si cet appareil l'avait déjà appliquée. */
export function remettreStatsAZero(depuis: number): boolean {
  if (depuis <= depuisRemiseAZero()) return false
  for (const p of lireHistorique()) if (p.creeLe <= depuis) supprimerDeHistorique(p.id)
  for (const r of lireHistoriqueIA()) if (r.date <= depuis) supprimerResumeIA(r.id)
  for (const p of lirePartiesIA()) if (p.creeLe <= depuis) supprimerPartieIAGardee(p.id)
  ecrire(CLE_DEPUIS, depuis)
  return true
}
