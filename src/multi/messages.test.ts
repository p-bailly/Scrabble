import { describe, expect, it } from 'vitest'
import { notificationsPartie } from '../../functions/messages.js'

/** Une partie à deux en cours : `moi` est le créateur, `lui` l'invité. Les champs sont ceux du document Firestore. */
const partie = (modif: Record<string, unknown> = {}) => ({
  code: 'K7P2QX',
  createur: 'moi',
  joueurs: ['moi', 'lui'],
  pseudos: { moi: 'Moi', lui: 'Léa' },
  etat: 'encours',
  tour: 'lui',
  nbCoups: 1,
  scores: { moi: 12, lui: 0 },
  dernier: { uid: 'moi', type: 'mot', mot: 'maison', points: 12 },
  invites: [],
  refus: [],
  fin: null,
  ...modif,
})

describe('notifications d’une partie qui change', () => {
  it('un coup joué prévient l’autre joueur, avec le mot et les points', () => {
    const avant = partie({ nbCoups: 0, tour: 'moi', dernier: null, scores: { moi: 0, lui: 0 } })
    expect(notificationsPartie(avant, partie())).toEqual([
      { uid: 'lui', genre: 'tour', titre: 'À toi de jouer', texte: 'Moi a joué MAISON (12 pts).', hash: '#/partie/K7P2QX', tag: 'K7P2QX' },
    ])
  })

  it('un échange ou un passage est dit sans les points', () => {
    const avant = partie({ nbCoups: 0 })
    const change = notificationsPartie(avant, partie({ dernier: { uid: 'moi', type: 'change', points: 0 } }))
    const passe = notificationsPartie(avant, partie({ dernier: { uid: 'moi', type: 'passe', points: 0 } }))
    expect(change[0].texte).toBe('Moi a changé des lettres.')
    expect(passe[0].texte).toBe('Moi a passé son tour.')
  })

  it('l’adversaire qui rejoint la partie prévient le créateur, qui joue en premier', () => {
    const avant = partie({ etat: 'attente', joueurs: ['moi'], tour: null, nbCoups: 0, dernier: null })
    const apres = partie({ nbCoups: 0, tour: 'moi', dernier: null })
    expect(notificationsPartie(avant, apres)).toEqual([
      { uid: 'moi', genre: 'tour', titre: 'À toi de jouer', texte: 'Léa a rejoint ta partie.', hash: '#/partie/K7P2QX', tag: 'K7P2QX' },
    ])
  })

  it('la fin de partie prévient celui qui n’a pas joué le dernier coup, avec les scores', () => {
    const avant = partie({ nbCoups: 9, tour: 'lui' })
    const apres = partie({ etat: 'finie', tour: null, nbCoups: 10, scores: { moi: 310, lui: 288 }, dernier: { uid: 'lui', type: 'mot', mot: 'x', points: 8 }, fin: { raison: 'chevalet-vide' } })
    expect(notificationsPartie(avant, apres)).toEqual([
      { uid: 'moi', genre: 'fin', titre: 'Partie terminée', texte: 'Léa : 288 – toi : 310', hash: '#/partie/K7P2QX', tag: 'K7P2QX' },
    ])
  })

  it('un abandon est annoncé comme tel, pas comme une partie terminée', () => {
    const avant = partie()
    const apres = partie({ etat: 'finie', tour: null, dernier: { uid: 'lui', type: 'abandon', points: 0 }, fin: { raison: 'abandon', gagnant: 'moi' } })
    const [n] = notificationsPartie(avant, apres)
    expect(n).toMatchObject({ uid: 'moi', genre: 'fin', titre: 'Partie abandonnée', texte: 'Léa a abandonné : tu gagnes la partie.' })
  })

  it('une invitation prévient l’invité, une seule fois', () => {
    const attente = { etat: 'attente', joueurs: ['moi'], tour: null, nbCoups: 0, dernier: null, pseudos: { moi: 'Pierre', lui: 'Léa' } }
    const creation = notificationsPartie(null, partie({ ...attente, invites: ['lui'] }))
    expect(creation).toEqual([
      { uid: 'lui', genre: 'invitation', titre: 'Invitation à jouer', texte: 'Pierre t’invite à une partie de Scrabble.', hash: '#/parties', tag: 'invitation.K7P2QX' },
    ])
    // Une écriture de plus sur la même partie (l'invité y est déjà) ne renvoie rien.
    expect(notificationsPartie(partie({ ...attente, invites: ['lui'] }), partie({ ...attente, invites: ['lui'] }))).toEqual([])
    // Inviter quelqu'un d'autre : seul le nouvel invité est prévenu.
    const autre = notificationsPartie(partie({ ...attente, invites: ['lui'] }), partie({ ...attente, invites: ['zoe'] }))
    expect(autre.map((n) => n.uid)).toEqual(['zoe'])
  })

  it('un refus prévient le créateur', () => {
    const attente = { etat: 'attente', joueurs: ['moi'], tour: null, nbCoups: 0, dernier: null, pseudos: { moi: 'Pierre', lui: 'Léa' } }
    const avant = partie({ ...attente, invites: ['lui'] })
    const apres = partie({ ...attente, invites: [], refus: ['lui'] })
    expect(notificationsPartie(avant, apres)).toEqual([
      { uid: 'moi', genre: 'invitation', titre: 'Invitation refusée', texte: 'Léa a refusé ton invitation.', hash: '#/partie/K7P2QX', tag: 'K7P2QX' },
    ])
  })

  it('rien à envoyer pour les écritures sans coup, ni à la suppression', () => {
    // Mise à jour de la date seule, ou de l'état « envoi en attente ».
    expect(notificationsPartie(partie(), partie())).toEqual([])
    expect(notificationsPartie(partie(), null)).toEqual([])
  })
})
