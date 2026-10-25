// Duplicate en solo : à chaque coup, un tirage, un temps de réflexion, puis le top est posé.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Apercu, Mot, useAnalyse } from '../composants/Apercu'
import { Chevalet, ChoixJoker, TuileVolante, useEdition } from '../composants/edition'
import { Entete, Feuille } from '../composants/Entete'
import { AnneauChrono, BarreJeu, PanneauBas, useMasquerOnglets } from '../composants/EcranJeu'
import { IconeMelanger, IconeRappeler } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { reference, type Coup } from '../jeu/coup'
import { nouvellePartie, terminerCoup, totaux, type CoupDuplicate, type PartieDuplicate } from '../jeu/duplicate'
import { nouvelleGraine } from '../jeu/hasard'
import { plateauDepuisTexte } from '../jeu/plateau'
import { naviguer } from '../lib/routeur'
import { chargerDico, chercherCoups } from '../moteur/moteur'
import {
  archiver,
  ecrireCoup,
  ecrirePartie,
  ecrireReglages,
  formatPct,
  formatTemps,
  lireCoup,
  lireHistorique,
  lirePartie,
  lireReglages,
  type EtatCoup,
} from '../solo/sauvegarde'

const DUREES = [60, 120, 180, 0]

export function Solo() {
  const [partie, setPartie] = useState<PartieDuplicate | null>(lirePartie)
  // Feuille de résultat affichée après un coup (coup null : la partie s'arrête sans coup possible).
  const [resultat, setResultat] = useState<{ coup: CoupDuplicate | null } | null>(null)

  const changer = useCallback((p: PartieDuplicate | null) => {
    setPartie(p)
    ecrirePartie(p)
  }, [])

  // Partie mise en pause : on revient à l'accueil du duplicate, qui propose de la reprendre.
  const [pause, setPause] = useState(false)

  const enJeu = partie && (!partie.finie || resultat)
  if (!enJeu || pause)
    return (
      <AccueilSolo
        onLancer={(p) => {
          if (partie && !partie.finie && partie.coups.length) archiver({ ...partie, finie: true, courant: null })
          changer(p)
          setPause(false)
        }}
        derniere={partie}
        onReprendre={enJeu ? () => setPause(false) : undefined}
      />
    )
  return (
    <PartieSolo
      partie={partie}
      resultat={resultat}
      onFinCoup={(p, r) => {
        changer(p)
        if (p.finie) archiver(p)
        setResultat({ coup: r })
      }}
      onSuivant={() => setResultat(null)}
      onAbandon={() => {
        if (partie.coups.length) archiver({ ...partie, finie: true, courant: null })
        changer(null)
        setResultat(null)
      }}
      onPause={() => setPause(true)}
    />
  )
}

interface PropsAccueil {
  onLancer: (p: PartieDuplicate) => void
  derniere: PartieDuplicate | null
  /** Présent quand une partie est en pause. */
  onReprendre?: () => void
}

