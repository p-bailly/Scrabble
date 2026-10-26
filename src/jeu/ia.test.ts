import { describe, expect, it } from 'vitest'
import { PASSES_MAX } from './classique'
import {
  abandonnerIA,
  appliquerDecision,
  changerIA,
  chevaletAdverseConnu,
  jouerMotIA,
  nouvellePartieIA,
  passerIA,
  resumeIA,
  type Camp,
  type PartieIA,
} from './contreIA'
import { analyserCoup, jetonsUtilises, retirerDuChevalet, type Coup } from './coup'
import { genererCoups } from './generateur'
import { Hasard, graineEnNombre } from './hasard'
import { choisir, decider, meilleurEchange, NIVEAUX, PROFILS, valeurReste, type ContexteIA, type NiveauIA } from './ia'
import { plateauDepuisTexte, type Plateau } from './plateau'
import { dicoAppli } from './outils-test'

/** Hasard reproductible, comme une fonction qui renvoie un nombre dans [0, 1). */
const hasardDe = (graine: string) => {
  const h = new Hasard(graineEnNombre(graine))
  return () => h.entier(1_000_000) / 1_000_000
}

const contexte = (p: PartieIA, camp: Camp, niveau: NiveauIA): ContexteIA => ({
  niveau,
  plateau: plateauDepuisTexte(p.plateau),
  chevalet: p.chevalets[camp],
  sac: p.sac.length,
  adversaire: chevaletAdverseConnu(p, camp),
})

/** Joue une partie complète entre deux niveaux ; vérifie la conservation des 102 jetons à chaque coup. */
function jouerPartie(niveaux: Record<Camp, NiveauIA>, graine: string, arret = 200): PartieIA {
  const ods = dicoAppli()
  const hasard = hasardDe(graine)
  let p = nouvellePartieIA(niveaux.moi, 'moi', hasard, graine)
  while (!p.finie && p.coups.length < arret) {
    const camp = p.tour
    const r = appliquerDecision(p, decider(ods, contexte(p, camp, niveaux[camp]), hasard), hasard, camp)
    if ('erreur' in r) throw new Error(r.erreur)
    p = r
    const surPlateau = plateauDepuisTexte(p.plateau).filter(Boolean).length
    expect(surPlateau + p.sac.length + p.chevalets.moi.length + p.chevalets.ia.length).toBe(102)
  }
  return p
}

describe('valeur des lettres gardées', () => {
  it('le joker et le S valent cher, le Q et les doublons se paient', () => {
    expect(valeurReste([...'?'])).toBeGreaterThan(valeurReste([...'S']))
    expect(valeurReste([...'S'])).toBeGreaterThan(valeurReste([...'R']))
    expect(valeurReste([...'Q'])).toBeLessThan(0)
    expect(valeurReste([...'RT'])).toBeGreaterThan(valeurReste([...'TT']))
    expect(valeurReste([])).toBe(0)
  })

  it('un chevalet équilibré vaut mieux qu’un chevalet sans voyelle', () => {
    expect(valeurReste([...'AIRTS'])).toBeGreaterThan(valeurReste([...'RTSNL']))
  })

  it('l’échange garde le joker et rend au moins une lettre', () => {
    const rendues = meilleurEchange([...'?SQVWKU'])
    expect(rendues.length).toBeGreaterThan(0)
    expect(rendues).not.toContain('?')
    expect(rendues).not.toContain('S')
    expect(rendues).toContain('Q')
  })
})

describe('choix du coup selon le niveau', () => {
  // Une position de milieu de partie, jouée par le champion, et le chevalet du joueur suivant.
  const ods = dicoAppli()
  const hasard = hasardDe('position')
  let p = nouvellePartieIA('champion', 'moi', hasard, 'position')
  for (let i = 0; i < 8; i++) {
    const camp = p.tour
    const r = appliquerDecision(p, decider(ods, contexte(p, camp, 'champion'), hasard), hasard, camp)
    if ('erreur' in r) throw new Error(r.erreur)
    p = r
  }
  const camp = p.tour
  const plateau: Plateau = plateauDepuisTexte(p.plateau)
  const chevalet = p.chevalets[camp]
  const coups = genererCoups(ods, plateau, chevalet)

  const decisions = (niveau: NiveauIA, n: number) => {
    const h = hasardDe('essais-' + niveau)
    const ctx: ContexteIA = { niveau, plateau, chevalet, sac: p.sac.length, adversaire: null }
    return Array.from({ length: n }, () => choisir(coups, ctx, h))
  }

  it('la position de départ a de quoi choisir', () => {
    expect(coups.length).toBeGreaterThan(20)
  })

  it('chaque niveau joue un coup légal qui tient sur son chevalet', () => {
    for (const niveau of NIVEAUX) {
      for (const d of decisions(niveau, 30)) {
        if (d.type !== 'mot') continue
        const a = analyserCoup(plateau, d.coup.poses, ods)
        expect(a.valide).toBe(true)
        expect(a.points).toBe(d.coup.points)
        expect(retirerDuChevalet(chevalet, jetonsUtilises(d.coup.poses))).not.toBeNull()
      }
    }
  })

  it('plus le niveau est haut, plus le coup joué rapporte', () => {
    const moyenne = (niveau: NiveauIA) => {
      const ds = decisions(niveau, 300)
      const pts = ds.map((d) => (d.type === 'mot' ? d.coup.points : 0))
      return pts.reduce((a, b) => a + b, 0) / pts.length
    }
    const m = NIVEAUX.map(moyenne)
    for (let i = 1; i < 4; i++) expect(m[i]).toBeGreaterThan(m[i - 1])
    expect(m[4]).toBeGreaterThan(m[2])
  })

  it('le débutant joue de petits mots', () => {
    for (const d of decisions('debutant', 100)) {
      expect(d.type).toBe('mot')
      if (d.type === 'mot') expect(d.coup.mot.length).toBeLessThanOrEqual(PROFILS.debutant.longueurMax)
    }
  })

  it('le champion joue le scrabble quand il y en a un', () => {
    const scrabble = coups.find((c) => c.poses.length === 7)
    if (!scrabble) return // pas de scrabble sur cette position : rien à vérifier
    for (const d of decisions('champion', 5)) expect(d).toEqual({ type: 'mot', coup: scrabble })
  })

  it('sans coup possible : on change les lettres s’il reste 7 jetons au sac, sinon on passe', () => {
    const ctx = (sac: number): ContexteIA => ({ niveau: 'amateur', plateau, chevalet, sac, adversaire: null })
    const h = hasardDe('rien')
    const change = choisir([], ctx(20), h)
    expect(change.type).toBe('change')
    if (change.type === 'change') expect(change.lettres.length).toBeGreaterThan(0)
    expect(choisir([], ctx(6), h)).toEqual({ type: 'passe' })
  })

  it('en fin de partie, le champion connaît le chevalet adverse et joue un coup légal', () => {
    const adversaire = [...'ES']
    const ctx: ContexteIA = { niveau: 'champion', plateau, chevalet: chevalet.slice(0, 3), sac: 0, adversaire }
    const peu = genererCoups(ods, plateau, ctx.chevalet)
    const d = choisir(peu, ctx, hasardDe('fin'), (pl, rack) => genererCoups(ods, pl, rack, { limite: 1 })[0] ?? null)
    if (peu.length === 0) expect(d.type).toBe('passe')
    else {
      expect(d.type).toBe('mot')
      if (d.type === 'mot') expect(peu).toContain(d.coup)
    }
  })
})

