// Compte pour les parties à deux, sans mot de passe : on saisit son adresse e-mail, Firebase envoie un lien, toucher
// ce lien connecte. Le compte est le même sur tous les appareils : mêmes parties, même pseudo.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { Entete } from '../composants/Entete'
import { lire } from '../lib/stockage'
import { configuration, deconnexion, envoyerLien, estLienDeConnexion, terminerConnexion, utilisateur } from './firebase'
import Multi from './Multi'

/** Pages du multijoueur : le lien reçu par e-mail ramène sur celle d'où la connexion a été demandée. */
const PAGES = ['parties', 'partie', 'rejoindre']

/** Retire de l'adresse les paramètres du lien de connexion (ils ne servent qu'une fois). */
const nettoyerAdresse = () => history.replaceState(null, '', location.pathname + location.hash)

function message(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'auth/invalid-email') return 'Cette adresse e-mail n’est pas valide.'
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') return 'Trop de demandes pour l’instant : réessaie dans quelques minutes.'
  if (code === 'auth/network-request-failed') return 'Pas de connexion à Internet.'
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code')
    return 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau.'
  return e instanceof Error ? e.message : String(e)
}

export default function Compte({ chemin }: { chemin: string[] }) {
  // Sans configuration Firebase, l'écran du multijoueur explique quoi faire.
  if (!configuration) return <Multi chemin={chemin} />
  return <Session chemin={chemin} />
}

function Session({ chemin }: { chemin: string[] }) {
  const [moi, setMoi] = useState<User | null | undefined>(undefined)
  // Lien de connexion contenu dans l'adresse de la page : on vient de toucher le lien de l'e-mail.
  const [lien, setLien] = useState<string | null>(() => (estLienDeConnexion() ? location.href : null))
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    utilisateur()
      .then(setMoi)
      .catch((e: Error) => setErreur('Connexion impossible : ' + e.message))
  }, [])

  // Déjà connecté sur cet appareil : le lien ne sert plus, on le retire de l'adresse.
  useEffect(() => {
    if (moi && lien) oublierLien()
  }, [moi, lien])

  const oublierLien = () => {
    nettoyerAdresse()
    setLien(null)
  }
  const connecte = (u: User) => {
    oublierLien()
    setMoi(u)
  }

  if (erreur)
    return (
      <div className="contenu">
        <Entete titre="Mes parties" />
        <div className="apercu erreur">{erreur}</div>
        <p className="note">Vérifie ta connexion à Internet, puis rouvre l’onglet.</p>
      </div>
    )
  if (moi === undefined) return <div className="vide-etat">Connexion…</div>
  if (!moi) {
    if (lien) return <FinConnexion lien={lien} onConnecte={connecte} onAbandon={oublierLien} />
    return <Connexion retour={PAGES.includes(chemin[0]) ? chemin.join('/') : 'parties'} onConnecte={connecte} />
  }
  return (
    <>
      <Multi chemin={chemin} />
      {chemin[0] === 'parties' && (
        <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="note" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Connecté : {moi.email}
          </span>
          <button type="button" className="bouton discret" onClick={() => void deconnexion().then(() => setMoi(null))}>
            Se déconnecter
          </button>
        </div>
      )}
    </>
  )
}

