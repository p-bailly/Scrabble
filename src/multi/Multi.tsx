// Parties à deux en différé : pseudo, liste « Mes parties », invitation, partie en cours.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { Apercu, Mot, useAnalyse } from '../composants/Apercu'
import { Chevalet, ChoixJoker, TuileVolante, useEdition } from '../composants/edition'
import { Entete, Feuille } from '../composants/Entete'
import { IconeMelanger, IconePartager, IconePlus, IconeRappeler, IconeRetour } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { MIN_SAC_POUR_CHANGER } from '../jeu/classique'
import { JOKER, valeur } from '../jeu/lettres'
import { plateauDepuisTexte } from '../jeu/plateau'
import { demanderPermission, natif } from '../lib/notifications'
import { naviguer } from '../lib/routeur'
import { ecrire, lire } from '../lib/stockage'
import { analyser } from '../moteur/moteur'
import {
  abandonner,
  autre,
  creerPartie,
  ecouterChevalet,
  ecouterCoups,
  ecouterMesParties,
  ecouterPartie,
  enregistrerPseudo,
  jouerCoup,
  lirePseudo,
  normaliserCode,
  rejoindre,
  supprimerPartie,
  verifierCoups,
  type CoupMulti,
  type Partie,
} from './donnees'
import { configuration, connexion } from './firebase'
import { demarrerVeille } from './veille'

/** Adresse publique de la version web, pour les liens d'invitation. */
const URL_WEB = 'https://p-bailly.github.io/Scrabble/'
const URL_APK = 'https://github.com/p-bailly/Scrabble/releases/latest/download/scrabble.apk'

export default function Multi({ chemin }: { chemin: string[] }) {
  if (!configuration) return <NonConfigure />
  return <AvecSession chemin={chemin} />
}

function NonConfigure() {
  return (
    <div className="contenu">
      <Entete titre="Mes parties" />
      <div className="carte" style={{ lineHeight: 1.5 }}>
        <b>Les parties à deux ne sont pas encore configurées.</b>
        <p>
          Elles passent par Firebase (offre gratuite). Il faut créer un projet Firebase puis ajouter le fichier
          <code> firebase.config.json</code> au dépôt : la procédure pas à pas est dans le README, rubrique « Parties à
          deux : créer le projet Firebase ».
        </p>
        <p className="note">Le duplicate en solo et le calculateur marchent sans rien configurer.</p>
      </div>
    </div>
  )
}

function AvecSession({ chemin }: { chemin: string[] }) {
  const [moi, setMoi] = useState<User | null>(null)
  const [pseudo, setPseudo] = useState<string | null>(() => lire<string | null>('multi.pseudo', null))
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    connexion()
      .then(async (u) => {
        setMoi(u)
        if (!lire('multi.pseudo', null)) {
          const p = await lirePseudo(u.uid).catch(() => null)
          if (p) {
            ecrire('multi.pseudo', p)
            setPseudo(p)
          }
        }
        void demarrerVeille()
      })
      .catch((e: Error) => setErreur('Connexion impossible : ' + e.message))
  }, [])

  if (erreur)
    return (
      <div className="contenu">
        <Entete titre="Mes parties" />
        <div className="apercu erreur">{erreur}</div>
        <p className="note">Vérifie ta connexion à Internet, puis rouvre l’onglet.</p>
      </div>
    )
  if (!moi) return <div className="vide-etat">Connexion…</div>
  if (!pseudo) return <ChoixPseudo uid={moi.uid} onFini={setPseudo} />

  if (chemin[0] === 'partie' && chemin[1]) return <PartieMulti code={chemin[1]} uid={moi.uid} />
  if (chemin[0] === 'rejoindre' && chemin[1]) return <Rejoindre code={normaliserCode(chemin[1])} uid={moi.uid} pseudo={pseudo} />
  return <ListeParties uid={moi.uid} pseudo={pseudo} onPseudo={() => setPseudo(null)} />
}

