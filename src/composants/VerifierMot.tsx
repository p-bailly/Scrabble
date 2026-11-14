// Un mot est-il valable ? La réponse de l'arbitre, avec ses points sans case bonus et sa définition. Sert à l'outil
// « Vérifier » du dictionnaire et, pendant une partie, à tester un mot sans le poser (fenêtre FeuilleVerifier).

import { useEffect, useState } from 'react'
import { sommeValeurs } from '../jeu/lettres'
import { motsConnus } from '../moteur/moteur'
import { DefinitionMot } from './Definition'
import { Feuille } from './Entete'

/** Lettres A à Z d'une saisie (accents et casse ignorés). */
export const nettoyer = (saisie: string) => saisie.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '')

/** Le mot (déjà nettoyé) est-il dans le dictionnaire ? null tant que la réponse du worker n'est pas arrivée. */
export function useValable(mot: string): boolean | null {
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
  return reponse?.mot === mot ? reponse.valable : null
}

/** `initial` : mot déjà tapé dans la ligne d'aperçu des écrans de jeu. */
export function VerifierMot({ autoFocus, initial = '' }: { autoFocus?: boolean; initial?: string }) {
  const [saisie, setSaisie] = useState(initial)
  const mot = nettoyer(saisie)
  const valable = useValable(mot)

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

/** Fenêtre « Vérifier un mot » des écrans de jeu : on teste un mot sans toucher au plateau ni au chevalet.
 * `mot` : null = fermée ; sinon le mot déjà tapé dans la ligne d'aperçu (vide si on a seulement touché la loupe). */
export function FeuilleVerifier({ mot, onFermer }: { mot: string | null; onFermer: () => void }) {
  return (
    <Feuille ouvert={mot !== null} onFermer={onFermer}>
      <h3>Vérifier un mot</h3>
      <VerifierMot autoFocus initial={mot ?? ''} />
      <button type="button" className="bouton principal" onClick={onFermer}>
        Fermer
      </button>
    </Feuille>
  )
}
