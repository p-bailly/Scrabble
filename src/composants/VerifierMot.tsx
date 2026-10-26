// Un mot est-il valable ? La réponse de l'arbitre, avec ses points sans case bonus et sa définition. Sert à l'outil
// « Vérifier » du dictionnaire et, pendant une partie, à tester un mot sans le poser (fenêtre FeuilleVerifier).

import { useEffect, useState } from 'react'
import { sommeValeurs } from '../jeu/lettres'
import { motsConnus } from '../moteur/moteur'
import { DefinitionMot } from './Definition'
import { Feuille } from './Entete'

/** Lettres A à Z d'une saisie (accents et casse ignorés). */
const nettoyer = (saisie: string) => saisie.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '')

export function VerifierMot({ autoFocus }: { autoFocus?: boolean }) {
  const [saisie, setSaisie] = useState('')
  const mot = nettoyer(saisie)
  // Réponse pour le mot en cours de saisie ; null tant qu'elle n'est pas arrivée.
  const [reponse, setReponse] = useState<{ mot: string; valable: boolean } | null>(null)
  useEffect(() => {
    if (!mot) return
    let actuel = true
    motsConnus([mot])
      .then(([valable]) => actuel && setReponse({ mot, valable }))
      .catch(() => actuel && setReponse(null))
    return () => {
      actuel = false
    }
  }, [mot])
  const valable = reponse?.mot === mot ? reponse.valable : null

  return (
    <>
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder="Un mot à vérifier"
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Mot à vérifier"
      />
      {!mot ? (
        <div className="vide-etat">Tape un mot : l’appli te dit s’il est dans le dictionnaire.</div>
      ) : valable === null ? (
        <div className="vide-etat">Vérification…</div>
      ) : (
        <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
          <b style={{ fontSize: 22 }} className={valable ? 'ecart-ok' : 'ecart-neg'}>
            {mot} {valable ? 'est valable ✓' : 'n’est pas valable ✗'}
          </b>
          {valable && <span className="note">{sommeValeurs([...mot])} points sans case bonus · {mot.length} lettre{mot.length > 1 ? 's' : ''}</span>}
        </div>
      )}
      {valable && <DefinitionMot mot={mot} />}
    </>
  )
}

/** Fenêtre « Vérifier un mot » des écrans de jeu : on teste un mot sans toucher au plateau ni au chevalet. */
export function FeuilleVerifier({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  return (
    <Feuille ouvert={ouvert} onFermer={onFermer}>
      <h3>Vérifier un mot</h3>
      <VerifierMot autoFocus />
      <button type="button" className="bouton principal" onClick={onFermer}>
        Fermer
      </button>
    </Feuille>
  )
}
