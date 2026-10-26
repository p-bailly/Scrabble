import type { ReactNode } from 'react'
import { naviguer } from '../lib/routeur'
import { IconeRetour } from './Icones'

export function Logo() {
  return (
    <div className="logo" aria-hidden>
      <span>S</span>
    </div>
  )
}

export function Entete({ titre = 'Scrabble', droite }: { titre?: string; droite?: ReactNode }) {
  return (
    <header className="entete">
      <Logo />
      <h1>{titre}</h1>
      {droite}
    </header>
  )
}

/** En-tête d'une sous-page : flèche de retour vers `vers` (chemin de l'appli, ex. « solo »), puis le titre. */
export function EnteteRetour({ titre, vers, droite }: { titre: string; vers: string; droite?: ReactNode }) {
  return (
    <header className="entete">
      <button type="button" className="bouton-icone" onClick={() => naviguer(vers)} aria-label="Retour">
        <IconeRetour />
      </button>
      <h1>{titre}</h1>
      {droite}
    </header>
  )
}

export function Feuille({ ouvert, onFermer, children }: { ouvert: boolean; onFermer?: () => void; children: ReactNode }) {
  if (!ouvert) return null
  return (
    <div className="voile" onClick={onFermer}>
      <div className="feuille" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
