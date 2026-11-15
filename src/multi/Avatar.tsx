// Rond d'un joueur : l'icône qu'il a choisie dans les Réglages, sinon l'initiale de son pseudo. L'icône se lit dans sa
// fiche (joueurs/{uid}), pas dans les parties : un changement se voit donc partout, même dans les parties déjà jouées.

import { useEffect, useSyncExternalStore } from 'react'
import { lireJoueur } from './donnees'
import { emojiIcone } from './icones'

// Icône de chaque joueur déjà lu (identifiant, ou null s'il n'en a pas), gardée le temps de la session : chaque fiche
// n'est lue qu'une fois, quel que soit le nombre de parties contre ce joueur.
const connues = new Map<string, string | null>()
const lectures = new Set<string>()
const abonnes = new Set<() => void>()

function sAbonner(rappel: () => void) {
  abonnes.add(rappel)
  return () => {
    abonnes.delete(rappel)
  }
}

/** Retient l'icône d'un joueur lue ailleurs (liste des joueurs, sa propre fiche) ou qu'on vient de choisir. */
export function retenirIcone(uid: string, icone: string | null | undefined) {
  const valeur = icone ?? null
  if (connues.get(uid) === valeur) return
  connues.set(uid, valeur)
  for (const rappel of abonnes) rappel()
}

/** L'emoji de l'icône d'un joueur (undefined : pas d'icône, ou pas encore lue) ; sa fiche est lue au premier appel. */
export function useIcone(uid: string | null | undefined): string | undefined {
  const id = useSyncExternalStore(sAbonner, () => (uid ? connues.get(uid) : undefined))
  useEffect(() => {
    if (!uid || connues.has(uid) || lectures.has(uid)) return
    lectures.add(uid)
    lireJoueur(uid)
      .then((j) => retenirIcone(uid, j?.icone))
      // Hors ligne et sans cache : l'initiale reste, la fiche sera relue à la prochaine ouverture de l'écran.
      .catch(() => {})
      .finally(() => lectures.delete(uid))
  }, [uid])
  return emojiIcone(id)
}

/** `fond` : la couleur du rond, qui dit déjà l'état de la partie (à toi de jouer, en attente…). */
export function Avatar({ uid, nom, fond }: { uid?: string | null; nom: string; fond?: string }) {
  const emoji = useIcone(uid)
  return (
    <div className={'avatar' + (emoji ? ' avatar-icone' : '')} style={fond ? { background: fond } : undefined} aria-hidden="true">
      {emoji ?? (nom.slice(0, 1).toUpperCase() || '?')}
    </div>
  )
}
