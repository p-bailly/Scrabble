// Réglages de l'appli, gardés sur l'appareil. Le thème et les étiquettes du plateau s'appliquent à la page entière
// (attributs de <html> que lit styles.css) ; les autres sont lus au moment où ils servent.

import { ecrire, lire } from './stockage'

export type Theme = 'auto' | 'clair' | 'sombre'
export const THEMES: { theme: Theme; nom: string }[] = [
  { theme: 'auto', nom: 'Automatique' },
  { theme: 'clair', nom: 'Clair' },
  { theme: 'sombre', nom: 'Sombre' },
]

export interface Reglages {
  theme: Theme
  /** Libellés des cases bonus sur le plateau (MT, MD, LT, LD). */
  etiquettes: boolean
  /** Notifications « À toi de jouer » et invitations (en plus de l'autorisation du système). */
  notifications: boolean
  /** Demander confirmation avant de passer son tour. */
  confirmerPasse: boolean
}

const CLE = 'reglages'
const DEFAUT: Reglages = { theme: 'auto', etiquettes: true, notifications: true, confirmerPasse: true }

const booleen = (v: unknown, defaut: boolean) => (typeof v === 'boolean' ? v : defaut)

/** Réglages enregistrés, complétés par les valeurs par défaut (une valeur inconnue ou abîmée est ignorée). */
export function lireReglages(): Reglages {
  const r = lire<Partial<Record<keyof Reglages, unknown>> | null>(CLE, null) ?? {}
  return {
    theme: THEMES.some((t) => t.theme === r.theme) ? (r.theme as Theme) : DEFAUT.theme,
    etiquettes: booleen(r.etiquettes, DEFAUT.etiquettes),
    notifications: booleen(r.notifications, DEFAUT.notifications),
    confirmerPasse: booleen(r.confirmerPasse, DEFAUT.confirmerPasse),
  }
}

/** Change un ou plusieurs réglages, les enregistre et les applique à la page. Renvoie les réglages à jour. */
export function modifierReglages(modif: Partial<Reglages>): Reglages {
  const r = { ...lireReglages(), ...modif }
  ecrire(CLE, r)
  appliquer(r)
  return r
}

const SOMBRE = '(prefers-color-scheme: dark)'
/** Même couleur que les <meta name="theme-color"> d'index.html, pour la barre du navigateur. */
const COULEUR_BARRE = { clair: '#a9d3f4', sombre: '#0e2238' }

/** Le thème est-il sombre ? En « automatique », c'est le système qui décide. (Le script d'index.html fait le même calcul.) */
export const estSombre = (theme: Theme, systemeSombre: boolean) => theme === 'sombre' || (theme === 'auto' && systemeSombre)

function appliquer(r: Reglages) {
  const sombre = estSombre(r.theme, matchMedia(SOMBRE).matches)
  const racine = document.documentElement
  racine.dataset.theme = sombre ? 'dark' : 'light'
  racine.dataset.etiquettes = r.etiquettes ? 'oui' : 'non'
  // Les deux <meta> d'index.html suivent le système ; un thème choisi à la main impose sa couleur aux deux.
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.removeAttribute('media')
    m.setAttribute('content', COULEUR_BARRE[sombre ? 'sombre' : 'clair'])
  }
}

/** Au lancement : applique les réglages et suit le thème du système tant qu'on est en « automatique ». */
export function demarrerReglages() {
  appliquer(lireReglages())
  matchMedia(SOMBRE).addEventListener('change', () => appliquer(lireReglages()))
}
