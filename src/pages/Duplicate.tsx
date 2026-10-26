// Duplicate en solo : à chaque coup, un tirage, un temps de réflexion, puis le top est posé.
// Deux modes, comme dans l'appli DupliJeu de la FFSc : l'entraînement (une partie entière, comparée aux tops) et le
// topping (le coup ne se termine que lorsqu'on a trouvé le top, avec des indices).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Apercu, Mot, useAnalyse } from '../composants/Apercu'
import { Chevalet, ChoixJoker, TuileVolante, useEdition } from '../composants/edition'
import { EnteteRetour, Feuille } from '../composants/Entete'
import { BarreJeu, BarreStatut, Chrono, ContenuPanneau, estUrgent, PanneauBas, useMasquerOnglets } from '../composants/EcranJeu'
import { IconeCrayon, IconeMelanger, IconeOk, IconeRappeler } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { motConforme } from '../jeu/lettres'
import { reference, type Coup } from '../jeu/coup'
import {
  INDICES,
  modeDe,
  nouvellePartie,
  plateauAvantCoup,
  terminerCoup,
  texteIndice,
  topTrouve,
  totaux,
  type CoupDuplicate,
  type Essai,
  type Indice,
  type ModeDuplicate,
  type PartieDuplicate,
} from '../jeu/duplicate'
import { nouvelleGraine } from '../jeu/hasard'
import { plateauDepuisTexte } from '../jeu/plateau'
import { naviguer } from '../lib/routeur'
import { chargerDico, chercherCoups } from '../moteur/moteur'
import {
  archiver,
  ecrireCoup,
  ecrirePartie,
  ecrireReglages,
  formatChrono,
  formatPct,
  formatTemps,
  lireCoup,
  lireHistorique,
  lirePartie,
  lireReglages,
  type EtatCoup,
} from '../solo/sauvegarde'

/** Temps par coup : les noms sont ceux de DupliJeu, les durées sont celles de l'appli. */
const TEMPS = [
  { secondes: 180, nom: 'Normal' },
  { secondes: 120, nom: 'Semi-rapide' },
  { secondes: 60, nom: 'Rapide' },
  { secondes: 30, nom: 'Blitz' },
  { secondes: 0, nom: 'Sans limite' },
]

const MODES: { mode: ModeDuplicate; nom: string; texte: string }[] = [
  {
    mode: 'entrainement',
    nom: 'Entraînement',
    texte:
      'Une partie entière. À chaque coup, propose ton meilleur mot : à la fin du temps ou quand tu valides, le top est posé et ton score est comparé à celui des tops.',
  },
  {
    mode: 'topping',
    nom: 'Topping',
    texte:
      'Le coup ne se termine que lorsque tu as trouvé le top, ou que le temps est écoulé. Des indices (valeur, longueur, direction, position) peuvent t’aider.',
  },
]

/** Combien d'autres bons coups on garde pour la correction. */
const NB_SOLUTIONS = 15

const REGLE_MOT = 'Le mot doit avoir au moins 2 voyelles ou 2 consonnes (le Y et l’apostrophe comptent pour les deux).'

const NOM_INDICE: Record<Indice, string> = {
  valeur: 'Valeur du top',
  longueur: 'Longueur du mot',
  direction: 'Direction',
  position: 'Case de départ',
}

