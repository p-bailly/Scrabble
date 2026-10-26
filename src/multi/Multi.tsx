// Parties à deux en différé : pseudo, liste « Mes parties », invitation, partie en cours.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { Apercu, Mot, useAnalyse } from '../composants/Apercu'
import { Changement } from '../composants/Changement'
import { DefinitionMot } from '../composants/Definition'
import { Chevalet, ChoixJoker, TuileVolante, useEdition } from '../composants/edition'
import { Entete, Feuille } from '../composants/Entete'
import { BarreJeu, BarreStatut, ColonneJeu, PanneauBas, useMasquerOnglets } from '../composants/EcranJeu'
import { IconeHistorique, IconeMelanger, IconeMenu, IconePartager, IconePlus, IconeRappeler, IconeRetour } from '../composants/Icones'
import { Plateau } from '../composants/Plateau'
import { BoutonSac, Sac } from '../composants/Sac'
import { FeuilleVerifier } from '../composants/VerifierMot'
import { lettresNonVues } from '../jeu/classique'
import { plateauDepuisTexte } from '../jeu/plateau'
import { ADRESSE_WEB, URL_APK } from '../lib/adresses'
import { demanderPermission, natif, notificationsAutorisees } from '../lib/notifications'
import { lireReglages } from '../lib/reglages'
import { naviguer } from '../lib/routeur'
import { ecrire, lire } from '../lib/stockage'
import { ilYa, joursEcoules } from '../lib/temps'
import { analyser } from '../moteur/moteur'
import {
  abandonner,
  adversairesRecents,
  annulerInvitation,
  autre,
  chercherJoueurs,
  cleRecherche,
  creerPartie,
  ecouterChevalet,
  ecouterCoups,
  ecouterInvitations,
  ecouterMesParties,
  ecouterPartie,
  enregistrerPseudo,
  inviter,
  jouerCoup,
  lireJoueur,
  messageErreur,
  MIN_RECHERCHE,
  normaliserCode,
  refuserInvitation,
  rejoindre,
  supprimerPartie,
  verifierCoups,
  type CoupMulti,
  type JoueurTrouve,
  type Partie,
} from './donnees'
import { configuration, connexion } from './firebase'
import AnalyseMulti from './AnalyseMulti'
import { demarrerSynchro } from './synchro'
import { demarrerVeille } from './veille'

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
        <p className="note">Le duplicate en solo et le dictionnaire marchent sans rien configurer.</p>
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
          const j = await lireJoueur(u.uid).catch(() => null)
          if (j) {
            ecrire('multi.pseudo', j.pseudo)
            setPseudo(j.pseudo)
          }
        }
        void demarrerVeille()
        void demarrerSynchro()
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

  if (chemin[0] === 'partie' && chemin[1] && chemin[2] === 'analyse') return <AnalyseMulti code={chemin[1]} uid={moi.uid} />
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
  const [recues, setRecues] = useState<Partie[]>([])
  const [code, setCode] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  // Parties terminées que j'ai retirées de ma liste (elles restent chez l'adversaire et dans le bilan).
  const [masquees, setMasquees] = useState<string[]>(() => lire<string[]>('multi.masquees', []))
  const masquer = (code: string) => {
    const suite = [...masquees, code]
    setMasquees(suite)
    ecrire('multi.masquees', suite)
  }

  useEffect(() => ecouterMesParties(uid, setParties, (e) => setErreur(e.message)), [uid])
  // Une erreur ici (règles Firestore pas encore à jour) ne doit pas gâcher le reste de l'écran : pas d'invitations, c'est tout.
  useEffect(() => ecouterInvitations(uid, setRecues, (e) => console.warn('Invitations indisponibles', e)), [uid])

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
      <RappelNotifications />
      {parties === null && <div className="vide-etat">Chargement…</div>}
      {parties && liste.length === 0 && recues.length === 0 && (
        <div className="vide-etat">Aucune partie. Crée-en une, puis invite un joueur de l’appli ou envoie le lien à un ami par SMS ou WhatsApp.</div>
      )}
      {recues.length > 0 && (
        <>
          <h2>Invitations reçues</h2>
          <div className="liste">
            {recues.map((p) => (
              <LigneInvitation key={p.code} p={p} uid={uid} pseudo={pseudo} />
            ))}
          </div>
        </>
      )}
      <Section titre="À toi de jouer" parties={aMoi} uid={uid} onErreur={setErreur} onMasquer={masquer} />
      <Section titre="En attente de l’adversaire" parties={attente} uid={uid} onErreur={setErreur} onMasquer={masquer} />
      <Section titre="Invitations envoyées" parties={invitations} uid={uid} onErreur={setErreur} onMasquer={masquer} />
      <Section titre="Terminées" parties={finies.filter((p) => !masquees.includes(p.code)).slice(0, 20)} uid={uid} onErreur={setErreur} onMasquer={masquer} />
    </div>
  )
}

