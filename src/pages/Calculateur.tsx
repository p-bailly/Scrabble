// Calculateur de meilleur coup : on recopie un plateau (par exemple celui d'une vraie partie) et un tirage,
// l'appli donne le top et la liste des meilleurs coups.

import { useEffect, useMemo, useState } from 'react'
import { Mot } from '../composants/Apercu'
import { Entete } from '../composants/Entete'
import { IconeEffacer } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { jetonsUtilises, jouer, reference, retirerDuChevalet, type Coup } from '../jeu/coup'
import { ALPHABET, JOKER, valeur } from '../jeu/lettres'
import { TAILLE, colonneDe, ligneDe, plateauDepuisTexte, plateauEnTexte, plateauVide } from '../jeu/plateau'
import { ecrire, lire } from '../lib/stockage'
import { chercherCoups } from '../moteur/moteur'

interface Sauvegarde {
  plateau: string
  tirage: string[]
}

type Cible = 'plateau' | 'tirage' | null

export function Calculateur() {
  const [donnees, setDonnees] = useState<Sauvegarde>(() =>
    lire<Sauvegarde>('calculateur', { plateau: plateauEnTexte(plateauVide()), tirage: [] }),
  )
  const plateau = useMemo(() => plateauDepuisTexte(donnees.plateau), [donnees.plateau])
  const [cible, setCible] = useState<Cible>(null)
  const [curseur, setCurseur] = useState<{ pos: number; dir: 'H' | 'V' }>({ pos: 112, dir: 'H' })
  const [joker, setJoker] = useState(false)
  const [resultats, setResultats] = useState<{ coups: Coup[]; total: number; duree: number } | null>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [calcul, setCalcul] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => ecrire('calculateur', donnees), [donnees])
  // Le plateau ou le tirage change : les résultats ne valent plus.
  useEffect(() => {
    setResultats(null)
    setChoisi(null)
  }, [donnees])

  const majPlateau = (p: string[]) => setDonnees((d) => ({ ...d, plateau: plateauEnTexte(p) }))

  const avancer = (pos: number, dir: 'H' | 'V', sens: 1 | -1) => {
    if (dir === 'H') {
      const c = colonneDe(pos) + sens
      return c < 0 || c >= TAILLE ? pos : pos + sens
    }
    const l = ligneDe(pos) + sens
    return l < 0 || l >= TAILLE ? pos : pos + sens * TAILLE
  }

  const touche = (t: string) => {
    if (cible === 'tirage') {
      if (t === '⌫') setDonnees((d) => ({ ...d, tirage: d.tirage.slice(0, -1) }))
      else if (donnees.tirage.length < 7) setDonnees((d) => ({ ...d, tirage: [...d.tirage, t] }))
      return
    }
    const p = plateau.slice()
    if (t === '⌫') {
      if (p[curseur.pos]) p[curseur.pos] = ''
      else {
        const avant = avancer(curseur.pos, curseur.dir, -1)
        p[avant] = ''
        setCurseur({ ...curseur, pos: avant })
      }
      majPlateau(p)
      return
    }
    p[curseur.pos] = joker ? t.toLowerCase() : t
    setJoker(false)
    majPlateau(p)
    setCurseur({ ...curseur, pos: avancer(curseur.pos, curseur.dir, 1) })
  }

  const chercher = async () => {
    setCible(null)
    setErreur('')
    setCalcul(true)
    try {
      const r = await chercherCoups(plateau, donnees.tirage, 100)
      setResultats(r)
      setChoisi(r.coups.length ? 0 : null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setCalcul(false)
    }
  }

  const coup = choisi !== null ? resultats?.coups[choisi] : undefined

  const poser = () => {
    if (!coup) return
    const reste = retirerDuChevalet(donnees.tirage, jetonsUtilises(coup.poses)) ?? []
    setDonnees({ plateau: plateauEnTexte(jouer(plateau, coup.poses)), tirage: reste })
  }

  return (
    <div className="contenu">
      <Entete
        titre="Calculateur"
        droite={
          <button
            type="button"
            className="puce"
            onClick={() => {
              if (confirm('Effacer le plateau et le tirage ?')) setDonnees({ plateau: plateauEnTexte(plateauVide()), tirage: [] })
            }}
          >
            Tout effacer
          </button>
        }
      />
      <Plateau
        plateau={plateau}
        curseur={cible === 'plateau' ? curseur : null}
        apercu={coup ? { lettres: new Map(coup.poses.map((p) => [p.pos, p.lettre])), style: 'apercu' } : undefined}
        onCase={(pos) => {
          setResultats(null)
          setChoisi(null)
          if (cible === 'plateau' && curseur.pos === pos) setCurseur({ pos, dir: curseur.dir === 'H' ? 'V' : 'H' })
          else setCurseur({ pos, dir: curseur.dir })
          setCible('plateau')
          return true
        }}
      />
      <div className="actions" style={{ alignItems: 'center' }}>
        <button
          type="button"
          className="chevalet"
          style={{ flex: 1, border: cible === 'tirage' ? '2px solid var(--ring)' : '2px solid transparent', cursor: 'pointer' }}
          onClick={() => setCible('tirage')}
          aria-label="Saisir le tirage"
        >
          {Array.from({ length: 7 }, (_, i) => {
            const l = donnees.tirage[i]
            return (
              <div key={i} className={'emplacement' + (l ? '' : ' vide')} style={{ width: 36, height: 38 }}>
                {l && (
                  <div className="tuile" style={{ fontSize: 19 }}>
                    {l === JOKER ? '' : l}
                    {l !== JOKER && <span className="points">{valeur(l)}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </button>
        <button type="button" className="bouton principal" onClick={() => void chercher()} disabled={calcul || donnees.tirage.length === 0}>
          {calcul ? '…' : 'Chercher'}
        </button>
      </div>

      {cible && (
        <div className="panneau-clavier">
          <div className="note">
            {cible === 'plateau'
              ? 'Touche une case puis tape les lettres. Toucher à nouveau la case change le sens.'
              : 'Tape les lettres du tirage (7 au plus).'}
          </div>
          <div className="clavier">
            {[...ALPHABET].map((l) => (
              <button key={l} type="button" onClick={() => touche(l)}>
                {cible === 'plateau' && joker ? l.toLowerCase() : l}
              </button>
            ))}
            {cible === 'tirage' ? (
              <button type="button" onClick={() => touche(JOKER)} style={{ gridColumn: 'span 2', fontSize: 15 }}>
                Joker
              </button>
            ) : (
              <button type="button" className={joker ? 'actif' : ''} onClick={() => setJoker(!joker)} style={{ gridColumn: 'span 2', fontSize: 15 }}>
                Joker
              </button>
            )}
            {cible === 'plateau' && (
              <button
                type="button"
                onClick={() => setCurseur({ ...curseur, dir: curseur.dir === 'H' ? 'V' : 'H' })}
                style={{ fontSize: 15 }}
                aria-label="Changer de sens"
              >
                {curseur.dir === 'H' ? '→' : '↓'}
              </button>
            )}
            <button type="button" onClick={() => touche('⌫')} aria-label="Effacer">
              <IconeEffacer />
            </button>
            <button type="button" className="actif" onClick={() => setCible(null)} style={{ gridColumn: cible === 'plateau' ? 'span 1' : 'span 2', fontSize: 15 }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Place réservée sous le contenu pour que le clavier ne cache rien. */}
      {cible && <div style={{ height: 300 }} />}
      {erreur && <div className="apercu erreur">{erreur}</div>}
      {resultats && (
        <>
          <div className="note" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {resultats.total.toLocaleString('fr-FR')} coups trouvés en {(resultats.duree / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} s
            </span>
            {coup && (
              <button type="button" className="bouton discret" style={{ minHeight: 0, padding: 0 }} onClick={poser}>
                Poser ce coup
              </button>
            )}
          </div>
          {resultats.coups.length === 0 && <div className="vide-etat">Aucun coup possible avec ce tirage.</div>}
          <div className="liste">
            {resultats.coups.map((c, i) => (
              <button type="button" key={i} className={'ligne' + (choisi === i ? ' choisie' : '')} onClick={() => setChoisi(i)}>
                <span className="note" style={{ width: 28, textAlign: 'center', fontWeight: i === 0 ? 800 : 400, color: i === 0 ? 'var(--ok)' : undefined }}>
                  {i === 0 ? 'TOP' : i + 1}
                </span>
                <div className="principal">
                  <Mot mot={c.mot} />
                  <span className="ref">{reference(c.debut, c.dir)}</span>
                </div>
                <span className="pts">{c.points}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
