// Construction du DAWG à partir d'une liste de mots (voir dawg.ts pour le format).
// Sans import : ce fichier sert à la fois aux tests et au script scripts/dico.ts lancé directement par Node.

interface Noeud {
  id: number
  final: boolean
  enfants: [number, Noeud][]
}

/**
 * Normalise une ligne d'une liste de mots selon la règle du Scrabble francophone : majuscules, sans accents.
 * Renvoie null pour un mot à écarter (trait d'union, apostrophe, chiffre, moins de 2 ou plus de 15 lettres).
 */
export function normaliserMot(ligne: string): string | null {
  const m = ligne
    .trim()
    .replace(/[œŒ]/g, 'OE')
    .replace(/[æÆ]/g, 'AE')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
  return /^[A-Z]{2,15}$/.test(m) ? m : null
}

/** Mots normalisés, sans doublon, triés : l'entrée attendue par `construireDawg`. */
export function preparerListe(lignes: Iterable<string>): string[] {
  const mots = new Set<string>()
  for (const l of lignes) {
    const m = normaliserMot(l)
    if (m) mots.add(m)
  }
  return [...mots].sort()
}

/**
 * Construit le DAWG minimal d'une liste de mots triée (algorithme incrémental de Daciuk) et renvoie ses arcs.
 */
export function construireDawg(mots: readonly string[]): Uint32Array {
  let compteur = 0
  const nouveau = (): Noeud => ({ id: compteur++, final: false, enfants: [] })
  const racine = nouveau()
  const registre = new Map<string, Noeud>()
  const aVerifier: [Noeud, Noeud][] = [] // [parent, enfant] le long du dernier mot ajouté
  const signature = (n: Noeud) => (n.final ? '1' : '0') + n.enfants.map(([c, e]) => c + ':' + e.id).join(',')

  const minimiser = (jusqua: number) => {
    while (aVerifier.length > jusqua) {
      const [parent, enfant] = aVerifier.pop()!
      const cle = signature(enfant)
      const existant = registre.get(cle)
      if (existant) parent.enfants[parent.enfants.length - 1][1] = existant
      else registre.set(cle, enfant)
    }
  }

  let precedent = ''
  for (const mot of mots) {
    if (mot <= precedent && precedent !== '') throw new Error(`Liste non triée ou doublon : ${mot}`)
    let commun = 0
    while (commun < mot.length && commun < precedent.length && mot[commun] === precedent[commun]) commun++
    minimiser(commun)
    let noeud = aVerifier.length ? aVerifier[aVerifier.length - 1][1] : racine
    for (let i = commun; i < mot.length; i++) {
      const n = nouveau()
      noeud.enfants.push([mot.charCodeAt(i) - 65, n])
      aVerifier.push([noeud, n])
      noeud = n
    }
    noeud.final = true
    precedent = mot
  }
  minimiser(0)

  // Placement des nœuds : chacun reçoit l'indice de son premier arc (la racine en 1).
  const offset = new Map<Noeud, number>()
  const ordre: Noeud[] = []
  let suivant = 1
  const pile = [racine]
  while (pile.length) {
    const n = pile.pop()!
    if (offset.has(n) || n.enfants.length === 0) continue
    offset.set(n, suivant)
    suivant += n.enfants.length
    ordre.push(n)
    for (const [, e] of n.enfants) pile.push(e)
  }

  const arcs = new Uint32Array(Math.max(suivant, 2))
  for (const n of ordre) {
    const base = offset.get(n)!
    n.enfants.forEach(([c, e], i) => {
      const enfant = offset.get(e) ?? 0
      arcs[base + i] = c | (e.final ? 32 : 0) | (i === n.enfants.length - 1 ? 64 : 0) | 0
      arcs[base + i] += enfant * 128
    })
  }
  if (arcs.length === 2 && racine.enfants.length === 0) arcs[1] = 64 // dictionnaire vide
  return arcs
}

/** Fichier binaire complet (en-tête + arcs), voir dawg.ts. */
export function fichierDawg(arcs: Uint32Array, nbMots: number, nom: string): Uint8Array {
  const octets = new Uint8Array(48 + arcs.length * 4)
  const vue = new DataView(octets.buffer)
  octets.set([68, 65, 87, 71], 0) // « DAWG »
  vue.setUint32(4, 1, true)
  vue.setUint32(8, arcs.length, true)
  vue.setUint32(12, nbMots, true)
  octets.set(new TextEncoder().encode(nom).subarray(0, 32), 16)
  for (let i = 0; i < arcs.length; i++) vue.setUint32(48 + 4 * i, arcs[i], true)
  return octets
}
