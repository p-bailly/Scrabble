// Notifications à envoyer quand une partie à deux change. Fonctions pures, sans Firebase : elles sont testées avec le
// reste de l'appli (src/multi/messages.test.ts). Elles reprennent les règles de src/multi/veille.ts, qui prévient déjà
// quand l'appli est ouverte ; ici, c'est le serveur qui prévient appli fermée.

/**
 * @typedef {{ uid: string, genre: 'tour' | 'invitation' | 'fin', titre: string, texte: string, hash: string, tag: string }} Notification
 */

/**
 * Ce qu'il faut notifier, à qui, entre l'état d'une partie avant et après son écriture.
 * `avant` est null à la création de la partie, `apres` à sa suppression (rien à envoyer alors).
 * @param {any} avant
 * @param {any} apres
 * @returns {Notification[]}
 */
export function notificationsPartie(avant, apres) {
  if (!apres) return []
  const nom = (uid) => apres.pseudos?.[uid] ?? 'Ton adversaire'
  const lien = '#/partie/' + apres.code
  /** @type {Notification[]} */
  const envois = []

  // Invitation reçue : un joueur de l'appli est invité à une partie en attente.
  if (apres.etat === 'attente') {
    const avantInvites = avant?.invites ?? []
    for (const invite of apres.invites ?? []) {
      if (avantInvites.includes(invite)) continue
      envois.push({
        uid: invite,
        genre: 'invitation',
        titre: 'Invitation à jouer',
        texte: `${apres.pseudos?.[apres.createur] ?? 'Un joueur'} t’invite à une partie de Scrabble.`,
        hash: '#/parties',
        tag: 'invitation.' + apres.code,
      })
    }
    // Invitation refusée : le créateur l'apprend.
    const refusAvant = avant?.refus ?? []
    const refus = apres.refus ?? []
    if (refus.length > refusAvant.length) {
      const refuse = refus[refus.length - 1]
      envois.push({
        uid: apres.createur,
        genre: 'invitation',
        titre: 'Invitation refusée',
        texte: `${apres.pseudos?.[refuse] ?? 'Le joueur invité'} a refusé ton invitation.`,
        hash: lien,
        tag: apres.code,
      })
    }
    return envois
  }

  const adversaireDe = (uid) => (apres.joueurs ?? []).find((j) => j !== uid)

  // L'adversaire rejoint la partie : le créateur joue en premier.
  if (avant?.etat === 'attente' && apres.etat === 'encours' && apres.tour) {
    const nouveau = (apres.joueurs ?? []).find((j) => j !== apres.createur)
    envois.push({ uid: apres.tour, genre: 'tour', titre: 'À toi de jouer', texte: `${nom(nouveau)} a rejoint ta partie.`, hash: lien, tag: apres.code })
    return envois
  }

  // Fin de partie : celui qui n'a pas joué le dernier coup (ou abandonné) l'apprend.
  if (avant && avant.etat !== 'finie' && apres.etat === 'finie') {
    const dernier = apres.dernier
    const destinataire = dernier ? adversaireDe(dernier.uid) : undefined
    if (destinataire && dernier) {
      if (apres.fin?.raison === 'abandon')
        envois.push({
          uid: destinataire,
          genre: 'fin',
          titre: 'Partie abandonnée',
          texte: `${nom(dernier.uid)} a abandonné : tu gagnes la partie.`,
          hash: lien,
          tag: apres.code,
        })
      else
        envois.push({
          uid: destinataire,
          genre: 'fin',
          titre: 'Partie terminée',
          texte: `${nom(dernier.uid)} : ${apres.scores?.[dernier.uid] ?? 0} – toi : ${apres.scores?.[destinataire] ?? 0}`,
          hash: lien,
          tag: apres.code,
        })
    }
    return envois
  }

  // Un coup vient d'être joué : c'est à l'autre de jouer.
  if (avant && apres.etat === 'encours' && apres.nbCoups > (avant.nbCoups ?? 0) && apres.tour && apres.dernier) {
    const d = apres.dernier
    const qui = nom(d.uid)
    const texte =
      d.type === 'mot'
        ? `${qui} a joué ${String(d.mot ?? '').toUpperCase()} (${d.points} pts).`
        : d.type === 'change'
          ? `${qui} a changé des lettres.`
          : `${qui} a passé son tour.`
    envois.push({ uid: apres.tour, genre: 'tour', titre: 'À toi de jouer', texte, hash: lien, tag: apres.code })
  }
  return envois
}
