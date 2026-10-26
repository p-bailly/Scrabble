// Réglages : apparence, jeu, notifications, compte des parties à deux, données gardées sur l'appareil, à propos.

import { lazy, Suspense, useEffect, useState } from 'react'
import { Interrupteur, Rangee } from '../composants/Reglage'
import { Entete } from '../composants/Entete'
import { ADRESSE_WEB, URL_APK } from '../lib/adresses'
import { nbDefinitionsGardees, viderDefinitions } from '../lib/definitions'
import { demanderPermission, natif, notificationsAutorisees, notifier } from '../lib/notifications'
import { THEMES, lireReglages, modifierReglages, type Reglages as ReglagesAppli } from '../lib/reglages'
import { naviguer } from '../lib/routeur'
import { lire } from '../lib/stockage'
import { chargerDico } from '../moteur/moteur'
import { lireHistorique, viderHistorique } from '../solo/sauvegarde'
import { bilanParNiveau, supprimerHistoriqueIA } from '../solo/sauvegardeIA'

// Le compte passe par Firebase : on ne le charge que si un compte existe sur cet appareil.
const SectionCompte = lazy(() => import('../multi/SectionCompte'))

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export function Reglages() {
  const [r, setR] = useState<ReglagesAppli>(lireReglages)
  const maj = (modif: Partial<ReglagesAppli>) => setR(modifierReglages(modif))
  // Les données effacées changent les compteurs affichés.
  const [, rafraichir] = useState(0)

  return (
    <div className="contenu">
      <Entete titre="Réglages" />

      <h2>Apparence</h2>
      <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="champ">
          Thème
          <div className="segments">
            {THEMES.map((t) => (
              <button key={t.theme} type="button" className={r.theme === t.theme ? 'actif' : ''} aria-pressed={r.theme === t.theme} onClick={() => maj({ theme: t.theme })}>
                {t.nom}
              </button>
            ))}
          </div>
          <span className="note">« Automatique » suit le réglage clair ou sombre du téléphone.</span>
        </div>
        <Interrupteur
          titre="Étiquettes des cases bonus"
          texte="Affiche MT, MD, LT et LD sur le plateau. Les couleurs restent, l’étoile du centre aussi."
          actif={r.etiquettes}
          onChange={(etiquettes) => maj({ etiquettes })}
        />
      </div>

      <h2>Jeu</h2>
      <div className="carte">
        <Interrupteur
          titre="Confirmer avant de passer"
          texte="Demande « Passer ton tour ? » avant de passer, dans les parties à deux et contre l’IA."
          actif={r.confirmerPasse}
          onChange={(confirmerPasse) => maj({ confirmerPasse })}
        />
      </div>

      <h2>Notifications</h2>
      <div className="carte">
        <Notifications r={r} maj={maj} />
      </div>

      <h2>Parties à deux</h2>
      <div className="carte">
        {lire<string | null>('multi.pseudo', null) ? (
          <Suspense fallback={<div className="note">Chargement…</div>}>
            <SectionCompte />
          </Suspense>
        ) : (
          <Rangee
            titre="Compte"
            texte="Choisis un nom d’utilisateur pour jouer à deux et inviter des amis."
            droite={
              <button type="button" className="bouton" onClick={() => naviguer('parties')}>
                Se connecter
              </button>
            }
          />
        )}
      </div>

      <h2>Données de cet appareil</h2>
      <div className="carte">
        <Donnees rafraichir={() => rafraichir((x) => x + 1)} />
      </div>

      <h2>À propos</h2>
      <div className="carte">
        <APropos />
      </div>
    </div>
  )
}

function Notifications({ r, maj }: { r: ReglagesAppli; maj: (modif: Partial<ReglagesAppli>) => void }) {
  // undefined : on ne sait pas encore ; null : cet appareil n'en propose pas.
  const [autorisees, setAutorisees] = useState<boolean | null | undefined>(undefined)
  useEffect(() => {
    void notificationsAutorisees().then(setAutorisees)
  }, [])

  const demander = async () => {
    await demanderPermission()
    setAutorisees(await notificationsAutorisees())
  }

  return (
    <>
      <Interrupteur
        titre="Notifications"
        texte="Une alerte quand il se passe quelque chose dans tes parties à deux. Elle arrive quand l’appli est ouverte ou revient au premier plan."
        actif={r.notifications}
        onChange={(notifications) => {
          maj({ notifications })
          if (notifications) void demander()
        }}
      >
        {r.notifications && autorisees === null && <span className="note">Cet appareil ne propose pas les notifications.</span>}
        {r.notifications && autorisees === false && (
          <>
            <span className="note ecart-neg">
              Le système ne les autorise pas encore. Si le bouton ne fait rien, ouvre les réglages du téléphone (ou du navigateur), rubrique
              Notifications de Scrabble, et autorise-les.
            </span>
            <div>
              <button type="button" className="bouton" onClick={() => void demander()}>
                Autoriser
              </button>
            </div>
          </>
        )}
        {r.notifications && autorisees && (
          <div>
            <button type="button" className="bouton" onClick={() => void notifier('test', 'Scrabble', 'Les notifications fonctionnent.', '#/reglages')}>
              Envoyer un essai
            </button>
          </div>
        )}
      </Interrupteur>
      {r.notifications && (
        <>
          <Interrupteur
            titre="C’est mon tour"
            texte="Ton adversaire a joué, ou a rejoint ta partie."
            actif={r.notifTour}
            onChange={(notifTour) => maj({ notifTour })}
          />
          <Interrupteur
            titre="Invitations"
            texte="On t’invite à une partie, ou ton invité refuse."
            actif={r.notifInvitations}
            onChange={(notifInvitations) => maj({ notifInvitations })}
          />
          <Interrupteur titre="Fin de partie" texte="Ton adversaire a terminé la partie." actif={r.notifFin} onChange={(notifFin) => maj({ notifFin })} />
        </>
      )}
    </>
  )
}

