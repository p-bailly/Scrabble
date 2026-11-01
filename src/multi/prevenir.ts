// Prévenir l'autre joueur, appli fermée, sans Cloud Function : après une écriture dans une partie (coup, invitation, refus,
// fin), on demande au Worker (dossier worker/) d'envoyer la notification push. Sans « notifierUrl » dans firebase.config.json,
// ou si la Cloud Function est déployée à la place, rien à faire. Voir CLAUDE.md, « Notifications push ».

import { configuration } from '../lib/configFirebase'
import { utilisateur } from './firebase'

/** Demande l'envoi du push pour cette partie ; sans attente ni erreur : le coup, lui, est déjà enregistré. */
export function prevenir(code: string): void {
  const url = configuration?.notifierUrl
  if (!url || !configuration?.push) return
  void (async () => {
    try {
      const jeton = await (await utilisateur())?.getIdToken()
      if (!jeton) return
      await fetch(url.replace(/\/$/, '') + '/prevenir', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        keepalive: true,
      })
    } catch {
      /* hors ligne ou Worker indisponible : l'adversaire verra le coup à l'ouverture de l'appli */
    }
  })()
}
