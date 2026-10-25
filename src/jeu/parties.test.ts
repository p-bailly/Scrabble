import { describe, expect, it } from 'vitest'
import { changer, finDePartie, jouerMot, lettresAdversaire } from './classique'
import { analyserCoup } from './coup'
import { compter, nouvellePartie, terminerCoup, tirageValide, tirer, totaux } from './duplicate'
import { genererCoups } from './generateur'
import { graineEnNombre } from './hasard'
import { tousLesJetons } from './lettres'
import { plateauDepuisTexte } from './plateau'
import { dicoAppli, dicoDe, ecrire, posesDe, vide } from './outils-test'

describe('tirages du duplicate (règlement FISF)', () => {
  it('2 voyelles et 2 consonnes jusqu’au 15e coup, puis 1 et 1', () => {
    expect(tirageValide([...'AEBCDFG'], 1)).toBe(true)
    expect(tirageValide([...'ABCDFGH'], 1)).toBe(false)
    expect(tirageValide([...'AEIOUBY'], 15)).toBe(false) // Y = voyelle : une seule consonne
    expect(tirageValide([...'ABCDFGH'], 16)).toBe(true)
    expect(tirageValide([...'AEIOUYE'], 16)).toBe(false)
  })

  it('le joker compte comme voyelle et comme consonne', () => {
    expect(tirageValide([...'A?BCDFG'], 1)).toBe(true)
    expect(tirageValide([...'??BCDFG'], 1)).toBe(true)
    expect(tirageValide([...'?BCDFGH'], 1)).toBe(false)
    expect(compter([...'AY?BC'])).toEqual({ voyelles: 2, consonnes: 2, jokers: 1 })
  })

  it('même graine, mêmes tirages ; tirage refusé remis dans le sac', () => {
    const a = tirer(tousLesJetons(), [], 1, graineEnNombre('test'))
    const b = tirer(tousLesJetons(), [], 1, graineEnNombre('test'))
    expect(a).toEqual(b)
    expect(a.tirage!.tirage).toHaveLength(7)
    expect(tirageValide(a.tirage!.tirage, 1)).toBe(true)
    expect(a.sac.length + 7).toBe(102)
    // Reliquat sans voyelle et sac sans voyelle : impossible, fin de partie.
    expect(tirer([...'BCDFG'], [...'HJ'], 3, 1).tirage).toBeNull()
    // Avec un reliquat, le tirage est complété depuis le sac.
    const c = tirer([...'EEEEBBBB'], [...'RS'], 2, 7)
    expect(c.tirage!.tirage).toHaveLength(7)
  })

  it('partie complète en jouant les tops : jetons conservés, fin de partie', () => {
    const ods = dicoAppli()
    let partie = nouvellePartie('graine-de-test', 180)
    let coups = 0
    while (!partie.finie && coups < 40) {
      const tirage = partie.courant!.tirage
      const tous = genererCoups(ods, plateauDepuisTexte(partie.plateau), tirage, { limite: 10 })
      partie = terminerCoup(partie, tous[0] ?? null, tous[1] ?? null, tous.slice(1), 30)
      coups++
      const plateau = plateauDepuisTexte(partie.plateau).filter(Boolean)
      const enJeu = plateau.length + partie.sac.length + (partie.courant?.tirage.length ?? 0)
      if (!partie.finie) expect(enJeu).toBe(102)
    }
    expect(partie.finie).toBe(true)
    expect(partie.coups.length).toBeGreaterThan(10)
    const t = totaux(partie)
    expect(t.top).toBeGreaterThan(500)
    expect(t.pourcentage).toBeLessThanOrEqual(100)
    // Chaque top est un coup valable sur le plateau de l'époque.
    let p = vide()
    for (const c of partie.coups) {
      const a = analyserCoup(p, c.top.poses, ods)
      expect(a.valide).toBe(true)
      expect(a.points).toBe(c.top.points)
      for (const pose of c.top.poses) p[pose.pos] = pose.lettre
    }
    // Rejouer avec la même graine redonne exactement la même partie.
    let bis = nouvellePartie('graine-de-test', 180, partie.id)
    for (const c of partie.coups) {
      expect(bis.courant!.tirage).toEqual(c.tirage)
      bis = terminerCoup(bis, c.top, c.joueur, c.autres, c.duree)
    }
    expect(bis.plateau).toBe(partie.plateau)
  })
})

describe('partie classique', () => {
  const dico = dicoDe(['MAISON', 'MAISONS', 'SE', 'ZEN'])

  it('jouer un mot complète le chevalet', () => {
    const sac = tousLesJetons().slice(20)
    const r = jouerMot(vide(), [...'MAISONE'], sac, posesDe(vide(), 7, 7, 'H', 'MAISON'), dico, () => 0)
    if ('erreur' in r) throw new Error(r.erreur)
    expect(r.chevalet).toHaveLength(7)
    expect(r.sac).toHaveLength(sac.length - 6)
    expect(r.analyse.points).toBe((2 + 1 + 1 + 1 + 2 + 1) * 2) // O en H12 (LD)
  })

  it('refuse un mot inconnu ou des lettres absentes du chevalet', () => {
    expect(jouerMot(vide(), [...'ZZZABCD'], [], posesDe(vide(), 7, 7, 'H', 'ZZZ'), dico)).toEqual({ erreur: 'Mot inconnu : ZZZ' })
    expect('erreur' in jouerMot(vide(), [...'ABCDEFG'], [], posesDe(vide(), 7, 7, 'H', 'ZEN'), dico)).toBe(true)
  })

  it('changer des lettres : au moins 7 dans le sac', () => {
    expect(changer([...'ABCDEFG'], [...'XYZ'], ['A'])).toHaveProperty('erreur')
    const r = changer([...'ABCDEFG'], [...'HIJKLMNO'], ['A', 'B'], () => 0)
    if ('erreur' in r) throw new Error(r.erreur)
    expect(r.chevalet).toEqual([...'CDEFGHI'])
    expect(r.sac.sort()).toEqual([...'ABJKLMNO'])
  })

  it('fin de partie et déduction des lettres restantes', () => {
    // Chevalet vide et sac vide : le joueur gagne les points de l'adversaire, qui les perd.
    expect(finDePartie([], [[], ['K', 'E']], 0)).toEqual({ ajustements: [11, -11], raison: 'chevalet-vide' })
    // Six passes de suite : chacun perd ses lettres.
    expect(finDePartie(['A'], [['Z'], ['?', 'E']], 6)).toEqual({ ajustements: [-10, -1], raison: 'passes' })
    expect(finDePartie(['A'], [[], ['E']], 2)).toBeNull()
  })

  it('les lettres de l’adversaire se déduisent du reste', () => {
    const plateau = ecrire(vide(), 7, 7, 'H', 'MAISoN')
    const moi = [...'EEARTS?']
    const adversaire = [...'KWLLUEE']
    const sac = tousLesJetons()
    for (const j of [...'MAISN?', ...moi, ...adversaire]) sac.splice(sac.indexOf(j), 1)
    expect(lettresAdversaire(plateau, sac, moi).sort()).toEqual(adversaire.sort())
  })
})
