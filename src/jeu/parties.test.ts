import { describe, expect, it } from 'vitest'
import { changer, finDePartie, jouerMot, lettresAdversaire, lettresNonVues } from './classique'
import { analyserCoup, type Coup } from './coup'
import {
  INDICES,
  compter,
  modeDe,
  nouvellePartie,
  plateauAvantCoup,
  terminerCoup,
  texteIndice,
  tirageValide,
  tirer,
  topTrouve,
  totaux,
} from './duplicate'
import { genererCoups } from './generateur'
import { graineEnNombre } from './hasard'
import { tousLesJetons } from './lettres'
import { plateauDepuisTexte, plateauEnTexte } from './plateau'
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

  it('les lettres non vues : ni sur le plateau, ni sur mon chevalet (sac et chevalet adverse)', () => {
    const moi = [...'EEARTS?']
    // Au départ : les 102 jetons moins mon chevalet.
    expect(lettresNonVues(vide(), moi)).toHaveLength(102 - 7)
    // Un joker posé (minuscule) retire un joker, pas la lettre qu'il représente.
    const plateau = ecrire(vide(), 7, 7, 'H', 'MAISoN')
    const nonVues = lettresNonVues(plateau, moi)
    const nb = (l: string) => nonVues.filter((x) => x === l).length
    expect(nonVues).toHaveLength(102 - 6 - 7)
    expect(nb('?')).toBe(0) // les deux jokers : un posé, un sur mon chevalet
    expect(nb('O')).toBe(6) // le « o » posé est un joker : aucun O de moins
    expect(nb('E')).toBe(15 - 2)
    // Ce que contient le sac, plus les lettres de l'adversaire, c'est exactement ce qu'on n'a pas vu.
    const adversaire = [...'KWLLUEE']
    const sac = tousLesJetons()
    for (const j of [...'MAISN?', ...moi, ...adversaire]) sac.splice(sac.indexOf(j), 1)
    expect([...sac, ...adversaire].sort()).toEqual(nonVues.sort())
  })
})

describe('topping du duplicate', () => {
  const coup = (mot: string, points: number, debut: number, dir: 'H' | 'V' = 'H'): Coup => ({
    poses: [...mot].map((lettre, i) => ({ pos: debut + i * (dir === 'H' ? 1 : 15), lettre })),
    mot,
    dir,
    debut,
    points,
  })

  it('même graine, mêmes tirages ; une autre graine, d’autres tirages', () => {
    const t = (g: string) => nouvellePartie(g, 180).courant!.tirage.join('')
    expect(t('PARTIE-1')).toBe(t('PARTIE-1'))
    expect(t('PARTIE-1')).not.toBe(t('PARTIE-2'))
  })

  it('une partie ancienne, sans mode, est un entraînement', () => {
    const p = nouvellePartie('mode', 180)
    expect(modeDe(p)).toBe('entrainement')
    const { mode: _mode, ...ancienne } = p
    expect(modeDe(ancienne as typeof p)).toBe('entrainement')
    expect(modeDe(nouvellePartie('mode', 60, 'x', 'topping'))).toBe('topping')
  })

  it('les indices révèlent le top sans le donner', () => {
    const top = coup('MAISON', 24, 7 * 15 + 3, 'V')
    expect(texteIndice('valeur', top)).toBe('24 points')
    expect(texteIndice('longueur', top)).toBe('6 lettres')
    expect(texteIndice('direction', top)).toBe('vertical')
    expect(texteIndice('position', top)).toBe('départ ligne H, colonne 4')
    expect(INDICES).toHaveLength(4)
  })

  it('le top est trouvé quand le coup du joueur vaut autant', () => {
    const base = { numero: 1, tirage: [], reliquat: [], rejets: 0, autres: [], duree: 42 }
    const top = coup('MAISON', 24, 112)
    expect(topTrouve({ ...base, top, joueur: coup('SON', 24, 112) })).toBe(true)
    expect(topTrouve({ ...base, top, joueur: coup('SON', 20, 112) })).toBe(false)
    expect(topTrouve({ ...base, top, joueur: null })).toBe(false)
  })

  it('terminerCoup garde les indices demandés ; les totaux comptent tops trouvés et temps moyen', () => {
    const ods = dicoAppli()
    let partie = nouvellePartie('totaux', 120, 'p', 'topping')
    for (let i = 0; i < 3; i++) {
      const tous = genererCoups(ods, plateauDepuisTexte(partie.plateau), partie.courant!.tirage, { limite: 5 })
      // Premier et troisième coups : top trouvé ; deuxième : un coup moins bon, avec deux indices.
      const joueur = i === 1 ? tous[1] : tous[0]
      partie = terminerCoup(partie, tous[0], joueur, tous, 30 + i * 10, i === 1 ? ['valeur', 'longueur'] : [])
    }
    expect(partie.coups[1].indices).toEqual(['valeur', 'longueur'])
    expect(partie.coups[0].indices).toBeUndefined()
    const t = totaux(partie)
    expect(t.indices).toBe(2)
    expect(t.trouves).toBe(partie.coups.filter((c) => c.joueur!.points >= c.top.points).length)
    expect(t.trouves).toBeGreaterThanOrEqual(2)
    expect(t.tempsMoyen).toBeGreaterThan(0)
  })

  it('le plateau avant un coup se reconstruit à partir des tops précédents', () => {
    const ods = dicoAppli()
    let partie = nouvellePartie('avant', 180)
    const plateaux: string[] = [partie.plateau]
    for (let i = 0; i < 3; i++) {
      const tous = genererCoups(ods, plateauDepuisTexte(partie.plateau), partie.courant!.tirage, { limite: 3 })
      partie = terminerCoup(partie, tous[0], null, tous, 10)
      plateaux.push(partie.plateau)
    }
    for (let n = 1; n <= 4; n++) expect(plateauEnTexte(plateauAvantCoup(partie, n))).toBe(plateaux[n - 1])
  })
})
