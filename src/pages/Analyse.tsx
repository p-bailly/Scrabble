// Analyse d'une partie classique terminée (contre l'IA ou à deux) : à chaque tour, le coup joué et les meilleurs coups
// possibles avec le chevalet du joueur, que l'on peut regarder sur le plateau tel qu'il était alors.

import { useEffect, useMemo, useState } from 'react'
import { Mot } from '../composants/Apercu'
import { DefinitionsDe } from '../composants/Definition'
import { Entete } from '../composants/Entete'
import { IconeRetour } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { bilanParJoueur, manqueAGagner, plateauxAvant, toursDeIA, type Meilleurs, type TourAnalysable } from '../jeu/analyse'
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
            suite[i] = { coups: r.coups, total: r.total }
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
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [montre, setMontre] = useState<{ coup: Coup; style: 'apercu' | 'mien' } | null>(null)
  const [filtre, setFiltre] = useState<'tous' | 'moi'>('tous')

  const nom = (id: string) => joueurs.find((j) => j.id === id)?.nom ?? '?'
  const aAnalyser = tours.filter((t) => t.chevalet).length
  const faits = resultats.filter(Boolean).length
  const bilans = useMemo(() => bilanParJoueur(tours, resultats, joueurs.map((j) => j.id)), [tours, resultats, joueurs])

  const choisir = (i: number) => {
    if (ouvert === i) {
      setOuvert(null)
      setMontre(null)
      return
    }
    setOuvert(i)
    const meilleur = resultats[i]?.coups[0]
    setMontre(meilleur ? { coup: meilleur, style: 'apercu' } : null)
  }

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
            </div>
            {b.plusGrosEcart && (
              <button type="button" className="bouton discret" style={{ minHeight: 32, padding: 0 }} onClick={() => choisir(tours.findIndex((t) => t.numero === b.plusGrosEcart!.numero))}>
                Plus gros écart : n° {b.plusGrosEcart.numero} (−{b.plusGrosEcart.manque})
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="note">
        Le meilleur coup est celui qui rapporte le plus de points ; il ne tient pas compte des lettres gardées pour la suite. Touche un tour
        pour voir les meilleurs coups sur le plateau.
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

      <div className="liste">
        {tours.map((t, i) => {
          if (filtre === 'moi' && t.joueur !== moi) return null
          const m = resultats[i]
          const meilleur = m?.coups[0]
          const manque = m ? manqueAGagner(t, m) : 0
          return (
            <div key={t.numero} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" className={'ligne' + (ouvert === i ? ' choisie' : '')} disabled={!m} style={{ opacity: m ? 1 : 0.7 }} onClick={() => choisir(i)}>
                <span className="note" style={{ width: 22 }}>
                  {t.numero}
                </span>
                <div className="principal">
                  <div className="note">
                    {nom(t.joueur)} · <span className="tirage-texte">{t.chevalet?.join('') ?? '—'}</span>
                  </div>
                  <div>{decrire(t)}</div>
                  <div className="note">
                    {!t.chevalet ? (
                      'Chevalet non gardé'
                    ) : !m ? (
                      'Analyse…'
                    ) : meilleur ? (
                      <>
                        Meilleur : <Mot mot={meilleur.mot} /> {reference(meilleur.debut, meilleur.dir)} · {meilleur.points} pts
                      </>
                    ) : (
                      'Aucun coup possible'
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="pts">{t.points}</div>
                  {m && <div className={'note ' + (manque ? 'ecart-neg' : 'ecart-ok')}>{manque ? `−${manque}` : 'top'}</div>}
                </div>
              </button>
              {ouvert === i && m && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12 }}>
                  <Plateau
                    plateau={plateaux[i]}
                    apercu={montre ? { lettres: new Map(montre.coup.poses.map((p) => [p.pos, p.lettre])), style: montre.style } : undefined}
                  />
                  <div className="note">
                    {m.total === 0 ? 'Aucun coup possible' : `${m.total.toLocaleString('fr-FR')} coup${m.total > 1 ? 's' : ''} possible${m.total > 1 ? 's' : ''} avec ce chevalet`}
                    {m.total > m.coups.length && ` · les ${m.coups.length} meilleurs :`}
                  </div>
                  <DefinitionsDe mots={[t.coup?.mot, meilleur?.mot]} />
                  <div className="liste">
                    {t.coup && (
                      <button
                        type="button"
                        className={'ligne' + (montre?.coup === t.coup ? ' choisie' : '')}
                        onClick={() => setMontre({ coup: t.coup!, style: 'mien' })}
                      >
                        <div className="principal">
                          <span className="note">Coup joué · </span>
                          <Mot mot={t.coup.mot} />
                          <span className="ref">{reference(t.coup.debut, t.coup.dir)}</span>
                        </div>
                        <span className="pts">{t.coup.points}</span>
                      </button>
                    )}
                    {m.coups.map((c, k) => (
                      <button type="button" key={k} className={'ligne' + (montre?.coup === c ? ' choisie' : '')} onClick={() => setMontre({ coup: c, style: 'apercu' })}>
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
                </div>
              )}
            </div>
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
