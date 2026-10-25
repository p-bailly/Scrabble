// Agencement des écrans de jeu (« plateau plein écran ») : barre du haut avec retour, titre et progression,
// plateau d'un bord à l'autre, panneau du bas avec le chevalet et les boutons. Pas d'onglets pendant le jeu.

import { useEffect, type ReactNode } from 'react'
import { IconeRetour } from './Icones'

const EVENEMENT_ONGLETS = 'scrabble:onglets'

/** Masque la barre d'onglets tant que le composant appelant est affiché. */
export function useMasquerOnglets(masquer = true) {
  useEffect(() => {
    if (!masquer) return
    window.dispatchEvent(new CustomEvent(EVENEMENT_ONGLETS, { detail: true }))
    return () => {
      window.dispatchEvent(new CustomEvent(EVENEMENT_ONGLETS, { detail: false }))
    }
  }, [masquer])
}

/** Pour l'appli : suit les demandes de masquage des onglets. */
export function surMasquageOnglets(rappel: (masque: boolean) => void): () => void {
  const maj = (e: Event) => rappel((e as CustomEvent<boolean>).detail)
  window.addEventListener(EVENEMENT_ONGLETS, maj)
  return () => window.removeEventListener(EVENEMENT_ONGLETS, maj)
}

interface PropsBarre {
  onRetour: () => void
  libelleRetour: string
  titre: ReactNode
  /** Progression : texte à gauche, part de la jauge (0..1), texte à droite. */
  progression?: { gauche: ReactNode; part: number; droite: ReactNode }
  droite?: ReactNode
}

export function BarreJeu({ onRetour, libelleRetour, titre, progression, droite }: PropsBarre) {
  return (
    <header className="barre-jeu">
      <button type="button" className="bouton-icone" onClick={onRetour} aria-label={libelleRetour}>
        <IconeRetour />
      </button>
      <div className="milieu">
        <div className="titre">{titre}</div>
        {progression && (
          <div className="progression">
            <span>{progression.gauche}</span>
            <div className="jauge" aria-hidden>
              <div style={{ width: `${Math.round(Math.max(0, Math.min(1, progression.part)) * 100)}%` }} />
            </div>
            <span>{progression.droite}</span>
          </div>
        )}
      </div>
      {droite}
    </header>
  )
}

const R = 22
const CIRCONFERENCE = 2 * Math.PI * R

/** Chrono circulaire : l'anneau se vide avec le temps. `total` 0 : sans limite (on affiche le temps écoulé). */
export function AnneauChrono({ ecoule, total }: { ecoule: number; total: number }) {
  const reste = total ? Math.max(0, total - ecoule) : ecoule
  const part = total ? reste / total : 1
  const urgent = total > 0 && reste <= 15
  const texte = `${Math.floor(reste / 60)}:${String(Math.floor(reste % 60)).padStart(2, '0')}`
  return (
    <div className={'anneau' + (urgent ? ' urgent' : '')} role="timer" aria-label={total ? `Temps restant ${texte}` : `Temps écoulé ${texte}`}>
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={R} fill="none" className="fond" strokeWidth="5" />
        <circle
          cx="26"
          cy="26"
          r={R}
          fill="none"
          className="avant"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCONFERENCE}
          strokeDashoffset={CIRCONFERENCE * (1 - part)}
        />
      </svg>
      <span>{texte}</span>
    </div>
  )
}

export function PanneauBas({ children }: { children: ReactNode }) {
  return <div className="panneau-bas">{children}</div>
}
