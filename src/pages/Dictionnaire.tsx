// Dictionnaire : tous les mots valables (ODS), avec deux outils : chercher (début, fin ou contenu, « ? » pour une
// lettre) et vérifier qu'un mot est valable. Toucher un mot en donne la définition. Pas de recherche « avec mes
// lettres » : ce serait tricher en cours de partie.

import { useEffect, useMemo, useState } from 'react'
import { DefinitionMot } from '../composants/Definition'
import { Entete } from '../composants/Entete'
import { Dawg } from '../jeu/dawg'
import { sommeValeurs } from '../jeu/lettres'
import { URL_DICO } from '../moteur/moteur'

type Outil = 'chercher' | 'verifier'
const OUTILS: { outil: Outil; nom: string }[] = [
  { outil: 'chercher', nom: 'Chercher' },
  { outil: 'verifier', nom: 'Vérifier' },
]

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
  const [outil, setOutil] = useState<Outil>('chercher')

  useEffect(() => {
    charger().then(setD, (e: Error) => setErreur(e.message))
  }, [])

  return (
    <div className="contenu">
      <Entete titre="Dictionnaire" droite={d ? <span className="puce">{d.nbMots.toLocaleString('fr-FR')} mots</span> : undefined} />
      <div className="segments" role="tablist">
        {OUTILS.map((o) => (
          <button key={o.outil} type="button" role="tab" aria-selected={outil === o.outil} className={outil === o.outil ? 'actif' : ''} onClick={() => setOutil(o.outil)}>
            {o.nom}
          </button>
        ))}
      </div>
      {erreur && <div className="apercu erreur">{erreur}</div>}
      {!d && !erreur && <div className="vide-etat">Chargement du dictionnaire…</div>}
      {d && outil === 'chercher' && <Chercher d={d} />}
      {d && outil === 'verifier' && <Verifier d={d} />}
    </div>
  )
}

function Chercher({ d }: { d: Dawg }) {
  const [requete, setRequete] = useState('')
  const [mode, setMode] = useState<Mode>('debut')
  const [limite, setLimite] = useState(PAGE)
  const [ouvert, setOuvert] = useState<string | null>(null)

  useEffect(() => setLimite(PAGE), [requete, mode])

  const mots = useMemo(() => filtrer(d, requete, mode, limite + 1), [d, requete, mode, limite])
  const encore = mots.length > limite

  return (
    <>
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
      {mots.length === 0 && <div className="vide-etat">Aucun mot ne correspond.</div>}
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
    </>
  )
}

/** Lettres A à Z d'une saisie (accents et casse ignorés). */
const nettoyer = (saisie: string) => saisie.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '')

/** Un mot est-il valable ? La réponse de l'arbitre, avec ses points sans case bonus et sa définition. */
function Verifier({ d }: { d: Dawg }) {
  const [saisie, setSaisie] = useState('')
  const mot = nettoyer(saisie)
  const valable = mot.length > 0 && d.contient(mot)
  return (
    <>
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder="Un mot à vérifier"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Mot à vérifier"
      />
      {mot ? (
        <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
          <b style={{ fontSize: 22 }} className={valable ? 'ecart-ok' : 'ecart-neg'}>
            {mot} {valable ? 'est valable ✓' : 'n’est pas valable ✗'}
          </b>
          {valable && <span className="note">{sommeValeurs([...mot])} points sans case bonus · {mot.length} lettre{mot.length > 1 ? 's' : ''}</span>}
        </div>
      ) : (
        <div className="vide-etat">Tape un mot : l’appli te dit s’il est dans le dictionnaire.</div>
      )}
      {valable && <DefinitionMot mot={mot} />}
    </>
  )
}
