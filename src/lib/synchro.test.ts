import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { passerIA, nouvellePartieIA, type PartieIA } from '../jeu/contreIA'
import { genererCoups } from '../jeu/generateur'
import { nouvellePartie, terminerCoup, type PartieDuplicate } from '../jeu/duplicate'
import { dicoAppli } from '../jeu/outils-test'
import { plateauDepuisTexte } from '../jeu/plateau'
import {
  abandonnerPartie,
  archiver,
  enregistrerPartie,
  lireHistorique,
  lirePartiesEnCours,
  retirerPartie,
  supprimerDeHistorique,
  ecrireReglages as ecrireReglagesDuplicate,
  lireReglages as lireReglagesDuplicate,
} from '../solo/sauvegarde'
import {
  archiverIA,
  enregistrerPartieIA,
  lireHistoriqueIA,
  lirePartiesIA,
  lirePartiesIAEnCours,
  retirerPartieIA,
  supprimerHistoriqueIA,
} from '../solo/sauvegardeIA'
import { aDesDonnees, inconnusDuServeur, lireLocaux, traiterDistants, viderLocal, type DocumentDistant } from './moteurSynchro'
import { lireReglages, modifierReglages } from './reglages'
import { cleDe, decider, DUREE_JOURNAL, lireCle, lireSuppressions, noterSuppression, surSignal, type Signal } from './synchro'
import { adapteurs } from './synchroTypes'

describe('décider : la version la plus récente gagne', () => {
  const v = (majLe: number, supprime = false) => ({ majLe, supprime })
  it('élément connu d’un seul côté', () => {
    expect(decider(null, null)).toBe('rien')
    expect(decider(v(5), null)).toBe('envoyer')
    expect(decider(null, v(5))).toBe('appliquer')
  })
  it('une suppression que l’autre côté ignore ne demande rien', () => {
    expect(decider(v(5, true), null)).toBe('rien')
    expect(decider(null, v(5, true))).toBe('rien')
  })
  it('le plus récent l’emporte, élément ou suppression', () => {
    expect(decider(v(9), v(5))).toBe('envoyer')
    expect(decider(v(5), v(9))).toBe('appliquer')
    expect(decider(v(9, true), v(5))).toBe('envoyer')
    expect(decider(v(5), v(9, true))).toBe('supprimer-local')
    expect(decider(v(5, true), v(9))).toBe('appliquer')
  })
  it('à date égale la suppression l’emporte ; deux versions identiques ne demandent rien', () => {
    expect(decider(v(5), v(5, true))).toBe('supprimer-local')
    expect(decider(v(5, true), v(5))).toBe('envoyer')
    expect(decider(v(5), v(5))).toBe('rien')
  })
})

describe('clé d’un élément', () => {
  it('se relit telle quelle, même avec des « / » et des accents dans l’identifiant', () => {
    for (const id of ['ia-123', 'GRAINE/A-1793', 'Été façon-1']) {
      const cle = cleDe('duplicate-encours', id)
      expect(cle).not.toContain('/')
      expect(lireCle(cle)).toEqual({ type: 'duplicate-encours', id })
    }
  })
})

// --- Deux appareils et un serveur qui garde la version la plus récente (c'est ce que font les règles Firestore) ---

/** Un appareil : son propre stockage, que les fonctions de l'appli lisent via `executer`. */
class Appareil {
  stockage: Record<string, string> = {}
  executer<T>(f: () => T): T {
    const s = this.stockage
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => s[k] ?? null,
      setItem: (k: string, v: string) => void (s[k] = v),
      removeItem: (k: string) => void delete s[k],
      key: (i: number) => Object.keys(s)[i] ?? null,
      get length() {
        return Object.keys(s).length
      },
    })
    return f()
  }
}

class Serveur {
  docs = new Map<string, DocumentDistant>()
  recevoir(doc: DocumentDistant) {
    const ancien = this.docs.get(doc.cle)
    if (!ancien || doc.majLe >= ancien.majLe) this.docs.set(doc.cle, doc)
  }
  /** Ce que fait l'appli à l'ouverture, ou quand le serveur envoie des changements : tout comparer, appliquer, envoyer. */
  synchroniser(a: Appareil) {
    a.executer(() => {
      const r = traiterDistants(adapteurs, this.docs)
      for (const doc of r.aEnvoyer) this.recevoir(doc)
      for (const doc of inconnusDuServeur(adapteurs, new Set(this.docs.keys()))) this.recevoir(doc)
    })
  }
}

