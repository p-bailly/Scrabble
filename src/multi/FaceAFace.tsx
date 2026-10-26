// Bilan face à face avec chaque adversaire des parties à deux, pour l'onglet Stats. Chargé à part (Firebase) : l'onglet
// ne l'ouvre que si cet appareil a un compte.

import { useEffect, useState } from 'react'
import { bilansFaceAFace, ecouterMesParties, type Bilan } from './donnees'
import { utilisateur } from './firebase'

export default function FaceAFace() {
  const [bilans, setBilans] = useState<Bilan[] | null>(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let actif = true
    let arreter = () => {}
    utilisateur()
      .then((u) => {
        if (!actif) return
        if (!u) return setBilans([])
        arreter = ecouterMesParties(u.uid, (parties) => setBilans(bilansFaceAFace(parties, u.uid)), (e) => setErreur(e.message))
      })
      .catch((e: Error) => actif && setErreur(e.message))
    return () => {
      actif = false
      arreter()
    }
  }, [])

  if (erreur) return <div className="vide-etat">Bilans indisponibles : {erreur}</div>
  if (!bilans) return <div className="vide-etat">Chargement…</div>
  if (bilans.length === 0) return <div className="vide-etat">Aucune partie à deux terminée. Invite un joueur depuis l’onglet Mes parties !</div>
  return (
    <div className="liste">
      {bilans.map((b) => (
        <div className="ligne" key={b.uid} style={{ cursor: 'default' }}>
          <div className="principal">
            <div style={{ fontWeight: 700 }}>{b.pseudo}</div>
            <div className="note">
              {b.victoires} victoire{b.victoires > 1 ? 's' : ''} · {b.egalites} égalité{b.egalites > 1 ? 's' : ''} · {b.defaites} défaite
              {b.defaites > 1 ? 's' : ''}
            </div>
          </div>
          <span className="pts">
            {b.victoires}/{b.victoires + b.defaites + b.egalites}
          </span>
        </div>
      ))}
    </div>
  )
}