function Donnees({ rafraichir }: { rafraichir: () => void }) {
  const nbDuplicate = lireHistorique().length
  const nbIA = bilanParNiveau().reduce((n, b) => n + b.parties, 0)
  const nbDefinitions = nbDefinitionsGardees()
  const effacer = (question: string, action: () => void) => () => {
    if (!confirm(question)) return
    action()
    rafraichir()
  }
  const bouton = (n: number, onClick: () => void) => (
    <button type="button" className="bouton danger" disabled={n === 0} onClick={onClick}>
      Effacer
    </button>
  )
  return (
    <>
      <Rangee
        titre="Duplicate"
        texte={`${pluriel(nbDuplicate, 'partie')} dans l’historique, d’où viennent les statistiques.`}
        droite={bouton(nbDuplicate, effacer('Effacer l’historique du duplicate et ses statistiques ?', viderHistorique))}
      />
      <Rangee
        titre="Contre l’IA"
        texte={`${pluriel(nbIA, 'partie')} terminée${nbIA > 1 ? 's' : ''}, d’où viennent les victoires par niveau, avec les dernières parties gardées pour l’analyse.`}
        droite={bouton(nbIA, effacer('Effacer les résultats contre l’IA et les parties gardées pour l’analyse ?', supprimerHistoriqueIA))}
      />
      <Rangee
        titre="Définitions du dictionnaire"
        texte={`${pluriel(nbDefinitions, 'mot')} gardé${nbDefinitions > 1 ? 's' : ''} pour les lire sans connexion.`}
        droite={bouton(nbDefinitions, effacer('Vider les définitions gardées sur l’appareil ?', viderDefinitions))}
      />
    </>
  )
}

function APropos() {
  const [dico, setDico] = useState('Chargement…')
  const [maj, setMaj] = useState('')
  const [copie, setCopie] = useState(false)
  useEffect(() => {
    chargerDico()
      .then((d) => setDico(`${d.nom} · ${d.nbMots.toLocaleString('fr-FR')} mots`))
      .catch(() => setDico('Indisponible'))
  }, [])

  // La version web cherche toute seule une mise à jour au lancement ; ce bouton le fait à la demande. Le service
  // worker prend la main dès qu'il en trouve une et la page se recharge (voir main.tsx).
  const chercherMiseAJour = async () => {
    setMaj('Recherche…')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (!reg) return setMaj('Pas de mise à jour automatique dans ce mode.')
      await reg.update()
      setMaj(reg.installing || reg.waiting ? 'Mise à jour trouvée : l’appli se recharge…' : 'Tu as la dernière version.')
    } catch {
      setMaj('Impossible de vérifier : es-tu connecté à Internet ?')
    }
  }

  const partager = async () => {
    const texte = `Viens jouer au Scrabble ! Version web : ${ADRESSE_WEB} · Android : ${URL_APK}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Scrabble', text: texte })
        return
      } catch {
        /* partage annulé : on copie à la place */
      }
    }
    await navigator.clipboard?.writeText(texte)
    setCopie(true)
  }

  return (
    <>
      <Rangee titre="Version" texte={`Construite le ${new Date(__BUILD__).toLocaleDateString('fr-FR')}`} />
      <Rangee titre="Dictionnaire" texte={dico} />
      {natif ? (
        <Rangee
          titre="Mise à jour"
          texte="Retélécharge l’APK : il s’installe par-dessus l’ancien."
          droite={
            <a className="bouton" href={URL_APK}>
              Télécharger
            </a>
          }
        />
      ) : (
        <Rangee
          titre="Mise à jour"
          texte={maj || 'Vérifiée au lancement ; tu peux aussi la demander.'}
          droite={
            <button type="button" className="bouton" onClick={() => void chercherMiseAJour()}>
              Vérifier
            </button>
          }
        />
      )}
      <Rangee
        titre="Faire découvrir l’appli"
        texte="Envoie les liens de la version web et de l’APK Android."
        droite={
          <button type="button" className="bouton" onClick={() => void partager()}>
            {copie ? 'Copié !' : 'Partager'}
          </button>
        }
      />
    </>
  )
}
