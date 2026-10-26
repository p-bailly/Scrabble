// Dictionnaire : tous les mots valables (ODS), avec trois outils : chercher (début, fin ou contenu, « ? » pour une
// lettre), vérifier qu'un mot est valable, et trouver les mots qu'on écrit avec ses lettres. Toucher un mot en donne la définition.

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Mot } from '../composants/Apercu'
import { DefinitionMot } from '../composants/Definition'
import { Entete } from '../composants/Entete'
import { motsAvecLettres, nettoyerLettres } from '../jeu/anagrammes'
import { Dawg } from '../jeu/dawg'
import { sommeValeurs } from '../jeu/lettres'
import { URL_DICO } from '../moteur/moteur'

type Outil = 'chercher' | 'verifier' | 'lettres'
const OUTILS: { outil: Outil; nom: string }[] = [
  { outil: 'chercher', nom: 'Chercher' },
  { outil: 'verifier', nom: 'Vérifier' },
  { outil: 'lettres', nom: 'Mes lettres' },
]

type Mode = 'debut' | 'fin' | 'contient'
const MODES: { mode: Mode; nom: string }[] = [
  { mode: 'debut', nom: 'Commence par' },
  { mode: 'fin', nom: 'Finit par' },
  { mode: 'contient', nom: 'Contient' },
]
const PAGE = 200
/** Au-delà, la recherche des mots possibles devient trop longue pour un téléphone. */
const MAX_LETTRES = 15

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
      {d && outil === 'lettres' && <MesLettres d={d} />}
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

/** Un mot est-il valable ? La réponse de l'arbitre, avec ses points sans case bonus et sa définition. */
function Verifier({ d }: { d: Dawg }) {
  const [saisie, setSaisie] = useState('')
  const mot = nettoyerLettres(saisie).replace(/\?/g, '')
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

/** Les mots qu'on écrit avec des lettres données (un chevalet), joker « ? » compris. */
function MesLettres({ d }: { d: Dawg }) {
  const [saisie, setSaisie] = useState('')
  const [toutes, setToutes] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Le calcul passe après la frappe : le champ reste fluide même avec des jokers.
  const lettres = useDeferredValue(nettoyerLettres(saisie))
  const trop = lettres.length > MAX_LETTRES
  const r = useMemo(() => (lettres.length >= 2 && !trop ? motsAvecLettres(d, lettres, { toutes }) : null), [d, lettres, trop, toutes])
  return (
    <>
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder="Tes lettres (? = joker)"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Tes lettres"
      />
      <div className="segments">
        <button type="button" className={!toutes ? 'actif' : ''} onClick={() => setToutes(false)}>
          Tous les mots
        </button>
        <button type="button" className={toutes ? 'actif' : ''} onClick={() => setToutes(true)}>
          Toutes les lettres
        </button>
      </div>
      {!r && (
        <div className="vide-etat">
          {trop ? `${MAX_LETTRES} lettres au plus.` : `Tape deux lettres ou plus (jusqu’à ${MAX_LETTRES}, avec « ? » pour un joker).`}
        </div>
      )}
      {r && r.mots.length === 0 && <div className="vide-etat">Aucun mot ne se forme avec ces lettres.</div>}
      {r && r.mots.length > 0 && (
        <span className="note">
          {r.mots.length}
          {r.tronque ? '+' : ''} mot{r.mots.length > 1 ? 's' : ''}, les plus longs d’abord · points sans case bonus
        </span>
      )}
      <div className="liste">
        {r?.mots.map((m) => {
          const clair = m.mot.toUpperCase()
          return (
            <div key={m.mot}>
              <button type="button" className={'ligne' + (ouvert === m.mot ? ' choisie' : '')} onClick={() => setOuvert(ouvert === m.mot ? null : m.mot)}>
                <div className="principal">
                  <Mot mot={m.mot} />
                </div>
                <span className="pts">{m.points}</span>
              </button>
              {ouvert === m.mot && <DefinitionMot mot={clair} />}
            </div>
          )
        })}
      </div>
    </>
  )
}
