// Réglages de l'appli, gardés sur l'appareil. Le thème, la taille du texte et les étiquettes du plateau s'appliquent à
// la page entière (attributs de <html> que lit styles.css) ; les autres sont lus au moment où ils servent.

import { useSyncExternalStore } from 'react'
import { ecrire, lire } from './stockage'
import { ecrireEstampille, lireEstampille, signaler, type Adapteur } from './synchro'

export type Theme = 'auto' | 'clair' | 'sombre'
export const THEMES: { theme: Theme; nom: string }[] = [
  { theme: 'auto', nom: 'Auto' },
  { theme: 'clair', nom: 'Clair' },
  { theme: 'sombre', nom: 'Sombre' },
]

export type TailleTexte = 'normal' | 'grand' | 'tres-grand'
export const TAILLES: { taille: TailleTexte; nom: string }[] = [
  { taille: 'normal', nom: 'Normal' },
  { taille: 'grand', nom: 'Grand' },
  { taille: 'tres-grand', nom: 'Très grand' },
]

export interface Reglages {
  theme: Theme
  /** Taille des textes de l'interface (pas des lettres du plateau). Propre à l'appareil. */
  texte: TailleTexte
  /**
   * Mode simple, pour une personne qui découvre (ou une personne âgée) : trois onglets, pas de duplicate, contre
   * l'ordinateur en un toucher, statistiques et réglages réduits. Propre à l'appareil.
   */
  simple: boolean
  /** Libellés des cases bonus sur le plateau (MT, MD, LT, LD). */
  etiquettes: boolean
  /** Notifications (en plus de l'autorisation du système) ; les trois suivants choisissent lesquelles. */
  notifications: boolean
  /** « À toi de jouer » : l'adversaire a joué ou rejoint ta partie. */
  notifTour: boolean
  /** Invitation reçue, ou refusée. */
  notifInvitations: boolean
  /** Partie terminée par l'adversaire. */
  notifFin: boolean
  /** Demander confirmation avant de passer son tour. */
  confirmerPasse: boolean
}

export type GenreNotification = 'tour' | 'invitation' | 'fin'
const CLE_GENRE = { tour: 'notifTour', invitation: 'notifInvitations', fin: 'notifFin' } as const

const CLE = 'reglages'
const DEFAUT: Reglages = {
  theme: 'auto',
  texte: 'normal',
  simple: false,
  etiquettes: true,
  notifications: true,
  notifTour: true,
  notifInvitations: true,
  notifFin: true,
  confirmerPasse: true,
}

const booleen = (v: unknown, defaut: boolean) => (typeof v === 'boolean' ? v : defaut)

/** Réglages enregistrés, complétés par les valeurs par défaut (une valeur inconnue ou abîmée est ignorée). */
export function lireReglages(): Reglages {
  const r = lire<Partial<Record<keyof Reglages, unknown>> | null>(CLE, null) ?? {}
  return {
    theme: THEMES.some((t) => t.theme === r.theme) ? (r.theme as Theme) : DEFAUT.theme,
    texte: TAILLES.some((t) => t.taille === r.texte) ? (r.texte as TailleTexte) : DEFAUT.texte,
    simple: booleen(r.simple, DEFAUT.simple),
    etiquettes: booleen(r.etiquettes, DEFAUT.etiquettes),
    notifications: booleen(r.notifications, DEFAUT.notifications),
    notifTour: booleen(r.notifTour, DEFAUT.notifTour),
    notifInvitations: booleen(r.notifInvitations, DEFAUT.notifInvitations),
    notifFin: booleen(r.notifFin, DEFAUT.notifFin),
    confirmerPasse: booleen(r.confirmerPasse, DEFAUT.confirmerPasse),
  }
}

/** Les genres de notification que je veux recevoir (aucun si les notifications sont coupées). */
export function genresVoulus(): GenreNotification[] {
  const r = lireReglages()
  if (!r.notifications) return []
  return (Object.keys(CLE_GENRE) as GenreNotification[]).filter((g) => r[CLE_GENRE[g]])
}

/** Faut-il afficher cette notification ? Sans genre : seul l'interrupteur général compte (notification d'essai). */
export function notificationVoulue(genre?: GenreNotification): boolean {
  const r = lireReglages()
  return r.notifications && (!genre || r[CLE_GENRE[genre]])
}

const abonnes = new Set<(r: Reglages) => void>()
// Derniers réglages lus, pour useReglages (React exige le même objet tant que rien ne change).
let instantane: Reglages | null = null

/** Être prévenu de chaque changement de réglages (le mode simple change les onglets, par exemple). */
export function surReglages(rappel: (r: Reglages) => void): () => void {
  abonnes.add(rappel)
  return () => abonnes.delete(rappel)
}

/** Change un ou plusieurs réglages, les enregistre et les applique à la page. Renvoie les réglages à jour. */
export function modifierReglages(modif: Partial<Reglages>): Reglages {
  const r = { ...lireReglages(), ...modif }
  ecrire(CLE, r)
  appliquer(r)
  instantane = r
  for (const rappel of abonnes) rappel(r)
  // Apparence et confirmation suivent le compte ; les notifications dépendent de l'appareil (autorisation, appli installée).
  if ('theme' in modif || 'etiquettes' in modif || 'confirmerPasse' in modif) signaler('reglages', 'app', reglagesDuCompte(r))
  return r
}

/** Réglages à jour dans un composant, qui se redessine quand ils changent. */
export const useReglages = (): Reglages => useSyncExternalStore(surReglages, () => (instantane ??= lireReglages()))

type ReglagesDuCompte = Pick<Reglages, 'theme' | 'etiquettes' | 'confirmerPasse'>
const reglagesDuCompte = (r: Reglages): ReglagesDuCompte => ({ theme: r.theme, etiquettes: r.etiquettes, confirmerPasse: r.confirmerPasse })

/** Synchronisation avec le compte (voir synchro.ts) : l'apparence et la confirmation avant de passer. */
export const adapteurReglages: Adapteur = {
  lister: () => (lireEstampille('app') ? [{ id: 'app', majLe: lireEstampille('app'), donnees: reglagesDuCompte(lireReglages()) }] : []),
  appliquer(_id, donnees, majLe) {
    if (!donnees) return
    modifierReglages(donnees as Partial<Reglages>)
    ecrireEstampille('app', majLe)
  },
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
  racine.dataset.texte = r.texte
  racine.dataset.simple = r.simple ? 'oui' : 'non'
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
