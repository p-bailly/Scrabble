// Le sac : bouton dans la barre de jeu (avec le nombre de lettres) et fenêtre qui détaille les lettres qu'il reste.

import { compter } from '../jeu/duplicate'
import { ALPHABET, DISTRIBUTION, JOKER, valeur } from '../jeu/lettres'
import { Feuille } from './Entete'
import { IconeSac } from './Icones'

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Pastille « sac 87 » de la barre de jeu (les lettres qu'on ne voit pas) : la toucher ouvre la fenêtre du sac. */
export function BoutonSac({ sac, onClick }: { sac: number; onClick: () => void }) {
  return (
    <button type="button" className="puce-sac" onClick={onClick} aria-label={`Voir le sac, ${pluriel(sac, 'lettre')}`}>
      <IconeSac taille={16} /> {sac}
    </button>
  )
}

/**
 * Fenêtre du sac. `lettres` : ce que le joueur ne voit pas encore. En duplicate, c'est exactement le sac ; face à un
 * adversaire (`adversaire`), le chevalet de celui-ci s'y mêle : on sait combien de lettres il a, pas lesquelles.
 */
export function Sac({
  ouvert,
  onFermer,
  lettres,
  sac,
  adversaire,
}: {
  ouvert: boolean
  onFermer: () => void
  lettres: readonly string[]
  /** Nombre de jetons dans le sac. */
  sac: number
  /** Chez qui sont les lettres qui ne sont pas dans le sac (« l'IA », un pseudo), absent en duplicate. */
  adversaire?: string
}) {
  const nb = new Map<string, number>()
  for (const l of lettres) nb.set(l, (nb.get(l) ?? 0) + 1)
  const { voyelles, consonnes, jokers } = compter(lettres)
  const chezAdversaire = lettres.length - sac
  return (
    <Feuille ouvert={ouvert} onFermer={onFermer}>
      <h3>{adversaire ? 'Lettres restantes' : 'Dans le sac'}</h3>
      <span className="note">
        {adversaire
          ? `${pluriel(lettres.length, 'lettre')} ni sur le plateau ni sur ton chevalet : ${sac} dans le sac, ${chezAdversaire} chez ${adversaire}. On ne sait pas lesquelles sont où.`
          : `${pluriel(lettres.length, 'lettre')} dans le sac.`}
      </span>
      <div className="sac-grille">
        {[...ALPHABET, JOKER].map((l) => {
          const n = nb.get(l) ?? 0
          return (
            <div key={l} className={'sac-case' + (n === 0 ? ' vide' : '')} aria-label={`${l === JOKER ? 'Joker' : l} : ${n} sur ${DISTRIBUTION[l]}`}>
              <div className="tuile">
                {l === JOKER ? '' : l}
                {l !== JOKER && <span className="points">{valeur(l)}</span>}
              </div>
              <span className="nb">{n}</span>
            </div>
          )
        })}
      </div>
      <span className="note">
        Voyelles {voyelles} · consonnes {consonnes} · jokers {jokers}
      </span>
      <button type="button" className="bouton principal" onClick={onFermer}>
        Fermer
      </button>
    </Feuille>
  )
}
