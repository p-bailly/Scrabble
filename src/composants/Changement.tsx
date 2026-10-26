// Fenêtre « Changer des lettres » : on touche les lettres à remettre dans le sac (parties à deux et contre l'IA).

import { useEffect, useState } from 'react'
import { MIN_SAC_POUR_CHANGER } from '../jeu/classique'
import { JOKER, valeur } from '../jeu/lettres'
import { Feuille } from './Entete'

export function Changement({
  ouvert,
  chevalet,
  sac,
  onFermer,
  onChanger,
}: {
  ouvert: boolean
  chevalet: string[]
  sac: number
  onFermer: () => void
  onChanger: (lettres: string[]) => void
}) {
  const [choix, setChoix] = useState<Set<number>>(new Set())
  useEffect(() => setChoix(new Set()), [ouvert])
  const possible = sac >= MIN_SAC_POUR_CHANGER
  return (
    <Feuille ouvert={ouvert} onFermer={onFermer}>
      <h3>Changer des lettres</h3>
      {possible ? (
        <span className="note">Touche les lettres à remettre dans le sac. Tu passes ton tour.</span>
      ) : (
        <span className="note ecart-neg">Il faut au moins 7 lettres dans le sac pour changer (il en reste {sac}).</span>
      )}
      <div className="chevalet">
        {chevalet.map((l, i) => (
          <div className="emplacement" key={i}>
            <button
              type="button"
              className={'tuile' + (choix.has(i) ? ' marquee' : '')}
              onClick={() => {
                const c = new Set(choix)
                if (c.has(i)) c.delete(i)
                else c.add(i)
                setChoix(c)
              }}
              aria-pressed={choix.has(i)}
              aria-label={l === JOKER ? 'Joker' : l}
            >
              {l === JOKER ? '' : l}
              {l !== JOKER && <span className="points">{valeur(l)}</span>}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bouton principal"
        disabled={!possible || choix.size === 0}
        onClick={() => onChanger([...choix].map((i) => chevalet[i]))}
      >
        Changer {choix.size || ''} lettre{choix.size > 1 ? 's' : ''}
      </button>
    </Feuille>
  )
}