function partieDuplicate(id: string, n = 0): PartieDuplicate {
  const ods = dicoAppli()
  let p = nouvellePartie(id, 180, id)
  for (let i = 0; i < n; i++) {
    const tous = genererCoups(ods, plateauDepuisTexte(p.plateau), p.courant!.tirage, { limite: 3 })
    p = terminerCoup(p, tous[0], tous[0], tous, 20)
  }
  return p
}
const partieIA = (id: string, coups = 0): PartieIA => {
  const p = nouvellePartieIA('amateur', 'moi', undefined, id)
  if (!coups) return p
  const r = passerIA(p, 'moi')
  if ('erreur' in r) throw new Error(r.erreur)
  return r
}

describe('synchronisation entre deux appareils', () => {
  let a: Appareil, b: Appareil, serveur: Serveur
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_800_000_000_000)
    a = new Appareil()
    b = new Appareil()
    serveur = new Serveur()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const plus = (ms: number) => vi.setSystemTime(Date.now() + ms)

  it('une partie en cours commencée sur un appareil se retrouve sur l’autre, et la suite de la partie aussi', () => {
    a.executer(() => enregistrerPartie(partieDuplicate('P1')))
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lirePartiesEnCours().map((p) => [p.id, p.coups.length]))).toEqual([['P1', 0]])

    plus(60_000)
    b.executer(() => enregistrerPartie(partieDuplicate('P1', 2)))
    serveur.synchroniser(b)
    serveur.synchroniser(a)
    expect(a.executer(() => lirePartiesEnCours().map((p) => [p.id, p.coups.length]))).toEqual([['P1', 2]])
  })

  it('terminer une partie la fait quitter les parties en cours de l’autre appareil et entrer dans son historique', () => {
    a.executer(() => enregistrerPartie(partieDuplicate('P1', 1)))
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    plus(60_000)
    a.executer(() => {
      const p = lirePartiesEnCours()[0]
      archiver({ ...p, finie: true, courant: null })
      retirerPartie(p.id)
    })
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lirePartiesEnCours())).toEqual([])
    expect(b.executer(() => lireHistorique().map((p) => p.id))).toEqual(['P1'])
  })

  it('un historique supprimé sur un appareil l’est aussi sur l’autre, et ne ressuscite pas', () => {
    a.executer(() => archiver({ ...partieDuplicate('H1', 1), finie: true, courant: null }))
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lireHistorique())).toHaveLength(1)
    plus(60_000)
    // B supprime hors ligne ; A, qui a toujours la partie, se synchronise d'abord : la suppression, plus récente, l'emporte.
    b.executer(() => supprimerDeHistorique('H1'))
    serveur.synchroniser(a)
    expect(a.executer(() => lireHistorique())).toHaveLength(1)
    serveur.synchroniser(b)
    serveur.synchroniser(a)
    expect(a.executer(() => lireHistorique())).toEqual([])
    expect(b.executer(() => lireHistorique())).toEqual([])
    // Une nouvelle synchro ne ramène rien.
    serveur.synchroniser(b)
    expect(b.executer(() => lireHistorique())).toEqual([])
  })

  it('une partie supprimée hors ligne ne revient pas quand l’appareil se synchronise pour la première fois', () => {
    serveur.recevoir({ cle: cleDe('duplicate-histo', 'H1'), type: 'duplicate-histo', id: 'H1', majLe: 1_000, supprime: false, donnees: JSON.stringify(partieDuplicate('H1')) })
    a.executer(() => {
      // L'appareil avait la partie, l'a supprimée, et n'a jamais pu le dire au serveur.
      noterSuppression(cleDe('duplicate-histo', 'H1'), Date.now())
    })
    serveur.synchroniser(a)
    expect(a.executer(() => lireHistorique())).toEqual([])
    expect(serveur.docs.get(cleDe('duplicate-histo', 'H1'))?.supprime).toBe(true)
  })

  it('une écriture plus ancienne que celle du serveur est ignorée (dernier écrit gagne)', () => {
    a.executer(() => enregistrerPartie(partieDuplicate('P1', 1)))
    const ancienne = a.executer(() => documentDe0())
    plus(60_000)
    b.executer(() => enregistrerPartie(partieDuplicate('P1', 3)))
    serveur.synchroniser(b)
    serveur.recevoir(ancienne) // A, hors ligne depuis un moment, envoie sa vieille version
    expect(JSON.parse(serveur.docs.get(cleDe('duplicate-encours', 'P1'))!.donnees).coups).toHaveLength(3)
    function documentDe0(): DocumentDistant {
      const [e] = lireLocaux(adapteurs).values()
      return { cle: cleDe(e.signal.type, e.signal.id), type: e.signal.type, id: e.signal.id, majLe: e.signal.majLe, supprime: false, donnees: JSON.stringify(e.signal.donnees) }
    }
  })

  it('première synchro : ce que l’appareil avait et ce que le compte avait se réunissent', () => {
    a.executer(() => {
      enregistrerPartie(partieDuplicate('A1'))
      archiverIA(partieIA('ia-a', 1))
    })
    b.executer(() => enregistrerPartieIA(partieIA('ia-b')))
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    serveur.synchroniser(a)
    for (const x of [a, b]) {
      expect(x.executer(() => lirePartiesEnCours().map((p) => p.id))).toEqual(['A1'])
      expect(x.executer(() => lirePartiesIAEnCours().map((p) => p.id))).toEqual(['ia-b'])
      expect(x.executer(() => lireHistoriqueIA().map((r) => r.id))).toEqual(['ia-a'])
      expect(x.executer(() => lirePartiesIA().map((p) => p.id))).toEqual(['ia-a'])
    }
  })

  it('abandonner une partie contre l’IA depuis un appareil la retire de l’autre', () => {
    a.executer(() => enregistrerPartieIA(partieIA('ia-1', 1)))
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    plus(1000)
    a.executer(() => retirerPartieIA('ia-1'))
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lirePartiesIAEnCours())).toEqual([])
  })

  it('les réglages du compte suivent (apparence, mode du duplicate), pas les notifications', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.stubGlobal('document', { documentElement: { dataset: {} }, querySelectorAll: () => [] })
    a.executer(() => {
      modifierReglages({ theme: 'sombre', notifications: false })
      ecrireReglagesDuplicate({ temps: 60, mode: 'topping' })
    })
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lireReglages())).toMatchObject({ theme: 'sombre', notifications: true })
    expect(b.executer(() => lireReglagesDuplicate())).toEqual({ temps: 60, mode: 'topping' })
    // Un réglage jamais touché sur un appareil ne part pas du côté serveur avec sa valeur par défaut.
    expect([...serveur.docs.keys()].sort()).toEqual([cleDe('reglages', 'app'), cleDe('reglages', 'duplicate')])
  })

  it('les historiques plafonnés convergent : ce que le plafond retire est signalé comme supprimé', () => {
    // Le compte contient 105 résumés ; l'appareil n'en garde que 100.
    for (let i = 0; i < 105; i++) {
      const id = `ia-${i}`
      const resume = { id, niveau: 'amateur', date: 1_000 + i, moi: 0, ia: 0, gagnant: null, abandon: false }
      serveur.recevoir({ cle: cleDe('ia-histo', id), type: 'ia-histo', id, majLe: 1_000 + i, supprime: false, donnees: JSON.stringify(resume) })
    }
    const signaux: Signal[] = []
    const arret = surSignal((s) => signaux.push(s))
    serveur.synchroniser(a)
    arret()
    expect(a.executer(() => lireHistoriqueIA())).toHaveLength(100)
    expect(a.executer(() => lireHistoriqueIA()[0].id)).toBe('ia-104')
    expect(signaux.filter((s) => s.donnees === null).map((s) => s.id).sort()).toEqual(['ia-0', 'ia-1', 'ia-2', 'ia-3', 'ia-4'])
  })

  it('« Effacer » les résultats contre l’IA supprime aussi ce qui est sur le compte', () => {
    a.executer(() => {
      archiverIA(partieIA('ia-1', 1))
      archiverIA(partieIA('ia-2', 1))
    })
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    plus(1000)
    a.executer(() => supprimerHistoriqueIA())
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lireHistoriqueIA())).toEqual([])
    expect(b.executer(() => lirePartiesIA())).toEqual([])
  })

  it('changer de compte : les données de l’appareil sont vidées sans rien supprimer chez le serveur', () => {
    a.executer(() => enregistrerPartie(partieDuplicate('A1')))
    serveur.synchroniser(a)
    expect(a.executer(() => aDesDonnees(adapteurs))).toBe(true)
    a.executer(() => viderLocal(adapteurs))
    expect(a.executer(() => aDesDonnees(adapteurs))).toBe(false)
    expect(serveur.docs.get(cleDe('duplicate-encours', 'A1'))?.supprime).toBe(false)
    expect(a.executer(() => lireSuppressions())).toEqual({})
  })

  it('abandonnerPartie : rangée dans l’historique du compte si on a joué, retirée des parties en cours', () => {
    a.executer(() => {
      enregistrerPartie(partieDuplicate('P1', 2))
      abandonnerPartie(lirePartiesEnCours()[0])
    })
    serveur.synchroniser(a)
    serveur.synchroniser(b)
    expect(b.executer(() => lirePartiesEnCours())).toEqual([])
    expect(b.executer(() => lireHistorique().map((p) => p.id))).toEqual(['P1'])
  })
})

describe('journal des suppressions', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('oublie les suppressions de plus de six mois', () => {
    const a = new Appareil()
    a.executer(() => {
      const t = Date.now()
      noterSuppression('x~vieille', t - DUREE_JOURNAL - 1)
      noterSuppression('x~recente', t - 1000)
      expect(Object.keys(lireSuppressions())).toEqual(['x~recente'])
    })
  })
})
