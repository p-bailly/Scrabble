import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { surMasquageOnglets } from './composants/EcranJeu'
import { IconeLoupe, IconeParties, IconeReglages, IconeSolo, IconeStats } from './composants/Icones'
import { useChemin } from './lib/routeur'
import { ContreIA } from './pages/ContreIA'
import { Duplicate } from './pages/Duplicate'
import { Solo } from './pages/Solo'

// Les écrans qu'on n'ouvre pas à chaque lancement ne sont chargés qu'au besoin, pour un démarrage plus rapide.
const chargeurs = {
  analyse: () => import('./pages/Analyse'),
  correction: () => import('./pages/Correction'),
  dictionnaire: () => import('./pages/Dictionnaire'),
  reglages: () => import('./pages/Reglages'),
  stats: () => import('./pages/Stats'),
}
const AnalyseIA = lazy(() => chargeurs.analyse().then((m) => ({ default: m.AnalyseIA })))
const Correction = lazy(() => chargeurs.correction().then((m) => ({ default: m.Correction })))
const Dictionnaire = lazy(() => chargeurs.dictionnaire().then((m) => ({ default: m.Dictionnaire })))
const Reglages = lazy(() => chargeurs.reglages().then((m) => ({ default: m.Reglages })))
const Stats = lazy(() => chargeurs.stats().then((m) => ({ default: m.Stats })))

/**
 * Charge ces écrans en arrière-plan, une fois l'appli affichée : la version web les garde alors en cache et ils
 * s'ouvrent aussi hors ligne, même sans être déjà passé par là.
 */
export function prechargerEcrans() {
  for (const charger of Object.values(chargeurs)) void charger().catch(() => {})
}

// Le multijoueur (et Firebase) n'est chargé que si on l'ouvre : le solo reste léger et marche hors ligne.
// Compte gère la connexion par e-mail, puis affiche les parties.
const Multi = lazy(() => import('./multi/Compte'))

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
  // Pas d'onglets pendant une partie : les écrans de jeu les masquent.
  const [ongletsMasques, setOngletsMasques] = useState(false)
  useEffect(() => surMasquageOnglets(setOngletsMasques), [])
  const page = chemin[0] ?? 'solo'
  let contenu: ReactNode
  if (page === 'correction') contenu = <Correction id={decodeURIComponent(chemin[1] ?? 'courante')} />
  else if (page === 'dictionnaire') contenu = <Dictionnaire />
  else if (page === 'stats') contenu = <Stats />
  else if (page === 'reglages') contenu = <Reglages />
  else if (page === 'parties' || page === 'partie' || page === 'rejoindre')
    contenu = (
      <Suspense fallback={<div className="vide-etat">Chargement…</div>}>
        <Multi chemin={chemin} />
      </Suspense>
    )
  else if (page === 'solo' && chemin[1] === 'duplicate') contenu = <Duplicate key={chemin[2]} id={chemin[2] && decodeURIComponent(chemin[2])} />
  else if (page === 'solo' && chemin[1] === 'ia' && chemin[2] === 'analyse') contenu = <AnalyseIA id={decodeURIComponent(chemin[3] ?? 'courante')} />
  else if (page === 'solo' && chemin[1] === 'ia') contenu = <ContreIA key={chemin[2]} id={chemin[2] && decodeURIComponent(chemin[2])} />
  else contenu = <Solo />

  const onglet = page === 'correction' ? 'solo' : page === 'partie' || page === 'rejoindre' ? 'parties' : page
  return (
    <div className="appli">
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div className="vide-etat">Chargement…</div>}>{contenu}</Suspense>
      </main>
      <nav className="onglets" hidden={ongletsMasques}>
        <Onglet href="#/solo" actif={onglet === 'solo'} icone={<IconeSolo />} texte="Solo" />
        <Onglet href="#/parties" actif={onglet === 'parties'} icone={<IconeParties />} texte="Mes parties" pastille={aMoi} />
        <Onglet href="#/dictionnaire" actif={onglet === 'dictionnaire'} icone={<IconeLoupe />} texte="Dictionnaire" />
        <Onglet href="#/stats" actif={onglet === 'stats'} icone={<IconeStats />} texte="Stats" />
        <Onglet href="#/reglages" actif={onglet === 'reglages'} icone={<IconeReglages />} texte="Réglages" />
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