export function Duplicate() {
  const [partie, setPartie] = useState<PartieDuplicate | null>(lirePartie)
  // Résultat affiché après un coup (coup null : la partie s'arrête sans coup possible).
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
      <AccueilDuplicate
        onLancer={(p) => {
          if (partie && !partie.finie && partie.coups.length) archiver({ ...partie, finie: true, courant: null })
          changer(p)
          setResultat(null)
          setPause(false)
        }}
        derniere={partie}
        onReprendre={enJeu ? () => setPause(false) : undefined}
      />
    )
  return (
    <EcranDuplicate
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

function AccueilDuplicate({ onLancer, derniere, onReprendre }: PropsAccueil) {
  const [reglages] = useState(lireReglages)
  const [temps, setTemps] = useState(reglages.temps)
  const [mode, setMode] = useState<ModeDuplicate>(reglages.mode)
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
    ecrireReglages({ temps, mode })
    ecrireCoup(null)
    const g = graine.trim().toUpperCase() || nouvelleGraine()
    onLancer(nouvellePartie(g, temps, `${g}-${Date.now()}`, mode))
  }

  return (
    <div className="contenu">
      <EnteteRetour titre="Duplicate" vers="solo" />
      {onReprendre && derniere && <EnPause partie={derniere} onReprendre={onReprendre} />}
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          À chaque coup, le même tirage de 7 lettres que pour tout le monde : trouve le meilleur mot avant la fin du temps.
          Ensuite, c’est le <b>top</b> qui est posé, et on continue avec les lettres restantes.
        </p>
        <div className="champ">
          Mode de jeu
          <div className="segments">
            {MODES.map((m) => (
              <button key={m.mode} type="button" className={mode === m.mode ? 'actif' : ''} onClick={() => setMode(m.mode)}>
                {m.nom}
              </button>
            ))}
          </div>
          <span className="note">{MODES.find((m) => m.mode === mode)?.texte}</span>
        </div>
        <div className="champ">
          Temps par coup
          <div className="segments">
            {TEMPS.map((t) => (
              <button key={t.secondes} type="button" className={temps === t.secondes ? 'actif' : ''} onClick={() => setTemps(t.secondes)}>
                {t.nom}
                <span className="note" style={{ display: 'block', fontWeight: 500, color: 'inherit', opacity: 0.8 }}>
                  {t.secondes === 0 ? '∞' : formatTemps(t.secondes)}
                </span>
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
  const topping = modeDe(partie) === 'topping'
  return (
    <div className="carte carte-accent">
      <div className="note">
        Partie en pause · {topping ? 'topping' : 'entraînement'} · coup {partie.courant?.numero ?? partie.coups.length}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>
        {topping ? `${t.trouves} / ${partie.coups.length} tops` : t.top ? formatPct(t.pourcentage) : '—'}
      </div>
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
  const topping = modeDe(partie) === 'topping'
  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="note">
        Dernière partie · {topping ? 'topping' : 'entraînement'} · graine <b>{partie.graine}</b> · {partie.coups.length} coups ·{' '}
        {formatTemps(partie.temps)}
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
          <div className="etiquette">{topping ? 'Trouvés' : 'Score'}</div>
          <div className="valeur">{topping ? `${t.trouves} / ${partie.coups.length}` : formatPct(t.pourcentage)}</div>
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

function EcranDuplicate({ partie, resultat, onFinCoup, onSuivant, onAbandon, onPause }: PropsPartie) {
  useMasquerOnglets()
  const topping = modeDe(partie) === 'topping'
  const plateau = useMemo(() => plateauDepuisTexte(partie.plateau), [partie.plateau])
  const courant = partie.courant
  const numero = courant?.numero ?? partie.coups.length
  const tirage = useMemo(() => courant?.tirage ?? [], [courant])
  // Entrée au clavier = Valider ; la fonction est donnée au hook par une référence, définie plus bas.
  const validerRef = useRef<() => void>(() => {})
  const edition = useEdition(plateau, tirage, () => validerRef.current())
  const analyse = useAnalyse(plateau, edition.poses)
  const [coup, setCoup] = useState<EtatCoup>(() => lireCoup(numero))
  const [menu, setMenu] = useState(false)
  const [feuilleIndices, setFeuilleIndices] = useState(false)
  const [calcul, setCalcul] = useState(false)
  const [message, setMessage] = useState('')
  // Le top du coup en cours, connu dès que le worker a fini sa recherche (pour les indices du topping).
  const [topConnu, setTopConnu] = useState<Coup | null>(null)
  const recherche = useRef<{ numero: number; promesse: Promise<Coup[]> } | null>(null)
  const fini = useRef(false)

  // Nouveau coup : on remet le chrono et on lance tout de suite la recherche du top dans le worker.
  useEffect(() => {
    if (!courant) return
    fini.current = false
    setCoup(lireCoup(courant.numero))
    setMessage('')
    setTopConnu(null)
    const promesse = chercherCoups(plateau, courant.tirage, NB_SOLUTIONS).then((r) => r.coups)
    promesse.catch(() => {})
    recherche.current = { numero: courant.numero, promesse }
    void promesse.then((r) => {
      if (recherche.current?.numero === courant.numero) setTopConnu(r[0] ?? null)
    }, () => {})
  }, [courant?.numero, partie.id])

  useEffect(() => ecrireCoup(coup), [coup])
  // Un message sur le coup précédent n'a plus de raison d'être dès qu'on bouge une lettre.
  useEffect(() => setMessage(''), [edition.poses])

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
      if (analyse?.valide && analyse.coup && motConforme(analyse.coup.mot) && (!joueur || analyse.points > joueur.points)) joueur = analyse.coup
      const top = coups[0] ?? null
      const suite = terminerCoup(partie, top, joueur, coups.slice(0, NB_SOLUTIONS), coup.ecoule, coup.indices, coup.essais)
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
    if (!analyse?.valide || !analyse.coup) return
    if (!motConforme(analyse.coup.mot)) return void setMessage(REGLE_MOT)
    setCoup((c) => ({ ...c, bulletin: analyse.coup! }))
  }

  // Entraînement : on valide, le coup est terminé. Topping : le coup ne se termine que si c'est le top.
  const valider = async () => {
    if (!topping) return void terminer()
    if (!analyse?.valide || !analyse.coup) {
      setMessage('Pose d’abord un mot valable.')
      return
    }
    if (!motConforme(analyse.coup.mot)) {
      setMessage(REGLE_MOT)
      return
    }
    setCalcul(true)
    try {
      const top = (await recherche.current?.promesse)?.[0]
      if (!top || analyse.points >= top.points) {
        setCalcul(false)
        void terminer()
        return
      }
      noter()
      const mot = analyse.coup.mot
      const points = analyse.points
      setCoup((c) => (c.essais.some((x) => x.mot === mot && x.points === points) ? c : { ...c, essais: [...c.essais, { mot, points, a: c.ecoule }] }))
      setMessage(`${analyse.points} points : ce n’est pas le top. Cherche encore !`)
    } catch {
      setMessage('Calcul impossible, réessaie.')
    }
    setCalcul(false)
  }

  validerRef.current = () => {
    if (!calcul && !resultat && !menu && !feuilleIndices) void valider()
  }

  const demanderIndice = (i: Indice) => {
    if (!topConnu || coup.indices.includes(i)) return
    setCoup((c) => ({ ...c, indices: [...c.indices, i] }))
  }

  // Résultat : on montre le plateau tel qu'il était avant le top, avec la solution choisie en aperçu.
  const [montre, setMontre] = useState<{ coup: Coup; style: 'apercu' | 'mien' } | null>(null)
  useEffect(() => {
    setMontre(resultat?.coup ? { coup: resultat.coup.top, style: 'apercu' } : null)
  }, [resultat])
  const plateauAvant = useMemo(
    () => (resultat?.coup ? plateauAvantCoup(partie, resultat.coup.numero) : null),
    [partie, resultat],
  )
  const apercu = useMemo(
    () => (montre ? { lettres: new Map(montre.coup.poses.map((p) => [p.pos, p.lettre])), style: montre.style } : undefined),
    [montre],
  )

  const statut = (
    <BarreStatut
      chrono={resultat ? undefined : <Chrono ecoule={coup.ecoule} total={partie.temps} />}
      texte={
        topping ? (
          <>
            <b>{t.trouves}</b> / {partie.coups.length} top{partie.coups.length > 1 ? 's' : ''}
            {partie.coups.length > 0 && ` · ${formatPct(t.pourcentage)}`}
          </>
        ) : (
          <>
            <b>{t.joueur}</b> / {t.top} pts
            {t.top > 0 && ` (${t.joueur - t.top >= 0 ? '+' : '−'}${Math.abs(t.joueur - t.top)} | ${formatPct(t.pourcentage)})`}
          </>
        )
      }
      part={topping ? (partie.coups.length ? t.trouves / partie.coups.length : 0) : t.top ? t.joueur / t.top : 0}
    />
  )

  return (
    <div className={'ecran-jeu' + (!resultat && estUrgent(coup.ecoule, partie.temps) ? ' urgent' : '')}>
      <BarreJeu
        onRetour={() => setMenu(true)}
        libelleRetour="Menu de la partie"
        titre={
          <>
            Coup {resultat?.coup?.numero ?? numero}{' '}
            <span className="sous">
              · {topping ? 'topping · ' : ''}sac {partie.sac.length} lettre{partie.sac.length > 1 ? 's' : ''}
            </span>
          </>
        }
      />
      <Plateau
        pleine
        plateau={resultat ? (plateauAvant ?? plateau) : plateau}
        poses={resultat ? undefined : edition.posesCarte}
        apercu={resultat ? apercu : undefined}
        derniers={resultat ? undefined : derniers}
        curseur={resultat ? null : edition.etat.curseur}
        cible={resultat ? null : edition.cible}
        onCase={resultat ? undefined : edition.toucherCase}
        onAppuiPose={resultat ? undefined : edition.appuiPose}
      />
      {resultat ? (
        <PanneauBas statut={statut}>
          <ContenuPanneau>
            {resultat.coup && (
              <ResultatCoup coup={resultat.coup} topping={topping} montre={montre} onMontrer={setMontre} />
            )}
            {partie.finie && <FinDePartie partie={partie} />}
          </ContenuPanneau>
          {partie.finie ? (
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
          ) : (
            <div className="actions">
              <button type="button" className="bouton principal large" onClick={onSuivant}>
                Coup suivant
              </button>
            </div>
          )}
        </PanneauBas>
      ) : (
        <>
          <Chevalet edition={edition} />
          <Apercu analyse={analyse} indice="" />
          {message && <div className="note note-centree ecart-neg">{message}</div>}
          {topping && coup.essais.length > 0 && <HistoriqueEssais essais={coup.essais} />}
          {topping && coup.indices.length > 0 && topConnu && (
            <div className="note note-centree">
              Indices : {coup.indices.map((i) => texteIndice(i, topConnu)).join(' · ')}
            </div>
          )}
          {!topping && coup.bulletin && (
            <div className="note note-centree">
              Noté : <Mot mot={coup.bulletin.mot} /> {reference(coup.bulletin.debut, coup.bulletin.dir)} · {coup.bulletin.points} pts
            </div>
          )}
          <PanneauBas statut={statut}>
            <div className="actions">
              <button type="button" className="bouton-icone" onClick={edition.melanger} aria-label="Mélanger">
                <IconeMelanger />
              </button>
              <button type="button" className="bouton-icone" onClick={edition.rappeler} aria-label="Reprendre les lettres">
                <IconeRappeler />
              </button>
              {topping ? (
                <button type="button" className="bouton contour large" onClick={() => setFeuilleIndices(true)}>
                  <IconeCrayon /> Indices{coup.indices.length > 0 && ` (${coup.indices.length})`}
                </button>
              ) : (
                <button type="button" className="bouton contour large" onClick={noter} disabled={!analyse?.valide}>
                  <IconeCrayon /> Noter
                </button>
              )}
              <button type="button" className="bouton principal large" onClick={() => void valider()} disabled={calcul}>
                <IconeOk /> {calcul ? 'Calcul…' : 'Valider'}
              </button>
            </div>
          </PanneauBas>
        </>
      )}
      <TuileVolante glisse={edition.glisse} />
      <ChoixJoker ouvert={!!edition.etat.joker} onChoix={edition.choisirLettreJoker} />

      <Feuille ouvert={feuilleIndices && !resultat} onFermer={() => setFeuilleIndices(false)}>
        <h3>Indices</h3>
        <p style={{ margin: 0 }} className="note">
          Chaque indice demandé est noté dans la correction de la partie.
        </p>
        <div className="liste">
          {INDICES.map((i) =>
            coup.indices.includes(i) && topConnu ? (
              <div className="ligne" key={i} style={{ cursor: 'default' }}>
                <div className="principal">
                  <span className="note">{NOM_INDICE[i]}</span>
                  <div style={{ fontWeight: 700 }}>{texteIndice(i, topConnu)}</div>
                </div>
              </div>
            ) : (
              <button type="button" className="ligne" key={i} disabled={!topConnu} onClick={() => demanderIndice(i)}>
                <div className="principal">
                  <div style={{ fontWeight: 700 }}>{NOM_INDICE[i]}</div>
                  <span className="note">{topConnu ? 'Toucher pour révéler' : 'Recherche du top en cours…'}</span>
                </div>
              </button>
            ),
          )}
        </div>
        <button type="button" className="bouton principal" onClick={() => setFeuilleIndices(false)}>
          Continuer à chercher
        </button>
        <button
          type="button"
          className="bouton danger"
          onClick={() => {
            if (!confirm('Renoncer à ce coup et voir le top ?')) return
            setFeuilleIndices(false)
            void terminer()
          }}
        >
          Renoncer et voir le top
        </button>
      </Feuille>

      <Feuille ouvert={menu} onFermer={() => setMenu(false)}>
        <h3>Partie en cours</h3>
        <p style={{ margin: 0 }} className="note">
          {topping ? 'Topping' : 'Entraînement'} · graine <b>{partie.graine}</b> · {formatTemps(partie.temps)} par coup · sac :{' '}
          {partie.sac.length} lettres
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

interface PropsResultat {
  coup: CoupDuplicate
  topping: boolean
  montre: { coup: Coup; style: 'apercu' | 'mien' } | null
  onMontrer: (m: { coup: Coup; style: 'apercu' | 'mien' }) => void
}

/** Après un coup : mon mot, le top et les autres bons coups. Toucher une ligne la montre sur le plateau. */
function ResultatCoup({ coup, topping, montre, onMontrer }: PropsResultat) {
  const j = coup.joueur
  const trouve = topTrouve(coup)
  const ecart = (j?.points ?? 0) - coup.top.points
  const ligne = (c: Coup, style: 'apercu' | 'mien', nom?: string) => (
    <button
      type="button"
      className={'ligne' + (montre?.coup === c ? ' choisie' : '')}
      key={nom ?? c.debut + c.mot + c.dir}
      onClick={() => onMontrer({ coup: c, style })}
    >
      <div className="principal">
        {nom && <div className="note">{nom}</div>}
        <Mot mot={c.mot} />
        <span className="ref">{reference(c.debut, c.dir)}</span>
      </div>
      <span className="pts">{c.points}</span>
    </button>
  )
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 17 }}>Coup {coup.numero}</b>
        <span className="note">
          Tirage <span className="tirage-texte">{coup.tirage.join('')}</span>
        </span>
        <b className={trouve ? 'ecart-ok' : 'ecart-neg'} style={{ marginLeft: 'auto' }}>
          {trouve
            ? topping
              ? `Top trouvé en ${formatChrono(coup.duree)}`
              : 'Top trouvé, bravo !'
            : topping && !j
              ? 'Temps écoulé'
              : `${ecart} points par rapport au top`}
        </b>
      </div>
      {topping && coup.essais && coup.essais.length > 0 && <HistoriqueEssais essais={coup.essais} />}
      {topping && coup.indices && coup.indices.length > 0 && (
        <span className="note">
          {coup.indices.length} indice{coup.indices.length > 1 ? 's' : ''} demandé{coup.indices.length > 1 ? 's' : ''}
        </span>
      )}
      <div className="liste" style={{ maxHeight: '22dvh', overflowY: 'auto' }}>
        {j ? (
          ligne(j, 'mien', 'Mon coup')
        ) : (
          <div className="ligne" style={{ cursor: 'default' }}>
            <div className="principal">
              <div className="note">Mon coup</div>
              <span className="note">Aucun mot valable</span>
            </div>
            <span className="pts">0</span>
          </div>
        )}
        {ligne(coup.top, 'apercu', 'Top')}
        {coup.autres.length > 1 && <h2>Autres bons coups</h2>}
        {coup.autres.slice(1).map((c) => ligne(c, 'apercu'))}
      </div>
    </>
  )
}

/** Mots proposés pendant le coup (topping), le plus récent en premier. */
function HistoriqueEssais({ essais }: { essais: Essai[] }) {
  return (
    <div className="historique-essais">
      <span className="note">Mots essayés ({essais.length})</span>
      {[...essais].reverse().map((e, i) => (
        <span key={i} className="essai">
          <Mot mot={e.mot} /> <b>{e.points}</b> <span className="note">· {formatChrono(e.a)}</span>
        </span>
      ))}
    </div>
  )
}

function FinDePartie({ partie }: { partie: PartieDuplicate }) {
  const t = totaux(partie)
  const topping = modeDe(partie) === 'topping'
  return (
    <div className="note" style={{ lineHeight: 1.5 }}>
      <b style={{ color: 'var(--text)' }}>Partie terminée.</b>{' '}
      {topping ? (
        <>
          {t.trouves} top{t.trouves > 1 ? 's' : ''} trouvé{t.trouves > 1 ? 's' : ''} sur {partie.coups.length}
          {t.trouves > 0 && `, en ${formatChrono(t.tempsMoyen)} en moyenne`} ; {t.joueur} points sur {t.top} ({formatPct(t.pourcentage)}).
        </>
      ) : (
        <>
          {t.joueur} points sur {t.top}, soit <b>{formatPct(t.pourcentage)}</b> du total des tops en {partie.coups.length} coups.
        </>
      )}
    </div>
  )
}