/**
 * Rappel tant que les notifications sont voulues mais pas autorisées par le système. Sans lui, un joueur qui n'a jamais
 * créé ni rejoint de partie ne les aurait pas encore demandées quand arrive sa première invitation.
 */
function RappelNotifications() {
  // undefined : on ne sait pas encore ; null : cet appareil n'en propose pas.
  const [autorisees, setAutorisees] = useState<boolean | null | undefined>(undefined)
  const [ecarte, setEcarte] = useState(() => lire('multi.rappelNotifications', false))
  const [refuse, setRefuse] = useState(false)
  useEffect(() => {
    void notificationsAutorisees().then(setAutorisees)
  }, [])
  if (ecarte || autorisees !== false || !lireReglages().notifications) return null

  const autoriser = async () => {
    await demanderPermission()
    const ok = await notificationsAutorisees()
    setAutorisees(ok)
    setRefuse(!ok)
  }
  return (
    <div className="carte carte-accent">
      <b>Être prévenu quand c’est ton tour</b>
      <span className="note">Autorise les notifications pour recevoir les invitations et les coups de tes adversaires.</span>
      {refuse && (
        <span className="note">Le système a refusé : ouvre les réglages du téléphone (ou du navigateur), rubrique Notifications de Scrabble, et autorise-les.</span>
      )}
      <div className="actions">
        <button
          type="button"
          className="bouton large"
          onClick={() => {
            ecrire('multi.rappelNotifications', true)
            setEcarte(true)
          }}
        >
          Masquer
        </button>
        <button type="button" className="bouton large" onClick={() => void autoriser()}>
          Autoriser
        </button>
      </div>
    </div>
  )
}

interface ActionsListe {
  onErreur: (message: string) => void
  onMasquer: (code: string) => void
}

function Section({ titre, parties, uid, ...actions }: { titre: string; parties: Partie[]; uid: string } & ActionsListe) {
  if (parties.length === 0) return null
  return (
    <>
      <h2>{titre}</h2>
      <div className="liste">
        {parties.map((p) => (
          <LignePartie key={p.code} p={p} uid={uid} {...actions} />
        ))}
      </div>
    </>
  )
}

/** Invitation reçue : on l'accepte (la partie commence) ou on la refuse (le créateur en est informé). */
function LigneInvitation({ p, uid, pseudo }: { p: Partie; uid: string; pseudo: string }) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const nom = p.pseudos[p.createur] ?? 'Un joueur'
  const repondre = async (action: () => Promise<void>) => {
    setOccupe(true)
    setErreur('')
    try {
      await action()
    } catch (e) {
      setErreur(messageErreur(e))
      setOccupe(false)
    }
  }
  const accepter = () =>
    repondre(async () => {
      void demanderPermission()
      await rejoindre(p.code, uid, pseudo)
      naviguer('partie/' + p.code)
    })
  return (
    <div className="ligne choisie" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="avatar" style={{ background: 'var(--accent)' }}>
          {nom.slice(0, 1).toUpperCase()}
        </div>
        <div className="principal">
          <div style={{ fontWeight: 700 }}>{nom} t’invite à jouer</div>
          <div className="note">Partie à deux · {nom} commence</div>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="bouton large" disabled={occupe} onClick={() => void repondre(() => refuserInvitation(p.code, uid))}>
          Refuser
        </button>
        <button type="button" className="bouton principal large" disabled={occupe} onClick={() => void accepter()}>
          Accepter
        </button>
      </div>
      {erreur && <div className="apercu erreur">{erreur}</div>}
    </div>
  )
}

