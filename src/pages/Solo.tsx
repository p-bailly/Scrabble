// Menu du solo : le duplicate (entraînement ou topping) ou une partie classique contre l'IA.

import type { ReactNode } from 'react'
import { Entete } from '../composants/Entete'
import { PROFILS } from '../jeu/ia'
import { modeDe, totaux } from '../jeu/duplicate'
import { naviguer } from '../lib/routeur'
import { formatPct, lireHistorique, lirePartie } from '../solo/sauvegarde'
import { bilanParNiveau, lirePartieIA } from '../solo/sauvegardeIA'

export function Solo() {
  const duplicate = lirePartie()
  const contreIA = lirePartieIA()
  const dernierDuplicate = lireHistorique()[0]
  const victoires = bilanParNiveau().reduce((n, b) => n + b.victoires, 0)
  const partiesIA = bilanParNiveau().reduce((n, b) => n + b.parties, 0)

  let etatDuplicate: ReactNode = null
  if (duplicate && !duplicate.finie) {
    const t = totaux(duplicate)
    etatDuplicate = (
      <div className="note ecart-ok">
        Partie en cours · {modeDe(duplicate) === 'topping' ? 'topping' : 'entraînement'} · coup {duplicate.courant?.numero ?? duplicate.coups.length} ·{' '}
        {t.top ? formatPct(t.pourcentage) : '—'}
      </div>
    )
  } else if (dernierDuplicate && dernierDuplicate.coups.length) {
    etatDuplicate = <div className="note">Dernière partie : {formatPct(totaux(dernierDuplicate).pourcentage)} des tops</div>
  }

  let etatIA: ReactNode = null
  if (contreIA && !contreIA.finie) {
    etatIA = (
      <div className="note ecart-ok">
        Partie en cours contre {PROFILS[contreIA.niveau].nom} · {contreIA.scores.moi} – {contreIA.scores.ia}
      </div>
    )
  } else if (partiesIA > 0) {
    etatIA = (
      <div className="note">
        {victoires} victoire{victoires > 1 ? 's' : ''} sur {partiesIA} partie{partiesIA > 1 ? 's' : ''}
      </div>
    )
  }

  return (
    <div className="contenu">
      <Entete droite={<span className="puce">Solo</span>} />
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
