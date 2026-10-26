// Section « compte » des réglages : pseudo, visibilité dans la recherche de joueurs, déconnexion. Chargée à la demande
// (elle dépend de Firebase), seulement quand un compte existe sur l'appareil.

import { useEffect, useState, type FormEvent } from 'react'
import { Interrupteur, Rangee } from '../composants/Reglage'
import { naviguer } from '../lib/routeur'
import { ecrire, lire } from '../lib/stockage'
import { enregistrerJoueur, lireJoueur, type Joueur } from './donnees'
import { configuration, deconnexion, utilisateur } from './firebase'
import { arreterVeille } from './veille'

export default function SectionCompte() {
  if (!configuration) return <Rangee titre="Compte" texte="Les parties à deux ne sont pas configurées (voir le README)." />
  return <Compte />
}

function Compte() {
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  // undefined : lecture en cours ; null : fiche illisible (hors ligne, ou pas encore créée).
  const [joueur, setJoueur] = useState<Joueur | null | undefined>(undefined)
  const [pseudo, setPseudo] = useState(() => lire('multi.pseudo', ''))
  const [message, setMessage] = useState('')

  useEffect(() => {
    utilisateur()
      .then(async (u) => {
        setUid(u?.uid ?? null)
        setJoueur(u ? await lireJoueur(u.uid).catch(() => null) : null)
      })
      .catch(() => setUid(null))
  }, [])

  if (uid === undefined) return <div className="note">Chargement…</div>
  if (uid === null)
    return (
      <Rangee
        titre="Compte"
        texte="Tu n’es pas connecté."
        droite={
          <button type="button" className="bouton" onClick={() => naviguer('parties')}>
            Se connecter
          </button>
        }
      />
    )

  // Une erreur d'écriture (hors ligne, règles pas à jour) est dite telle quelle, le réglage reste comme il était.
  const enregistrer = async (nouveau: string, visible: boolean) => {
    setMessage('')
    try {
      await enregistrerJoueur(uid, nouveau, visible)
      ecrire('multi.pseudo', nouveau)
      setPseudo(nouveau)
      setJoueur({ pseudo: nouveau, visible })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  const changerPseudo = (e: FormEvent) => {
    e.preventDefault()
    const p = pseudo.trim().slice(0, 20)
    if (p) void enregistrer(p, joueur?.visible ?? true)
  }

  const sortir = async () => {
    arreterVeille() // avant la déconnexion : sinon les écoutes en cours seraient refusées
    await deconnexion()
    naviguer('parties')
  }

  return (
    <>
      <Rangee titre="Pseudo" texte="Le nom que voient les autres joueurs.">
        <form className="actions" onSubmit={changerPseudo}>
          <input
            className="champ-code libre"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            maxLength={20}
            aria-label="Pseudo"
            autoCapitalize="words"
          />
          {/* Sans la fiche (hors ligne), on ne sait pas si le joueur a choisi d'être caché : on n'écrit pas par-dessus. */}
          <button type="submit" className="bouton" disabled={!joueur || !pseudo.trim() || pseudo.trim() === joueur.pseudo}>
            Enregistrer
          </button>
        </form>
      </Rangee>
      <Interrupteur
        titre="Être trouvé par les autres joueurs"
        texte="Ils peuvent t’inviter en tapant ton pseudo. Désactivé, seuls le code et le lien d’une partie permettent de te faire jouer."
        actif={joueur?.visible ?? true}
        desactive={!joueur}
        onChange={(visible) => joueur && void enregistrer(joueur.pseudo, visible)}
      >
        {joueur === null && <span className="note">Disponible quand tu es connecté à Internet.</span>}
      </Interrupteur>
      {message && <div className="apercu erreur">{message}</div>}
      <Rangee
        titre="Compte"
        texte="Saisis le même nom sur un autre appareil pour retrouver tes parties."
        droite={
          <button type="button" className="bouton danger" onClick={() => void sortir()}>
            Se déconnecter
          </button>
        }
      />
    </>
  )
}
