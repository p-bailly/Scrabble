// Sauvegarde des données de l'appareil dans un fichier : réglages, parties en cours, historiques et statistiques.
// Tout vit dans le navigateur (localStorage) : sans sauvegarde, vider les données du site, changer de téléphone ou, sur
// iPhone, laisser une version non installée plusieurs jours sans l'ouvrir (Safari purge alors le stockage) efface tout.
// Le compte des parties à deux et ses parties sont chez Firebase : ils n'en font pas partie.

import { natif } from './notifications'

const PREFIXE = 'scrabble.'
/** Ce qui est sauvegardé : réglages, duplicate (parties en cours, coup en cours, historique) et contre l'IA. */
const SAUVEGARDE = /^(reglages|solo\.|ia\.)/

export interface Sauvegarde {
  application: 'scrabble'
  version: 1
  date: string
  /** Clé (sans préfixe) → valeur telle qu'elle est écrite dans le stockage. */
  donnees: Record<string, string>
}

/** Les données de l'appareil, en texte JSON. */
export function exporterDonnees(): string {
  const donnees: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i)
      if (!cle?.startsWith(PREFIXE)) continue
      const court = cle.slice(PREFIXE.length)
      const valeur = localStorage.getItem(cle)
      if (SAUVEGARDE.test(court) && valeur !== null) donnees[court] = valeur
    }
  } catch {
    /* stockage inaccessible : sauvegarde vide */
  }
  const s: Sauvegarde = { application: 'scrabble', version: 1, date: new Date().toISOString(), donnees }
  return JSON.stringify(s)
}

export type ResultatImport = { ok: true; nb: number } | { ok: false; erreur: string }

/**
 * Restaure une sauvegarde : elle remplace les réglages, parties et historiques de l'appareil. Rien n'est touché si le
 * texte n'est pas une sauvegarde valable.
 */
export function importerDonnees(texte: string): ResultatImport {
  let s: Partial<Sauvegarde>
  try {
    s = JSON.parse(texte) as Partial<Sauvegarde>
  } catch {
    return { ok: false, erreur: 'Ce n’est pas une sauvegarde de Scrabble.' }
  }
  if (s?.application !== 'scrabble' || s.version !== 1 || !s.donnees || typeof s.donnees !== 'object')
    return { ok: false, erreur: 'Ce n’est pas une sauvegarde de Scrabble.' }
  const entrees = Object.entries(s.donnees)
  for (const [cle, valeur] of entrees) {
    if (!SAUVEGARDE.test(cle) || typeof valeur !== 'string') return { ok: false, erreur: 'La sauvegarde contient des données inattendues.' }
    try {
      JSON.parse(valeur)
    } catch {
      return { ok: false, erreur: 'La sauvegarde est abîmée.' }
    }
  }
  try {
    // On vide d'abord ce que la sauvegarde remplace, pour ne pas mêler deux appareils.
    const remplacees: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i)
      if (cle?.startsWith(PREFIXE) && SAUVEGARDE.test(cle.slice(PREFIXE.length))) remplacees.push(cle)
    }
    for (const cle of remplacees) localStorage.removeItem(cle)
    for (const [cle, valeur] of entrees) localStorage.setItem(PREFIXE + cle, valeur)
  } catch {
    return { ok: false, erreur: 'Le stockage de l’appareil est plein ou refusé.' }
  }
  return { ok: true, nb: entrees.length }
}

/** Nom du fichier de sauvegarde, daté. */
export const nomFichier = (date = new Date()) => `scrabble-sauvegarde-${date.toISOString().slice(0, 10)}.json`

export interface Plateforme {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
  /** `navigator.standalone` (Safari) ou mode d'affichage « standalone » : l'appli est ouverte depuis l'écran d'accueil. */
  installee: boolean
  natif: boolean
}

/**
 * Faut-il conseiller d'ajouter l'appli à l'écran d'accueil ? Oui sur un iPhone ou un iPad où elle tourne dans Safari :
 * c'est la seule façon d'y recevoir des notifications, et le stockage n'y est pas purgé.
 */
export function conseillerInstallation(p: Plateforme): boolean {
  if (p.natif || p.installee) return false
  const iphone = /iPhone|iPad|iPod/.test(p.userAgent)
  // Un iPad récent se présente comme un Mac, mais avec un écran tactile.
  const ipadMac = p.platform === 'MacIntel' && (p.maxTouchPoints ?? 0) > 1
  return iphone || ipadMac
}

/** Plateforme de cet appareil, pour `conseillerInstallation`. */
export function plateformeActuelle(): Plateforme {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    installee: nav.standalone === true || matchMedia('(display-mode: standalone)').matches,
    natif,
  }
}

/** Demande au navigateur de ne pas purger les données du site (sans effet, ni message, s'il refuse ou ne sait pas). */
export function demanderStockagePersistant() {
  try {
    void navigator.storage?.persist?.().catch(() => {})
  } catch {
    /* tant pis */
  }
}
