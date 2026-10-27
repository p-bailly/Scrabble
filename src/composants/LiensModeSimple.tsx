// Mode simple : Stats et Réglages n'ont plus d'onglet. Ces deux liens discrets, en bas de Solo et de « Mes parties »,
// y mènent quand même (pour revenir au mode complet, par exemple).

import { useReglages } from '../lib/reglages'
import { naviguer } from '../lib/routeur'

export function LiensModeSimple() {
  const { simple } = useReglages()
  if (!simple) return null
  return (
    <div className="actions">
      <button type="button" className="bouton discret large" onClick={() => naviguer('stats')}>
        Mes résultats
      </button>
      <button type="button" className="bouton discret large" onClick={() => naviguer('reglages')}>
        Réglages
      </button>
    </div>
  )
}