function ChoixPseudo({ uid, onFini }: { uid: string; onFini: (p: string) => void }) {
  const [texte, setTexte] = useState(() => lire('multi.pseudo', ''))
  const [envoi, setEnvoi] = useState(false)
  const valider = async () => {
    const p = texte.trim().slice(0, 20)
    if (!p) return
    setEnvoi(true)
    try {
      await enregistrerPseudo(uid, p)
      ecrire('multi.pseudo', p)
      onFini(p)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <div className="contenu">
      <Entete titre="Mes parties" />
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <b>Choisis ton pseudo</b>
        <span className="note">C’est le nom que verra ton adversaire.</span>
        <label className="champ">
          Pseudo
          <input value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={20} autoFocus />
        </label>
        <button type="button" className="bouton principal" disabled={!texte.trim() || envoi} onClick={() => void valider()}>
          Continuer
        </button>
      </div>
    </div>
  )
}

function ListeParties({ uid, pseudo, onPseudo }: { uid: string; pseudo: string; onPseudo: () => void }) {
  const [parties, setParties] = useState<Partie[] | null>(null)
  const [code, setCode] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => ecouterMesParties(uid, setParties, (e) => setErreur(e.message)), [uid])

  const nouvelle = async () => {
    setOccupe(true)
    setErreur('')
    try {
      void demanderPermission()
      const c = await creerPartie(uid, pseudo)
      naviguer('partie/' + c)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setOccupe(false)
    }
  }

  const date = (p: Partie) => p.majLe?.toMillis?.() ?? Date.now()
  const tri = (a: Partie, b: Partie) => date(b) - date(a)
  const liste = parties ?? []
  const aMoi = liste.filter((p) => p.etat === 'encours' && p.tour === uid).sort(tri)
  const attente = liste.filter((p) => p.etat === 'encours' && p.tour !== uid).sort(tri)
  const invitations = liste.filter((p) => p.etat === 'attente').sort(tri)
  const finies = liste.filter((p) => p.etat === 'finie').sort(tri)

  return (
    <div className="contenu">
      <Entete
        titre="Mes parties"
        droite={
          <button type="button" className="puce" onClick={onPseudo} aria-label="Changer de pseudo">
            {pseudo}
          </button>
        }
      />
      <div className="actions">
        <button type="button" className="bouton principal large" onClick={() => void nouvelle()} disabled={occupe}>
          <IconePlus /> Nouvelle partie
        </button>
      </div>
      <form
        className="actions"
        onSubmit={(e) => {
          e.preventDefault()
          if (normaliserCode(code)) naviguer('rejoindre/' + normaliserCode(code))
        }}
      >
        <input
          className="champ-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code reçu (ex. K7P2QX)"
          autoCapitalize="characters"
          aria-label="Code d’invitation"
        />
        <button type="submit" className="bouton" disabled={!normaliserCode(code)}>
          Rejoindre
        </button>
      </form>
      {erreur && <div className="apercu erreur">{erreur}</div>}
      {parties === null && <div className="vide-etat">Chargement…</div>}
      {parties && liste.length === 0 && (
        <div className="vide-etat">Aucune partie. Crée-en une et envoie le lien à un ami par SMS ou WhatsApp.</div>
      )}
      <Section titre="À toi de jouer" parties={aMoi} uid={uid} />
      <Section titre="En attente de l’adversaire" parties={attente} uid={uid} />
      <Section titre="Invitations envoyées" parties={invitations} uid={uid} />
      <Section titre="Terminées" parties={finies.slice(0, 20)} uid={uid} />
    </div>
  )
}

function Section({ titre, parties, uid }: { titre: string; parties: Partie[]; uid: string }) {
  if (parties.length === 0) return null
  return (
    <>
      <h2>{titre}</h2>
      <div className="liste">
        {parties.map((p) => (
          <LignePartie key={p.code} p={p} uid={uid} />
        ))}
      </div>
    </>
  )
}

function LignePartie({ p, uid }: { p: Partie; uid: string }) {
  const adv = autre(p, uid)
  const nom = adv ? p.pseudos[adv] : null
  const aMoi = p.etat === 'encours' && p.tour === uid
  let sousTitre = ''
  if (p.etat === 'attente') sousTitre = `Code ${p.code} · personne n’a encore rejoint`
  else if (p.dernier) {
    const qui = p.dernier.uid === uid ? 'Tu as' : (p.pseudos[p.dernier.uid] ?? '?') + ' a'
    sousTitre =
      p.dernier.type === 'mot'
        ? `${qui} joué ${p.dernier.mot?.toUpperCase()} · ${p.dernier.points} pts`
        : p.dernier.type === 'change'
          ? `${qui} changé des lettres`
          : p.dernier.type === 'abandon'
            ? `${qui} abandonné`
            : `${qui} passé`
  } else sousTitre = 'Début de partie'
  let titre = nom ? (p.etat === 'finie' ? resultat(p, uid) + ' contre ' + nom : aMoi ? nom : 'En attente de ' + nom) : 'Invitation envoyée'
  if (p.enAttente) titre += ' · envoi en attente'
  return (
    <button type="button" className={'ligne' + (aMoi ? ' choisie' : '')} onClick={() => naviguer('partie/' + p.code)}>
      <div className="avatar" style={{ background: aMoi ? 'var(--accent)' : 'var(--muted)' }}>
        {(nom ?? '?').slice(0, 1).toUpperCase()}
      </div>
      <div className="principal">
        <div style={{ fontWeight: 700 }}>{titre}</div>
        <div className="note">{sousTitre}</div>
      </div>
      {adv && (
        <div style={{ textAlign: 'right' }}>
          <div className="pts">{p.scores[uid] ?? 0}</div>
          <div className="note">{p.scores[adv] ?? 0}</div>
        </div>
      )}
    </button>
  )
}

