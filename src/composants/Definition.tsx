// Définition d'un mot (Wiktionnaire), cherchée au premier affichage puis gardée sur l'appareil. Pour une forme fléchie
// (pluriel, conjugaison…), la définition du mot d'origine suit.

import { useEffect, useState } from 'react'
import { chercherDefinition, type Definition } from '../lib/definitions'

export function DefinitionMot({ mot }: { mot: string }) {
  const [def, setDef] = useState<Definition | null | undefined>(undefined)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let actuel = true
    setDef(undefined)
    setErreur('')
    chercherDefinition(mot).then(
      (r) => actuel && setDef(r),
      () =>
        actuel &&
        setErreur(navigator.onLine === false ? 'Définition indisponible hors connexion.' : 'Le Wiktionnaire ne répond pas pour le moment. Réessaie dans un instant.'),
    )
    return () => {
      actuel = false
    }
  }, [mot])
  return (
    <div className="carte" style={{ margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {erreur ? (
        <span className="note">{erreur}</span>
      ) : def === undefined ? (
        <span className="note">Recherche de la définition…</span>
      ) : def === null ? (
        <span className="note">Pas de définition trouvée pour ce mot.</span>
      ) : (
        <>
          <Sens def={def} />
          {def.lemme && <Sens def={def.lemme} />}
          <span className="note">Source : Wiktionnaire (CC BY-SA)</span>
        </>
      )}
    </div>
  )
}

/** Titre et sens d'une page du Wiktionnaire. */
function Sens({ def }: { def: Definition }) {
  return (
    <>
      <b>{def.titre}</b>
      {def.sens.map((s, i) => (
        <div key={i}>
          <span className="note">{s.nature}</span>
          <ol style={{ margin: '2px 0 0', paddingLeft: 20, lineHeight: 1.4 }}>
            {s.definitions.map((t, j) => (
              <li key={j}>{t}</li>
            ))}
          </ol>
        </div>
      ))}
    </>
  )
}

/** Quelques mots (le coup joué, le meilleur coup…) : on touche celui dont on veut la définition. */
export function DefinitionsDe({ mots }: { mots: (string | undefined)[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const uniques = [...new Set(mots.filter((m): m is string => !!m).map((m) => m.toUpperCase()))]
  if (uniques.length === 0) return null
  return (
    <div className="champ">
      <span className="note">Définition de :</span>
      <div className="segments">
        {uniques.map((m) => (
          <button key={m} type="button" className={ouvert === m ? 'actif' : ''} aria-pressed={ouvert === m} onClick={() => setOuvert(ouvert === m ? null : m)}>
            {m}
          </button>
        ))}
      </div>
      {ouvert && <DefinitionMot mot={ouvert} />}
    </div>
  )
}
