// Historique des parties de duplicate et statistiques.

import { useState } from 'react'
import { Entete } from '../composants/Entete'
import { PROFILS } from '../jeu/ia'
import { aides } from '../jeu/contreIA'
import { naviguer } from '../lib/routeur'
import { formatPct, formatTemps, statistiques, supprimerDeHistorique } from '../solo/sauvegarde'
import { bilanParNiveau, lirePartiesIA } from '../solo/sauvegardeIA'

export function Stats() {
  const [, rafraichir] = useState(0)
  const s = statistiques()
  const contreIA = bilanParNiveau().filter((b) => b.parties > 0)
  const partiesIA = lirePartiesIA().slice(0, 5)
  return (
    <div className="contenu">
      <Entete titre="Statistiques" />
      <h2>Duplicate</h2>
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
      <h2>Contre l’IA</h2>
      {contreIA.length === 0 ? (
        <div className="vide-etat">Aucune partie contre l’IA. Défie-la dans l’onglet Solo !</div>
      ) : (
        <div className="liste">
          {contreIA.map((b) => (
            <div className="ligne" key={b.niveau} style={{ cursor: 'default' }}>
              <div className="principal">
                <div style={{ fontWeight: 700 }}>{PROFILS[b.niveau].nom}</div>
                <div className="note">
                  {b.victoires} victoire{b.victoires > 1 ? 's' : ''} · {b.egalites} égalité{b.egalites > 1 ? 's' : ''} · {b.defaites} défaite
                  {b.defaites > 1 ? 's' : ''}
                  {b.meilleur > 0 && ` · meilleur score gagnant ${b.meilleur}`}
                </div>
              </div>
              <span className="pts">
                {b.victoires}/{b.parties}
              </span>
            </div>
          ))}
        </div>
      )}
      {partiesIA.length > 0 && (
        <>
          <h2>Dernières parties contre l’IA</h2>
          <div className="liste">
            {partiesIA.map((p) => (
              <button type="button" className="ligne" key={p.id} onClick={() => naviguer('solo/ia/analyse/' + encodeURIComponent(p.id))}>
                <div className="principal">
                  <div style={{ fontWeight: 700 }}>
                    {new Date(p.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {PROFILS[p.niveau].nom}
                  </div>
                  <div className="note">
                    {p.fin?.raison === 'abandon' ? 'Abandonnée' : p.fin?.gagnant === 'moi' ? 'Gagnée' : p.fin?.gagnant === 'ia' ? 'Perdue' : 'Égalité'} ·{' '}
                    {p.scores.moi} – {p.scores.ia}
                    {aides(p) && ` · ${aides(p)}`} · toucher pour l’analyser
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      <h2>Historique du duplicate</h2>
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
                    {p.mode === 'topping' ? 'Topping' : 'Entraînement'} · {p.nbCoups} coups · {formatTemps(p.temps)} · {p.joueur} / {p.top}
                    {p.mode === 'topping' && ` · ${p.trouves} tops trouvés`}
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
