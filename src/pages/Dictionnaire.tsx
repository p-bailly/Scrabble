// Dictionnaire : tous les mots valables (ODS), avec recherche, et la définition d'un mot en le touchant.

import { useEffect, useMemo, useState } from 'react'
import { Entete } from '../composants/Entete'
import { Dawg } from '../jeu/dawg'
import { chercherDefinition, type Definition } from '../lib/definitions'
import { URL_DICO } from '../moteur/moteur'

type Mode = 'debut' | 'fin' | 'contient'
const MODES: { mode: Mode; nom: string }[] = [
  { mode: 'debut', nom: 'Commence par' },
  { mode: 'fin', nom: 'Finit par' },
  { mode: 'contient', nom: 'Contient' },
]
const PAGE = 200

let dico: Promise<Dawg> | null = null
const charger = () =>
  (dico ??= fetch(URL_DICO)
    .then(async (r) => {
      if (!r.ok) throw new Error(`Dictionnaire introuvable (${r.status})`)
      return Dawg.depuisFichier(await r.arrayBuffer())
    })
    .catch((e) => {
      dico = null
      throw e
    }))

/** Mots correspondant à la recherche ; `?` remplace une lettre quelconque. */
function filtrer(d: Dawg, requete: string, mode: Mode, limite: number): string[] {
  const q = requete.toUpperCase().replace(/[^A-Z?]/g, '')
  const motif = new RegExp((mode === 'debut' ? '^' : '') + q.replace(/\?/g, '.') + (mode === 'fin' ? '$' : ''))
  const res: string[] = []
  if (mode === 'debut' && !q.includes('?') && q) {
    // Parcours direct à partir du préfixe.
    const arc = d.suivre(q)
    if (arc < 0) return res
    if (d.contient(q)) res.push(q)
    for (const m of d.mots(d.arcs[arc] >>> 7, q)) {
      res.push(m)
      if (res.length >= limite) break
    }
    return res
  }
  for (const m of d.mots()) {
    if (!q || motif.test(m)) {
      res.push(m)
      if (res.length >= limite) break
    }
  }
  return res
}

export function Dictionnaire() {
  const [d, setD] = useState<Dawg | null>(null)
  const [erreur, setErreur] = useState('')
  const [requete, setRequete] = useState('')
  const [mode, setMode] = useState<Mode>('debut')
  const [limite, setLimite] = useState(PAGE)
  const [ouvert, setOuvert] = useState<string | null>(null)

  useEffect(() => {
    charger().then(setD, (e: Error) => setErreur(e.message))
  }, [])
  useEffect(() => setLimite(PAGE), [requete, mode])

  const mots = useMemo(() => (d ? filtrer(d, requete, mode, limite + 1) : []), [d, requete, mode, limite])
  const encore = mots.length > limite

  return (
    <div className="contenu">
      <Entete titre="Dictionnaire" droite={d ? <span className="puce">{d.nbMots.toLocaleString('fr-FR')} mots</span> : undefined} />
      <input
        value={requete}
        onChange={(e) => setRequete(e.target.value)}
        placeholder="Chercher un mot (? = une lettre)"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Chercher un mot"
      />
      <div className="segments">
        {MODES.map((m) => (
          <button key={m.mode} type="button" className={mode === m.mode ? 'actif' : ''} onClick={() => setMode(m.mode)}>
            {m.nom}
          </button>
        ))}
      </div>
      {erreur && <div className="apercu erreur">{erreur}</div>}
      {!d && !erreur && <div className="vide-etat">Chargement du dictionnaire…</div>}
      {d && mots.length === 0 && <div className="vide-etat">Aucun mot ne correspond.</div>}
      <div className="liste">
        {mots.slice(0, limite).map((m) => (
          <div key={m}>
            <button type="button" className={'ligne' + (ouvert === m ? ' choisie' : '')} onClick={() => setOuvert(ouvert === m ? null : m)}>
              <div className="principal">
                <span className="mot">{m}</span>
              </div>
            </button>
            {ouvert === m && <DefinitionMot mot={m} />}
          </div>
        ))}
      </div>
      {encore && (
        <button type="button" className="bouton" onClick={() => setLimite((l) => l + PAGE)}>
          Voir la suite
        </button>
      )}
    </div>
  )
}

function DefinitionMot({ mot }: { mot: string }) {
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
          <span className="note">Source : Wiktionnaire (CC BY-SA)</span>
        </>
      )}
    </div>
  )
}
