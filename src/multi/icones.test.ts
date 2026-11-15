import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emojiIcone, ICONES, LONGUEUR_ICONE } from './icones'

describe('icônes des joueurs', () => {
  it('des identifiants uniques, assez courts pour les règles Firestore', () => {
    const ids = ICONES.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(new RegExp(`^[a-z]{1,${LONGUEUR_ICONE}}$`))
    expect(readFileSync('firestore.rules', 'utf8')).toContain(`icone.size() <= ${LONGUEUR_ICONE}`)
  })

  it('un identifiant absent ou inconnu ne donne pas d’icône : l’initiale reste', () => {
    expect(emojiIcone('renard')).toBe('🦊')
    expect(emojiIcone('licorne')).toBeUndefined()
    expect(emojiIcone(undefined)).toBeUndefined()
    expect(emojiIcone(null)).toBeUndefined()
  })
})
