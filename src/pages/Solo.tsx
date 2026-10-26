// Menu du solo : les parties en cours (on peut en avoir plusieurs, les reprendre ou les abandonner), puis le duplicate
// (entraînement ou topping) ou une partie classique contre l'IA.

import { useState, type ReactNode } from 'react'
import { ConseilInstallation } from '../composants/ConseilInstallation'
import { Entete } from '../composants/Entete'
import type { PartieIA } from '../jeu/contreIA'
import { PROFILS } from '../jeu/ia'
import { modeDe, totaux, type PartieDuplicate } from '../jeu/duplicate'
import { naviguer } from '../lib/routeur'
import { useSynchro } from '../lib/synchro'
import { abandonnerPartie, formatPct, formatTemps, lireHistorique, lirePartiesEnCours } from '../solo/sauvegarde'
import { abandonnerPartieIA, bilanParNiveau, lirePartiesIAEnCours } from '../solo/sauvegardeIA'

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
  const enCours = lireEnCours()
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
      <Entete droite={<span className="puce">Solo</span>} />
      <ConseilInstallation />
      {enCours.length > 0 && (
        <>
          <h2>
            {enCours.length > 1 ? `${enCours.length} parties en cours` : 'Partie en cours'}
          </h2>
          <div className="liste">
            {enCours.map((e) => (
              <PartieEnCours key={e.partie.id} e={e} onAbandon={() => rafraichir((n) => n + 1)} />
            ))}
          </div>
          <h2>Nouvelle partie</h2>
        </>
      )}
      <div className="liste">
        <Choix
          sigle="D"
          titre="Duplicate"
          texte="Le même tirage pour tous : cherche le meilleur mot, puis le top est posé. Entraînement ou topping avec indices."
          etat={etatDuplicate}
          onClick={() => naviguer('solo/duplicate')}
        />
        <Choix
          sigle="IA"
          titre="Contre l’IA"
          texte="Une partie classique tour par tour contre l’ordinateur, du débutant au champion."
          etat={etatIA}
          onClick={() => naviguer('solo/ia')}
        />
      </div>
    </div>
  )
}

/** Une partie en cours : où elle en est, de quoi la reprendre ou l'abandonner. */
function PartieEnCours({ e, onAbandon }: { e: EnCours; onAbandon: () => void }) {
  let titre: string
  let gros: string
  let detail: string
  let reprendre: string
  let question: string
  let abandonner: () => void
  // Les parties en cours se ressemblent vite : la date de la dernière sauvegarde aide à les reconnaître.
  const quand = new Date(e.partie.majLe ?? e.partie.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  if (e.type === 'duplicate') {
    const p = e.partie
    const t = totaux(p)
    const topping = modeDe(p) === 'topping'
    titre = `Duplicate · ${topping ? 'topping' : 'entraînement'} · coup ${p.courant?.numero ?? p.coups.length}`
    gros = !p.coups.length ? 'Début de partie' : topping ? `${t.trouves} / ${p.coups.length} tops` : formatPct(t.pourcentage)
    detail = `${p.coups.length ? `${t.joueur} / ${t.top} points` : formatTemps(p.temps) + ' par coup'} · graine ${p.graine} · ${quand}`
    reprendre = 'solo/duplicate/' + encodeURIComponent(p.id)
    question = p.coups.length ? 'Abandonner cette partie ? Elle sera rangée dans l’historique.' : 'Abandonner cette partie ?'
    abandonner = () => abandonnerPartie(p)
  } else {
    const p = e.partie
    titre = `Contre l’IA · ${PROFILS[p.niveau].nom} · ${p.coups.length} coup${p.coups.length > 1 ? 's' : ''}`
    gros = `${p.scores.moi} – ${p.scores.ia}`
    detail = `${p.tour === 'moi' ? 'À toi de jouer' : 'L’IA doit jouer'} · ${quand}`
    reprendre = 'solo/ia/' + encodeURIComponent(p.id)
    question = p.coups.length ? 'Abandonner cette partie ? L’IA gagne.' : 'Abandonner cette partie ?'
    abandonner = () => abandonnerPartieIA(p)
  }
  return (
    <div className="carte carte-accent" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="note">{titre}</div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{gros}</div>
      <div className="note">{detail}</div>
      <div className="actions">
        <button
          type="button"
          className="bouton danger large"
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
