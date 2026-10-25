// Générateur pseudo-aléatoire reproductible (mulberry32) : une même graine redonne les mêmes tirages.

/** Transforme une graine texte (ex. « dimanche ») en entier de 32 bits. */
export function graineEnNombre(graine: string): number {
  let h = 1779033703 ^ graine.length
  for (let i = 0; i < graine.length; i++) {
    h = Math.imul(h ^ graine.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

/** Un tirage aléatoire : renvoie un nombre dans [0, 1) et le nouvel état du générateur. */
export function aleatoire(etat: number): [number, number] {
  const suivant = (etat + 0x6d2b79f5) >>> 0
  let t = suivant
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, suivant]
}

/** Générateur avec état modifiable, pratique pour enchaîner les tirages. */
export class Hasard {
  etat: number
  constructor(etat: number) {
    this.etat = etat >>> 0
  }
  /** Entier dans [0, n). */
  entier(n: number): number {
    const [x, e] = aleatoire(this.etat)
    this.etat = e
    return Math.floor(x * n)
  }
}

/** Graine lisible tirée au hasard (6 caractères sans ambiguïté). */
export function nouvelleGraine(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}
