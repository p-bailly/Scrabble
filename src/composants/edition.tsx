// Pose des lettres : chevalet, toucher-toucher, glisser-déposer, choix de la lettre d'un joker.
//
// Deux façons de poser :
//  - toucher une lettre du chevalet puis une case (ou glisser la lettre sur la case) ;
//  - toucher une case (un curseur apparaît, toucher à nouveau la case change le sens), puis toucher les lettres
//    l'une après l'autre : elles se posent à la suite, comme si on tapait le mot ;
//  - au clavier : taper les lettres (Retour arrière efface, Espace change le sens, Échap reprend tout, Entrée valide).
// Toucher un jeton en cours de pose le renvoie sur le chevalet.
// Réarranger le chevalet : la lettre qu'on tient quitte son emplacement, les autres s'écartent pour lui faire de la
// place pendant qu'on la déplace, puis elle se pose en douceur. Les lettres sont placées par un décalage (--i) que le CSS
// anime : échanger deux lettres ou mélanger le chevalet les fait aussi glisser à leur nouvelle place.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react'
import type { Pose } from '../jeu/coup'
import { ALPHABET, JOKER, valeur } from '../jeu/lettres'
import { CENTRE, TAILLE, colonneDe, ligneDe, type Plateau } from '../jeu/plateau'

export interface Tuile {
  id: number
  /** « A »…« Z » ou « ? ». */
  lettre: string
}

interface EtatEdition {
  tuiles: Tuile[]
  /** Jetons posés : id de la tuile → case et lettre affichée (minuscule pour un joker). */
  poses: Record<number, { pos: number; lettre: string }>
  choisie: number | null
  curseur: { pos: number; dir: 'H' | 'V' } | null
  /** Joker en attente de sa lettre. */
  joker: { id: number; pos: number } | null
}

let prochainId = 1
const versTuiles = (lettres: readonly string[]): Tuile[] => lettres.map((lettre) => ({ id: prochainId++, lettre }))

const vide = (tuiles: Tuile[]): EtatEdition => ({ tuiles, poses: {}, choisie: null, curseur: null, joker: null })

export interface Glisse {
  tuile: Tuile
  x: number
  y: number
  /** Côté de la tuile à l'écran (celui d'un emplacement du chevalet). */
  taille: number
  /** Dépôt fait : la tuile glisse jusqu'à ce point (centre de son emplacement) avant de disparaître. */
  vers?: { x: number; y: number }
}

/** Durée (ms) du dépôt d'une lettre sur son emplacement ; la même que dans styles.css (.tuile-volante.atterrit). */
const DUREE_DEPOT = 170

const emplacements = () => [...document.querySelectorAll<HTMLElement>('.chevalet .case-chevalet')]

/** Côté d'une tuile du chevalet, tel qu'il est affiché. */
const tailleTuile = () => emplacements()[0]?.getBoundingClientRect().width || 46

/** Centre (à l'écran) de l'emplacement `i` du chevalet. */
function centreEmplacement(i: number): { x: number; y: number } | null {
  const r = emplacements()[i]?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
}

/** Emplacement du chevalet le plus proche du point, ou null si le point est loin du chevalet. */
function emplacementProche(x: number, y: number): number | null {
  const cases = emplacements()
  if (cases.length === 0) return null
  const bac = cases[0].closest('.chevalet')!.getBoundingClientRect()
  const marge = 24
  if (x < bac.left - marge || x > bac.right + marge || y < bac.top - marge || y > bac.bottom + marge) return null
  let meilleur = 0
  let ecart = Infinity
  cases.forEach((c, i) => {
    const r = c.getBoundingClientRect()
    const d = Math.abs(x - (r.left + r.right) / 2)
    if (d < ecart) {
      ecart = d
      meilleur = i
    }
  })
  return meilleur
}

