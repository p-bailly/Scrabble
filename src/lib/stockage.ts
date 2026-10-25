// Sauvegarde sur l'appareil (localStorage), protégée contre les navigateurs qui la refusent.

const PREFIXE = 'scrabble.'

export function lire<T>(cle: string, defaut: T): T {
  try {
    const t = localStorage.getItem(PREFIXE + cle)
    return t === null ? defaut : (JSON.parse(t) as T)
  } catch {
    return defaut
  }
}

export function ecrire(cle: string, valeur: unknown): void {
  try {
    if (valeur === undefined || valeur === null) localStorage.removeItem(PREFIXE + cle)
    else localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur))
  } catch {
    /* stockage plein ou interdit : tant pis */
  }
}
