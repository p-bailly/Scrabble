// Analyse d'une partie à deux terminée : l'historique des coups (avec le chevalet de chaque tour) vient de Firestore.

import { useEffect, useMemo, useState } from 'react'
import { Entete } from '../composants/Entete'
import { AnalysePartie } from '../pages/Analyse'
import { naviguer } from '../lib/routeur'
import { ecouterCoups, ecouterPartie, toursDeMulti, type CoupMulti, type Partie } from './donnees'

export default function AnalyseMulti({ code, uid }: { code: string; uid: string }) {
  const [p, setP] = useState<Partie | null | undefined>(undefined)
  const [coups, setCoups] = useState<CoupMulti[] | null>(null)
  useEffect(() => ecouterPartie(code, setP), [code])
  useEffect(() => ecouterCoups(code, setCoups), [code])

  const partie = useMemo(() => {
    if (!p || !coups) return null
    return {
      tours: toursDeMulti(coups),
      // Moi d'abord : c'est mon bilan qu'on regarde en premier.
      joueurs: [uid, ...p.joueurs.filter((j) => j !== uid)].map((id) => ({ id, nom: id === uid ? 'Toi' : (p.pseudos[id] ?? '?') })),
      moi: uid,
    }
  }, [p, coups, uid])

  const retour = 'partie/' + code
  if (p === undefined || (p && !coups)) return <div className="vide-etat">Chargement…</div>
  // Les chevalets des tours passés révèlent le jeu de l'adversaire : pas d'analyse en cours de partie.
  if (p === null || p.etat !== 'finie' || !partie)
    return (
      <div className="contenu">
        <Entete titre="Analyse" />
        <div className="vide-etat">{p === null ? 'Cette partie n’existe pas ou plus.' : 'L’analyse est possible une fois la partie terminée.'}</div>
        <button type="button" className="bouton discret" onClick={() => naviguer(retour)}>
          Retour à la partie
        </button>
      </div>
    )
  return <AnalysePartie partie={partie} retour={retour} />
}
