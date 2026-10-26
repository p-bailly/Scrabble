// Aperçu pendant la pose : validité des mots et score, avant de valider.

import { useEffect, useState } from 'react'
import type { Analyse, Pose } from '../jeu/coup'
import type { Plateau } from '../jeu/plateau'
import { analyser } from '../moteur/moteur'
import { IconeCroix, IconeLoupe, IconeOk } from './Icones'

/** Analyse (par le worker) du coup en cours de pose ; null tant qu'aucune lettre n'est posée. */
export function useAnalyse(plateau: Plateau, poses: Pose[]): Analyse | null {
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  useEffect(() => {
    if (poses.length === 0) {
      setAnalyse(null)
      return
    }
    let actuel = true
    analyser(plateau, poses)
      .then((a) => actuel && setAnalyse(a))
      .catch(() => actuel && setAnalyse(null))
    return () => {
      actuel = false
    }
  }, [plateau, poses])
  return poses.length ? analyse : null
}

/** Mot avec les jokers en minuscules colorées. */
export function Mot({ mot }: { mot: string }) {
  return (
    <span className="mot">
      {[...mot].map((l, i) =>
        l >= 'a' ? (
          <span key={i} className="j">
            {l}
          </span>
        ) : (
          l
        ),
      )}
    </span>
  )
}

/** Bouton « Vérifier un mot » au bout de la ligne d'aperçu. */
function Loupe({ onVerifier }: { onVerifier?: () => void }) {
  if (!onVerifier) return null
  return (
    <button type="button" className="bouton-loupe" onClick={onVerifier} aria-label="Vérifier un mot">
      <IconeLoupe />
    </button>
  )
}

/** `onVerifier` : ajoute au bout de la ligne le bouton qui ouvre la vérification d'un mot (FeuilleVerifier). */
export function Apercu({ analyse, indice, onVerifier }: { analyse: Analyse | null; indice: string; onVerifier?: () => void }) {
  const avec = onVerifier ? ' avec-loupe' : ''
  if (!analyse) {
    return (
      <div className={'apercu' + avec}>
        <span className="indice">{indice}</span>
        <Loupe onVerifier={onVerifier} />
      </div>
    )
  }
  if (analyse.erreur) {
    return (
      <div className={'apercu erreur' + avec}>
        <IconeCroix />
        <span className="mots">{analyse.erreur}</span>
        <Loupe onVerifier={onVerifier} />
      </div>
    )
  }
  const inconnus = new Set(analyse.motsInconnus)
  return (
    <div className={'apercu' + (analyse.valide ? '' : ' erreur') + avec}>
      {analyse.valide ? (
        <span style={{ color: 'var(--ok)', display: 'flex' }}>
          <IconeOk />
        </span>
      ) : (
        <IconeCroix />
      )}
      <span className="mots" style={{ color: 'var(--text)' }}>
        {analyse.mots.map((m, i) => (
          <span key={i}>
            {i > 0 && ' + '}
            <span className={inconnus.has(m.mot) ? 'inconnu' : ''}>
              <b>
                <Mot mot={m.affichage} />
              </b>{' '}
              {m.points}
            </span>
          </span>
        ))}
        {analyse.scrabble && <b> + 50</b>}
      </span>
      <span className="total" style={{ color: analyse.valide ? 'var(--text)' : 'var(--muted)' }}>
        {analyse.points} pts
      </span>
      <Loupe onVerifier={onVerifier} />
    </div>
  )
}
