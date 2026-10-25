import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { IconeLoupe, IconeParties, IconeSolo, IconeStats } from './composants/Icones'
import { useChemin } from './lib/routeur'
import { Calculateur } from './pages/Calculateur'
import { Correction } from './pages/Correction'
import { Solo } from './pages/Solo'
import { Stats } from './pages/Stats'

// Le multijoueur (et Firebase) n'est chargé que si on l'ouvre : le solo reste léger et marche hors ligne.
const Multi = lazy(() => import('./multi/Multi'))

/** Nom de l'événement émis par la veille des parties à deux (multi/veille.ts). */
const EVENEMENT_TOUR = 'scrabble:tour'

export function App() {
  const chemin = useChemin()
  // Nombre de parties où c'est mon tour, pour la pastille de l'onglet.
  const [aMoi, setAMoi] = useState(0)
  useEffect(() => {
    const maj = (e: Event) => setAMoi((e as CustomEvent<number>).detail)
    window.addEventListener(EVENEMENT_TOUR, maj)
    return () => window.removeEventListener(EVENEMENT_TOUR, maj)
  }, [])
  const page = chemin[0] ?? 'solo'
  let contenu: ReactNode
  if (page === 'correction') contenu = <Correction id={decodeURIComponent(chemin[1] ?? 'courante')} />
  else if (page === 'calculateur') contenu = <Calculateur />
  else if (page === 'stats') contenu = <Stats />
  else if (page === 'parties' || page === 'partie' || page === 'rejoindre')
    contenu = (
      <Suspense fallback={<div className="vide-etat">Chargement…</div>}>
        <Multi chemin={chemin} />
      </Suspense>
    )
  else contenu = <Solo />

  const onglet = page === 'correction' ? 'solo' : page === 'partie' || page === 'rejoindre' ? 'parties' : page
  return (
    <div className="appli">
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{contenu}</main>
      <nav className="onglets">
        <Onglet href="#/solo" actif={onglet === 'solo'} icone={<IconeSolo />} texte="Solo" />
        <Onglet href="#/parties" actif={onglet === 'parties'} icone={<IconeParties />} texte="Mes parties" pastille={aMoi} />
        <Onglet href="#/calculateur" actif={onglet === 'calculateur'} icone={<IconeLoupe />} texte="Calculateur" />
        <Onglet href="#/stats" actif={onglet === 'stats'} icone={<IconeStats />} texte="Stats" />
      </nav>
    </div>
  )
}

function Onglet({ href, actif, icone, texte, pastille = 0 }: { href: string; actif: boolean; icone: ReactNode; texte: string; pastille?: number }) {
  return (
    <a href={href} className={actif ? 'actif' : ''} aria-current={actif ? 'page' : undefined}>
      {icone}
      {pastille > 0 && <span className="pastille">{pastille}</span>}
      {texte}
    </a>
  )
}
