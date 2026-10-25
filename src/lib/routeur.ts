// Routage par « hash » (#/solo, #/partie/K7P2QX…) : marche sans serveur, en PWA comme dans l'APK.

import { useEffect, useState } from 'react'

export const cheminActuel = (): string[] => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

export function naviguer(chemin: string, remplacer = false) {
  const hash = '#/' + chemin.replace(/^\/+/, '')
  if (remplacer) history.replaceState(null, '', hash)
  else location.hash = hash
  if (remplacer) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useChemin(): string[] {
  const [chemin, setChemin] = useState(cheminActuel)
  useEffect(() => {
    const maj = () => setChemin(cheminActuel())
    window.addEventListener('hashchange', maj)
    return () => window.removeEventListener('hashchange', maj)
  }, [])
  return chemin
}