function AccueilSolo({ onLancer, derniere, onReprendre }: PropsAccueil) {
  const [temps, setTemps] = useState(() => lireReglages().temps)
  const [graine, setGraine] = useState('')
  const [dico, setDico] = useState<string>('')
  const precedente = derniere?.finie ? derniere : lireHistorique()[0]

  useEffect(() => {
    chargerDico()
      .then((d) => setDico(`${d.nom} · ${d.nbMots.toLocaleString('fr-FR')} mots`))
      .catch((e: Error) => setDico('Dictionnaire indisponible : ' + e.message))
  }, [])

  const lancer = () => {
    if (onReprendre && !confirm('Abandonner la partie en pause pour en commencer une autre ?')) return
    ecrireReglages({ temps })
    ecrireCoup(null)
    const g = graine.trim().toUpperCase() || nouvelleGraine()
    onLancer(nouvellePartie(g, temps, `${g}-${Date.now()}`))
  }

  return (
    <div className="contenu">
      <Entete droite={<span className="puce">Duplicate</span>} />
      {onReprendre && derniere && <EnPause partie={derniere} onReprendre={onReprendre} />}
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          À chaque coup, un tirage de 7 lettres : trouve le meilleur mot avant la fin du temps. Ensuite, c’est le
          <b> top</b> qui est posé, et on continue avec les lettres restantes.
        </p>
        <div className="champ">
          Temps par coup
          <div className="segments">
            {DUREES.map((d) => (
              <button key={d} type="button" className={temps === d ? 'actif' : ''} onClick={() => setTemps(d)}>
                {d === 0 ? '∞' : `${d / 60} min`}
              </button>
            ))}
          </div>
        </div>
        <label className="champ">
          Graine (facultatif)
          <input
            value={graine}
            onChange={(e) => setGraine(e.target.value)}
            placeholder="Au hasard"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={24}
          />
          <span className="note">Une même graine redonne les mêmes tirages : pratique pour rejouer une partie ou défier un ami.</span>
        </label>
        <button type="button" className="bouton principal" onClick={lancer}>
          Nouvelle partie
        </button>
        <span className="note">{dico || 'Chargement du dictionnaire…'}</span>
      </div>
      {precedente && precedente.coups.length > 0 && <Bilan partie={precedente} />}
    </div>
  )
}

function EnPause({ partie, onReprendre }: { partie: PartieDuplicate; onReprendre: () => void }) {
  const t = totaux(partie)
  return (
    <div className="carte carte-accent">
      <div className="note">Partie en pause · coup {partie.courant?.numero ?? partie.coups.length}</div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>{t.top ? formatPct(t.pourcentage) : '—'}</div>
      <div className="note">
        {t.joueur} / {t.top} points · graine {partie.graine}
      </div>
      <button type="button" className="bouton" onClick={onReprendre}>
        Reprendre
      </button>
    </div>
  )
}

function Bilan({ partie }: { partie: PartieDuplicate }) {
  const t = totaux(partie)
  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="note">
        Dernière partie · graine <b>{partie.graine}</b> · {partie.coups.length} coups · {formatTemps(partie.temps)}
      </div>
      <div className="stats">
        <div className="stat" style={{ background: 'var(--surface-2)' }}>
          <div className="etiquette">Moi</div>
          <div className="valeur">{t.joueur}</div>
        </div>
        <div className="stat" style={{ background: 'var(--surface-2)' }}>
          <div className="etiquette">Tops</div>
          <div className="valeur">{t.top}</div>
        </div>
        <div className="stat" style={{ background: 'var(--surface-2)' }}>
          <div className="etiquette">Score</div>
          <div className="valeur">{formatPct(t.pourcentage)}</div>
        </div>
      </div>
      <button type="button" className="bouton discret" onClick={() => naviguer('correction/' + encodeURIComponent(partie.id))}>
        Voir la correction
      </button>
    </div>
  )
}

interface PropsPartie {
  partie: PartieDuplicate
  resultat: { coup: CoupDuplicate | null } | null
  onFinCoup: (p: PartieDuplicate, r: CoupDuplicate | null) => void
  onSuivant: () => void
  onAbandon: () => void
  onPause: () => void
}