const resultat = (p: Partie, uid: string) => (!p.fin?.gagnant ? 'Égalité' : p.fin.gagnant === uid ? 'Gagnée' : 'Perdue')

/** Lien d'invitation : la version web publiée (ou celle qu'on utilise, si on est déjà sur le web). */
function lienInvitation(code: string) {
  const baseWeb = natif || location.hostname === 'localhost' ? URL_WEB : location.origin + location.pathname
  return `${baseWeb}#/rejoindre/${code}`
}

function Invitation({ p }: { p: Partie }) {
  const lien = lienInvitation(p.code)
  const message = `Viens jouer au Scrabble avec moi ! Code ${p.code} : ${lien}`
  const [copie, setCopie] = useState(false)
  const partager = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Partie de Scrabble', text: message })
        return
      } catch {
        /* partage annulé : on garde les autres boutons */
      }
    }
    await navigator.clipboard?.writeText(message)
    setCopie(true)
  }
  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <b>Invite ton adversaire</b>
      <div className="code-invitation">{p.code}</div>
      <span className="note">
        Envoie ce lien : il ouvre l’appli Scrabble si elle est installée, sinon la version web. On peut aussi saisir le
        code dans « Mes parties ».
      </span>
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="bouton principal large" onClick={() => void partager()}>
          <IconePartager /> Partager
        </button>
        <a className="bouton large" href={'https://wa.me/?text=' + encodeURIComponent(message)} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
        <a className="bouton large" href={'sms:?&body=' + encodeURIComponent(message)}>
          SMS
        </a>
      </div>
      <button
        type="button"
        className="bouton discret"
        onClick={() => {
          void navigator.clipboard?.writeText(lien)
          setCopie(true)
        }}
      >
        {copie ? 'Copié !' : 'Copier le lien'}
      </button>
      <button
        type="button"
        className="bouton danger"
        onClick={() => {
          if (confirm('Supprimer cette invitation ?')) void supprimerPartie(p.code).then(() => naviguer('parties'))
        }}
      >
        Supprimer l’invitation
      </button>
    </div>
  )
}

function Rejoindre({ code, uid, pseudo }: { code: string; uid: string; pseudo: string }) {
  const [erreur, setErreur] = useState('')
  const android = !natif && /Android/i.test(navigator.userAgent)
  useEffect(() => {
    void demanderPermission()
    rejoindre(code, uid, pseudo)
      .then(() => naviguer('partie/' + code, true))
      .catch((e: Error) => setErreur(e.message))
  }, [code, uid, pseudo])
  const intent = `intent://rejoindre/${code}#Intent;scheme=fr.perso.scrabble;package=fr.perso.scrabble;S.browser_fallback_url=${encodeURIComponent(URL_APK)};end`
  return (
    <div className="contenu">
      <Entete titre="Rejoindre" />
      {erreur ? <div className="apercu erreur">{erreur}</div> : <div className="vide-etat">Connexion à la partie {code}…</div>}
      {android && (
        <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="note">Tu préfères l’appli Android ? Ce bouton l’ouvre si elle est installée, sinon il la télécharge.</span>
          <a className="bouton" href={intent}>
            Ouvrir dans l’appli
          </a>
        </div>
      )}
      <button type="button" className="bouton discret" onClick={() => naviguer('parties')}>
        Mes parties
      </button>
    </div>
  )
}

