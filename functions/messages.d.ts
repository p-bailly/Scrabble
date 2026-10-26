export interface Notification {
  uid: string
  genre: 'tour' | 'invitation' | 'fin'
  titre: string
  texte: string
  hash: string
  tag: string
}

/** Ce qu'il faut notifier, à qui, entre l'état d'une partie avant et après son écriture. */
export function notificationsPartie(avant: unknown, apres: unknown): Notification[]
