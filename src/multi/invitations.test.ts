import type { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { reference } from '../jeu/coup'
import { adversairesRecents, cleRecherche, MIN_RECHERCHE, toursDeMulti, type CoupMulti, type Partie } from './donnees'

const instant = (ms: number) => ({ toMillis: () => ms }) as unknown as Timestamp

function partie(code: string, joueurs: string[], pseudos: Record<string, string>, majLe: number | null): Partie {
  return { code, joueurs, pseudos, majLe: majLe === null ? null : instant(majLe) } as Partie
}

describe('clé de recherche', () => {
  it('ignore accents, majuscules et ponctuation', () => {
    expect(cleRecherche('Jean Luc')).toBe('jean-luc')
    expect(cleRecherche('jean-luc')).toBe('jean-luc')
    expect(cleRecherche('  Élodie ')).toBe('elodie')
  })
  it('un nom sans lettre ni chiffre donne une clé vide, donc introuvable', () => {
    expect(cleRecherche('???')).toBe('')
    expect(cleRecherche('???').length).toBeLessThan(MIN_RECHERCHE)
  })
})

describe('adversaires récents', () => {
  const moi = 'moi'

  it('du plus récent au plus ancien, chacun une fois', () => {
    const parties = [
      partie('A', [moi, 'marie'], { moi: 'Moi', marie: 'Marie' }, 100),
      partie('B', [moi, 'paul'], { moi: 'Moi', paul: 'Paul' }, 300),
      partie('C', [moi, 'marie'], { moi: 'Moi', marie: 'Marie' }, 200),
    ]
    expect(adversairesRecents(parties, moi)).toEqual([
      { uid: 'paul', pseudo: 'Paul' },
      { uid: 'marie', pseudo: 'Marie' },
    ])
  })

  it('reprend le pseudo de la partie la plus récente', () => {
    const parties = [
      partie('A', [moi, 'marie'], { moi: 'Moi', marie: 'Marie' }, 100),
      partie('B', [moi, 'marie'], { moi: 'Moi', marie: 'Marie-Claire' }, 200),
    ]
    expect(adversairesRecents(parties, moi)).toEqual([{ uid: 'marie', pseudo: 'Marie-Claire' }])
  })

  it('ignore les parties sans adversaire (invitation en attente)', () => {
    expect(adversairesRecents([partie('A', [moi], { moi: 'Moi', marie: 'Marie' }, 100)], moi)).toEqual([])
  })

  it('une partie dont l’écriture n’est pas encore partie (date inconnue) passe pour la plus récente', () => {
    const parties = [partie('A', [moi, 'marie'], { marie: 'Marie' }, 100), partie('B', [moi, 'paul'], { paul: 'Paul' }, null)]
    expect(adversairesRecents(parties, moi).map((j) => j.uid)).toEqual(['paul', 'marie'])
  })
})

describe('tours d’une partie à deux, pour l’analyse', () => {
  const coups: CoupMulti[] = [
    {
      n: 1,
      uid: 'a',
      type: 'mot',
      poses: [
        { pos: 112, lettre: 'A' },
        { pos: 113, lettre: 'b' },
      ],
      mot: 'Ab',
      ref: reference(112, 'H'),
      points: 5,
      chevalet: 'AB?CDEF',
    },
    { n: 2, uid: 'b', type: 'passe', points: 0, chevalet: 'XYZ' },
    { n: 3, uid: 'a', type: 'change', points: 0, nbChanges: 2 },
    { n: 4, uid: 'b', type: 'mot', poses: [{ pos: 40, lettre: 'E' }], mot: 'E', ref: reference(40, 'V'), points: 2, chevalet: 'E' },
  ]
  const tours = toursDeMulti(coups)

  it('relit la place et le sens du coup dans sa référence (H4, 4H)', () => {
    expect(tours[0].coup).toEqual({ poses: coups[0].poses, mot: 'Ab', dir: 'H', debut: 112, points: 5 })
    expect(tours[3].coup).toMatchObject({ dir: 'V', debut: 40 })
  })

  it('garde le chevalet de chaque tour, et signale les coups d’avant l’analyse (sans chevalet)', () => {
    expect(tours[0].chevalet).toEqual([...'AB?CDEF'])
    expect(tours[1].chevalet).toEqual([...'XYZ'])
    expect(tours[2].chevalet).toBeUndefined()
  })

  it('un passage ou un échange n’a pas de coup, seulement ses points et son nombre de lettres', () => {
    expect(tours[1]).toMatchObject({ numero: 2, joueur: 'b', type: 'passe', points: 0 })
    expect(tours[1].coup).toBeUndefined()
    expect(tours[2]).toMatchObject({ type: 'change', nbChanges: 2 })
  })
})
