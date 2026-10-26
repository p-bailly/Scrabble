// Compte pour les parties à deux : un nom d'utilisateur, sans mot de passe ni e-mail. Saisir le même nom sur un autre
// appareil ouvre le même compte : mêmes parties, même pseudo.

import { useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { Entete } from '../composants/Entete'
import { naviguer } from '../lib/routeur'
import { demanderPermission } from '../lib/notifications'
import { notificationVoulue } from '../lib/reglages'
import { ecrire } from '../lib/stockage'
import { enregistrerJoueur, lireJoueur } from './donnees'
import { configuration, connecterNom, utilisateur } from './firebase'
import Multi from './Multi'

function message(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'auth/network-request-failed') return 'Pas de connexion à Internet.'
  if (code === 'auth/too-many-requests') return 'Trop d’essais : réessaie dans quelques minutes.'
  if (code === 'auth/invalid-credential') return 'Ce nom ne peut pas être utilisé : choisis-en un autre.'
  if (code === 'auth/operation-not-allowed')
    return 'La connexion n’est pas activée dans Firebase (Authentication → Adresse e-mail/Mot de passe).'
  return e instanceof Error ? e.message : String(e)
}

export default function Compte({ chemin }: { chemin: string[] }) {
  // Sans configuration Firebase, l'écran du multijoueur explique quoi faire.
  if (!configuration) return <Multi chemin={chemin} />
  return <Session chemin={chemin} />
}

function Session({ chemin }: { chemin: string[] }) {
  const [moi, setMoi] = useState<User | null | undefined>(undefined)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    utilisateur()
      .then(setMoi)
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
  if (moi === undefined) return <div className="vide-etat">Connexion…</div>
  if (!moi) return <Connexion onConnecte={setMoi} />
  // Le pseudo, la visibilité et la déconnexion se règlent dans l'onglet Réglages.
  return <Multi chemin={chemin} />
}

/** Saisie du nom d'utilisateur : crée le compte la première fois, le retrouve ensuite (sur n'importe quel appareil). */
function Connexion({ onConnecte }: { onConnecte: (u: User) => void }) {
  const [nom, setNom] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const valider = async (e: FormEvent) => {
    e.preventDefault()
    const n = nom.trim().slice(0, 20)
    if (!n) return
    // Tout de suite, dans le geste de l'utilisateur (les navigateurs l'exigent) : un joueur invité doit pouvoir être
    // prévenu dès sa première invitation, avant d'avoir créé ni rejoint une partie.
    if (notificationVoulue()) void demanderPermission()
    setOccupe(true)
    setErreur('')
    try {
      const u = await connecterNom(n)
      // Le nom sert de pseudo ; un compte déjà connu garde le pseudo enregistré (même écriture sur tous les appareils).
      const existant = await lireJoueur(u.uid).catch(() => null)
      if (!existant) await enregistrerJoueur(u.uid, n, true)
      ecrire('multi.pseudo', existant?.pseudo ?? n)
      onConnecte(u)
    } catch (err) {
      setErreur(message(err))
      setOccupe(false)
    }
  }

  return (
    <div className="contenu">
      <Entete titre="Mes parties" />
      <form className="carte" onSubmit={(e) => void valider(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <b>Choisis ton nom d’utilisateur</b>
        <span className="note">
          Pas de mot de passe : saisis le même nom sur tous tes appareils pour retrouver tes parties. Attention, toute
          personne qui connaît ce nom peut s’y connecter.
        </span>
        <label className="champ">
          Nom d’utilisateur
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
          />
        </label>
        <button type="submit" className="bouton principal" disabled={!nom.trim() || occupe}>
          Continuer
        </button>
        {erreur && <div className="apercu erreur">{erreur}</div>}
      </form>
      <button
        type="button"
        className="bouton discret"
        onClick={() => {
          ecrire('multi.sansCompte', true)
          naviguer('solo')
        }}
      >
        Jouer en solo sans compte
      </button>
    </div>
  )
}
