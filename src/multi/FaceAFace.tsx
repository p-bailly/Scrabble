// Bilan face à face avec chaque adversaire des parties à deux (résultats, forme, scores, records, parties à analyser),
// pour l'onglet Stats. Chargé à part (Firebase) : l'onglet ne l'ouvre que si cet appareil a un compte.

import { useEffect, useState } from 'react'
import { depuisRemiseAZero } from '../solo/remiseAZero'
import { naviguer } from '../lib/routeur'
import { bilansFaceAFace, ecouterMesParties, type Bilan, type PartieJouee } from './donnees'
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
        arreter = ecouterMesParties(u.uid, (parties) => setBilans(bilansFaceAFace(parties, u.uid, depuisRemiseAZero())), (e) => setErreur(e.message))
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

  const toutes = bilans.flatMap((b) => b.parties)
  const victoires = toutes.filter((p) => p.resultat === 'victoire').length
  const record = Math.max(0, ...bilans.map((b) => b.record.moi))
  return (
    <div className="liste">
      <div className="stats">
        <div className="stat">
          <div className="etiquette">Parties</div>
          <div className="valeur">{toutes.length}</div>
        </div>
        <div className="stat">
          <div className="etiquette">Gagnées</div>
          <div className="valeur">{Math.round((100 * victoires) / toutes.length)} %</div>
        </div>
        <div className="stat">
          <div className="etiquette">Ton record</div>
          <div className="valeur">{record || '—'}</div>
        </div>
      </div>
      {bilans.map((b) => (
        <Adversaire key={b.uid} b={b} />
      ))}
    </div>
  )
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const date = (ms: number) => (ms ? new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const LETTRE = { victoire: 'V', defaite: 'D', egalite: 'N' } as const
const NOM_SERIE = { victoire: 'victoire', defaite: 'défaite', egalite: 'égalité' } as const

/** Le bilan contre un adversaire : résultats, forme du moment, scores, records et liste des parties. */
function Adversaire({ b }: { b: Bilan }) {
  const [ouvert, setOuvert] = useState(false)
  const total = b.parties.length
  const forme = b.parties.slice(0, 5).reverse()
  const ecart = (p: PartieJouee) => p.mesPoints - p.sesPoints
  return (
    <div className="carte face-a-face">
      <div className="fa-entete">
        <div className="principal">
          <div className="fa-nom">{b.pseudo}</div>
          <div className="note">
            {pluriel(total, 'partie')} · {pluriel(b.egalites, 'égalité')}
          </div>
        </div>
        <div className="fa-score" aria-label={`${b.victoires} victoires, ${b.defaites} défaites`}>
          <span className="ecart-ok">{b.victoires}</span> – <span className="ecart-neg">{b.defaites}</span>
        </div>
      </div>
      <div className="fa-barre" aria-hidden>
        <div className="v" style={{ flex: b.victoires }} />
        <div className="e" style={{ flex: b.egalites }} />
        <div className="d" style={{ flex: b.defaites }} />
      </div>

      <div className="fa-forme">
        <span className="note">Dernières parties</span>
        {forme.map((p) => (
          <span key={p.code} className={'fa-pion ' + p.resultat} title={date(p.date)}>
            {LETTRE[p.resultat]}
          </span>
        ))}
        {b.serie && b.serie.nombre >= 2 && (
          <span className="note fa-serie">
            {b.serie.nombre} {NOM_SERIE[b.serie.resultat]}s de suite
          </span>
        )}
      </div>

      <dl className="fa-chiffres">
        {b.moyenne && (
          <>
            <dt>Score moyen</dt>
            <dd>
              toi {Math.round(b.moyenne.moi)} · {b.pseudo} {Math.round(b.moyenne.lui)}
            </dd>
            <dt>Meilleur score</dt>
            <dd>
              toi {b.record.moi} · {b.pseudo} {b.record.lui}
            </dd>
          </>
        )}
        {b.plusLargeVictoire && (
          <>
            <dt>Plus large victoire</dt>
            <dd>
              <span className="ecart-ok">+{ecart(b.plusLargeVictoire)}</span> ({b.plusLargeVictoire.mesPoints} – {b.plusLargeVictoire.sesPoints})
            </dd>
          </>
        )}
        {b.plusLourdeDefaite && (
          <>
            <dt>Plus lourde défaite</dt>
            <dd>
              <span className="ecart-neg">{ecart(b.plusLourdeDefaite)}</span> ({b.plusLourdeDefaite.mesPoints} – {b.plusLourdeDefaite.sesPoints})
            </dd>
          </>
        )}
        {b.meilleureSerie >= 2 && (
          <>
            <dt>Meilleure série</dt>
            <dd>{b.meilleureSerie} victoires de suite</dd>
          </>
        )}
      </dl>

      <button type="button" className="bouton discret" onClick={() => setOuvert(!ouvert)}>
        {ouvert ? 'Masquer les parties' : `Voir les parties (${total})`}
      </button>
      {ouvert && (
        <div className="liste">
          {b.parties.map((p) => (
            <button type="button" className="ligne" key={p.code} onClick={() => naviguer('partie/' + p.code + '/analyse')}>
              <span className={'fa-pion ' + p.resultat}>{LETTRE[p.resultat]}</span>
              <div className="principal">
                <div style={{ fontWeight: 700 }}>
                  {p.mesPoints} – {p.sesPoints}
                </div>
                <div className="note">
                  {date(p.date)}
                  {p.abandon === 'moi' && ' · tu as abandonné'}
                  {p.abandon === 'lui' && ` · ${b.pseudo} a abandonné`} · toucher pour l’analyser
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
