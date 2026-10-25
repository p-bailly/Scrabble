// Générateur de tous les coups légaux pour un tirage et un plateau (algorithme d'Appel et Jacobson, 1988).
//
// Pour chaque ligne (puis chaque colonne, en lisant le plateau transposé) :
//  1. « contrôles croisés » : pour chaque case vide, les lettres qui forment un mot valable avec les lettres
//     posées au-dessus et au-dessous, et la valeur de ces lettres (pour le score du mot croisé) ;
//  2. « ancres » : les cases vides voisines d'une lettre posée (l'étoile sur un plateau vide). Tout coup couvre
//     au moins une ancre ; on génère chaque coup à partir de son ancre la plus à gauche ;
//  3. pour chaque ancre, la partie gauche du mot est soit les lettres déjà posées juste avant, soit 0 à 6 lettres
//     du tirage sur les cases libres (non ancres) qui précèdent ; on prolonge ensuite vers la droite en suivant
//     le DAWG et les contrôles croisés.

import type { Coup, Direction, Pose } from './coup'
import { BONUS_SCRABBLE } from './coup'
import { Dawg, RACINE } from './dawg'
import { JOKER, VALEUR_CODE } from './lettres'
import { CENTRE, MULT_LETTRE, MULT_MOT, NB_CASES, TAILLE, type Plateau } from './plateau'

const TOUTES = (1 << 26) - 1
const JOK = 26 // indice du joker dans le compte des lettres du tirage

export interface OptionsGeneration {
  /** Nombre maximum de coups renvoyés (les meilleurs). Par défaut : tous. */
  limite?: number
}

/** Nombre de jokers utilisés par un coup. */
export const nbJokers = (c: Coup): number => c.poses.reduce((n, p) => n + (p.lettre >= 'a' ? 1 : 0), 0)

/** Ordre des coups : score décroissant, puis le moins de jokers, puis le mot le plus long, puis la position. */
export function comparerCoups(a: Coup, b: Coup): number {
  return (
    b.points - a.points ||
    nbJokers(a) - nbJokers(b) ||
    b.mot.length - a.mot.length ||
    a.debut - b.debut ||
    (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0) ||
    (a.mot < b.mot ? -1 : a.mot > b.mot ? 1 : 0)
  )
}

/**
 * Tous les coups jouables avec `tirage` (lettres et « ? »), triés du meilleur au moins bon.
 * Un même mot à la même place n'apparaît qu'une fois, avec la meilleure répartition des jokers.
 */
export function genererCoups(dawg: Dawg, plateau: Plateau, tirage: readonly string[], options: OptionsGeneration = {}): Coup[] {
  const rack = new Int8Array(27)
  for (const t of tirage) {
    if (t === JOKER) rack[JOK]++
    else rack[t.charCodeAt(0) - 65]++
  }
  // Plateau en codes : -1 vide, 0..25 lettre ; valeur 0 et drapeau pour un joker posé.
  const p: PlateauCode = { lettres: new Int8Array(NB_CASES), valeurs: new Int8Array(NB_CASES), jokers: new Uint8Array(NB_CASES) }
  let vide = true
  for (let i = 0; i < NB_CASES; i++) {
    const t = plateau[i]
    if (!t) p.lettres[i] = -1
    else {
      vide = false
      p.lettres[i] = t.toUpperCase().charCodeAt(0) - 65
      p.jokers[i] = t >= 'a' ? 1 : 0
      p.valeurs[i] = p.jokers[i] ? 0 : VALEUR_CODE[p.lettres[i]]
    }
  }

  const resultats = new Map<string, Coup>()
  const ajouter = (c: Coup) => {
    const cle = c.dir + c.debut + c.mot.toUpperCase()
    const ancien = resultats.get(cle)
    if (!ancien || comparerCoups(c, ancien) < 0) resultats.set(cle, c)
  }

  genererSens(dawg, p, rack, false, vide, ajouter)
  // Sur un plateau vide, les coups verticaux ne sont que les symétriques des horizontaux : on ne les génère pas.
  if (!vide) genererSens(dawg, p, rack, true, vide, ajouter)

  // Un coup d'une seule lettre peut être trouvé dans les deux sens : on ne le garde qu'une fois, en horizontal
  // s'il forme un mot horizontal (même convention que l'analyse d'un coup).
  const uneLettre = new Map<string, Coup>()
  for (const c of resultats.values()) {
    if (c.poses.length !== 1) continue
    const cle = c.poses[0].pos + c.poses[0].lettre
    const autre = uneLettre.get(cle)
    if (!autre || (c.dir === 'H' && autre.dir === 'V')) uneLettre.set(cle, c)
  }
  const coups: Coup[] = []
  for (const c of [...resultats.values()].sort(comparerCoups)) {
    if (c.poses.length === 1 && uneLettre.get(c.poses[0].pos + c.poses[0].lettre) !== c) continue
    coups.push(c)
    if (options.limite && coups.length >= options.limite) break
  }
  return coups
}

