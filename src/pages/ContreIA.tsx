// Partie classique contre l'ordinateur : cinq niveaux, du débutant au champion. Tout se passe sur l'appareil (le
// choix du coup de l'IA se fait dans le Web Worker du moteur) et marche hors ligne.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Apercu, Mot, useAnalyse } from '../composants/Apercu'
import { Changement } from '../composants/Changement'
import { DefinitionMot } from '../composants/Definition'
import { Chevalet, ChoixJoker, TuileVolante, useEdition } from '../composants/edition'
import { EnteteRetour, Feuille } from '../composants/Entete'
import { BarreJeu, BarreStatut, ColonneJeu, ContenuPanneau, PanneauBas, useMasquerOnglets } from '../composants/EcranJeu'
import { IconeHistorique, IconeMelanger, IconeOk, IconeRappeler } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { BoutonSac, Sac } from '../composants/Sac'
import { lettresNonVues } from '../jeu/classique'
import {
  abandonnerIA,
  aides,
  annulerCoup,
  appliquerDecision,
  changerIA,
  chevaletAdverseConnu,
  demanderIndiceIA,
  indicesDuTour,
  jouerMotIA,
  memoriserAvant,
  nouvellePartieIA,
  passerIA,
  peutAnnuler,
  type Camp,
  type CoupIA,
  type PartieIA,
} from '../jeu/contreIA'
import { reference, type Coup } from '../jeu/coup'
import { INDICES, NOM_INDICE, texteIndice } from '../jeu/duplicate'
import { NIVEAUX, PROFILS } from '../jeu/ia'
import { plateauDepuisTexte } from '../jeu/plateau'
import { lireReglages } from '../lib/reglages'
import { naviguer } from '../lib/routeur'
import { chargerDico, chercherCoups, decisionIA } from '../moteur/moteur'
import {
  archiverIA,
  bilanParNiveau,
  ecrireReglagesIA,
  enregistrerPartieIA,
  lireReglagesIA,
  abandonnerPartieIA,
  retirerPartieIA,
  trouverPartieIAEnCours,
  type ReglagesIA,
} from '../solo/sauvegardeIA'

/** Temps minimal de « réflexion » de l'IA, pour qu'on voie son coup arriver. */
const REFLEXION_MIN = 800

const NOM_CAMP: Record<Camp, string> = { moi: 'Toi', ia: 'L’IA' }

/** Sans `id` : l'accueil, où l'on commence une partie. Avec : cette partie, à reprendre là où elle en était. */
export function ContreIA({ id }: { id?: string }) {
  const [partie, setPartie] = useState<PartieIA | null>(() => (id ? trouverPartieIAEnCours(id) : null))

  // Une partie en cours est sauvegardée à chaque coup ; terminée, elle quitte les parties en cours pour l'historique.
  const changer = useCallback((p: PartieIA) => {
    setPartie(p)
    if (p.finie) {
      retirerPartieIA(p.id)
      archiverIA(p)
    } else enregistrerPartieIA(p)
  }, [])

  // Partie introuvable (abandonnée depuis le menu Solo, par exemple) : retour à l'accueil.
  useEffect(() => {
    if (id && !partie) naviguer('solo/ia', true)
  }, [id, partie])

  if (!partie) return <AccueilIA />
  return (
    <EcranIA
      partie={partie}
      onChange={changer}
      onRevanche={(p) => {
        enregistrerPartieIA(p)
        naviguer('solo/ia/' + encodeURIComponent(p.id), true)
      }}
      onPause={() => naviguer('solo')}
      onQuitter={() => naviguer('solo')}
    />
  )
}

