// Plateau de jeu : 15 × 15 cases, zoomable (pincer, double toucher, molette) et déplaçable quand il est zoomé.

import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { BONUS, CENTRE, NB_CASES, type Plateau as TPlateau } from '../jeu/plateau'
import { estJoker, valeur } from '../jeu/lettres'

export interface PropsPlateau {
  plateau: TPlateau
  /** Jetons en cours de pose : case → lettre (minuscule pour un joker). */
  poses?: Map<number, string>
  /** Coup montré sans être posé (calculateur, correction). */
  apercu?: { lettres: Map<number, string>; style: 'apercu' | 'mien' }
  /** Jetons du dernier coup joué. */
  derniers?: Set<number>
  curseur?: { pos: number; dir: 'H' | 'V' } | null
  cible?: number | null
  /** Toucher d'une case ; renvoie true si le toucher a servi (sinon un double toucher zoome). */
  onCase?: (pos: number) => boolean
  /** Début d'un appui sur un jeton en cours de pose (pour le glisser). */
  onAppuiPose?: (pos: number, e: PE) => void
  /** Plateau d'un bord à l'autre de l'écran (écrans de jeu). */
  pleine?: boolean
}

const ZOOM_MAX = 3
const ZOOM_DOUBLE = 2.2

export function Plateau({ plateau, poses, apercu, derniers, curseur, cible, onCase, onAppuiPose, pleine }: PropsPlateau) {
  const zone = useRef<HTMLDivElement>(null)
  const [vue, setVue] = useState({ s: 1, x: 0, y: 0 })
  const vueRef = useRef(vue)
  vueRef.current = vue
  const pointeurs = useRef(new Map<number, { x: number; y: number }>())
  const geste = useRef<{
    debut: { x: number; y: number; t: number }
    bouge: boolean
    pince?: { d: number; mx: number; my: number; s: number; x: number; y: number }
    pan?: { x: number; y: number; vx: number; vy: number }
  } | null>(null)
  const dernierToucher = useRef<{ t: number; x: number; y: number } | null>(null)

  const borner = (s: number, x: number, y: number) => {
    const w = zone.current?.clientWidth ?? 0
    s = Math.min(ZOOM_MAX, Math.max(1, s))
    return { s, x: Math.min(0, Math.max(w - w * s, x)), y: Math.min(0, Math.max(w - w * s, y)) }
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = zone.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // Molette (ordinateur) : zoom autour du pointeur.
  useEffect(() => {
    const el = zone.current
    if (!el) return
    const roue = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      const v = vueRef.current
      const s = v.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)
      const ns = Math.min(ZOOM_MAX, Math.max(1, s))
      setVue(borner(ns, p.x - ((p.x - v.x) / v.s) * ns, p.y - ((p.y - v.y) / v.s) * ns))
    }
    el.addEventListener('wheel', roue, { passive: false })
    return () => el.removeEventListener('wheel', roue)
  }, [])

  const appui = (e: PE<HTMLDivElement>) => {
    const p = local(e)
    pointeurs.current.set(e.pointerId, p)
    const v = vueRef.current
    if (pointeurs.current.size === 1) geste.current = { debut: { ...p, t: Date.now() }, bouge: false }
    else if (pointeurs.current.size === 2 && geste.current) {
      const [a, b] = [...pointeurs.current.values()]
      geste.current.bouge = true
      geste.current.pince = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: v.s, x: v.x, y: v.y }
    }
  }

  const deplacement = (e: PE<HTMLDivElement>) => {
    if (!pointeurs.current.has(e.pointerId) || !geste.current) return
    const p = local(e)
    pointeurs.current.set(e.pointerId, p)
    const g = geste.current
    if (g.pince && pointeurs.current.size >= 2) {
      const [a, b] = [...pointeurs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const s = Math.min(ZOOM_MAX, Math.max(1, (g.pince.s * d) / g.pince.d))
      setVue(borner(s, mx - ((g.pince.mx - g.pince.x) / g.pince.s) * s, my - ((g.pince.my - g.pince.y) / g.pince.s) * s))
      return
    }
    if (!g.bouge && Math.hypot(p.x - g.debut.x, p.y - g.debut.y) > 8) {
      g.bouge = true
      const v = vueRef.current
      g.pan = { x: p.x, y: p.y, vx: v.x, vy: v.y }
    }
    if (g.pan && vueRef.current.s > 1) {
      setVue(borner(vueRef.current.s, g.pan.vx + p.x - g.pan.x, g.pan.vy + p.y - g.pan.y))
    }
  }

  const fin = (e: PE<HTMLDivElement>) => {
    if (!pointeurs.current.has(e.pointerId)) return
    pointeurs.current.delete(e.pointerId)
    const g = geste.current
    if (pointeurs.current.size > 0) return
    geste.current = null
    if (!g || g.bouge || e.type === 'pointercancel') return
    // Toucher simple.
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-case]')
    const pos = el ? Number(el.dataset.case) : -1
    const servi = pos >= 0 && onCase ? onCase(pos) : false
    const p = local(e)
    const avant = dernierToucher.current
    if (!servi && avant && Date.now() - avant.t < 320 && Math.hypot(p.x - avant.x, p.y - avant.y) < 30) {
      const v = vueRef.current
      if (v.s > 1.05) setVue({ s: 1, x: 0, y: 0 })
      else setVue(borner(ZOOM_DOUBLE, p.x - p.x * ZOOM_DOUBLE, p.y - p.y * ZOOM_DOUBLE))
      dernierToucher.current = null
    } else dernierToucher.current = servi ? null : { t: Date.now(), ...p }
  }

  const cases = []
  for (let pos = 0; pos < NB_CASES; pos++) {
    const fixe = plateau[pos]
    const enPose = poses?.get(pos)
    const montre = apercu?.lettres.get(pos)
    const b = BONUS[pos]
    let classe = 'case ' + b
    if (pos === CENTRE) classe += ' centre'
    if (curseur?.pos === pos) classe += ' curseur'
    if (cible === pos) classe += ' cible'
    const lettre = fixe || enPose || montre
    let etat = ''
    if (enPose) etat = ' pose'
    else if (montre) etat = ' ' + apercu!.style
    else if (fixe && derniers?.has(pos)) etat = ' dernier'
    cases.push(
      <div key={pos} className={classe} data-case={pos}>
        {lettre ? (
          <div
            className={'jeton' + etat + (estJoker(lettre) ? ' joker' : '')}
            data-pose={enPose ? pos : undefined}
            onPointerDown={
              enPose && onAppuiPose
                ? (e) => {
                    e.stopPropagation()
                    onAppuiPose(pos, e)
                  }
                : undefined
            }
          >
            <span className="lettre">{lettre.toUpperCase()}</span>
            {!estJoker(lettre) && <span className="points">{valeur(lettre)}</span>}
          </div>
        ) : (
          <span className="etiq">{pos === CENTRE ? '★' : b}</span>
        )}
        {curseur?.pos === pos && !lettre && <Fleche dir={curseur.dir} />}
      </div>,
    )
  }

  return (
    <div
      className={'zone-plateau' + (pleine ? ' pleine' : '')}
      ref={zone}
      onPointerDown={appui}
      onPointerMove={deplacement}
      onPointerUp={fin}
      onPointerCancel={fin}
    >
      <div className="plateau" style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.s})` }}>
        {cases}
      </div>
    </div>
  )
}

function Fleche({ dir }: { dir: 'H' | 'V' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ position: 'absolute', inset: '15%', color: 'var(--ring)', transform: dir === 'V' ? 'rotate(90deg)' : undefined }}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