function PartieSolo({ partie, resultat, onFinCoup, onSuivant, onAbandon, onPause }: PropsPartie) {
  useMasquerOnglets()
  const plateau = useMemo(() => plateauDepuisTexte(partie.plateau), [partie.plateau])
  const courant = partie.courant
  const numero = courant?.numero ?? partie.coups.length
  const tirage = useMemo(() => courant?.tirage ?? [], [courant])
  const edition = useEdition(plateau, tirage)
  const analyse = useAnalyse(plateau, edition.poses)
  const [coup, setCoup] = useState<EtatCoup>(() => lireCoup(numero))
  const [menu, setMenu] = useState(false)
  const [calcul, setCalcul] = useState(false)
  const recherche = useRef<{ numero: number; promesse: Promise<Coup[]> } | null>(null)
  const fini = useRef(false)

  // Nouveau coup : on remet le chrono et on lance tout de suite la recherche du top dans le worker.
  useEffect(() => {
    if (!courant) return
    fini.current = false
    setCoup(lireCoup(courant.numero))
    const promesse = chercherCoups(plateau, courant.tirage, 30).then((r) => r.coups)
    promesse.catch(() => {})
    recherche.current = { numero: courant.numero, promesse }
  }, [courant?.numero, partie.id])

  useEffect(() => ecrireCoup(coup), [coup])

  const derniers = useMemo(() => {
    const d = partie.coups.at(-1)
    return new Set(d ? d.top.poses.map((p) => p.pos) : [])
  }, [partie.coups])

  const terminer = useCallback(async () => {
    if (fini.current || !courant || !recherche.current) return
    fini.current = true
    setCalcul(true)
    try {
      const coups = await recherche.current.promesse
      let joueur = coup.bulletin
      if (analyse?.valide && analyse.coup && (!joueur || analyse.points > joueur.points)) joueur = analyse.coup
      const top = coups[0] ?? null
      const suite = terminerCoup(partie, top, joueur, coups.slice(0, 12), coup.ecoule)
      ecrireCoup(null)
      onFinCoup(suite, top ? suite.coups.at(-1)! : null)
    } catch {
      fini.current = false
    } finally {
      setCalcul(false)
    }
  }, [analyse, coup, courant, onFinCoup, partie])

  // Chrono : une seconde de plus tant que l'appli est visible et qu'aucune fenêtre (résultat, menu) n'est ouverte.
  useEffect(() => {
    if (!courant || resultat || menu) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setCoup((c) => ({ ...c, ecoule: c.ecoule + 1 }))
    }, 1000)
    return () => clearInterval(id)
  }, [courant, resultat, menu])

  const reste = partie.temps ? Math.max(0, partie.temps - coup.ecoule) : null
  useEffect(() => {
    if (reste === 0 && !resultat) void terminer()
  }, [reste, resultat, terminer])

  const t = totaux(partie)
  const noter = () => {
    if (analyse?.valide && analyse.coup) setCoup((c) => ({ ...c, bulletin: analyse.coup! }))
  }

  return (
    <div className="ecran-jeu">
      <BarreJeu
        onRetour={() => setMenu(true)}
        libelleRetour="Menu de la partie"
        titre={
          <>
            Coup {numero} <span className="sous">· sac {partie.sac.length} lettre{partie.sac.length > 1 ? 's' : ''}</span>
          </>
        }
        progression={{
          gauche: (
            <>
              <b>{t.joueur}</b> / {t.top}
            </>
          ),
          part: t.top ? t.joueur / t.top : 0,
          droite: <span className="fort">{t.top ? `${Math.round(t.pourcentage)} %` : '—'}</span>,
        }}
        droite={<AnneauChrono ecoule={coup.ecoule} total={partie.temps} />}
      />
      <Plateau
        pleine
        plateau={plateau}
        poses={edition.posesCarte}
        derniers={derniers}
        curseur={edition.etat.curseur}
        cible={edition.cible}
        onCase={edition.toucherCase}
        onAppuiPose={edition.appuiPose}
      />
      <Apercu analyse={analyse} indice="Touche une case puis tes lettres, ou glisse-les." />
      {coup.bulletin && (
        <div className="note note-centree">
          Noté : <Mot mot={coup.bulletin.mot} /> {reference(coup.bulletin.debut, coup.bulletin.dir)} · {coup.bulletin.points} pts
        </div>
      )}
      <PanneauBas>
        <Chevalet edition={edition} />
        <div className="actions">
          <button type="button" className="bouton-icone" onClick={edition.melanger} aria-label="Mélanger">
            <IconeMelanger />
          </button>
          <button type="button" className="bouton-icone" onClick={edition.rappeler} aria-label="Reprendre les lettres">
            <IconeRappeler />
          </button>
          <button type="button" className="bouton contour large" onClick={noter} disabled={!analyse?.valide}>
            Noter
          </button>
          <button type="button" className="bouton principal large" onClick={() => void terminer()} disabled={calcul}>
            {calcul ? 'Calcul…' : 'Valider'}
          </button>
        </div>
      </PanneauBas>
      <TuileVolante glisse={edition.glisse} />
      <ChoixJoker ouvert={!!edition.etat.joker} onChoix={edition.choisirLettreJoker} />

      <Feuille ouvert={!!resultat}>
        {resultat?.coup && <ResultatCoup coup={resultat.coup} />}
        {partie.finie && (
          <>
            <h3>Partie terminée</h3>
            <p style={{ margin: 0 }}>
              {t.joueur} points sur {t.top}, soit <b>{formatPct(t.pourcentage)}</b> du total des tops en {partie.coups.length} coups.
            </p>
            <div className="actions">
              <button
                type="button"
                className="bouton large"
                onClick={() => {
                  onSuivant()
                  naviguer('correction/' + encodeURIComponent(partie.id))
                }}
              >
                Correction
              </button>
              <button type="button" className="bouton principal large" onClick={onSuivant}>
                Terminer
              </button>
            </div>
          </>
        )}
        {resultat && !partie.finie && (
          <button type="button" className="bouton principal" onClick={onSuivant}>
            Coup suivant
          </button>
        )}
      </Feuille>

      <Feuille ouvert={menu} onFermer={() => setMenu(false)}>
        <h3>Partie en cours</h3>
        <p style={{ margin: 0 }} className="note">
          Graine <b>{partie.graine}</b> · {formatTemps(partie.temps)} par coup · sac : {partie.sac.length} lettres
        </p>
        <button type="button" className="bouton principal" onClick={() => setMenu(false)}>
          Reprendre
        </button>
        <button type="button" className="bouton" onClick={onPause}>
          Mettre en pause
        </button>
        <button
          type="button"
          className="bouton"
          onClick={() => {
            setMenu(false)
            naviguer('correction/courante')
          }}
        >
          Correction des coups joués
        </button>
        <button
          type="button"
          className="bouton danger"
          onClick={() => {
            setMenu(false)
            if (confirm('Abandonner la partie ? Elle sera rangée dans l’historique.')) onAbandon()
          }}
        >
          Abandonner la partie
        </button>
      </Feuille>
    </div>
  )
}

