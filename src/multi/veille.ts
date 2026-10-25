// Veille des parties à deux tant que l'appli est ouverte : détecte le coup de l'adversaire, affiche la
// notification « À toi de jouer » et tient à jour le nombre de parties où c'est mon tour (pastille de l'onglet).

import { ecrire, lire } from '../lib/stockage'
import { notifier } from '../lib/notifications'
import { ecouterMesParties, type Partie } from './donnees'
import { connexion } from './firebase'

export const EVENEMENT_TOUR = 'scrabble:tour'

let active = false

export async function demarrerVeille() {
  if (active) return
  active = true
  try {
    const moi = await connexion()
    ecouterMesParties(moi.uid, (parties) => {
      const aMoi = parties.filter((p) => p.etat === 'encours' && p.tour === moi.uid)
      window.dispatchEvent(new CustomEvent(EVENEMENT_TOUR, { detail: aMoi.length }))
      for (const p of parties) signaler(p, moi.uid)
    })
  } catch {
    active = false
  }
}

/** Notifie une fois chaque nouveau coup de l'adversaire (et la fin d'une partie). */
function signaler(p: Partie, uid: string) {
  const cle = 'multi.vu.' + p.code
  const vu = lire<string | null>(cle, null)
  const etape = `${p.etat}:${p.joueurs.length}:${p.nbCoups}`
  if (vu === etape) return
  ecrire(cle, etape)
  if (vu === null && p.etat !== 'encours') return // partie découverte déjà terminée ou en attente : rien à dire
  const adversaire = p.joueurs.find((j) => j !== uid)
  if (!adversaire || p.enAttente) return
  const nom = p.pseudos[adversaire] ?? 'Ton adversaire'
  const hash = '#/partie/' + p.code
  if (p.etat === 'finie' && p.dernier?.uid !== uid) {
    notifier(p.code, 'Partie terminée', `${nom} : ${p.scores[adversaire]} – toi : ${p.scores[uid]}`, hash)
  } else if (p.etat === 'encours' && p.tour === uid) {
    const d = p.dernier
    const texte =
      !d || p.nbCoups === 0
        ? `${nom} a rejoint ta partie.`
        : d.type === 'mot'
          ? `${nom} a joué ${d.mot?.toUpperCase()} (${d.points} pts).`
          : d.type === 'change'
            ? `${nom} a changé des lettres.`
            : `${nom} a passé son tour.`
    notifier(p.code, 'À toi de jouer', texte, hash)
  }
}
