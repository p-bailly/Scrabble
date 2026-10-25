// Partie de duplicate en solo, selon le principe de la FISF.
//
// À chaque coup, un tirage de 7 lettres (le reliquat du coup précédent complété par le sac). Le joueur cherche
// son meilleur coup ; puis c'est le top (meilleur score possible) qui est posé sur le plateau. Les lettres non
// utilisées par le top forment le reliquat du coup suivant.
//
// Validation du tirage : au moins 2 voyelles et 2 consonnes jusqu'au 15e coup, puis au moins 1 voyelle et
// 1 consonne. Sinon toutes les lettres retournent dans le sac et on retire. Convention de l'appli : le Y est une
// voyelle, et un joker compte à la fois comme voyelle et comme consonne.
// La partie s'arrête quand on ne peut plus former de tirage valable, ou quand le tirage ne permet aucun coup.

import { jetonsUtilises, retirerDuChevalet, type Coup } from './coup'
import { Hasard, graineEnNombre } from './hasard'
import { JOKER, VOYELLES, tousLesJetons } from './lettres'
import { jouer as poserCoup } from './coup'
import { plateauDepuisTexte, plateauEnTexte, plateauVide } from './plateau'

export const DERNIER_COUP_EXIGEANT = 15

export interface CoupDuplicate {
  numero: number
  tirage: string[]
  /** Lettres du tirage venues du coup précédent. */
  reliquat: string[]
  /** Nombre de tirages rejetés avant celui-ci. */
  rejets: number
  top: Coup
  /** Coup du joueur (null s'il n'a rien joué de valable). */
  joueur: Coup | null
  /** Autres bons coups, pour la correction. */
  autres: Coup[]
  /** Durée de réflexion en secondes. */
  duree: number
}

export interface TirageCourant {
  numero: number
  tirage: string[]
  reliquat: string[]
  rejets: number
}

export interface PartieDuplicate {
  version: 1
  id: string
  graine: string
  /** Temps par coup en secondes (0 : sans limite). */
  temps: number
  creeLe: number
  plateau: string
  sac: string[]
  /** État du générateur aléatoire. */
  hasard: number
  coups: CoupDuplicate[]
  courant: TirageCourant | null
  finie: boolean
}

export const minimumRequis = (numero: number): number => (numero <= DERNIER_COUP_EXIGEANT ? 2 : 1)

/** Compte voyelles, consonnes et jokers. */
export function compter(lettres: readonly string[]) {
  let voyelles = 0
  let consonnes = 0
  let jokers = 0
  for (const l of lettres) {
    if (l === JOKER) jokers++
    else if (VOYELLES.has(l)) voyelles++
    else consonnes++
  }
  return { voyelles, consonnes, jokers }
}

/** Le tirage respecte-t-il le règlement pour le coup `numero` ? */
export function tirageValide(lettres: readonly string[], numero: number): boolean {
  const min = minimumRequis(numero)
  const { voyelles, consonnes, jokers } = compter(lettres)
  return voyelles + jokers >= min && consonnes + jokers >= min
}

export interface ResultatTirage {
  tirage: TirageCourant | null
  sac: string[]
  hasard: number
}

/**
 * Tire le tirage du coup `numero` à partir du reliquat. Renvoie `tirage: null` si aucun tirage valable n'est
 * possible (fin de partie).
 */
export function tirer(sac: readonly string[], reliquat: readonly string[], numero: number, etat: number): ResultatTirage {
  const h = new Hasard(etat)
  const min = minimumRequis(numero)
  const total = compter([...sac, ...reliquat])
  if (sac.length + reliquat.length === 0 || total.voyelles + total.jokers < min || total.consonnes + total.jokers < min)
    return { tirage: null, sac: [...sac], hasard: h.etat }

  let s = [...sac]
  let r = [...reliquat]
  for (let rejets = 0; rejets < 1000; rejets++) {
    const tirage = [...r]
    while (tirage.length < 7 && s.length) tirage.push(s.splice(h.entier(s.length), 1)[0])
    if (tirageValide(tirage, numero)) return { tirage: { numero, tirage, reliquat: [...r], rejets }, sac: s, hasard: h.etat }
    // Tirage refusé : toutes les lettres retournent dans le sac.
    s = [...s, ...tirage]
    r = []
    if (s.length <= 7) break // on retirerait les mêmes lettres
  }
  return { tirage: null, sac: s, hasard: h.etat }
}

export function nouvellePartie(graine: string, temps: number, id = graine + '-' + Date.now()): PartieDuplicate {
  const t = tirer(tousLesJetons(), [], 1, graineEnNombre(graine))
  return {
    version: 1,
    id,
    graine,
    temps,
    creeLe: Date.now(),
    plateau: plateauEnTexte(plateauVide()),
    sac: t.sac,
    hasard: t.hasard,
    coups: [],
    courant: t.tirage,
    finie: t.tirage === null,
  }
}

/**
 * Termine le coup courant : le top est posé, le coup du joueur est noté, puis on tire le coup suivant.
 * `top` null : aucun coup possible avec ce tirage, la partie s'arrête.
 */
export function terminerCoup(
  partie: PartieDuplicate,
  top: Coup | null,
  joueur: Coup | null,
  autres: Coup[],
  duree: number,
): PartieDuplicate {
  const c = partie.courant
  if (!c || partie.finie) return partie
  if (!top) return { ...partie, courant: null, finie: true }
  const reste = retirerDuChevalet(c.tirage, jetonsUtilises(top.poses))
  if (!reste) throw new Error('Le top utilise des lettres absentes du tirage')
  const coup: CoupDuplicate = { ...c, top, joueur, autres, duree }
  const plateau = poserCoup(plateauDepuisTexte(partie.plateau), top.poses)
  const t = tirer(partie.sac, reste, c.numero + 1, partie.hasard)
  return {
    ...partie,
    plateau: plateauEnTexte(plateau),
    sac: t.sac,
    hasard: t.hasard,
    coups: [...partie.coups, coup],
    courant: t.tirage,
    finie: t.tirage === null,
  }
}

/** Points du joueur sur un coup : son coup s'il est valable, sinon 0. */
export const pointsJoueur = (c: CoupDuplicate): number => c.joueur?.points ?? 0

export function totaux(partie: PartieDuplicate) {
  const joueur = partie.coups.reduce((s, c) => s + pointsJoueur(c), 0)
  const top = partie.coups.reduce((s, c) => s + c.top.points, 0)
  return { joueur, top, pourcentage: top ? (100 * joueur) / top : 0 }
}