function PartieMulti({ code, uid }: { code: string; uid: string }) {
  const [p, setP] = useState<Partie | null | undefined>(undefined)
  const [chevalet, setChevalet] = useState<string[]>([])
  const [coups, setCoups] = useState<CoupMulti[]>([])
  const [suspects, setSuspects] = useState<Set<number>>(new Set())
  const [historique, setHistorique] = useState(false)
  const [changement, setChangement] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => ecouterPartie(code, setP), [code])
  useEffect(() => ecouterChevalet(code, uid, setChevalet), [code, uid])
  useEffect(() => ecouterCoups(code, setCoups), [code])

  // Chaque coup reçu est revérifié (mots du dictionnaire et score) quand l'historique est complet.
  useEffect(() => {
    if (!p || !coups.length || coups[coups.length - 1].n !== p.nbCoups) return
    let actuel = true
    verifierCoups(coups, p.plateau, (pl, poses) => analyser(pl, poses)).then((s) => actuel && setSuspects(s))
    return () => {
      actuel = false
    }
  }, [coups, p])

  const plateau = useMemo(() => plateauDepuisTexte(p?.plateau ?? '.'.repeat(225)), [p?.plateau])
  const edition = useEdition(plateau, chevalet)
  const analyse = useAnalyse(plateau, edition.poses)

  if (p === undefined) return <div className="vide-etat">Chargement…</div>
  if (p === null)
    return (
      <div className="contenu">
        <Retour />
        <div className="vide-etat">Cette partie n’existe pas ou plus.</div>
      </div>
    )

  const adv = autre(p, uid)
  const nomAdv = adv ? p.pseudos[adv] : '…'
  const aMoi = p.etat === 'encours' && p.tour === uid
  const derniers = new Set(coups.length ? (coups[coups.length - 1].poses ?? []).map((x) => x.pos) : [])

  const jouer = (action: Parameters<typeof jouerCoup>[3]) => {
    const err = jouerCoup(p, uid, chevalet, action)
    setMessage(err ?? '')
    if (!err) edition.rappeler()
  }

  return (
    <div className="contenu">
      <Retour droite={<button type="button" className="puce" onClick={() => setHistorique(true)}>Historique</button>} />
      {p.etat === 'attente' ? (
        <Invitation p={p} />
      ) : (
        <>
          <div className="stats">
            <div className={'stat' + (p.tour === uid ? ' accent' : '')} style={{ alignItems: 'flex-start' }}>
              <div className="etiquette">Moi</div>
              <div className="valeur">{p.scores[uid] ?? 0}</div>
            </div>
            <div className={'stat' + (p.tour === adv ? ' accent' : '')} style={{ alignItems: 'flex-start' }}>
              <div className="etiquette">{nomAdv}</div>
              <div className="valeur">{adv ? (p.scores[adv] ?? 0) : 0}</div>
            </div>
            <div className="stat">
              <div className="etiquette">Sac</div>
              <div className="valeur">{p.sac.length}</div>
            </div>
          </div>
          {p.etat === 'finie' && <Fin p={p} uid={uid} nomAdv={nomAdv} />}
          {p.etat === 'encours' && (
            <div className="note" style={{ fontWeight: 700, color: aMoi ? 'var(--accent)' : undefined }}>
              {aMoi ? 'À toi de jouer !' : `En attente de ${nomAdv}…`}
              {p.enAttente && ' · coup en attente d’envoi (hors ligne)'}
            </div>
          )}
          <Plateau
            plateau={plateau}
            poses={edition.posesCarte}
            derniers={derniers}
            curseur={aMoi ? edition.etat.curseur : null}
            cible={edition.cible}
            onCase={aMoi ? edition.toucherCase : () => false}
            onAppuiPose={edition.appuiPose}
          />
          {aMoi && <Apercu analyse={analyse} indice="Pose ton mot, puis « Jouer »." />}
          {message && <div className="apercu erreur">{message}</div>}
          <Chevalet edition={edition} />
          {aMoi && (
            <div className="actions">
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
                  if (confirm('Passer ton tour ?')) jouer({ type: 'passe' })
                }}
              >
                Passer
              </button>
              <button
                type="button"
                className="bouton principal large"
                disabled={!analyse?.valide}
                onClick={() => analyse && jouer({ type: 'mot', analyse })}
              >
                Jouer
              </button>
            </div>
          )}
          {p.etat === 'encours' && !aMoi && (
            <div className="actions">
              <button type="button" className="bouton-icone" onClick={edition.melanger} aria-label="Mélanger">
                <IconeMelanger />
              </button>
            </div>
          )}
        </>
      )}
      <TuileVolante glisse={edition.glisse} />
      <ChoixJoker ouvert={!!edition.etat.joker} onChoix={edition.choisirLettreJoker} />
      <Changement
        ouvert={changement}
        chevalet={chevalet}
        sac={p.sac.length}
        onFermer={() => setChangement(false)}
        onChanger={(lettres) => {
          setChangement(false)
          jouer({ type: 'change', lettres })
        }}
      />
      <Feuille ouvert={historique} onFermer={() => setHistorique(false)}>
        <h3>Historique</h3>
        {coups.length === 0 && <div className="note">Aucun coup pour l’instant.</div>}
        <div className="liste">
          {coups.map((c) => (
            <div className="ligne" key={c.n} style={{ cursor: 'default' }}>
              <span className="note" style={{ width: 22 }}>
                {c.n}
              </span>
              <div className="principal">
                <div className="note">{p.pseudos[c.uid] ?? '?'}</div>
                {c.type === 'mot' ? (
                  <>
                    <Mot mot={c.mot ?? ''} />
                    <span className="ref">{c.ref}</span>
                    {suspects.has(c.n) && <div className="note ecart-neg">Coup non conforme (mot ou score)</div>}
                  </>
                ) : c.type === 'change' ? (
                  <span>A changé {c.nbChanges} lettre{(c.nbChanges ?? 0) > 1 ? 's' : ''}</span>
                ) : (
                  <span>A passé</span>
                )}
              </div>
              <span className="pts">{c.points}</span>
            </div>
          ))}
        </div>
        {p.etat === 'encours' && (
          <button
            type="button"
            className="bouton danger"
            onClick={() => {
              if (confirm('Abandonner la partie ? Ton adversaire gagne.')) {
                abandonner(p, uid)
                setHistorique(false)
              }
            }}
          >
            Abandonner la partie
          </button>
        )}
      </Feuille>
    </div>
  )
}

