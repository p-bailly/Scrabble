// Aperçu pendant la pose : validité des mots et score, avant de valider.

import { useEffect, useState } from 'react'
import type { Analyse, Pose } from '../jeu/coup'
import type { Plateau } from '../jeu/plateau'
import { analyser } from '../moteur/moteur'
import { IconeCroix, IconeLoupe, IconeOk } from './Icones'
import { nettoyer, useValable } from './VerifierMot'

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

/** Ouvre la vérification d'un mot (FeuilleVerifier), avec le mot déjà tapé s'il y en a un. */
type Verifier = (mot?: string) => void

/** Bouton « Vérifier un mot » au bout de la ligne d'aperçu. */
export function Loupe({ onVerifier, mot }: { onVerifier?: Verifier; mot?: string }) {
  if (!onVerifier) return null
  return (
    <button type="button" className="bouton-loupe" onClick={() => onVerifier(mot)} aria-label="Vérifier un mot">
      <IconeLoupe />
    </button>
  )
}

/** Ligne d'aperçu sans lettre posée : on y tape directement un mot, la réponse s'affiche au bout de la ligne ;
 * Entrée ou la loupe ouvrent la fenêtre de vérification (définition) avec ce mot. L'indice sert de texte d'attente. */
export function SaisieVerifier({ indice, onVerifier }: { indice: string; onVerifier: Verifier }) {
  const [saisie, setSaisie] = useState('')
  const mot = nettoyer(saisie)
  const valable = useValable(mot)
  return (
    <div className="apercu avec-loupe">
      <input
        className="saisie-apercu"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && mot) onVerifier(mot)
        }}
        placeholder={indice}
        enterKeyHint="search"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Mot à vérifier"
      />
      {mot && valable !== null && (
        <span className={'verdict ' + (valable ? 'ecart-ok' : 'ecart-neg')} role="status">
          {valable ? <IconeOk /> : <IconeCroix />}
          {valable ? 'valable' : 'refusé'}
        </span>
      )}
      <Loupe onVerifier={onVerifier} mot={mot} />
    </div>
  )
}

/** `onVerifier` : ajoute au bout de la ligne le bouton qui ouvre la vérification d'un mot (FeuilleVerifier) et,
 * tant qu'aucune lettre n'est posée, la saisie directe d'un mot à vérifier (SaisieVerifier). */
export function Apercu({ analyse, indice, onVerifier }: { analyse: Analyse | null; indice: string; onVerifier?: Verifier }) {
  const avec = onVerifier ? ' avec-loupe' : ''
  if (!analyse) {
    if (onVerifier) return <SaisieVerifier indice={indice} onVerifier={onVerifier} />
    return (
      <div className="apercu">
        <span className="indice">{indice}</span>
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
          // Un mot et ses points ne se séparent pas ; la ligne passe à la suivante entre deux mots, sans rien couper.
          <span key={i}>
            {i > 0 && ' + '}
            <span className={'mot-points' + (inconnus.has(m.mot) ? ' inconnu' : '')}>
              <b>
                <Mot mot={m.affichage} />
              </b>{' '}
              {m.points}
            </span>
          </span>
        ))}
        {analyse.scrabble && <b className="mot-points"> + 50</b>}
      </span>
      <span className="total" style={{ color: analyse.valide ? 'var(--text)' : 'var(--muted)' }}>
        {analyse.points} pts
      </span>
      <Loupe onVerifier={onVerifier} />
    </div>
  )
}

/**
 * Dernier coup joué, rappelé sous la ligne d'aperçu, sur deux lignes : qui a joué, puis en grand le mot, sa position et
 * les points. `qui` : « Tu as », « Paul a », « L’ordinateur a ».
 */
export function DernierCoup({
  qui,
  type,
  mot,
  position,
  points,
  nbChanges = 0,
}: {
  qui: string
  type: 'mot' | 'change' | 'passe'
  mot?: string
  /** Référence de la première lettre (« H8 »). */
  position?: string
  points: number
  nbChanges?: number
}) {
  return (
    <div className="dernier-coup">
      <div className="qui">
        {qui} {type === 'mot' ? 'joué' : type === 'change' ? 'changé' : 'passé'}
      </div>
      {type === 'mot' && (
        <div className="quoi">
          <b>
            <Mot mot={mot ?? ''} />
          </b>{' '}
          <span className="ref">{position}</span> · <b>{points} pts</b>
        </div>
      )}
      {type === 'change' && (
        <div className="quoi">
          <b>
            {nbChanges} lettre{nbChanges > 1 ? 's' : ''}
          </b>
        </div>
      )}
    </div>
  )
}
