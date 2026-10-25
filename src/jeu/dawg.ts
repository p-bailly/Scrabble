// Dictionnaire compact : DAWG (graphe orienté acyclique de mots, un arbre des préfixes dont les suffixes
// communs sont partagés).
//
// Format du fichier (petit-boutiste) :
//   octets 0-3   « DAWG »
//   octets 4-7   version (1)
//   octets 8-11  nombre d'arcs (arc 0 inutilisé compris)
//   octets 12-15 nombre de mots
//   octets 16-47 nom du dictionnaire (UTF-8, complété par des zéros)
//   puis un entier de 32 bits par arc.
// Un nœud est une suite d'arcs consécutifs, triés par lettre ; on le désigne par l'indice de son premier arc.
// La racine commence à l'arc 1 ; l'indice 0 signifie « pas d'enfant ». Bits d'un arc :
//   0-4  lettre (0 = A … 25 = Z)
//   5    le chemin jusqu'à cet arc forme un mot
//   6    dernier arc du nœud
//   7-31 premier arc du nœud enfant

import type { Dico } from './coup'

export const ENTETE = 48
export const RACINE = 1

export const lettreArc = (a: number): number => a & 31
export const finDeMot = (a: number): boolean => (a & 32) !== 0
export const dernierArc = (a: number): boolean => (a & 64) !== 0
export const enfantArc = (a: number): number => a >>> 7

export class Dawg implements Dico {
  readonly arcs: Uint32Array
  readonly nbMots: number
  readonly nom: string

  constructor(arcs: Uint32Array, nbMots = 0, nom = '') {
    this.arcs = arcs
    this.nbMots = nbMots
    this.nom = nom
  }

  static depuisFichier(buffer: ArrayBuffer): Dawg {
    const vue = new DataView(buffer)
    const magie = String.fromCharCode(...new Uint8Array(buffer, 0, 4))
    if (magie !== 'DAWG' || vue.getUint32(4, true) !== 1) throw new Error('Fichier de dictionnaire invalide')
    const nbArcs = vue.getUint32(8, true)
    const nbMots = vue.getUint32(12, true)
    const nom = new TextDecoder().decode(new Uint8Array(buffer, 16, 32)).replace(/\0+$/, '')
    // Copie alignée (le tampon d'origine peut être partagé ou mal aligné).
    const arcs = new Uint32Array(nbArcs)
    for (let i = 0; i < nbArcs; i++) arcs[i] = vue.getUint32(ENTETE + 4 * i, true)
    return new Dawg(arcs, nbMots, nom)
  }

  /** Indice de l'arc de lettre `code` partant du nœud `noeud`, ou -1. */
  arc(noeud: number, code: number): number {
    if (noeud === 0) return -1
    const arcs = this.arcs
    for (let i = noeud; ; i++) {
      const a = arcs[i]
      const l = a & 31
      if (l === code) return i
      if (l > code || (a & 64) !== 0) return -1
    }
  }

  /** Arc atteint en lisant `mot` (majuscules) depuis la racine, ou -1. */
  suivre(mot: string, depuis = RACINE): number {
    let noeud = depuis
    let arc = -1
    for (let i = 0; i < mot.length; i++) {
      arc = this.arc(noeud, mot.charCodeAt(i) - 65)
      if (arc < 0) return -1
      noeud = this.arcs[arc] >>> 7
    }
    return arc
  }

  contient(mot: string): boolean {
    if (mot.length === 0) return false
    const arc = this.suivre(mot.toUpperCase())
    return arc >= 0 && finDeMot(this.arcs[arc])
  }

  /** Tous les mots (pour les tests et les petits dictionnaires). */
  *mots(noeud = RACINE, prefixe = ''): Generator<string> {
    if (noeud === 0) return
    for (let i = noeud; ; i++) {
      const a = this.arcs[i]
      const m = prefixe + String.fromCharCode(65 + lettreArc(a))
      if (finDeMot(a)) yield m
      yield* this.mots(enfantArc(a), m)
      if (dernierArc(a)) break
    }
  }
}
