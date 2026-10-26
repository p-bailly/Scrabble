// Lignes de l'écran des réglages : un titre avec son explication, et à droite un interrupteur ou un bouton.

import type { ReactNode } from 'react'

export function Rangee({ titre, texte, droite, children }: { titre: string; texte?: ReactNode; droite?: ReactNode; children?: ReactNode }) {
  return (
    <div className="reglage">
      <div className="texte">
        <div className="titre">{titre}</div>
        {texte && <div className="note">{texte}</div>}
        {children}
      </div>
      {droite}
    </div>
  )
}

export function Interrupteur({
  titre,
  texte,
  actif,
  onChange,
  desactive,
  children,
}: {
  titre: string
  texte?: ReactNode
  actif: boolean
  onChange: (actif: boolean) => void
  desactive?: boolean
  children?: ReactNode
}) {
  return (
    <Rangee
      titre={titre}
      texte={texte}
      droite={
        <button
          type="button"
          role="switch"
          aria-checked={actif}
          aria-label={titre}
          className="interrupteur"
          disabled={desactive}
          onClick={() => onChange(!actif)}
        />
      }
    >
      {children}
    </Rangee>
  )
}
