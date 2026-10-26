import { describe, expect, it } from 'vitest'
import { motsAvecLettres, nettoyerLettres } from './anagrammes'
import { dicoAppli, dicoDe } from './outils-test'

describe('mots avec des lettres données', () => {
  const d = dicoDe(['AS', 'SA', 'ASE', 'ASEE', 'EAU', 'RAS', 'SEL', 'SELLE', 'ELLE', 'LES', 'ZEN'])

  it('trouve les mots écrits avec chaque lettre au plus une fois', () => {
    const r = motsAvecLettres(d, 'SALE')
    // Du plus long au plus court ; à longueur et points égaux, par ordre alphabétique.
    expect(r.mots.map((m) => m.mot)).toEqual(['ASE', 'LES', 'SEL', 'AS', 'SA'])
    expect(r.mots.map((m) => m.mot)).not.toContain('SELLE') // un seul L
    expect(r.mots.map((m) => m.mot)).not.toContain('ASEE') // un seul E
    expect(r.tronque).toBe(false)
  })

  it('calcule les points sans case bonus et classe du plus long au plus cher', () => {
    const r = motsAvecLettres(d, 'SALEZ')
    const asE = r.mots.find((m) => m.mot === 'ASE')!
    expect(asE.points).toBe(3) // A1 S1 E1
    const longueurs = r.mots.map((m) => m.mot.length)
    expect(longueurs).toEqual([...longueurs].sort((a, b) => b - a))
  })

  it('un joker remplace n’importe quelle lettre et vaut 0 ; il est en minuscule', () => {
    const r = motsAvecLettres(d, 'ZE?')
    const zen = r.mots.find((m) => m.mot === 'ZEn')!
    expect(zen.points).toBe(10 + 1) // Z10 E1, le N est un joker
    // Une vraie lettre est préférée au joker quand on l'a.
    expect(motsAvecLettres(d, 'ZEN?').mots.find((m) => m.mot.toUpperCase() === 'ZEN')!.mot).toBe('ZEN')
  })

  it('anagrammes : seulement les mots qui emploient toutes les lettres', () => {
    expect(motsAvecLettres(d, 'SAL', { toutes: true }).mots.map((m) => m.mot)).toEqual([])
    expect(motsAvecLettres(d, 'SEL', { toutes: true }).mots.map((m) => m.mot).sort()).toEqual(['LES', 'SEL'])
    expect(motsAvecLettres(d, 'AS', { toutes: true }).mots.map((m) => m.mot).sort()).toEqual(['AS', 'SA'])
  })

  it('coupe la liste à la limite en gardant les plus longs', () => {
    const r = motsAvecLettres(d, 'SALEL?', { limite: 3 })
    expect(r.mots).toHaveLength(3)
    expect(r.tronque).toBe(true)
    expect(r.mots[0].mot.length).toBeGreaterThanOrEqual(r.mots[2].mot.length)
  })

  it('ignore les accents, la casse et ce qui n’est pas une lettre', () => {
    expect(nettoyerLettres('é a-s ?')).toBe('EAS?')
    expect(motsAvecLettres(d, 'e a u').mots.map((m) => m.mot)).toContain('EAU')
  })

  it('sur le vrai dictionnaire, un tirage de 7 lettres donne ses scrabbles', () => {
    const ods = dicoAppli()
    const r = motsAvecLettres(ods, 'ARTISTE', { toutes: true })
    expect(r.mots.map((m) => m.mot)).toEqual(expect.arrayContaining(['ARTISTE', 'ATTIRES', 'TRAITES']))
    // Chaque mot trouvé existe bien dans le dictionnaire et n'emploie que les lettres données.
    for (const m of r.mots) expect(ods.contient(m.mot)).toBe(true)
    const avecJoker = motsAvecLettres(ods, 'RETIAN?', { toutes: true })
    expect(avecJoker.mots.length).toBeGreaterThan(5)
    for (const m of avecJoker.mots) expect(ods.contient(m.mot.toUpperCase())).toBe(true)
  })
})