/** Demande de lien : adresse e-mail, puis attente du message. */
function Connexion({ retour, onConnecte }: { retour: string; onConnecte: (u: User) => void }) {
  const [email, setEmail] = useState(() => lire('multi.email', ''))
  const [envoye, setEnvoye] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [colle, setColle] = useState('')

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    const adresse = email.trim()
    if (!adresse) return
    setOccupe(true)
    setErreur('')
    try {
      await envoyerLien(adresse, retour)
      setEmail(adresse)
      setEnvoye(true)
    } catch (err) {
      setErreur(message(err))
    } finally {
      setOccupe(false)
    }
  }

  // Le lien s'est ouvert dans un autre navigateur (ou on est dans l'appli Android) : on peut le coller ici.
  const validerLienColle = async (e: FormEvent) => {
    e.preventDefault()
    const l = colle.trim()
    setErreur('')
    try {
      if (!estLienDeConnexion(l)) throw new Error('Ce n’est pas le lien reçu par e-mail : copie-le en entier.')
      onConnecte(await terminerConnexion(email.trim(), l))
    } catch (err) {
      setErreur(message(err))
    }
  }

  return (
    <div className="contenu">
      <Entete titre="Mes parties" />
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!envoye ? (
          <form onSubmit={(e) => void envoyer(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <b>Connecte-toi pour jouer à deux</b>
            <span className="note">
              Pas de mot de passe : tu reçois un lien par e-mail, il suffit de le toucher. Ton compte te suit d’un appareil à
              l’autre.
            </span>
            <label className="champ">
              Adresse e-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoFocus
              />
            </label>
            <button type="submit" className="bouton principal" disabled={!email.trim() || occupe}>
              Recevoir le lien
            </button>
          </form>
        ) : (
          <>
            <b>Regarde tes e-mails</b>
            <span className="note">
              Un message vient d’être envoyé à {email}. Touche le lien qu’il contient pour te connecter. Il peut mettre une
              minute à arriver : pense à regarder dans les courriers indésirables.
            </span>
            <form onSubmit={(e) => void validerLienColle(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="champ">
                Le lien s’ouvre ailleurs que dans l’appli ? Copie-le depuis l’e-mail et colle-le ici
                <input value={colle} onChange={(e) => setColle(e.target.value)} placeholder="https://…" autoCapitalize="none" />
              </label>
              <button type="submit" className="bouton" disabled={!colle.trim()}>
                Me connecter avec ce lien
              </button>
            </form>
            <button type="button" className="bouton discret" onClick={() => setEnvoye(false)}>
              Changer d’adresse ou renvoyer le lien
            </button>
          </>
        )}
        {erreur && <div className="apercu erreur">{erreur}</div>}
      </div>
    </div>
  )
}

/** On arrive par le lien de l'e-mail : on termine la connexion (l'adresse est redemandée si l'appareil a changé). */
function FinConnexion({ lien, onConnecte, onAbandon }: { lien: string; onConnecte: (u: User) => void; onAbandon: () => void }) {
  const [email, setEmail] = useState(() => lire('multi.email', ''))
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const valider = async (adresse: string) => {
    setOccupe(true)
    setErreur('')
    try {
      onConnecte(await terminerConnexion(adresse, lien))
    } catch (err) {
      setErreur(message(err))
      setOccupe(false)
    }
  }

  // Même appareil que la demande : l'adresse est connue, la connexion se termine toute seule (une seule fois :
  // un lien ne sert qu'une fois).
  const lance = useRef(false)
  useEffect(() => {
    const connue = lire('multi.email', '')
    if (connue && !lance.current) {
      lance.current = true
      void valider(connue)
    }
  }, [])

  const demandeAdresse = !lire('multi.email', '') || erreur !== ''
  return (
    <div className="contenu">
      <Entete titre="Mes parties" />
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!demandeAdresse && <div className="vide-etat">Connexion…</div>}
        {demandeAdresse && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim()) void valider(email.trim())
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <b>Confirme ton adresse e-mail</b>
            <span className="note">Saisis l’adresse à laquelle tu as reçu le lien pour terminer la connexion.</span>
            <label className="champ">
              Adresse e-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoFocus
              />
            </label>
            <button type="submit" className="bouton principal" disabled={!email.trim() || occupe}>
              Me connecter
            </button>
          </form>
        )}
        {erreur && <div className="apercu erreur">{erreur}</div>}
        {erreur && (
          <button type="button" className="bouton discret" onClick={onAbandon}>
            Recevoir un nouveau lien
          </button>
        )}
      </div>
    </div>
  )
}