/** État de la pose en cours, pour un plateau et un chevalet donnés. */
export function useEdition(plateau: Plateau, chevalet: readonly string[], surEntree?: () => void) {
  const cle = chevalet.join('')
  const [etat, setEtat] = useState<EtatEdition>(() => vide(versTuiles(chevalet)))
  const [glisse, setGlisse] = useState<Glisse | null>(null)
  const [cible, setCible] = useState<number | null>(null)
  // Emplacement du chevalet où la tuile tenue se poserait ; null tant qu'elle n'est pas au-dessus du chevalet.
  const [survol, setSurvol] = useState<number | null>(null)
  const survolRef = useRef<number | null>(null)
  // Tuile qui vient d'être lâchée : elle reste cachée jusqu'à l'arrivée de sa copie volante.
  const [atterri, setAtterri] = useState<number | null>(null)
  const minuterie = useRef<number | undefined>(undefined)
  const plateauRef = useRef(plateau)
  plateauRef.current = plateau
  const entreeRef = useRef(surEntree)
  entreeRef.current = surEntree

  // Nouveau chevalet (coup suivant, lettres changées) : on repart de zéro.
  useEffect(() => {
    setEtat(vide(versTuiles(chevalet)))
  }, [cle])

  const occupee = useCallback(
    (pos: number, e: EtatEdition) => !!plateauRef.current[pos] || Object.values(e.poses).some((p) => p.pos === pos),
    [],
  )

  /** Case suivante libre dans le sens du curseur, ou null au bord. */
  const suivante = useCallback(
    (pos: number, dir: 'H' | 'V', e: EtatEdition): number | null => {
      let p = pos
      for (;;) {
        if (dir === 'H') {
          if (colonneDe(p) === TAILLE - 1) return null
          p += 1
        } else {
          if (ligneDe(p) === TAILLE - 1) return null
          p += TAILLE
        }
        if (!occupee(p, e)) return p
      }
    },
    [occupee],
  )

  const placerDans = (e: EtatEdition, id: number, pos: number, lettre: string): EtatEdition => {
    const poses = { ...e.poses, [id]: { pos, lettre } }
    const apres = { ...e, poses, choisie: null, joker: null }
    const dir = e.curseur?.dir ?? 'H'
    const n = suivante(pos, dir, apres)
    return { ...apres, curseur: n === null ? null : { pos: n, dir } }
  }

  /** Pose la tuile `id` sur la case `pos` (demande la lettre si c'est un joker). */
  const placer = useCallback(
    (id: number, pos: number) => {
      setEtat((e) => {
        const t = e.tuiles.find((x) => x.id === id)
        if (!t) return e
        const autre = { ...e.poses }
        delete autre[id]
        if (plateauRef.current[pos] || Object.values(autre).some((p) => p.pos === pos)) return e
        const sans = { ...e, poses: autre }
        if (t.lettre === JOKER) {
          // Un joker déjà posé et déplacé garde sa lettre.
          const deja = e.poses[id]
          if (deja) return placerDans(sans, id, pos, deja.lettre)
          return { ...sans, joker: { id, pos }, choisie: null }
        }
        return placerDans(sans, id, pos, t.lettre)
      })
    },
    [suivante],
  )

  const choisirLettreJoker = useCallback((lettre: string | null) => {
    setEtat((e) => {
      if (!e.joker) return e
      if (!lettre) return { ...e, joker: null }
      return placerDans(e, e.joker.id, e.joker.pos, lettre.toLowerCase())
    })
  }, [suivante])

  /** Renvoie sur le chevalet le jeton posé en `pos`. */
  const retirer = useCallback((pos: number) => {
    setEtat((e) => {
      const entree = Object.entries(e.poses).find(([, p]) => p.pos === pos)
      if (!entree) return e
      const poses = { ...e.poses }
      delete poses[Number(entree[0])]
      return { ...e, poses, curseur: { pos, dir: e.curseur?.dir ?? 'H' } }
    })
  }, [])

  const rappeler = useCallback(() => setEtat((e) => ({ ...e, poses: {}, choisie: null, curseur: null, joker: null })), [])

  const melanger = useCallback(() => {
    setEtat((e) => {
      const t = [...e.tuiles]
      for (let i = t.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[t[i], t[j]] = [t[j], t[i]]
      }
      return { ...e, tuiles: t }
    })
  }, [])

  /** Déplace une tuile à l'emplacement `index` du chevalet (et la retire du plateau si besoin). */
  const ranger = useCallback((id: number, index: number) => {
    setEtat((e) => {
      const t = e.tuiles.filter((x) => x.id !== id)
      const tuile = e.tuiles.find((x) => x.id === id)
      if (!tuile) return e
      t.splice(Math.min(index, t.length), 0, tuile)
      const poses = { ...e.poses }
      delete poses[id]
      return { ...e, tuiles: t, poses, choisie: null }
    })
  }, [])

  /** Toucher d'une tuile du chevalet. */
  const toucherTuile = useCallback(
    (id: number) => {
      const e = etat
      if (e.poses[id]) return
      if (e.curseur && !occupee(e.curseur.pos, e)) {
        placer(id, e.curseur.pos)
        return
      }
      if (e.choisie !== null && e.choisie !== id) {
        // Deux tuiles touchées l'une après l'autre : on les échange.
        setEtat((s) => {
          const t = [...s.tuiles]
          const i = t.findIndex((x) => x.id === s.choisie)
          const j = t.findIndex((x) => x.id === id)
          if (i < 0 || j < 0) return s
          ;[t[i], t[j]] = [t[j], t[i]]
          return { ...s, tuiles: t, choisie: null }
        })
        return
      }
      setEtat((s) => ({ ...s, choisie: s.choisie === id ? null : id }))
    },
    [etat, occupee, placer],
  )

  /** Toucher d'une case du plateau ; renvoie true si le toucher a servi. */
  const toucherCase = useCallback(
    (pos: number): boolean => {
      const e = etat
      if (Object.values(e.poses).some((p) => p.pos === pos)) {
        retirer(pos)
        return true
      }
      if (plateauRef.current[pos]) return false
      if (e.choisie !== null) {
        const id = e.choisie
        setEtat((s) => ({ ...s, curseur: { pos, dir: s.curseur?.dir ?? 'H' } }))
        placer(id, pos)
        return true
      }
      setEtat((s) => ({
        ...s,
        curseur: s.curseur?.pos === pos ? { pos, dir: s.curseur.dir === 'H' ? 'V' : 'H' } : { pos, dir: s.curseur?.dir ?? 'H' },
      }))
      return true
    },
    [etat, placer, retirer],
  )

  /** Clavier : une lettre tapée se pose sur la case du curseur (avec la tuile, ou à défaut un joker). */
  const taper = useCallback(
    (lettre: string) => {
      setEtat((e) => {
        let c = e.curseur
        // Plateau vide : on commence au centre.
        if (!c && !plateauRef.current.some(Boolean) && Object.keys(e.poses).length === 0) c = { pos: CENTRE, dir: 'H' }
        if (!c || occupee(c.pos, e)) return e
        const libres = e.tuiles.filter((t) => !e.poses[t.id])
        const t = libres.find((x) => x.lettre === lettre)
        const avecCurseur = { ...e, curseur: c }
        if (t) return placerDans(avecCurseur, t.id, c.pos, lettre)
        const j = libres.find((x) => x.lettre === JOKER)
        return j ? placerDans(avecCurseur, j.id, c.pos, lettre.toLowerCase()) : e
      })
    },
    [occupee],
  )

  /** Clavier : Retour arrière renvoie sur le chevalet le dernier jeton posé avant le curseur. */
  const effacerDernier = useCallback(() => {
    setEtat((e) => {
      const posees = Object.entries(e.poses)
      if (posees.length === 0) return e
      const avant = e.curseur ? posees.filter(([, p]) => p.pos < e.curseur!.pos) : posees
      const [id, p] = (avant.length ? avant : posees).reduce((a, b) => (b[1].pos > a[1].pos ? b : a))
      const autres = { ...e.poses }
      delete autres[Number(id)]
      return { ...e, poses: autres, curseur: { pos: p.pos, dir: e.curseur?.dir ?? 'H' } }
    })
  }, [])

  const basculerSens = useCallback(() => {
    setEtat((e) => (e.curseur ? { ...e, curseur: { ...e.curseur, dir: e.curseur.dir === 'H' ? 'V' : 'H' } } : e))
  }, [])

  useEffect(() => {
    const touche = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return
      const cible = ev.target as HTMLElement | null
      if (cible && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return
      if (etatRef.current.joker) return
      if (ev.key === 'Backspace' || ev.key === 'Delete') effacerDernier()
      else if (ev.key === ' ' || ev.key === 'Tab') basculerSens()
      else if (ev.key === 'Escape') rappeler()
      else if (ev.key === 'Enter') entreeRef.current?.()
      else {
        const l = ev.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
        if (!/^[A-Z]$/.test(l)) return
        taper(l)
      }
      ev.preventDefault()
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [taper, effacerDernier, basculerSens, rappeler])

  // Glisser-déposer : appui sur une tuile du chevalet ou un jeton posé, suivi au doigt, dépôt sur une case ou
  // un emplacement du chevalet. Un appui sans mouvement est un simple toucher.
  const glisser = useRef<{ tuile: Tuile; depuis: 'chevalet' | 'plateau'; x0: number; y0: number; bouge: boolean } | null>(null)

  const sousLeDoigt = (x: number, y: number) => {
    const c = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-case]')
    return { pos: c ? Number(c.dataset.case) : null }
  }

  const changerSurvol = (i: number | null) => {
    if (survolRef.current === i) return
    survolRef.current = i
    setSurvol(i)
  }

  /** Fin du glisser : la copie volante disparaît et la tuile cachée réapparaît. */
  const finDuVol = () => {
    window.clearTimeout(minuterie.current)
    setGlisse(null)
    setAtterri(null)
    changerSurvol(null)
  }

  /** La copie volante glisse jusqu'à l'emplacement `i`, puis laisse la place à la vraie tuile. */
  const deposer = (id: number, i: number) => {
    const vers = centreEmplacement(i)
    if (!vers) return finDuVol()
    setAtterri(id)
    setGlisse((g) => g && { ...g, vers })
    minuterie.current = window.setTimeout(finDuVol, DUREE_DEPOT)
  }

  const commencer = (tuile: Tuile, depuis: 'chevalet' | 'plateau', e: PE) => {
    finDuVol() // un dépôt encore en cours se termine tout de suite
    glisser.current = { tuile, depuis, x0: e.clientX, y0: e.clientY, bouge: false }
    const bouger = (ev: PointerEvent) => {
      const g = glisser.current
      if (!g) return
      if (!g.bouge && Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) > 6) g.bouge = true
      if (g.bouge) {
        setGlisse({ tuile: g.tuile, x: ev.clientX, y: ev.clientY, taille: tailleTuile() })
        const { pos } = sousLeDoigt(ev.clientX, ev.clientY)
        setCible(pos)
        const i = pos === null ? emplacementProche(ev.clientX, ev.clientY) : null
        changerSurvol(i === null ? null : Math.min(i, etatRef.current.tuiles.length - 1))
      }
    }
    const lacher = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', bouger)
      window.removeEventListener('pointerup', lacher)
      window.removeEventListener('pointercancel', lacher)
      const g = glisser.current
      glisser.current = null
      setCible(null)
      if (!g) return finDuVol()
      if (!g.bouge) {
        finDuVol()
        if (g.depuis === 'chevalet') toucherTuile(g.tuile.id)
        else {
          const p = etatRef.current.poses[g.tuile.id]
          if (p) retirer(p.pos)
        }
        return
      }
      if (ev.type === 'pointercancel') return finDuVol()
      const { pos } = sousLeDoigt(ev.clientX, ev.clientY)
      const i = survolRef.current
      if (pos !== null) {
        finDuVol()
        placer(g.tuile.id, pos)
      } else if (i !== null) {
        ranger(g.tuile.id, i)
        deposer(g.tuile.id, i)
      } else if (g.depuis === 'chevalet') {
        // Lâchée ailleurs : la lettre retourne à sa place.
        deposer(g.tuile.id, etatRef.current.tuiles.findIndex((t) => t.id === g.tuile.id))
      } else finDuVol()
    }
    window.addEventListener('pointermove', bouger)
    window.addEventListener('pointerup', lacher)
    window.addEventListener('pointercancel', lacher)
  }

  const etatRef = useRef(etat)
  etatRef.current = etat

  const appuiTuile = (id: number, e: PE) => {
    const t = etat.tuiles.find((x) => x.id === id)
    if (t) commencer(t, 'chevalet', e)
  }
  const appuiPose = (pos: number, e: PE) => {
    const entree = Object.entries(etat.poses).find(([, p]) => p.pos === pos)
    if (!entree) return
    const t = etat.tuiles.find((x) => x.id === Number(entree[0]))
    if (t) commencer(t, 'plateau', e)
  }

  const poses: Pose[] = useMemo(
    () => Object.values(etat.poses).map((p) => ({ pos: p.pos, lettre: p.lettre })).sort((a, b) => a.pos - b.pos),
    [etat.poses],
  )
  const posesCarte = useMemo(() => new Map(poses.map((p) => [p.pos, p.lettre])), [poses])

  /** Pose directement un coup complet (ex. pour montrer un coup). */
  const poserCoup = useCallback((coup: Pose[]) => {
    setEtat((e) => {
      const libres = [...e.tuiles]
      const p: EtatEdition['poses'] = {}
      for (const { pos, lettre } of coup) {
        const voulu = lettre >= 'a' ? JOKER : lettre
        const i = libres.findIndex((t) => t.lettre === voulu)
        if (i < 0) return e
        p[libres[i].id] = { pos, lettre }
        libres.splice(i, 1)
      }
      return { ...e, poses: p, choisie: null, curseur: null, joker: null }
    })
  }, [])

  return {
    etat,
    poses,
    posesCarte,
    glisse,
    cible,
    survol,
    atterri,
    toucherCase,
    toucherTuile,
    appuiTuile,
    appuiPose,
    rappeler,
    melanger,
    choisirLettreJoker,
    poserCoup,
    effacerCurseur: () => setEtat((e) => ({ ...e, curseur: null, choisie: null })),
  }
}