function Fin({ p, uid, nomAdv }: { p: Partie; uid: string; nomAdv: string }) {
  const f = p.fin
  const adv = autre(p, uid)
  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <b style={{ fontSize: 20 }}>{f?.gagnant ? (f.gagnant === uid ? 'Tu as gagné !' : `${nomAdv} a gagné`) : 'Égalité'}</b>
      <span className="note">
        {f?.raison === 'abandon'
          ? 'Partie abandonnée.'
          : f?.raison === 'passes'
            ? 'Six passes de suite : chacun perd la valeur de ses lettres restantes'
            : 'Le sac est vide et un chevalet aussi : les lettres restantes changent de camp'}
        {f && f.raison !== 'abandon' && adv && ` (toi ${signe(f.ajustements[uid] ?? 0)}, ${nomAdv} ${signe(f.ajustements[adv] ?? 0)}).`}
      </span>
    </div>
  )
}

const signe = (n: number) => (n > 0 ? '+' + n : String(n))

function Changement({
  ouvert,
  chevalet,
  sac,
  onFermer,
  onChanger,
}: {
  ouvert: boolean
  chevalet: string[]
  sac: number
  onFermer: () => void
  onChanger: (lettres: string[]) => void
}) {
  const [choix, setChoix] = useState<Set<number>>(new Set())
  useEffect(() => setChoix(new Set()), [ouvert])
  const possible = sac >= MIN_SAC_POUR_CHANGER
  return (
    <Feuille ouvert={ouvert} onFermer={onFermer}>
      <h3>Changer des lettres</h3>
      {possible ? (
        <span className="note">Touche les lettres à remettre dans le sac. Tu passes ton tour.</span>
      ) : (
        <span className="note ecart-neg">Il faut au moins 7 lettres dans le sac pour changer (il en reste {sac}).</span>
      )}
      <div className="chevalet">
        {chevalet.map((l, i) => (
          <div className="emplacement" key={i}>
            <button
              type="button"
              className={'tuile' + (choix.has(i) ? ' marquee' : '')}
              onClick={() => {
                const c = new Set(choix)
                if (c.has(i)) c.delete(i)
                else c.add(i)
                setChoix(c)
              }}
              aria-pressed={choix.has(i)}
              aria-label={l === JOKER ? 'Joker' : l}
            >
              {l === JOKER ? '' : l}
              {l !== JOKER && <span className="points">{valeur(l)}</span>}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bouton principal"
        disabled={!possible || choix.size === 0}
        onClick={() => onChanger([...choix].map((i) => chevalet[i]))}
      >
        Changer {choix.size || ''} lettre{choix.size > 1 ? 's' : ''}
      </button>
    </Feuille>
  )
}

function Retour({ droite }: { droite?: ReactNode }) {
  return (
    <header className="entete">
      <button type="button" className="bouton-icone" onClick={() => naviguer('parties')} aria-label="Mes parties">
        <IconeRetour />
      </button>
      <h1>Partie</h1>
      {droite}
    </header>
  )
}
