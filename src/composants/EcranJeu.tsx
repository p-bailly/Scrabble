// Agencement des écrans de jeu, à la manière de DupliJeu : barre du haut avec retour et titre, plateau d'un bord
// à l'autre, chevalet dessous, puis les boutons et, tout en bas, le chrono encadré avec le score et sa jauge.
// Pas d'onglets pendant le jeu. Sur grand écran (ordinateur, tablette à l'horizontale), le plateau passe à gauche, le
// plus grand possible, et la barre du haut et la colonne de jeu forment le côté droit (voir styles.css).

import { useEffect, type ReactNode } from 'react'
import { IconeRetour } from './Icones'

const EVENEMENT_ONGLETS = 'scrabble:onglets'

// État courant : à l'ouverture de l'appli sur une partie en cours, l'écran de jeu demande le masquage avant que
// l'appli n'écoute l'événement ; elle lit donc cet état en s'abonnant.
let ongletsMasquesActuel = false

/** Masque la barre d'onglets tant que le composant appelant est affiché. */
export function useMasquerOnglets(masquer = true) {
  useEffect(() => {
    if (!masquer) return
    ongletsMasquesActuel = true
    window.dispatchEvent(new CustomEvent(EVENEMENT_ONGLETS, { detail: true }))
    return () => {
      ongletsMasquesActuel = false
      window.dispatchEvent(new CustomEvent(EVENEMENT_ONGLETS, { detail: false }))
    }
  }, [masquer])
}

/** Pour l'appli : suit les demandes de masquage des onglets. */
export function surMasquageOnglets(rappel: (masque: boolean) => void): () => void {
  rappel(ongletsMasquesActuel)
  const maj = (e: Event) => rappel((e as CustomEvent<boolean>).detail)
  window.addEventListener(EVENEMENT_ONGLETS, maj)
  return () => window.removeEventListener(EVENEMENT_ONGLETS, maj)
}

interface PropsBarre {
  onRetour: () => void
  libelleRetour: string
  titre: ReactNode
  /** Après le titre, jamais tronquée avec lui (la pastille du sac). */
  pastille?: ReactNode
  droite?: ReactNode
}

export function BarreJeu({ onRetour, libelleRetour, titre, pastille, droite }: PropsBarre) {
  return (
    <header className="barre-jeu">
      <button type="button" className="bouton-icone" onClick={onRetour} aria-label={libelleRetour}>
        <IconeRetour />
      </button>
      <div className="titre">
        <span className="texte">{titre}</span>
        {pastille}
      </div>
      {droite}
    </header>
  )
}

/** Reste de temps (en secondes) à partir duquel le chrono et le chevalet passent au rouge. */
const SECONDES_URGENTES = 15

/** Le temps est presque écoulé ? (`total` 0 : sans limite, jamais urgent.) */
export const estUrgent = (ecoule: number, total: number) => total > 0 && total - ecoule <= SECONDES_URGENTES

/** Chrono encadré. `total` 0 : sans limite (on affiche le temps écoulé). */
export function Chrono({ ecoule, total }: { ecoule: number; total: number }) {
  const reste = total ? Math.max(0, total - ecoule) : ecoule
  const texte = `${Math.floor(reste / 60)}:${String(Math.floor(reste % 60)).padStart(2, '0')}`
  return (
    <div
      className={'chrono' + (estUrgent(ecoule, total) ? ' urgent' : '')}
      role="timer"
      aria-label={total ? `Temps restant ${texte}` : `Temps écoulé ${texte}`}
    >
      {texte}
    </div>
  )
}

interface PropsStatut {
  chrono?: ReactNode
  texte: ReactNode
  /** Part remplie de la jauge (0..1). */
  part: number
}

/** Bas de l'écran : chrono, score (ou les deux scores) et jauge verte. */
export function BarreStatut({ chrono, texte, part }: PropsStatut) {
  return (
    <div className="statut">
      {chrono}
      <div className="milieu">
        <div className="texte">{texte}</div>
        <div className="jauge" aria-hidden>
          <div style={{ width: `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

/** Texte placé dans le panneau du bas (avec les mêmes marges que la ligne de boutons). */
export function ContenuPanneau({ children }: { children: ReactNode }) {
  return <div className="contenu-panneau">{children}</div>
}

/**
 * Tout ce qui suit le plateau (chevalet, aperçu, notes, boutons, chrono). Sur téléphone, ces éléments se rangent
 * directement sous le plateau ; sur grand écran, c'est la colonne de droite, sous la barre du haut.
 */
export function ColonneJeu({ children }: { children: ReactNode }) {
  return <div className="colonne-jeu">{children}</div>
}

/** Boutons d'action, collés en bas de l'écran avec la barre de statut dessous. */
export function PanneauBas({ children, statut }: { children: ReactNode; statut?: ReactNode }) {
  return (
    <div className="panneau-bas">
      {children}
      {statut}
    </div>
  )
}
