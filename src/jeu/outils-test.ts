// Outils partagés par les tests (pas de test ici).

import { readFileSync } from 'node:fs'
import { analyserCoup, type Dico, type Pose } from './coup'
import { construireDawg, preparerListe } from './construireDawg'
import { Dawg } from './dawg'
import { JOKER } from './lettres'
import { CENTRE, TAILLE, index, plateauVide, type Plateau } from './plateau'

let ods: Dawg | null = null

/** Le dictionnaire de l'appli (public/dico/mots.dawg). */
export function dicoAppli(): Dawg {
  if (!ods) {
    const octets = readFileSync(new URL('../../public/dico/mots.dawg', import.meta.url))
    ods = Dawg.depuisFichier(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength))
  }
  return ods
}

export const dicoDe = (mots: string[]): Dawg => new Dawg(construireDawg(preparerListe(mots)))

/** Écrit un mot sur le plateau (sans vérification), ex. ecrire(p, 'H4', 'MAISON'). */
export function ecrire(p: Plateau, ligne: number, colonne: number, dir: 'H' | 'V', mot: string): Plateau {
  const q = p.slice()
  ;[...mot].forEach((l, i) => {
    q[dir === 'H' ? index(ligne, colonne + i) : index(ligne + i, colonne)] = l
  })
  return q
}

/** Poses d'un mot, en sautant les cases déjà occupées. */
export function posesDe(p: Plateau, ligne: number, colonne: number, dir: 'H' | 'V', mot: string): Pose[] {
  const poses: Pose[] = []
  ;[...mot].forEach((l, i) => {
    const pos = dir === 'H' ? index(ligne, colonne + i) : index(ligne + i, colonne)
    if (!p[pos]) poses.push({ pos, lettre: l })
  })
  return poses
}

export const vide = plateauVide

/**
 * Oracle par force brute : pour chaque mot de `mots`, chaque position et chaque répartition des jokers, essaie de
 * le poser et le fait vérifier par analyserCoup. Renvoie, pour chaque coup (clé normalisée), le meilleur score.
 * Indépendant du générateur : sert à le vérifier.
 */
export function oracle(dico: Dico, mots: Iterable<string>, plateau: Plateau, tirage: string[]): Map<string, number> {
  const res = new Map<string, number>()
  const nbJokers = tirage.filter((t) => t === JOKER).length
  const compte = new Array(26).fill(0)
  for (const t of tirage) if (t !== JOKER) compte[t.charCodeAt(0) - 65]++
  // Cases « de contact » : occupées ou voisines d'une lettre (l'étoile sur un plateau vide). Un coup en couvre une.
  const vide = plateau.every((c) => !c)
  const contact = plateau.map((_, p) => {
    if (vide) return p === CENTRE
    const l = Math.floor(p / TAILLE)
    const c = p % TAILLE
    return !!plateau[p] || (c > 0 && !!plateau[p - 1]) || (c < TAILLE - 1 && !!plateau[p + 1]) ||
      (l > 0 && !!plateau[p - TAILLE]) || (l < TAILLE - 1 && !!plateau[p + TAILLE])
  })
  const besoin = new Array(26)
  for (const mot of mots) {
    for (const dir of ['H', 'V'] as const) {
      const pas = dir === 'H' ? 1 : TAILLE
      for (let l = 0; l < TAILLE; l++) {
        for (let c = 0; c < TAILLE; c++) {
          const fin = (dir === 'H' ? c : l) + mot.length - 1
          if (fin >= TAILLE) continue
          const debut = index(l, c)
          // Cases avant et après le mot : vides.
          const avantOk = dir === 'H' ? c === 0 || !plateau[debut - 1] : l === 0 || !plateau[debut - TAILLE]
          const finPos = debut + (mot.length - 1) * pas
          const apresOk = fin === TAILLE - 1 || !plateau[finPos + pas]
          if (!avantOk || !apresOk) continue
          let touche = false
          let ok = true
          let nbManquantes = 0
          for (let i = 0, p = debut; i < mot.length; i++, p += pas) {
            const t = plateau[p]
            if (contact[p]) touche = true
            if (t) {
              if (t.toUpperCase() !== mot[i]) {
                ok = false
                break
              }
            } else nbManquantes++
          }
          if (!ok || !touche || nbManquantes === 0 || nbManquantes > tirage.length) continue
          const manquantes: { pos: number; lettre: string }[] = []
          for (let i = 0, p = debut; i < mot.length; i++, p += pas) if (!plateau[p]) manquantes.push({ pos: p, lettre: mot[i] })
          // Toutes les façons de répartir les jokers sur les lettres manquantes.
          const n = manquantes.length
          for (let masque = 0; masque < 1 << n; masque++) {
            let jok = 0
            for (let i = 0; i < n; i++) if (masque & (1 << i)) jok++
            if (jok > nbJokers) continue
            besoin.fill(0)
            let possible = true
            for (let i = 0; i < n && possible; i++) {
              if (masque & (1 << i)) continue
              const k = manquantes[i].lettre.charCodeAt(0) - 65
              if (++besoin[k] > compte[k]) possible = false
            }
            if (!possible) continue
            const poses: Pose[] = manquantes.map((m, i) => ({
              pos: m.pos,
              lettre: masque & (1 << i) ? m.lettre.toLowerCase() : m.lettre,
            }))
            const a = analyserCoup(plateau, poses, dico)
            if (!a.valide || !a.coup) continue
            const cle = cleNormalisee(a.coup.poses, a.coup.dir, a.coup.debut, a.coup.mot)
            res.set(cle, Math.max(res.get(cle) ?? -1, a.points))
          }
        }
      }
    }
  }
  return res
}

/** Clé d'un coup indépendante du sens de recherche pour les coups d'une lettre. */
export function cleNormalisee(poses: Pose[], dir: string, debut: number, mot: string): string {
  if (poses.length === 1) return `1:${poses[0].pos}:${poses[0].lettre.toUpperCase()}`
  return `${dir}:${debut}:${mot.toUpperCase()}`
}

/**
 * Mots qu'on peut espérer former : chaque lettre manquante (au-delà du tirage et des lettres du plateau) doit être
 * couverte par un joker. Filtre rapide avant l'oracle.
 */
export function formables(mots: Iterable<string>, tirage: string[], plateau: Plateau): string[] {
  const dispo = new Array(26).fill(0)
  for (const t of [...tirage, ...plateau.filter(Boolean)]) if (t !== JOKER) dispo[t.toUpperCase().charCodeAt(0) - 65]++
  const jokers = tirage.filter((t) => t === JOKER).length
  const res: string[] = []
  const besoin = new Array(26)
  for (const m of mots) {
    if (m.length > tirage.length + 15) continue
    besoin.fill(0)
    let manque = 0
    for (let i = 0; i < m.length; i++) {
      const k = m.charCodeAt(i) - 65
      if (++besoin[k] > dispo[k]) manque++
    }
    if (manque <= jokers) res.push(m)
  }
  return res
}
