// Menu du solo : les parties en cours (on peut en avoir plusieurs, les reprendre ou les abandonner), puis le duplicate
// (entraînement ou topping) ou une partie classique contre l'ordinateur. En mode simple : pas de duplicate, et la partie
// contre l'ordinateur se lance d'un toucher, au dernier niveau choisi.

import { useState, type ReactNode } from 'react'
import { ConseilInstallation } from '../composants/ConseilInstallation'
import { Entete } from '../composants/Entete'
import { LiensModeSimple } from '../composants/LiensModeSimple'
import type { PartieIA } from '../jeu/contreIA'
import { modeDe, totaux, type PartieDuplicate } from '../jeu/duplicate'
import { useReglages } from '../lib/reglages'
import { naviguer } from '../lib/routeur'
import { useSynchro } from '../lib/synchro'
import { abandonnerPartie, formatPct, lireHistorique, lirePartiesEnCours } from '../solo/sauvegarde'
import { abandonnerPartieIA, bilanParNiveau, lirePartiesIAEnCours, lireReglagesIA } from '../solo/sauvegardeIA'
import { lancerPartieIA, nomNiveau } from './ContreIA'

type EnCours = { type: 'duplicate'; partie: PartieDuplicate } | { type: 'ia'; partie: PartieIA }

/** Toutes les parties en cours, la dernière jouée en premier. */
function lireEnCours(): EnCours[] {
  const date = (e: EnCours) => e.partie.majLe ?? e.partie.creeLe
  return [
    ...lirePartiesEnCours().map((partie): EnCours => ({ type: 'duplicate', partie })),
    ...lirePartiesIAEnCours().map((partie): EnCours => ({ type: 'ia', partie })),
  ].sort((a, b) => date(b) - date(a))
}

export function Solo() {
  // Abandonner une partie change la liste affichée ; la synchro avec le compte aussi.
  const [, rafraichir] = useState(0)
  useSynchro()
  const { simple } = useReglages()
  const enCours = lireEnCours().filter((e) => !simple || e.type === 'ia')
  const dernierDuplicate = lireHistorique()[0]
  const victoires = bilanParNiveau().reduce((n, b) => n + b.victoires, 0)
  const partiesIA = bilanParNiveau().reduce((n, b) => n + b.parties, 0)

  const etatDuplicate: ReactNode =
    dernierDuplicate && dernierDuplicate.coups.length ? (
      <div className="note">Dernière partie : {formatPct(totaux(dernierDuplicate).pourcentage)} des tops</div>
    ) : null

  const etatIA: ReactNode =
    partiesIA > 0 ? (
      <div className="note">
        {victoires} victoire{victoires > 1 ? 's' : ''} sur {partiesIA} partie{partiesIA > 1 ? 's' : ''}
      </div>
    ) : null

  return (
    <div className="contenu">
      <Entete />
      <ConseilInstallation />
      {enCours.length > 0 && (
        <>
          <h2>{enCours.length > 1 ? `${enCours.length} parties en cours` : 'Partie en cours'}</h2>
          <div className="liste">
            {enCours.map((e) => (
              <PartieEnCours key={e.partie.id} e={e} onAbandon={() => rafraichir((n) => n + 1)} />
            ))}
          </div>
          <h2>Nouvelle partie</h2>
        </>
      )}
      {simple ? (
        <JouerContreOrdinateur />
      ) : (
        <div className="liste">
          <Choix
            sigle="D"
            titre="Duplicate"
            texte="Le même tirage pour tous : cherche le meilleur mot, puis le top est posé. Entraînement ou topping avec indices."
            etat={etatDuplicate}
            onClick={() => naviguer('solo/duplicate')}
          />
          <Choix
            sigle="O"
            titre="Contre l’ordinateur"
            texte="Une partie classique, tour par tour, du débutant au champion."
            etat={etatIA}
            onClick={() => naviguer('solo/ia')}
          />
        </div>
      )}
      <LiensModeSimple />
    </div>
  )
}

/** Mode simple : un gros bouton qui lance la partie au dernier niveau choisi ; le niveau se change à côté. */
function JouerContreOrdinateur() {
  const reglages = lireReglagesIA()
  return (
    <div className="carte" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <b style={{ fontSize: 20 }}>Jouer contre l’ordinateur</b>
      <button type="button" className="bouton principal large" style={{ minHeight: 56 }} onClick={() => lancerPartieIA(reglages)}>
        Nouvelle partie
      </button>
      <div className="reglage">
        <div className="texte">
          <div className="titre">
            Niveau : <b>{nomNiveau(reglages.niveau, true)}</b>
          </div>
        </div>
        <button type="button" className="bouton" onClick={() => naviguer('solo/ia')}>
          Changer
        </button>
      </div>
    </div>
  )
}

/** Une partie en cours : son mode, son coup, l'autre joueur s'il y en a, de quoi la reprendre ou l'abandonner. */
function PartieEnCours({ e, onAbandon }: { e: EnCours; onAbandon: () => void }) {
  const { simple } = useReglages()
  let mode: string
  let coup: string
  let reprendre: string
  let question: string
  let abandonner: () => void
  if (e.type === 'duplicate') {
    const p = e.partie
    mode = `Duplicate · ${modeDe(p) === 'topping' ? 'Topping' : 'Entraînement'}`
    coup = `Coup ${p.courant?.numero ?? p.coups.length}`
    reprendre = 'solo/duplicate/' + encodeURIComponent(p.id)
    question = p.coups.length ? 'Abandonner cette partie ? Elle sera rangée dans l’historique.' : 'Abandonner cette partie ?'
    abandonner = () => abandonnerPartie(p)
  } else {
    const p = e.partie
    mode = 'Contre l’ordinateur'
    coup = `Coup ${p.coups.length + 1} · contre ${nomNiveau(p.niveau, simple)}`
    reprendre = 'solo/ia/' + encodeURIComponent(p.id)
    question = p.coups.length ? 'Abandonner cette partie ? L’ordinateur gagne.' : 'Abandonner cette partie ?'
    abandonner = () => abandonnerPartieIA(p)
  }
  return (
    <div className="carte carte-accent" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{mode}</div>
      <div className="note">{coup}</div>
      <div className="actions">
        <button
          type="button"
          className="bouton danger plein large"
          onClick={() => {
            if (!confirm(question)) return
            abandonner()
            onAbandon()
          }}
        >
          Abandonner
        </button>
        <button type="button" className="bouton principal large" onClick={() => naviguer(reprendre)}>
          Reprendre
        </button>
      </div>
    </div>
  )
}

function Choix({ sigle, titre, texte, etat, onClick }: { sigle: string; titre: string; texte: string; etat: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="ligne" style={{ padding: 16, gap: 14, alignItems: 'flex-start' }} onClick={onClick}>
      <div className="avatar" style={{ background: 'var(--accent)', borderRadius: 12 }}>
        {sigle}
      </div>
      <div className="principal" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{titre}</div>
        <div className="note" style={{ fontSize: 13, lineHeight: 1.4 }}>
          {texte}
        </div>
        {etat}
      </div>
    </button>
  )
}