function ResultatCoup({ coup }: { coup: CoupDuplicate }) {
  const j = coup.joueur
  const ecart = (j?.points ?? 0) - coup.top.points
  return (
    <>
      <h3>Coup {coup.numero}</h3>
      <div className="note">
        Tirage <span className="tirage-texte">{coup.tirage.join('')}</span>
      </div>
      <div className="liste">
        <div className="ligne">
          <div className="principal">
            <div className="note">Ton coup</div>
            {j ? (
              <>
                <Mot mot={j.mot} />
                <span className="ref">{reference(j.debut, j.dir)}</span>
              </>
            ) : (
              <span className="note">Aucun mot valable</span>
            )}
          </div>
          <span className="pts">{j?.points ?? 0}</span>
        </div>
        <div className="ligne">
          <div className="principal">
            <div className="note">Top</div>
            <Mot mot={coup.top.mot} />
            <span className="ref">{reference(coup.top.debut, coup.top.dir)}</span>
          </div>
          <span className="pts">{coup.top.points}</span>
        </div>
      </div>
      <p style={{ margin: 0, fontWeight: 700 }} className={ecart >= 0 ? 'ecart-ok' : 'ecart-neg'}>
        {ecart >= 0 ? 'Top trouvé, bravo !' : `${ecart} points par rapport au top`}
      </p>
      {coup.autres.length > 1 && (
        <>
          <h2>Autres bons coups</h2>
          <div className="liste">
            {coup.autres.slice(1, 6).map((c, i) => (
              <div className="ligne" key={i}>
                <div className="principal">
                  <Mot mot={c.mot} />
                  <span className="ref">{reference(c.debut, c.dir)}</span>
                </div>
                <span className="pts">{c.points}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