describe('partie contre l’IA', () => {
  it('une partie complète IA contre IA : jetons conservés, fin prononcée, points cohérents', () => {
    const p = jouerPartie({ moi: 'champion', ia: 'debutant' }, 'complete')
    expect(p.finie).toBe(true)
    expect(p.fin).not.toBeNull()
    expect(p.coups.length).toBeGreaterThan(10)
    for (const camp of ['moi', 'ia'] as const) {
      const marques = p.coups.filter((c) => c.camp === camp).reduce((s, c) => s + c.points, 0)
      expect(p.scores[camp]).toBe(marques + p.fin!.ajustements[camp])
    }
    const gagnant = p.scores.moi === p.scores.ia ? null : p.scores.moi > p.scores.ia ? 'moi' : 'ia'
    expect(p.fin!.gagnant).toBe(gagnant)
    // Le champion bat le débutant.
    expect(p.fin!.gagnant).toBe('moi')
    expect(resumeIA(p)).toMatchObject({ niveau: 'champion', moi: p.scores.moi, ia: p.scores.ia, gagnant: 'moi' })
  })

  it('chaque coup posé respecte le règlement sur le plateau de l’époque', () => {
    const ods = dicoAppli()
    const p = jouerPartie({ moi: 'expert', ia: 'confirme' }, 'verif')
    let plateau = plateauDepuisTexte(nouvellePartieIA('expert', 'moi', hasardDe('x'), 'x').plateau)
    for (const c of p.coups) {
      if (c.type !== 'mot') continue
      const a = analyserCoup(plateau, c.coup!.poses, ods)
      expect(a.valide).toBe(true)
      expect(a.points).toBe(c.points)
      plateau = plateau.slice()
      for (const pose of c.coup!.poses) plateau[pose.pos] = pose.lettre
    }
  })

  it('refuse de jouer hors de son tour, ou des lettres absentes du chevalet', () => {
    const p = nouvellePartieIA('amateur', 'moi', hasardDe('tour'), 'tour')
    const coup: Coup = { poses: [{ pos: 112, lettre: 'A' }, { pos: 113, lettre: 'B' }], mot: 'AB', dir: 'H', debut: 112, points: 8 }
    expect(passerIA(p, 'ia')).toHaveProperty('erreur')
    const sansA = { ...p, chevalets: { ...p.chevalets, moi: [...'CDEFGHI'] } }
    expect(jouerMotIA(sansA, 'moi', coup)).toEqual({ erreur: 'Ces lettres ne sont pas sur le chevalet' })
  })

  it('changer des lettres exige 7 jetons au sac ; six passes de suite terminent la partie', () => {
    let p = nouvellePartieIA('amateur', 'moi', hasardDe('passes'), 'passes')
    expect(changerIA({ ...p, sac: [...'ABC'] }, 'moi', ['A'])).toHaveProperty('erreur')
    const apres = changerIA(p, 'moi', [p.chevalets.moi[0]], hasardDe('c'))
    if ('erreur' in apres) throw new Error(apres.erreur)
    expect(apres.tour).toBe('ia')
    expect(apres.chevalets.moi).toHaveLength(7)
    expect(apres.sac).toHaveLength(p.sac.length)
    for (let i = 0; i < PASSES_MAX; i++) {
      const camp = p.tour
      expect(p.finie).toBe(false)
      const r = passerIA(p, camp)
      if ('erreur' in r) throw new Error(r.erreur)
      p = r
    }
    expect(p.finie).toBe(true)
    expect(p.fin!.raison).toBe('passes')
  })

  it('abandonner donne la victoire à l’IA', () => {
    const p = abandonnerIA(nouvellePartieIA('expert', 'moi', hasardDe('abandon'), 'abandon'))
    expect(p.finie).toBe(true)
    expect(p.fin).toMatchObject({ gagnant: 'ia', raison: 'abandon' })
    expect(abandonnerIA(p)).toBe(p)
  })
})