/** Meilleur coup (le « top »), ou null si aucun coup n'est possible. */
export function meilleurCoup(dawg: Dawg, plateau: Plateau, tirage: readonly string[]): Coup | null {
  return genererCoups(dawg, plateau, tirage, { limite: 1 })[0] ?? null
}

interface PlateauCode {
  lettres: Int8Array
  valeurs: Int8Array
  jokers: Uint8Array
}

function genererSens(
  dawg: Dawg,
  plateau: PlateauCode,
  rack: Int8Array,
  transpose: boolean,
  plateauVide: boolean,
  ajouter: (c: Coup) => void,
) {
  const arcs = dawg.arcs
  const dir: Direction = transpose ? 'V' : 'H'
  // Case réelle de la ligne `l`, colonne `c` du plateau tel qu'on le lit (transposé ou non).
  const caseDe = (l: number, c: number) => (transpose ? c * TAILLE + l : l * TAILLE + c)
  const lettreEn = (l: number, c: number) => plateau.lettres[caseDe(l, c)]

  const croisement = new Int32Array(TAILLE) // lettres permises (masque de 26 bits)
  const scoreCroise = new Int32Array(TAILLE) // valeur des lettres du mot croisé, -1 s'il n'y en a pas
  const ancre = new Uint8Array(TAILLE)
  const lettresLigne = new Int8Array(TAILLE)
  const cases = new Int16Array(TAILLE)
  // Jetons posés pendant la recherche : code de lettre (-1 si rien), et s'il s'agit d'un joker.
  const pose = new Int8Array(TAILLE).fill(-1)
  const poseJoker = new Uint8Array(TAILLE)
  let nbPoses = 0

  /** Arc atteint en lisant les lettres du plateau de (l, c1) à (l, c2) en colonne `c`… ou -1. */
  const lireColonne = (noeud: number, c: number, l1: number, l2: number): number => {
    let arc = -1
    for (let l = l1; l <= l2; l++) {
      if (noeud === 0) return -1
      arc = dawg.arc(noeud, lettreEn(l, c))
      if (arc < 0) return -1
      noeud = arcs[arc] >>> 7
    }
    return arc
  }

  for (let l = 0; l < TAILLE; l++) {
    for (let c = 0; c < TAILLE; c++) {
      cases[c] = caseDe(l, c)
      lettresLigne[c] = plateau.lettres[cases[c]]
    }

    // Contrôles croisés et ancres.
    for (let c = 0; c < TAILLE; c++) {
      ancre[c] = 0
      croisement[c] = TOUTES
      scoreCroise[c] = -1
      if (lettresLigne[c] >= 0) continue
      let haut = l
      while (haut > 0 && lettreEn(haut - 1, c) >= 0) haut--
      let bas = l
      while (bas < TAILLE - 1 && lettreEn(bas + 1, c) >= 0) bas++
      const voisinLigne = (c > 0 && lettresLigne[c - 1] >= 0) || (c < TAILLE - 1 && lettresLigne[c + 1] >= 0)
      if (haut < l || bas > l || voisinLigne || (plateauVide && cases[c] === CENTRE)) ancre[c] = 1
      if (haut === l && bas === l) continue

      // Mot croisé : préfixe (au-dessus) + lettre + suffixe (au-dessous).
      let somme = 0
      for (let ll = haut; ll <= bas; ll++) if (ll !== l) somme += plateau.valeurs[caseDe(ll, c)]
      scoreCroise[c] = somme
      let masque = 0
      let noeud = RACINE
      if (haut < l) {
        const a = lireColonne(RACINE, c, haut, l - 1)
        noeud = a < 0 ? 0 : arcs[a] >>> 7
      }
      if (noeud !== 0) {
        for (let i = noeud; ; i++) {
          const a = arcs[i]
          let fin: boolean
          if (bas === l) fin = (a & 32) !== 0
          else {
            const s = lireColonne(a >>> 7, c, l + 1, bas)
            fin = s >= 0 && (arcs[s] & 32) !== 0
          }
          if (fin) masque |= 1 << (a & 31)
          if (a & 64) break
        }
      }
      croisement[c] = masque
    }

    for (let c = 0; c < TAILLE; c++) {
      if (!ancre[c]) continue
      if (c > 0 && lettresLigne[c - 1] >= 0) {
        // Partie gauche imposée : les lettres déjà posées juste avant l'ancre.
        let debut = c - 1
        while (debut > 0 && lettresLigne[debut - 1] >= 0) debut--
        let noeud = RACINE
        for (let k = debut; k < c && noeud !== 0; k++) {
          const a = dawg.arc(noeud, lettresLigne[k])
          noeud = a < 0 ? 0 : arcs[a] >>> 7
        }
        if (noeud !== 0) prolonger(debut, c, c, noeud, false)
      } else {
        // Partie gauche libre : de 0 à `limite` lettres du tirage sur les cases vides qui précèdent l'ancre.
        let limite = 0
        while (c - limite - 1 >= 0 && lettresLigne[c - limite - 1] < 0 && !ancre[c - limite - 1]) limite++
        limite = Math.min(limite, 6)
        for (let long = 0; long <= limite; long++) gauche(c, c - long, c - long, RACINE)
      }
    }
  }

  // Pose une partie gauche sur les cases debut … ancreC-1 (k : case courante), puis prolonge depuis l'ancre.
  function gauche(ancreC: number, debut: number, k: number, noeud: number) {
    if (k === ancreC) {
      prolonger(debut, ancreC, ancreC, noeud, false)
      return
    }
    if (noeud === 0) return
    for (let i = noeud; ; i++) {
      const a = arcs[i]
      const code = a & 31
      if (rack[code] > 0) {
        rack[code]--
        poser(k, code, 0)
        gauche(ancreC, debut, k + 1, a >>> 7)
        deposer(k)
        rack[code]++
      }
      if (rack[JOK] > 0) {
        rack[JOK]--
        poser(k, code, 1)
        gauche(ancreC, debut, k + 1, a >>> 7)
        deposer(k)
        rack[JOK]++
      }
      if (a & 64) break
    }
  }

  function poser(c: number, code: number, joker: number) {
    pose[c] = code
    poseJoker[c] = joker
    nbPoses++
  }
  function deposer(c: number) {
    pose[c] = -1
    poseJoker[c] = 0
    nbPoses--
  }

  // Prolonge vers la droite le mot commencé en `debut`, la case courante étant `c` ; `noeud` est l'état du DAWG
  // après les lettres de debut … c-1, `motFini` indique si ces lettres forment un mot.
  function prolonger(debut: number, ancreC: number, c: number, noeud: number, motFini: boolean) {
    if (c < TAILLE && lettresLigne[c] >= 0) {
      if (noeud === 0) return
      const a = dawg.arc(noeud, lettresLigne[c])
      if (a >= 0) prolonger(debut, ancreC, c + 1, arcs[a] >>> 7, (arcs[a] & 32) !== 0)
      return
    }
    if (motFini && c > ancreC && nbPoses > 0) enregistrer(debut, c)
    if (c >= TAILLE || noeud === 0) return
    const permis = croisement[c]
    if (permis === 0) return
    for (let i = noeud; ; i++) {
      const a = arcs[i]
      const code = a & 31
      if (permis & (1 << code)) {
        if (rack[code] > 0) {
          rack[code]--
          poser(c, code, 0)
          prolonger(debut, ancreC, c + 1, a >>> 7, (a & 32) !== 0)
          deposer(c)
          rack[code]++
        }
        if (rack[JOK] > 0) {
          rack[JOK]--
          poser(c, code, 1)
          prolonger(debut, ancreC, c + 1, a >>> 7, (a & 32) !== 0)
          deposer(c)
          rack[JOK]++
        }
      }
      if (a & 64) break
    }
  }

  function enregistrer(debut: number, fin: number) {
    let somme = 0
    let mult = 1
    let croises = 0
    let mot = ''
    const poses: Pose[] = []
    for (let c = debut; c < fin; c++) {
      const p = cases[c]
      if (pose[c] >= 0) {
        const v = poseJoker[c] ? 0 : VALEUR_CODE[pose[c]]
        const lm = MULT_LETTRE[p]
        const wm = MULT_MOT[p]
        somme += v * lm
        mult *= wm
        if (scoreCroise[c] >= 0) croises += (scoreCroise[c] + v * lm) * wm
        const lettre = String.fromCharCode((poseJoker[c] ? 97 : 65) + pose[c])
        mot += lettre
        poses.push({ pos: p, lettre })
      } else {
        somme += plateau.valeurs[p]
        mot += String.fromCharCode((plateau.jokers[p] ? 97 : 65) + lettresLigne[c])
      }
    }
    const points = somme * mult + croises + (poses.length === 7 ? BONUS_SCRABBLE : 0)
    ajouter({ poses, mot, dir, debut: cases[debut], points })
  }
}
