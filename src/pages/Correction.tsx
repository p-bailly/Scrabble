// Correction d'une partie de duplicate : à chaque coup, mon mot, le top et les autres bons coups.

import { useMemo, useState } from 'react'
import { Mot } from '../composants/Apercu'
import { Entete } from '../composants/Entete'
import { IconeRetour } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { jouer, reference, type Coup } from '../jeu/coup'
import { totaux, type PartieDuplicate } from '../jeu/duplicate'
import { plateauVide } from '../jeu/plateau'
import { formatPct, lireHistorique, lirePartiesEnCours, trouverPartieEnCours } from '../solo/sauvegarde'

export function Correction({ id }: { id: string }) {
  const partie = useMemo<PartieDuplicate | null>(() => {
    // « courante » : la partie en cours la plus récente.
    if (id === 'courante') return lirePartiesEnCours()[0] ?? null
    return lireHistorique().find((p) => p.id === id) ?? trouverPartieEnCours(id)
  }, [id])
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [montre, setMontre] = useState<{ coup: Coup; style: 'apercu' | 'mien' } | null>(null)

  if (!partie || partie.coups.length === 0) {
    return (
      <div className="contenu">
        <Retour />
        <div className="vide-etat">Aucun coup à corriger pour l’instant.</div>
      </div>
    )
  }
  const t = totaux(partie)

  // Plateau tel qu'il était avant le coup ouvert.
  const plateauAvant = (n: number) => partie.coups.slice(0, n).reduce((p, c) => jouer(p, c.top.poses), plateauVide())
  const choisir = (i: number) => {
    setOuvert(ouvert === i ? null : i)
    setMontre(ouvert === i ? null : { coup: partie.coups[i].top, style: 'apercu' })
  }

  return (
    <div className="contenu">
      <Retour />
      <div className="stats">
        <div className="stat">
          <div className="etiquette">Moi</div>
          <div className="valeur">{t.joueur}</div>
        </div>
        <div className="stat">
          <div className="etiquette">Tops</div>
          <div className="valeur">{t.top}</div>
        </div>
        <div className="stat">
          <div className="etiquette">Score</div>
          <div className="valeur">{formatPct(t.pourcentage)}</div>
        </div>
      </div>
      <div className="note">
        Graine <b>{partie.graine}</b> · touche un coup pour le voir sur le plateau.
      </div>
      {ouvert !== null && (
        <Plateau
          plateau={plateauAvant(ouvert)}
          apercu={montre ? { lettres: new Map(montre.coup.poses.map((p) => [p.pos, p.lettre])), style: montre.style } : undefined}
        />
      )}
      <div className="liste">
        {partie.coups.map((c, i) => {
          const j = c.joueur
          const ecart = (j?.points ?? 0) - c.top.points
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" className={'ligne' + (ouvert === i ? ' choisie' : '')} onClick={() => choisir(i)}>
                <span className="note" style={{ width: 22 }}>
                  {c.numero}
                </span>
                <div className="principal">
                  <div>
                    <Mot mot={c.top.mot} />
                    <span className="ref">{reference(c.top.debut, c.top.dir)}</span>
                  </div>
                  <div className="note">
                    <span className="tirage-texte">{c.tirage.join('')}</span> · moi :{' '}
                    {j ? (
                      <>
                        <Mot mot={j.mot} /> {j.points}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="pts">{c.top.points}</div>
                  <div className={'note ' + (ecart >= 0 ? 'ecart-ok' : 'ecart-neg')}>{ecart >= 0 ? 'top' : ecart}</div>
                </div>
              </button>
              {ouvert === i && (
                <div className="liste" style={{ paddingLeft: 12 }}>
                  {j && (
                    <button type="button" className={'ligne' + (montre?.coup === j ? ' choisie' : '')} onClick={() => setMontre({ coup: j, style: 'mien' })}>
                      <div className="principal">
                        <span className="note">Mon coup · </span>
                        <Mot mot={j.mot} />
                        <span className="ref">{reference(j.debut, j.dir)}</span>
                      </div>
                      <span className="pts">{j.points}</span>
                    </button>
                  )}
                  {c.autres.slice(0, 8).map((a, k) => (
                    <button
                      type="button"
                      key={k}
                      className={'ligne' + (montre?.coup === a || (k === 0 && montre?.coup === c.top) ? ' choisie' : '')}
                      onClick={() => setMontre({ coup: a, style: 'apercu' })}
                    >
                      <div className="principal">
                        <Mot mot={a.mot} />
                        <span className="ref">{reference(a.debut, a.dir)}</span>
                      </div>
                      <span className="pts">{a.points}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Retour() {
  return (
    <Entete
      titre="Correction"
      droite={
        <button type="button" className="bouton-icone" onClick={() => history.back()} aria-label="Retour">
          <IconeRetour />
        </button>
      }
    />
  )
}
