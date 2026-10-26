import type { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { adversairesRecents, cleRecherche, MIN_RECHERCHE, type Partie } from './donnees'

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
