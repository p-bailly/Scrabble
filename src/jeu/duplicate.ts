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
//
// Deux façons de jouer la même partie (comme dans l'appli DupliJeu de la FFSc) :
//  - « entraînement » : on valide un coup quand on veut ou à la fin du temps, puis le top est posé ;
//  - « topping » : le coup ne se termine que lorsqu'on a trouvé le top ou que le temps est écoulé ; des indices
//    (valeur, longueur, direction, position du top) peuvent aider.

import { jetonsUtilises, jouer as poserCoup, retirerDuChevalet, type Coup } from './coup'
import { Hasard, graineEnNombre } from './hasard'
import { JOKER, VOYELLES, tousLesJetons } from './lettres'
import { colonneDe, ligneDe, plateauDepuisTexte, plateauEnTexte, plateauVide, type Plateau } from './plateau'

export const DERNIER_COUP_EXIGEANT = 15

export type ModeDuplicate = 'entrainement' | 'topping'

/** Indices disponibles en topping : ce qu'on apprend du top. */
export type Indice = 'valeur' | 'longueur' | 'direction' | 'position'
export const INDICES: readonly Indice[] = ['valeur', 'longueur', 'direction', 'position']

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
  /** Indices demandés (topping). */
  indices?: Indice[]
  /** Mots proposés pendant le coup (topping), dans l'ordre. */
  essais?: Essai[]
}

/** Un mot proposé pendant un coup de topping. */
export interface Essai {
  mot: string
  points: number
  /** Temps écoulé (secondes) au moment de la proposition. */
  a: number
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
  /** Absent dans les parties enregistrées avant l'arrivée du topping : c'est alors un entraînement. */
  mode?: ModeDuplicate
  graine: string
  /** Temps par coup en secondes (0 : sans limite). */
  temps: number
  creeLe: number
  /** Dernière sauvegarde de la partie en cours (la liste des parties en cours s'ordonne dessus). */
  majLe?: number
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

export const modeDe = (partie: PartieDuplicate): ModeDuplicate => partie.mode ?? 'entrainement'

export function nouvellePartie(
  graine: string,
  temps: number,
  id = graine + '-' + Date.now(),
  mode: ModeDuplicate = 'entrainement',
): PartieDuplicate {
  const t = tirer(tousLesJetons(), [], 1, graineEnNombre(graine))
  return {
    version: 1,
    id,
    mode,
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
  indices: Indice[] = [],
  essais: Essai[] = [],
): PartieDuplicate {
  const c = partie.courant
  if (!c || partie.finie) return partie
  if (!top) return { ...partie, courant: null, finie: true }
  const reste = retirerDuChevalet(c.tirage, jetonsUtilises(top.poses))
  if (!reste) throw new Error('Le top utilise des lettres absentes du tirage')
  const coup: CoupDuplicate = { ...c, top, joueur, autres, duree, ...(indices.length ? { indices } : {}), ...(essais.length ? { essais } : {}) }
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

/** Le joueur a-t-il trouvé le top (ou un coup de même valeur) ? */
export const topTrouve = (c: CoupDuplicate): boolean => !!c.joueur && c.joueur.points >= c.top.points

export function totaux(partie: PartieDuplicate) {
  const joueur = partie.coups.reduce((s, c) => s + pointsJoueur(c), 0)
  const top = partie.coups.reduce((s, c) => s + c.top.points, 0)
  const trouves = partie.coups.filter(topTrouve)
  return {
    joueur,
    top,
    pourcentage: top ? (100 * joueur) / top : 0,
    /** Nombre de tops trouvés et temps moyen pour les trouver (en secondes). */
    trouves: trouves.length,
    tempsMoyen: trouves.length ? trouves.reduce((s, c) => s + c.duree, 0) / trouves.length : 0,
    indices: partie.coups.reduce((s, c) => s + (c.indices?.length ?? 0), 0),
  }
}

/** Plateau tel qu'il était avant le coup numéro `numero` (les tops précédents sont posés). */
export function plateauAvantCoup(partie: PartieDuplicate, numero: number): Plateau {
  return partie.coups.slice(0, numero - 1).reduce((p, c) => poserCoup(p, c.top.poses), plateauVide())
}

/** Ce que révèle un indice sur le top. */
export function texteIndice(indice: Indice, top: Coup): string {
  if (indice === 'valeur') return `${top.points} points`
  if (indice === 'longueur') return `${top.mot.length} lettres`
  if (indice === 'direction') return top.dir === 'H' ? 'horizontal' : 'vertical'
  return `départ ligne ${String.fromCharCode(65 + ligneDe(top.debut))}, colonne ${colonneDe(top.debut) + 1}`
}