export type Edition = ReturnType<typeof useEdition>

export function Chevalet({ edition, marquees }: { edition: Edition; marquees?: Set<number> }) {
  const { etat, glisse, survol, atterri } = edition
  const tuiles = etat.tuiles
  // Place de chaque tuile. Pendant un glisser, la tuile tenue laisse un trou : à son emplacement d'origine, ou là où
  // elle se poserait si on la lâchait maintenant ; les autres tuiles s'écartent pour lui faire de la place.
  const tenue = glisse && tuiles.some((t) => t.id === glisse.tuile.id) ? glisse.tuile.id : null
  const place = new Map<number, number>()
  if (tenue === null) tuiles.forEach((t, k) => place.set(t.id, k))
  else {
    const trou = survol ?? tuiles.findIndex((t) => t.id === tenue)
    tuiles
      .filter((t) => t.id !== tenue)
      .forEach((t, k) => place.set(t.id, k < trou ? k : k + 1))
    place.set(tenue, trou)
  }
  return (
    <div className="chevalet">
      <div className="rail">
        {Array.from({ length: Math.max(7, tuiles.length) }, (_, i) => (
          <div key={i} className="case-chevalet" />
        ))}
        {tuiles.map((t) => {
          // Une tuile posée sur le plateau n'est plus dans le bac ; une tuile tenue ou qui se pose reste là, cachée.
          const cachee = t.id === tenue || t.id === atterri
          if (etat.poses[t.id] && !cachee) return null
          return (
            <button
              key={t.id}
              type="button"
              className={
                'tuile tuile-rail' +
                (cachee ? ' cachee' : '') +
                (etat.choisie === t.id ? ' choisie' : '') +
                (marquees?.has(t.id) ? ' marquee' : '')
              }
              style={{ '--i': place.get(t.id) } as CSSProperties}
              onPointerDown={(e) => edition.appuiTuile(t.id, e)}
              aria-label={t.lettre === JOKER ? 'Joker' : t.lettre}
            >
              {t.lettre === JOKER ? '' : t.lettre}
              {t.lettre !== JOKER && <span className="points">{valeur(t.lettre)}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Tuile qui suit le doigt pendant un glisser, puis glisse jusqu'à son emplacement quand on la lâche. */
export function TuileVolante({ glisse }: { glisse: Glisse | null }) {
  if (!glisse) return null
  return (
    <div
      className={'tuile-volante' + (glisse.vers ? ' atterrit' : '')}
      style={{ left: glisse.vers?.x ?? glisse.x, top: glisse.vers?.y ?? glisse.y, '--t': `${glisse.taille}px` } as CSSProperties}
    >
      <div className="tuile">
        {glisse.tuile.lettre === JOKER ? '' : glisse.tuile.lettre}
        {glisse.tuile.lettre !== JOKER && <span className="points">{valeur(glisse.tuile.lettre)}</span>}
      </div>
    </div>
  )
}

/** Choix de la lettre représentée par un joker. */
export function ChoixJoker({ ouvert, onChoix }: { ouvert: boolean; onChoix: (lettre: string | null) => void }) {
  if (!ouvert) return null
  return (
    <div className="voile" onClick={() => onChoix(null)}>
      <div className="feuille" onClick={(e) => e.stopPropagation()}>
        <h3>Lettre du joker</h3>
        <div className="clavier">
          {[...ALPHABET].map((l) => (
            <button key={l} type="button" onClick={() => onChoix(l)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="bouton" onClick={() => onChoix(null)}>
          Annuler
        </button>
      </div>
    </div>
  )
}
