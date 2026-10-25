// Aperçu pendant la pose : validité des mots et score, avant de valider.

import { useEffect, useState } from 'react'
import type { Analyse, Pose } from '../jeu/coup'
import type { Plateau } from '../jeu/plateau'
import { analyser } from '../moteur/moteur'
import { IconeCroix, IconeOk } from './Icones'

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

export function Apercu({ analyse, indice }: { analyse: Analyse | null; indice: string }) {
  if (!analyse) {
    return (
      <div className="apercu">
        <span className="indice">{indice}</span>
      </div>
    )
  }
  if (analyse.erreur) {
    return (
      <div className="apercu erreur">
        <IconeCroix />
        <span className="mots">{analyse.erreur}</span>
      </div>
    )
  }
  const inconnus = new Set(analyse.motsInconnus)
  return (
    <div className={'apercu' + (analyse.valide ? '' : ' erreur')}>
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
    </div>
  )
}
