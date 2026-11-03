// Analyse d'une partie classique terminée (contre l'IA ou à deux) : un plateau que l'on fait défiler tour par tour
// (flèches, curseur, liste des tours), avec le coup joué, le meilleur coup mis en avant et les Scrabbles loupés.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mot } from '../composants/Apercu'
import { DefinitionsDe } from '../composants/Definition'
import { Entete } from '../composants/Entete'
import { IconeRetour } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { bilanParJoueur, manqueAGagner, plateauxAvant, scrabbleLoupe, toursDeIA, type Meilleurs, type TourAnalysable } from '../jeu/analyse'
import { reference, type Coup } from '../jeu/coup'
import { PROFILS } from '../jeu/ia'
import { naviguer } from '../lib/routeur'
import { chercherCoups } from '../moteur/moteur'
import { formatPct } from '../solo/sauvegarde'
import { trouverPartieIA } from '../solo/sauvegardeIA'

/** Combien de meilleurs coups on garde et montre pour chaque tour. */
const NB_MEILLEURS = 10

export interface PartieAnalysee {
  tours: TourAnalysable[]
  /** Les joueurs, dans l'ordre où l'on affiche leurs bilans. */
  joueurs: { id: string; nom: string }[]
  /** Le joueur qui regarde (filtre « Mes coups »). */
  moi: string
}

/** Cherche, tour après tour, les meilleurs coups possibles avec le chevalet de chaque joueur. */
function useMeilleurs(tours: TourAnalysable[], plateaux: ReturnType<typeof plateauxAvant>) {
  const [resultats, setResultats] = useState<(Meilleurs | undefined)[]>([])
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let actuel = true
    setResultats([])
    setErreur('')
    void (async () => {
      for (let i = 0; i < tours.length; i++) {
        const chevalet = tours[i].chevalet
        if (!chevalet) continue
        try {
          const r = await chercherCoups(plateaux[i], chevalet, NB_MEILLEURS)
          if (!actuel) return
          setResultats((avant) => {
            const suite = [...avant]
            suite[i] = { coups: r.coups, total: r.total, scrabble: r.scrabble }
            return suite
          })
        } catch (e) {
          if (actuel) setErreur(e instanceof Error ? e.message : String(e))
          return
        }
      }
    })()
    return () => {
      actuel = false
    }
  }, [tours, plateaux])
  return { resultats, erreur }
}

