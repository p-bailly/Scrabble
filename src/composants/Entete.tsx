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

/** `titreOrdi` : titre de la version web sur grand écran, où le logo et le nom de l'appli sont déjà dans le menu. */
export function Entete({ titre = 'Scrabble', titreOrdi, droite }: { titre?: string; titreOrdi?: string; droite?: ReactNode }) {
  return (
    <header className="entete">
      <Logo />
      <h1>
        {titreOrdi ? (
          <>
            <span className="tel-seul">{titre}</span>
            <span className="ordi-seul">{titreOrdi}</span>
          </>
        ) : (
          titre
        )}
      </h1>
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
