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

  // L'adversaire rejoint la partie : le créateur l'apprend, qu'il commence ou non (on alterne d'une partie à l'autre), ou
  // qu'il ait à répondre au premier coup que le créateur a joué dès l'invitation.
  if (avant?.etat === 'attente' && apres.etat === 'encours' && apres.tour) {
    const nouveau = (apres.joueurs ?? []).find((j) => j !== apres.createur)
    const aLui = apres.tour === apres.createur
    envois.push({
      uid: apres.createur,
      genre: 'tour',
      titre: aLui ? 'À toi de jouer' : 'Partie commencée',
      texte: `${nom(nouveau)} a rejoint ta partie${aLui ? '' : apres.nbCoups > 0 ? ' : à son tour de jouer' : ' et commence'}.`,
      hash: lien,
      tag: apres.code,
    })
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

/**
 * Ce qu'il faut notifier à partir de l'état *actuel* d'une partie, quand c'est `appelant` qui vient de l'écrire : c'est
 * ce que sait un serveur appelé par le client (worker/), sans l'état d'avant. L'appelant n'est cru que s'il est bien
 * l'auteur de ce que l'état montre (dernier coup, invitation, refus) : on ne prévient pas pour le compte d'un autre.
 * @param {any} partie
 * @param {string} appelant
 * @returns {Notification[]}
 */
export function notificationsDepuisEtat(partie, appelant) {
  if (!partie || !appelant) return []
  const joueurs = partie.joueurs ?? []
  if (partie.etat === 'attente') {
    if (partie.createur === appelant) return notificationsPartie({ etat: 'attente', invites: [], refus: partie.refus ?? [] }, partie)
    const refus = partie.refus ?? []
    if (refus[refus.length - 1] === appelant)
      return notificationsPartie({ etat: 'attente', invites: partie.invites ?? [], refus: refus.slice(0, -1) }, partie)
    return []
  }
  if (!joueurs.includes(appelant)) return []
  if (partie.etat === 'encours') {
    // Partie qui vient de commencer : l'auteur est celui qui a rejoint, qu'il commence ou non, ou qu'il ait à répondre au
    // premier coup que le créateur a joué dès l'invitation (seul cas où il a la main après un coup du créateur).
    const rejointe = partie.nbCoups === 0 || (partie.nbCoups === 1 && partie.dernier?.uid === partie.createur && partie.tour === appelant)
    if (rejointe) return partie.createur === appelant ? [] : notificationsPartie({ etat: 'attente' }, partie)
    if (partie.tour === appelant || partie.dernier?.uid !== appelant) return []
    return notificationsPartie({ etat: 'encours', nbCoups: partie.nbCoups - 1 }, partie)
  }
  if (partie.etat === 'finie' && partie.dernier?.uid === appelant) return notificationsPartie({ etat: 'encours' }, partie)
  return []
}
