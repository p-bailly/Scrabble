// Veille des parties à deux tant que l'appli est ouverte : détecte le coup de l'adversaire et les invitations reçues,
// affiche la notification correspondante et tient à jour le nombre de choses qui m'attendent (pastille de l'onglet).

import type { Unsubscribe } from 'firebase/firestore'
import { ecrire, lire } from '../lib/stockage'
import { notifier } from '../lib/notifications'
import { ecouterInvitations, ecouterMesParties, synchroniserJoueur, type Partie } from './donnees'
import { connexion } from './firebase'

export const EVENEMENT_TOUR = 'scrabble:tour'

let active = false
let ecoutes: Unsubscribe[] = []

export async function demarrerVeille() {
  if (active) return
  active = true
  try {
    const moi = await connexion()
    // Les fiches d'avant les invitations n'ont pas de clé de recherche : on la leur donne.
    void synchroniserJoueur(moi.uid).catch(() => {})
    // La pastille additionne les parties où c'est mon tour et les invitations en attente de réponse.
    let aMoi = 0
    let invitations = 0
    const compter = () => window.dispatchEvent(new CustomEvent(EVENEMENT_TOUR, { detail: aMoi + invitations }))
    ecoutes = [
      ecouterMesParties(moi.uid, (parties) => {
        aMoi = parties.filter((p) => p.etat === 'encours' && p.tour === moi.uid).length
        compter()
        for (const p of parties) signaler(p, moi.uid)
      }),
      ecouterInvitations(
        moi.uid,
        (recues) => {
          invitations = recues.length
          compter()
          for (const p of recues) signalerInvitation(p)
        },
        // Règles Firestore pas encore à jour : pas d'invitations, mais le reste de la veille continue.
        (e) => console.warn('Invitations indisponibles', e.message),
      ),
    ]
  } catch {
    active = false
  }
}

/** Arrête la veille (déconnexion) : la suivante repartira pour le compte qui se connectera. */
export function arreterVeille() {
  for (const arret of ecoutes) arret()
  ecoutes = []
  active = false
  window.dispatchEvent(new CustomEvent(EVENEMENT_TOUR, { detail: 0 }))
}

/** Notifie une fois chaque nouveau coup de l'adversaire (et la fin d'une partie, ou le refus d'une invitation). */
function signaler(p: Partie, uid: string) {
  const cle = 'multi.vu.' + p.code
  const vu = lire<string | null>(cle, null)
  // Le refus s'ajoute à la fin, pour que les étapes déjà gardées sur l'appareil restent valables.
  const etape = `${p.etat}:${p.joueurs.length}:${p.nbCoups}` + (p.refus?.length ? `:refus${p.refus.length}` : '')
  if (vu === etape) return
  ecrire(cle, etape)
  if (vu === null && p.etat !== 'encours') return // partie découverte déjà terminée ou en attente : rien à dire
  if (p.enAttente) return
  if (p.etat === 'attente') {
    const refuse = p.refus?.[p.refus.length - 1]
    if (refuse && p.createur === uid)
      notifier(p.code, 'Invitation refusée', `${p.pseudos[refuse] ?? 'Le joueur invité'} a refusé ton invitation.`, '#/partie/' + p.code, 'invitation')
    return
  }
  const adversaire = p.joueurs.find((j) => j !== uid)
  if (!adversaire) return
  const nom = p.pseudos[adversaire] ?? 'Ton adversaire'
  const hash = '#/partie/' + p.code
  if (p.etat === 'finie' && p.dernier?.uid !== uid) {
    notifier(p.code, 'Partie terminée', `${nom} : ${p.scores[adversaire]} – toi : ${p.scores[uid]}`, hash, 'fin')
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
    notifier(p.code, 'À toi de jouer', texte, hash, 'tour')
  }
}

/** Notifie une fois chaque invitation reçue ; toucher la notification ouvre « Mes parties », où l'on répond. */
function signalerInvitation(p: Partie) {
  const cle = 'multi.invitation.' + p.code
  if (lire(cle, false)) return
  ecrire(cle, true)
  const nom = p.pseudos[p.createur] ?? 'Un joueur'
  notifier('invitation.' + p.code, 'Invitation à jouer', `${nom} t’invite à une partie de Scrabble.`, '#/parties', 'invitation')
}
