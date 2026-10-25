// Historique des parties de duplicate et statistiques.

import { useState } from 'react'
import { Entete } from '../composants/Entete'
import { naviguer } from '../lib/routeur'
import { formatPct, formatTemps, statistiques, supprimerDeHistorique } from '../solo/sauvegarde'

export function Stats() {
  const [, rafraichir] = useState(0)
  const s = statistiques()
  return (
    <div className="contenu">
      <Entete titre="Statistiques" />
      <div className="stats">
        <div className="stat">
          <div className="etiquette">Parties</div>
          <div className="valeur">{s.parties.length}</div>
        </div>
        <div className="stat">
          <div className="etiquette">Moyenne</div>
          <div className="valeur">{s.parties.length ? formatPct(s.moyenne) : '—'}</div>
        </div>
        <div className="stat">
          <div className="etiquette">Tops trouvés</div>
          <div className="valeur">{s.tops}</div>
        </div>
      </div>
      {s.meilleure && (
        <div className="carte">
          <div className="note">Meilleure partie</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{formatPct(s.meilleure.pourcentage)}</div>
          <div className="note">
            {s.meilleure.joueur} / {s.meilleure.top} points · graine {s.meilleure.graine} ·{' '}
            {new Date(s.meilleure.date).toLocaleDateString('fr-FR')}
          </div>
        </div>
      )}
      <h2>Historique</h2>
      {s.parties.length === 0 ? (
        <div className="vide-etat">Aucune partie terminée. Lance un duplicate dans l’onglet Solo !</div>
      ) : (
        <div className="liste">
          {s.parties.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="ligne" onClick={() => naviguer('correction/' + encodeURIComponent(p.id))}>
                <div className="principal">
                  <div style={{ fontWeight: 700 }}>
                    {new Date(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · graine {p.graine}
                  </div>
                  <div className="note">
                    {p.nbCoups} coups · {formatTemps(p.temps)} · {p.joueur} / {p.top}
                  </div>
                </div>
                <span className="pts">{formatPct(p.pourcentage)}</span>
              </button>
              <button
                type="button"
                className="bouton-icone"
                aria-label="Supprimer"
                onClick={() => {
                  if (confirm('Supprimer cette partie de l’historique ?')) {
                    supprimerDeHistorique(p.id)
                    rafraichir((x) => x + 1)
                  }
                }}
                style={{ height: 'auto' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
