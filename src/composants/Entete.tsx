import type { ReactNode } from 'react'

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