export function AnalysePartie({ partie, retour }: { partie: PartieAnalysee; retour: string }) {
  const { tours, joueurs, moi } = partie
  const plateaux = useMemo(() => plateauxAvant(tours), [tours])
  const { resultats, erreur } = useMeilleurs(tours, plateaux)
  const [filtre, setFiltre] = useState<'tous' | 'moi'>('tous')
  const [actuel, setActuel] = useState(0)
  /** Ce que montre le plateau : le coup joué, le meilleur coup, ou un autre coup de la liste. */
  const [montre, setMontre] = useState<Coup | 'joue' | 'meilleur'>('joue')
  const visionneuse = useRef<HTMLDivElement>(null)

  const nom = (id: string) => joueurs.find((j) => j.id === id)?.nom ?? '?'
  const aAnalyser = tours.filter((t) => t.chevalet).length
  const faits = resultats.filter(Boolean).length
  const bilans = useMemo(() => bilanParJoueur(tours, resultats, joueurs.map((j) => j.id)), [tours, resultats, joueurs])
  /** Indices des tours que l'on peut faire défiler (selon le filtre). */
  const visibles = useMemo(() => tours.map((_, i) => i).filter((i) => filtre === 'tous' || tours[i].joueur === moi), [tours, filtre, moi])
  const rang = visibles.indexOf(actuel)

  const aller = (i: number, defiler = false) => {
    setActuel(i)
    setMontre('joue')
    if (defiler) visionneuse.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const precedent = rang > 0 ? visibles[rang - 1] : null
  const suivant = rang >= 0 && rang < visibles.length - 1 ? visibles[rang + 1] : null

  // Le filtre « Mes coups » peut cacher le tour regardé : on passe au premier tour visible.
  useEffect(() => {
    if (visibles.length && !visibles.includes(actuel)) aller(visibles[0])
  }, [visibles, actuel])

  // Flèches du clavier : tour précédent / suivant.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && precedent !== null) aller(precedent)
      else if (e.key === 'ArrowRight' && suivant !== null) aller(suivant)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [precedent, suivant])

  if (tours.length === 0)
    return (
      <div className="contenu">
        <Retour vers={retour} />
        <div className="vide-etat">Aucun coup n’a été joué dans cette partie.</div>
      </div>
    )
  if (aAnalyser === 0)
    return (
      <div className="contenu">
        <Retour vers={retour} />
        <div className="vide-etat">
          Cette partie date d’avant l’analyse : les chevalets de chaque tour n’ont pas été gardés, on ne peut pas dire quels coups étaient possibles.
          Les parties suivantes seront analysables.
        </div>
      </div>
    )

  const t = tours[actuel]
  const m = resultats[actuel]
  const meilleur = m?.coups[0]
  const manque = m ? manqueAGagner(t, m) : 0
  const loupe = m ? scrabbleLoupe(t, m) : false
  // Scrabble possible mais absent des meilleurs coups (un coup sans Scrabble rapportait plus) : on le montre aussi.
  const scrabbleHorsListe = loupe && m?.scrabble && !m.coups.includes(m.scrabble) ? m.scrabble : undefined
  const coupMontre = montre === 'joue' ? (t.coup ?? meilleur) : montre === 'meilleur' ? meilleur : montre
  const styleMontre = coupMontre && coupMontre === t.coup ? 'mien' : 'apercu'

  return (
    <div className="contenu">
      <Retour vers={retour} />
      {faits < aAnalyser && !erreur && (
        <div className="liste">
          <div className="note">
            Analyse en cours… {faits} / {aAnalyser} tours
          </div>
          <div className="jauge" aria-hidden>
            <div style={{ width: `${(100 * faits) / aAnalyser}%` }} />
          </div>
        </div>
      )}
      {erreur && <div className="apercu erreur">L’analyse a échoué : {erreur}</div>}

      <div className="stats">
        {bilans.map((b) => (
          <div className="stat" key={b.joueur}>
            <div className="etiquette">{nom(b.joueur)}</div>
            <div className="valeur">{b.tours ? formatPct(b.pourcentage) : '—'}</div>
            <div className="note">
              {b.points} pts sur {b.meilleur} possibles
              <br />
              {b.parfaits} meilleur{b.parfaits > 1 ? 's' : ''} coup{b.parfaits > 1 ? 's' : ''} sur {b.tours}
              <br />
              {b.scrabbles} Scrabble{b.scrabbles > 1 ? 's' : ''} ·{' '}
              <span className={b.scrabblesLoupes ? 'ecart-neg' : undefined}>
                {b.scrabblesLoupes} loupé{b.scrabblesLoupes > 1 ? 's' : ''}
              </span>
            </div>
            {b.plusGrosEcart && (
              <button
                type="button"
                className="bouton discret"
                style={{ minHeight: 32, padding: 0 }}
                onClick={() => aller(tours.findIndex((x) => x.numero === b.plusGrosEcart!.numero), true)}
              >
                Plus gros écart : n° {b.plusGrosEcart.numero} (−{b.plusGrosEcart.manque})
              </button>
            )}
          </div>
        ))}
      </div>
      {joueurs.some((j) => j.id === moi) && (
        <div className="segments">
          <button type="button" className={filtre === 'tous' ? 'actif' : ''} onClick={() => setFiltre('tous')}>
            Tous les coups
          </button>
          <button type="button" className={filtre === 'moi' ? 'actif' : ''} onClick={() => setFiltre('moi')}>
            Mes coups
          </button>
        </div>
      )}

      <div className="visionneuse" ref={visionneuse}>
        <div className="nav-tours">
          <button type="button" className="bouton-icone" disabled={precedent === null} onClick={() => precedent !== null && aller(precedent)} aria-label="Tour précédent">
            <IconeRetour />
          </button>
          <div className="principal">
            <div>
              <b>Tour {t.numero}</b> · {nom(t.joueur)}
            </div>
            <div className="note">
              <span className="tirage-texte">{t.chevalet?.join('') ?? '—'}</span>
            </div>
          </div>
          <button
            type="button"
            className="bouton-icone suivant"
            disabled={suivant === null}
            onClick={() => suivant !== null && aller(suivant)}
            aria-label="Tour suivant"
          >
            <IconeRetour />
          </button>
        </div>
        <input
          type="range"
          className="curseur-tours"
          min={0}
          max={Math.max(0, visibles.length - 1)}
          value={Math.max(0, rang)}
          onChange={(e) => aller(visibles[Number(e.target.value)])}
          aria-label="Choisir un tour"
        />

        <Plateau
          plateau={plateaux[actuel]}
          apercu={coupMontre ? { lettres: new Map(coupMontre.poses.map((p) => [p.pos, p.lettre])), style: styleMontre } : undefined}
        />

        <button type="button" className={'ligne' + (montre === 'joue' && t.coup ? ' choisie' : '')} disabled={!t.coup} onClick={() => setMontre('joue')}>
          <div className="principal">
            <div className="note">Coup joué</div>
            <div>{decrire(t)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="pts">{t.points}</div>
            {m && <div className={'note ' + (manque ? 'ecart-neg' : 'ecart-ok')}>{manque ? `−${manque}` : 'top'}</div>}
          </div>
        </button>

        {!t.chevalet ? (
          <div className="note">Chevalet non gardé : pas d’analyse pour ce tour.</div>
        ) : !m ? (
          <div className="note">Analyse…</div>
        ) : !meilleur ? (
          <div className="note">Aucun coup possible avec ce chevalet.</div>
        ) : (
          <>
            <button
              type="button"
              className={'meilleur-coup' + (coupMontre === meilleur && styleMontre === 'apercu' ? ' choisi' : '')}
              onClick={() => setMontre('meilleur')}
            >
              <div className="principal">
                <div className="etiquette">{manque ? 'Meilleur coup' : 'Meilleur coup : trouvé !'}</div>
                <div className="mot-meilleur">
                  <Mot mot={meilleur.mot} />
                  <span className="ref">{reference(meilleur.debut, meilleur.dir)}</span>
                </div>
              </div>
              <div className="pts-meilleur">{meilleur.points}</div>
            </button>
            {loupe && (
              <div className="apercu erreur">
                Scrabble loupé
                {scrabbleHorsListe && (
                  <>
                    {' '}
                    : <Mot mot={scrabbleHorsListe.mot} /> {reference(scrabbleHorsListe.debut, scrabbleHorsListe.dir)} ({scrabbleHorsListe.points} pts){' '}
                    <button type="button" className="bouton discret" style={{ minHeight: 32, padding: '0 6px' }} onClick={() => setMontre(scrabbleHorsListe)}>
                      Voir
                    </button>
                  </>
                )}
              </div>
            )}
            <DefinitionsDe mots={[t.coup?.mot, meilleur.mot]} />
            {m.coups.length > 1 && (
              <>
                <div className="note">
                  {m.total.toLocaleString('fr-FR')} coups possibles avec ce chevalet · les {m.coups.length} meilleurs :
                </div>
                <div className="liste">
                  {m.coups.map((c, k) => (
                    <button
                      type="button"
                      key={k}
                      className={'ligne' + (coupMontre === c && styleMontre === 'apercu' ? ' choisie' : '')}
                      onClick={() => setMontre(k === 0 ? 'meilleur' : c)}
                    >
                      <span className="note" style={{ width: 22 }}>
                        {k + 1}
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
          </>
        )}
      </div>

      <div className="note">Tous les tours</div>
      <div className="liste">
        {visibles.map((i) => {
          const tour = tours[i]
          const r = resultats[i]
          const ecart = r ? manqueAGagner(tour, r) : 0
          return (
            <button type="button" key={tour.numero} className={'ligne' + (actuel === i ? ' choisie' : '')} onClick={() => aller(i, true)}>
              <span className="note" style={{ width: 22 }}>
                {tour.numero}
              </span>
              <div className="principal">
                <div className="note">{nom(tour.joueur)}</div>
                <div>{decrire(tour)}</div>
                {r && scrabbleLoupe(tour, r) && <div className="note ecart-neg">Scrabble loupé</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="pts">{tour.points}</div>
                {r && <div className={'note ' + (ecart ? 'ecart-neg' : 'ecart-ok')}>{ecart ? `−${ecart}` : 'top'}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Ce que le joueur a fait à ce tour. */
function decrire(t: TourAnalysable) {
  if (t.type === 'mot' && t.coup)
    return (
      <>
        <Mot mot={t.coup.mot} />
        <span className="ref">{reference(t.coup.debut, t.coup.dir)}</span>
      </>
    )
  if (t.type === 'change') return <span>A changé {t.nbChanges} lettre{(t.nbChanges ?? 0) > 1 ? 's' : ''}</span>
  return <span>A passé</span>
}

function Retour({ vers }: { vers: string }) {
  return (
    <Entete
      titre="Analyse"
      droite={
        <button
          type="button"
          className="bouton-icone"
          onClick={() => (history.length > 1 ? history.back() : naviguer(vers))}
          aria-label="Retour"
        >
          <IconeRetour />
        </button>
      }
    />
  )
}

/** Analyse d'une partie contre l'IA : la partie de l'appareil (« courante ») ou une partie terminée gardée. */
export function AnalyseIA({ id }: { id: string }) {
  const donnees = useMemo(() => {
    const p = trouverPartieIA(id)
    if (!p) return null
    const profil = PROFILS[p.niveau]
    return {
      tours: toursDeIA(p),
      joueurs: [
        { id: 'moi', nom: 'Toi' },
        { id: 'ia', nom: profil.nom },
      ],
      moi: 'moi',
    }
  }, [id])
  if (!donnees)
    return (
      <div className="contenu">
        <Retour vers="solo/ia" />
        <div className="vide-etat">Cette partie n’est plus gardée sur l’appareil.</div>
      </div>
    )
  return <AnalysePartie partie={donnees} retour="solo/ia" />
}