/** Sans réponse de l'adversaire depuis ce nombre de jours, la liste le dit : on peut abandonner. */
const JOURS_SANS_REPONSE = 14

function LignePartie({ p, uid, onErreur, onMasquer }: { p: Partie; uid: string } & ActionsListe) {
  const adv = autre(p, uid)
  const nom = adv ? p.pseudos[adv] : null
  const aMoi = p.etat === 'encours' && p.tour === uid
  // Partie en attente : l'invité, s'il y en a un, a un nom ; sinon on attend quelqu'un qui aura le code.
  const invite = p.etat === 'attente' ? p.invites?.[0] : undefined
  const nomInvite = invite ? p.pseudos[invite] : undefined
  let sousTitre = ''
  if (p.etat === 'attente')
    sousTitre = `Code ${p.code} · ${nomInvite ? 'en attente de sa réponse' : p.refus?.length ? 'invitation refusée' : 'personne n’a encore rejoint'}`
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
  const depuis = p.majLe?.toMillis?.() ?? Date.now()
  const sansReponse = p.etat === 'encours' && !aMoi && joursEcoules(depuis) >= JOURS_SANS_REPONSE
  sousTitre += ' · ' + ilYa(depuis)
  let titre = nom
    ? p.etat === 'finie'
      ? resultat(p, uid) + ' contre ' + nom
      : aMoi
        ? nom
        : 'En attente de ' + nom
    : nomInvite
      ? 'Invitation envoyée à ' + nomInvite
      : 'Invitation envoyée'
  if (p.enAttente) titre += ' · envoi en attente'

  // Le bouton × : abandonner une partie en cours, supprimer une invitation envoyée, retirer une partie terminée de la liste.
  const sortir = () => {
    if (p.etat === 'encours') {
      if (confirm(`Abandonner la partie contre ${nom ?? 'ton adversaire'} ? ${nom ?? 'Ton adversaire'} gagne.`)) abandonner(p, uid, onErreur)
    } else if (p.etat === 'attente') {
      if (confirm('Supprimer cette invitation ?')) void supprimerPartie(p.code).catch((e) => onErreur(messageErreur(e)))
    } else if (confirm('Retirer cette partie de la liste ?')) onMasquer(p.code)
  }
  const libelleSortie = p.etat === 'encours' ? 'Abandonner la partie' : p.etat === 'attente' ? 'Supprimer l’invitation' : 'Retirer de la liste'

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button type="button" className={'ligne' + (aMoi ? ' choisie' : '')} onClick={() => naviguer('partie/' + p.code)}>
        <div className="avatar" style={{ background: aMoi ? 'var(--accent)' : 'var(--muted)' }}>
          {(nom ?? nomInvite ?? '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="principal">
          <div style={{ fontWeight: 700 }}>{titre}</div>
          <div className={'note' + (sansReponse ? ' ecart-neg' : '')}>{sousTitre}</div>
          {sansReponse && <div className="note ecart-neg">Pas de réponse depuis longtemps : tu peux abandonner.</div>}
        </div>
        {adv && (
          <div style={{ textAlign: 'right' }}>
            <div className="pts">{p.scores[uid] ?? 0}</div>
            <div className="note">{p.scores[adv] ?? 0}</div>
          </div>
        )}
      </button>
      <button type="button" className="bouton-icone" aria-label={libelleSortie} title={libelleSortie} onClick={sortir} style={{ height: 'auto' }}>
        ×
      </button>
    </div>
  )
}

const resultat = (p: Partie, uid: string) => (!p.fin?.gagnant ? 'Égalité' : p.fin.gagnant === uid ? 'Gagnée' : 'Perdue')

/** Lien d'invitation : la version web publiée (ou celle qu'on utilise, si on est déjà sur le web). */
function lienInvitation(code: string) {
  const baseWeb = natif || location.hostname === 'localhost' ? ADRESSE_WEB : location.origin + location.pathname
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
      <b>Ou envoie le lien</b>
      <div className="code-invitation">{p.code}</div>
      <span className="note">
        Pour quelqu’un qui n’a pas encore l’appli, ou que tu ne trouves pas ci-dessus : le lien ouvre l’appli Scrabble si
        elle est installée, sinon la version web. On peut aussi saisir le code dans « Mes parties ».
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

/**
 * Inviter directement un joueur de l'appli : on tape son pseudo (ou on touche un adversaire déjà rencontré), il reçoit
 * l'invitation dans « Mes parties » et l'accepte ou la refuse. Un seul invité à la fois : un nouveau remplace l'ancien.
 */
function InviterJoueur({ p, uid }: { p: Partie; uid: string }) {
  const [texte, setTexte] = useState('')
  const [trouves, setTrouves] = useState<JoueurTrouve[] | null>(null)
  const [recents, setRecents] = useState<JoueurTrouve[]>([])
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  // Adversaires déjà rencontrés : proposés d'un toucher, sans rien taper.
  useEffect(() => ecouterMesParties(uid, (parties) => setRecents(adversairesRecents(parties, uid).slice(0, 6))), [uid])

  // Recherche au fil de la frappe, après une courte pause.
  useEffect(() => {
    if (cleRecherche(texte).length < MIN_RECHERCHE) {
      setTrouves(null)
      return
    }
    let actuel = true
    const minuteur = setTimeout(() => {
      chercherJoueurs(texte, uid)
        .then((r) => {
          if (!actuel) return
          setTrouves(r)
          setErreur('')
        })
        .catch((e) => actuel && setErreur(messageErreur(e)))
    }, 300)
    return () => {
      actuel = false
      clearTimeout(minuteur)
    }
  }, [texte, uid])

  const invite = p.invites?.[0]
  const refuse = p.refus?.[p.refus.length - 1]
  const agir = async (action: () => Promise<void>) => {
    setOccupe(true)
    setErreur('')
    try {
      await action()
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(false)
    }
  }
  const choisir = (j: JoueurTrouve) => {
    if (j.uid !== invite) void agir(() => inviter(p, j))
  }

  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <b>Inviter un joueur</b>
      {invite ? (
        <div className="liste">
          <div className="ligne choisie" style={{ cursor: 'default' }}>
            <div className="principal">
              <div style={{ fontWeight: 700 }}>Invitation envoyée à {p.pseudos[invite] ?? '?'}</div>
              <div className="note">Elle la trouvera dans « Mes parties » et te préviendra en l’acceptant.</div>
            </div>
            <button type="button" className="bouton discret" disabled={occupe} onClick={() => void agir(() => annulerInvitation(p))}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        refuse && <span className="note ecart-neg">{p.pseudos[refuse] ?? 'Le joueur'} a refusé ton invitation.</span>
      )}
      {recents.length > 0 && (
        <div className="champ">
          Joué récemment
          <div className="segments">
            {recents.map((j) => (
              <button key={j.uid} type="button" className={j.uid === invite ? 'actif' : ''} disabled={occupe} onClick={() => choisir(j)}>
                {j.pseudo}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="champ">
        Chercher un joueur
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Son pseudo"
          maxLength={20}
          autoComplete="off"
          autoCapitalize="none"
        />
      </label>
      {trouves &&
        (trouves.length === 0 ? (
          <span className="note">
            Personne ne s’appelle comme ça. Il n’a peut-être pas encore de compte, ou ne veut pas être trouvé : envoie-lui le lien ci-dessous.
          </span>
        ) : (
          <div className="liste">
            {trouves.map((j) => (
              <button key={j.uid} type="button" className={'ligne' + (j.uid === invite ? ' choisie' : '')} disabled={occupe} onClick={() => choisir(j)}>
                <div className="avatar" style={{ background: 'var(--accent)' }}>
                  {j.pseudo.slice(0, 1).toUpperCase()}
                </div>
                <div className="principal" style={{ fontWeight: 700 }}>
                  {j.pseudo}
                </div>
                <span className="note">{j.uid === invite ? 'Invité' : 'Inviter'}</span>
              </button>
            ))}
          </div>
        ))}
      {erreur && <div className="apercu erreur">{erreur}</div>}
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
  const [feuilleSac, setFeuilleSac] = useState(false)
  const [feuilleVerifier, setFeuilleVerifier] = useState(false)
  // Coup de l'historique dont on lit la définition (numéro du coup).
  const [defOuverte, setDefOuverte] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
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
  // Pas d'onglets pendant une partie commencée (ils restent pour l'invitation).
  useMasquerOnglets(!!p && p.etat !== 'attente')
  const edition = useEdition(plateau, chevalet)
  const analyse = useAnalyse(plateau, edition.poses)
  const nonVues = useMemo(() => lettresNonVues(plateau, chevalet), [plateau, chevalet])

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
    const err = jouerCoup(p, uid, chevalet, action, setMessage)
    setMessage(err ?? '')
    if (!err) edition.rappeler()
  }

  const moi = p.scores[uid] ?? 0
  const lui = adv ? (p.scores[adv] ?? 0) : 0
  const boutonHistorique = (
    <button type="button" className="bouton-icone" onClick={() => setHistorique(true)} aria-label="Historique des coups">
      <IconeHistorique />
    </button>
  )

  return (
    <>
      {p.etat === 'attente' ? (
        <div className="contenu">
          <Retour droite={boutonHistorique} />
          {p.createur === uid && <InviterJoueur p={p} uid={uid} />}
          <Invitation p={p} />
        </div>
      ) : (
        <div className="ecran-jeu">
          <BarreJeu
            onRetour={() => naviguer('parties')}
            libelleRetour="Mes parties"
            titre={p.etat === 'finie' ? 'Terminée' : aMoi ? 'À toi de jouer' : `Tour de ${nomAdv}`}
            pastille={<BoutonSac sac={nonVues.length} onClick={() => setFeuilleSac(true)} />}
            droite={
              <>
                {boutonHistorique}
                {p.etat === 'encours' && (
                  <button type="button" className="bouton-icone" onClick={() => setMenu(true)} aria-label="Menu de la partie">
                    <IconeMenu />
                  </button>
                )}
              </>
            }
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
            {p.etat === 'finie' && (
              <div className="encart-jeu">
                <Fin p={p} uid={uid} nomAdv={nomAdv} />
              </div>
            )}
            <Chevalet edition={edition} />
            {aMoi && <Apercu analyse={analyse} indice="Pose ton mot, puis « Jouer »." onVerifier={() => setFeuilleVerifier(true)} />}
            {p.etat === 'encours' && !aMoi && (
              <div className="apercu">
                <span className="indice">{nomAdv} réfléchit… Tu seras prévenu quand ce sera ton tour.</span>
              </div>
            )}
            {p.enAttente && <div className="note note-centree">Coup en attente d’envoi (hors ligne)</div>}
            {message && <div className="apercu erreur">{message}</div>}
            <PanneauBas
              statut={
                <BarreStatut
                  texte={
                    <>
                      Moi <b>{moi}</b> · <b>{lui}</b> {nomAdv}
                    </>
                  }
                  part={moi + lui ? moi / (moi + lui) : 0.5}
                />
              }
            >
              {aMoi ? (
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
                      if (!lireReglages().confirmerPasse || confirm('Passer ton tour ?')) jouer({ type: 'passe' })
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
              ) : (
                <div className="actions">
                  <button type="button" className="bouton-icone" onClick={edition.melanger} aria-label="Mélanger">
                    <IconeMelanger />
                  </button>
                  <button type="button" className="bouton large" onClick={() => naviguer('parties')}>
                    Mes parties
                  </button>
                </div>
              )}
            </PanneauBas>
          </ColonneJeu>
        </div>
      )}
      <TuileVolante glisse={edition.glisse} />
      <ChoixJoker ouvert={!!edition.etat.joker} onChoix={edition.choisirLettreJoker} />
      <Sac ouvert={feuilleSac} onFermer={() => setFeuilleSac(false)} lettres={nonVues} sac={p.sac.length} adversaire={nomAdv} />
      <FeuilleVerifier ouvert={feuilleVerifier} onFermer={() => setFeuilleVerifier(false)} />
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
        {coups.some((c) => c.type === 'mot') && <div className="note">Touche un mot pour lire sa définition.</div>}
        <div className="liste">
          {coups.map((c) => (
            <div key={c.n}>
              <div
                className={'ligne' + (defOuverte === c.n ? ' choisie' : '')}
                style={{ cursor: c.type === 'mot' ? 'pointer' : 'default' }}
                onClick={() => c.type === 'mot' && setDefOuverte(defOuverte === c.n ? null : c.n)}
              >
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
              {defOuverte === c.n && c.type === 'mot' && c.mot && <DefinitionMot mot={c.mot.toUpperCase()} />}
            </div>
          ))}
        </div>
      </Feuille>
      <Feuille ouvert={menu && p.etat === 'encours'} onFermer={() => setMenu(false)}>
        <h3>Partie en cours</h3>
        <p style={{ margin: 0 }} className="note">
          Contre <b>{nomAdv}</b> · toi {moi}, {nomAdv} {lui}
        </p>
        <button type="button" className="bouton principal" onClick={() => setMenu(false)}>
          Reprendre
        </button>
        <button
          type="button"
          className="bouton danger"
          onClick={() => {
            setMenu(false)
            if (confirm(`Abandonner la partie ? ${nomAdv} gagne.`)) abandonner(p, uid, setMessage)
          }}
        >
          Abandonner la partie
        </button>
      </Feuille>
    </>
  )
}

function Fin({ p, uid, nomAdv }: { p: Partie; uid: string; nomAdv: string }) {
  const f = p.fin
  const adv = autre(p, uid)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  // Revanche : une nouvelle partie, avec la même personne déjà invitée.
  const revanche = async () => {
    if (!adv) return
    setOccupe(true)
    setErreur('')
    try {
      naviguer('partie/' + (await creerPartie(uid, p.pseudos[uid] ?? '?', { uid: adv, pseudo: nomAdv })))
    } catch (e) {
      setErreur(messageErreur(e))
      setOccupe(false)
    }
  }
  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <b style={{ fontSize: 20 }}>{f?.gagnant ? (f.gagnant === uid ? 'Tu as gagné !' : `${nomAdv} a gagné`) : 'Égalité'}</b>
      <span className="note">
        {f?.raison === 'abandon'
          ? p.dernier?.uid === uid
            ? 'Tu as abandonné la partie.'
            : `${nomAdv} a abandonné la partie.`
          : f?.raison === 'passes'
            ? 'Six passes de suite : chacun perd la valeur de ses lettres restantes'
            : 'Le sac est vide et un chevalet aussi : les lettres restantes changent de camp'}
        {f && f.raison !== 'abandon' && adv && ` (toi ${signe(f.ajustements[uid] ?? 0)}, ${nomAdv} ${signe(f.ajustements[adv] ?? 0)}).`}
      </span>
      {p.nbCoups > 0 && (
        <button type="button" className="bouton" onClick={() => naviguer('partie/' + p.code + '/analyse')}>
          Analyser la partie
        </button>
      )}
      {adv && (
        <button type="button" className="bouton principal" disabled={occupe} onClick={() => void revanche()}>
          Proposer une revanche à {nomAdv}
        </button>
      )}
      {erreur && <div className="apercu erreur">{erreur}</div>}
    </div>
  )
}

const signe = (n: number) => (n > 0 ? '+' + n : String(n))

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