function AccueilIA() {
  const [reglages, setReglages] = useState<ReglagesIA>(lireReglagesIA)
  const [dico, setDico] = useState('')
  const bilan = useMemo(() => bilanParNiveau(), [])

  useEffect(() => {
    chargerDico()
      .then((d) => setDico(`${d.nom} · ${d.nbMots.toLocaleString('fr-FR')} mots`))
      .catch((e: Error) => setDico('Dictionnaire indisponible : ' + e.message))
  }, [])

  const lancer = () => {
    ecrireReglagesIA(reglages)
    const premier: Camp = reglages.premier === 'hasard' ? (Math.random() < 0.5 ? 'moi' : 'ia') : reglages.premier
    const p = nouvellePartieIA(reglages.niveau, premier)
    enregistrerPartieIA(p)
    naviguer('solo/ia/' + encodeURIComponent(p.id))
  }

  return (
    <div className="contenu">
      <EnteteRetour titre="Contre l’IA" vers="solo" />
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Une vraie partie de Scrabble contre l’ordinateur : chacun son chevalet, on joue à tour de rôle. Choisis la force de
          l’adversaire.
        </p>
        <div className="champ">
          Niveau
          <div className="liste">
            {NIVEAUX.map((n) => {
              const b = bilan.find((x) => x.niveau === n)!
              return (
                <button
                  key={n}
                  type="button"
                  className={'ligne' + (reglages.niveau === n ? ' choisie' : '')}
                  style={{ background: 'var(--surface-2)' }}
                  onClick={() => setReglages({ ...reglages, niveau: n })}
                  aria-pressed={reglages.niveau === n}
                >
                  <div className="principal">
                    <div style={{ fontWeight: 700 }}>{PROFILS[n].nom}</div>
                    <div className="note">{PROFILS[n].description}</div>
                  </div>
                  {b.parties > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div className="pts">
                        {b.victoires} V
                      </div>
                      <div className="note">sur {b.parties}</div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="champ">
          Qui commence ?
          <div className="segments">
            {(
              [
                ['hasard', 'Au hasard'],
                ['moi', 'Moi'],
                ['ia', 'L’IA'],
              ] as const
            ).map(([valeur, texte]) => (
              <button
                key={valeur}
                type="button"
                className={reglages.premier === valeur ? 'actif' : ''}
                onClick={() => setReglages({ ...reglages, premier: valeur })}
              >
                {texte}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="bouton principal" onClick={lancer}>
          Nouvelle partie
        </button>
        <span className="note">{dico || 'Chargement du dictionnaire…'}</span>
      </div>
    </div>
  )
}

/** Phrase décrivant un coup de l'historique. */
function decrire(c: CoupIA) {
  const qui = c.camp === 'moi' ? 'Tu as' : 'L’IA a'
  if (c.type === 'mot') return { texte: `${qui} joué`, coup: c.coup! }
  if (c.type === 'change') return { texte: `${qui} changé ${c.nbChanges} lettre${(c.nbChanges ?? 0) > 1 ? 's' : ''}`, coup: null }
  return { texte: `${qui} passé`, coup: null }
}

function EcranIA({
  partie,
  onChange,
  onRevanche,
  onPause,
  onQuitter,
}: {
  partie: PartieIA
  onChange: (p: PartieIA) => void
  /** Revanche : la nouvelle partie, déjà prête. */
  onRevanche: (p: PartieIA) => void
  onPause: () => void
  onQuitter: () => void
}) {
  useMasquerOnglets()
  const plateau = useMemo(() => plateauDepuisTexte(partie.plateau), [partie.plateau])
  const chevalet = partie.chevalets.moi
  const edition = useEdition(plateau, chevalet)
  const analyse = useAnalyse(plateau, edition.poses)
  const nonVues = useMemo(() => lettresNonVues(plateau, chevalet), [plateau, chevalet])
  const aMoi = !partie.finie && partie.tour === 'moi'
  const [message, setMessage] = useState('')
  const [menu, setMenu] = useState(false)
  const [changement, setChangement] = useState(false)
  const [historique, setHistorique] = useState(false)
  const [feuilleSac, setFeuilleSac] = useState(false)
  // Coup de l'historique dont on lit la définition (numéro du coup).
  const [defOuverte, setDefOuverte] = useState<number | null>(null)
  const [feuilleIndices, setFeuilleIndices] = useState(false)
  // Le meilleur coup du chevalet, cherché à l'ouverture des indices (undefined : en cours ; null : aucun coup possible).
  const [top, setTop] = useState<Coup | null | undefined>(undefined)
  // L'IA n'a pas pu jouer (dictionnaire introuvable…) ; `essai` relance sa réflexion.
  const [erreurIA, setErreurIA] = useState('')
  const [essai, setEssai] = useState(0)

  // Tour de l'IA : le worker choisit son coup, qui est joué après une courte pause.
  useEffect(() => {
    if (partie.finie || partie.tour !== 'ia') return
    let actuel = true
    const debut = Date.now()
    setErreurIA('')
    decisionIA({
      niveau: partie.niveau,
      plateau,
      chevalet: partie.chevalets.ia,
      sac: partie.sac.length,
      adversaire: chevaletAdverseConnu(partie, 'ia'),
    })
      .then(async (d) => {
        const attente = REFLEXION_MIN - (Date.now() - debut)
        if (attente > 0) await new Promise((r) => setTimeout(r, attente))
        if (!actuel) return
        const suite = appliquerDecision(partie, d)
        if ('erreur' in suite) setErreurIA(suite.erreur)
        else onChange(suite)
      })
      .catch((e: Error) => actuel && setErreurIA(e.message))
    return () => {
      actuel = false
    }
  }, [partie, plateau, onChange, essai])

  // Un de mes coups : on garde la partie d'avant, pour pouvoir l'annuler.
  const appliquer = (r: PartieIA | { erreur: string }) => {
    if ('erreur' in r) {
      setMessage(r.erreur)
      return
    }
    setMessage('')
    edition.rappeler()
    onChange(memoriserAvant(partie, r))
  }

  const annuler = () => {
    const r = annulerCoup(partie)
    if ('erreur' in r) return setMessage(r.erreur)
    setMessage('')
    edition.rappeler()
    onChange(r)
  }

  // Indices : on cherche le meilleur coup du chevalet quand la fenêtre s'ouvre.
  useEffect(() => {
    if (!feuilleIndices || !aMoi) return
    let actuel = true
    setTop(undefined)
    chercherCoups(plateau, chevalet, 1).then(
      (r) => actuel && setTop(r.coups[0] ?? null),
      () => actuel && setTop(null),
    )
    return () => {
      actuel = false
    }
  }, [feuilleIndices, aMoi, plateau, chevalet])
  const reveles = indicesDuTour(partie)

  const dernier = partie.coups.at(-1)
  const derniers = useMemo(() => new Set(dernier?.coup ? dernier.coup.poses.map((p) => p.pos) : []), [dernier])
  const { moi, ia } = partie.scores
  const profil = PROFILS[partie.niveau]

  const bouton = (
    <button type="button" className="bouton-icone" onClick={() => setHistorique(true)} aria-label="Historique des coups">
      <IconeHistorique />
    </button>
  )

  return (
    <div className="ecran-jeu">
      <BarreJeu
        onRetour={() => setMenu(true)}
        libelleRetour="Menu de la partie"
        titre={`Contre ${profil.nom}`}
        pastille={<BoutonSac sac={nonVues.length} onClick={() => setFeuilleSac(true)} />}
        droite={bouton}
      />
      <Plateau
        pleine
        plateau={plateau}
        poses={edition.posesCarte}
        derniers={derniers}
        curseur={aMoi ? edition.etat.curseur : null}
        cible={edition.cible}
        onCase={aMoi ? edition.toucherCase : () => false}
        onAppuiPose={edition.appuiPose}
      />
      <ColonneJeu>
        <Chevalet edition={edition} />
        {aMoi && <Apercu analyse={analyse} indice="Pose ton mot, puis « Jouer »." />}
        {!partie.finie && !aMoi && (
          <div className="apercu">
            <span className="indice">{erreurIA ? '' : 'L’IA réfléchit…'}</span>
            {erreurIA && (
              <>
                <span className="mots ecart-neg">L’IA ne peut pas jouer : {erreurIA}</span>
                <button type="button" className="bouton" onClick={() => setEssai((n) => n + 1)}>
                  Réessayer
                </button>
              </>
            )}
          </div>
        )}
        {dernier && !partie.finie && (
          <div className="note note-centree">
            {(() => {
              const d = decrire(dernier)
              return d.coup ? (
                <>
                  {d.texte} <Mot mot={d.coup.mot} /> {reference(d.coup.debut, d.coup.dir)} · {dernier.points} pts
                </>
              ) : (
                d.texte
              )
            })()}
          </div>
        )}
        {message && <div className="note note-centree ecart-neg">{message}</div>}
        <PanneauBas
          statut={
            <BarreStatut
              texte={
                <>
                  Toi <b>{moi}</b> · <b>{ia}</b> IA
                </>
              }
              part={moi + ia ? moi / (moi + ia) : 0.5}
            />
          }
        >
          {partie.finie ? (
            <FinDePartie
              partie={partie}
              onRevanche={() => onRevanche(nouvellePartieIA(partie.niveau, Math.random() < 0.5 ? 'moi' : 'ia'))}
              onQuitter={onQuitter}
            />
          ) : aMoi ? (
            <div className="actions dense">
              <button type="button" className="bouton-icone" onClick={edition.melanger} aria-label="Mélanger">
                <IconeMelanger />
              </button>
              <button type="button" className="bouton-icone" onClick={edition.rappeler} aria-label="Reprendre les lettres">
                <IconeRappeler />
              </button>
              <button type="button" className="bouton large" onClick={() => setChangement(true)}>
                Changer
              </button>
              <button
                type="button"
                className="bouton large"
                onClick={() => {
                  if (!lireReglages().confirmerPasse || confirm('Passer ton tour ?')) appliquer(passerIA(partie, 'moi'))
                }}
              >
                Passer
              </button>
              <button
                type="button"
                className="bouton principal large"
                disabled={!analyse?.valide}
                onClick={() => analyse?.coup && appliquer(jouerMotIA(partie, 'moi', analyse.coup))}
              >
                <IconeOk /> Jouer
              </button>
            </div>
          ) : (
            <div className="actions">
              <button type="button" className="bouton-icone" onClick={edition.melanger} aria-label="Mélanger">
                <IconeMelanger />
              </button>
            </div>
          )}
        </PanneauBas>
      </ColonneJeu>
      <TuileVolante glisse={edition.glisse} />
      <ChoixJoker ouvert={!!edition.etat.joker} onChoix={edition.choisirLettreJoker} />
      <Sac ouvert={feuilleSac} onFermer={() => setFeuilleSac(false)} lettres={nonVues} sac={partie.sac.length} adversaire="l’IA" />
      <Changement
        ouvert={changement}
        chevalet={chevalet}
        sac={partie.sac.length}
        onFermer={() => setChangement(false)}
        onChanger={(lettres) => {
          setChangement(false)
          appliquer(changerIA(partie, 'moi', lettres))
        }}
      />

      <Feuille ouvert={historique} onFermer={() => setHistorique(false)}>
        <h3>Historique</h3>
        {partie.coups.length === 0 && <div className="note">Aucun coup pour l’instant.</div>}
        {partie.coups.some((c) => c.coup) && <div className="note">Touche un mot pour lire sa définition.</div>}
        <div className="liste">
          {[...partie.coups].reverse().map((c) => {
            const d = decrire(c)
            return (
              <div key={c.numero}>
                <div
                  className={'ligne' + (defOuverte === c.numero ? ' choisie' : '')}
                  style={{ cursor: d.coup ? 'pointer' : 'default' }}
                  onClick={() => d.coup && setDefOuverte(defOuverte === c.numero ? null : c.numero)}
                >
                  <span className="note" style={{ width: 22 }}>
                    {c.numero}
                  </span>
                  <div className="principal">
                    <div className="note">{NOM_CAMP[c.camp]}</div>
                    {d.coup ? (
                      <>
                        <Mot mot={d.coup.mot} />
                        <span className="ref">{reference(d.coup.debut, d.coup.dir)}</span>
                      </>
                    ) : (
                      <span>{c.type === 'change' ? `A changé ${c.nbChanges} lettre${(c.nbChanges ?? 0) > 1 ? 's' : ''}` : 'A passé'}</span>
                    )}
                  </div>
                  <span className="pts">{c.points}</span>
                </div>
                {defOuverte === c.numero && d.coup && <DefinitionMot mot={d.coup.mot.toUpperCase()} />}
              </div>
            )
          })}
        </div>
      </Feuille>

      <Feuille ouvert={feuilleIndices && aMoi} onFermer={() => setFeuilleIndices(false)}>
        <h3>Indices</h3>
        <p style={{ margin: 0 }} className="note">
          Chaque indice demandé est compté dans le résumé de la partie.
        </p>
        {top === null && <span className="note ecart-neg">Aucun mot possible avec ce chevalet : change des lettres ou passe.</span>}
        <div className="liste">
          {INDICES.map((i) =>
            reveles.includes(i) && top ? (
              <div className="ligne" key={i} style={{ cursor: 'default' }}>
                <div className="principal">
                  <span className="note">{NOM_INDICE[i]}</span>
                  <div style={{ fontWeight: 700 }}>{texteIndice(i, top)}</div>
                </div>
              </div>
            ) : (
              <button type="button" className="ligne" key={i} disabled={!top} onClick={() => onChange(demanderIndiceIA(partie, i))}>
                <div className="principal">
                  <div style={{ fontWeight: 700 }}>{NOM_INDICE[i]}</div>
                  <span className="note">{top === undefined ? 'Recherche du meilleur coup…' : 'Toucher pour révéler'}</span>
                </div>
              </button>
            ),
          )}
        </div>
        <button type="button" className="bouton principal" onClick={() => setFeuilleIndices(false)}>
          Continuer à chercher
        </button>
      </Feuille>

      <Feuille ouvert={menu} onFermer={() => setMenu(false)}>
        <h3>Partie en cours</h3>
        <p style={{ margin: 0 }} className="note">
          Contre <b>{profil.nom}</b> · toi {moi}, IA {ia} · sac : {nonVues.length} lettres
        </p>
        <button type="button" className="bouton principal" onClick={() => setMenu(false)}>
          Reprendre
        </button>
        <button
          type="button"
          className="bouton"
          disabled={!aMoi}
          onClick={() => {
            setMenu(false)
            setFeuilleIndices(true)
          }}
        >
          Indice{aMoi ? '' : ' (à ton tour)'}
        </button>
        <button
          type="button"
          className="bouton"
          disabled={!peutAnnuler(partie)}
          onClick={() => {
            setMenu(false)
            annuler()
          }}
        >
          Annuler mon dernier coup
        </button>
        <button type="button" className="bouton" onClick={onPause}>
          Mettre en pause
        </button>
        <button
          type="button"
          className="bouton danger"
          onClick={() => {
            setMenu(false)
            // Une partie où personne n'a joué disparaît ; sinon l'IA gagne et la partie reste dans l'historique.
            if (!partie.coups.length) {
              if (confirm('Abandonner cette partie qui n’a pas commencé ?')) {
                abandonnerPartieIA(partie)
                onQuitter()
              }
            } else if (confirm('Abandonner la partie ? L’IA gagne.')) onChange(abandonnerIA(partie))
          }}
        >
          Abandonner la partie
        </button>
      </Feuille>
    </div>
  )
}

const signe = (n: number) => (n > 0 ? '+' + n : String(n))

function FinDePartie({ partie, onRevanche, onQuitter }: { partie: PartieIA; onRevanche: () => void; onQuitter: () => void }) {
  const f = partie.fin!
  const profil = PROFILS[partie.niveau]
  return (
    <>
      <ContenuPanneau>
        <b style={{ fontSize: 20 }}>{f.gagnant === 'moi' ? 'Tu as gagné !' : f.gagnant === 'ia' ? `${profil.nom} a gagné` : 'Égalité'}</b>
        <span className="note">
          {f.raison === 'abandon'
            ? 'Partie abandonnée.'
            : f.raison === 'passes'
              ? 'Six tours sans mot : chacun perd la valeur de ses lettres restantes'
              : 'Le sac est vide et un chevalet aussi : les lettres restantes changent de camp'}
          {f.raison !== 'abandon' && ` (toi ${signe(f.ajustements.moi)}, IA ${signe(f.ajustements.ia)}).`}
        </span>
        <span className="note">
          Score final : toi {partie.scores.moi}, IA {partie.scores.ia}
        </span>
        {aides(partie) && <span className="note">Aides : {aides(partie)}</span>}
      </ContenuPanneau>
      {partie.coups.length > 0 && (
        <div className="actions">
          <button type="button" className="bouton large" onClick={() => naviguer('solo/ia/analyse/' + encodeURIComponent(partie.id))}>
            Analyser la partie
          </button>
        </div>
      )}
      <div className="actions">
        <button type="button" className="bouton large" onClick={onQuitter}>
          Terminer
        </button>
        <button type="button" className="bouton principal large" onClick={onRevanche}>
          Revanche
        </button>
      </div>
    </>
  )
}
