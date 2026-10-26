// Logo de l'appli : « La tuile », dessinée au crayon comme les logos de la famille Nimbus (Basket Live, Scan, Météo,
// Nimbus, Mes applis) : papier #F6F1E6, graphite #2E3644, chaque trait repassé deux fois avec un léger tremblé, un aplat
// léger puis des hachures appuyées. Scrabble prend le crayon violet. Sans filtre : uniquement des tracés.
//
// Écrit, sur la grille de l'icône adaptative Android (108 × 108, dessin dans le cercle sûr de 66) :
//  - design/logo/logo.svg (fond compris), repris par png.cjs pour les PNG ;
//  - public/icon.svg (icône de l'app web) ;
//  - les calques de l'icône adaptative Android (ic_launcher_foreground.xml, ic_launcher_monochrome.xml, fond papier)
//    et la petite icône des notifications (ic_stat_notify.xml, tuile pleine et S évidé).
// Le tremblé vient d'un tirage pseudo-aléatoire à graine fixe : le dessin est toujours le même. Les contours du « S » et
// du « 1 » des notifications viennent de la police Outfit (graisses 800 et 700, via opentype.js) et sont recopiés ici
// pour que le script n'ait aucune dépendance. Lancer : node design/logo/generer.mjs

import { writeFileSync } from 'node:fs'

const RACINE = new URL('../../', import.meta.url)
const RES = new URL('android/app/src/main/res/', RACINE)

export const PAPIER = '#F6F1E6'
const GRAPHITE = '#2E3644'
const BLANC = '#FFFDF8'
const VIOLET_CLAIR = '#BBA8E2'
const VIOLET_APPUYE = '#7A5BB8'

// ---------- géométrie ----------
const rad = (d) => (d * Math.PI) / 180
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const tourner = (pts, deg, cx, cy) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg))
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])
}
const decaler = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy])

/** Rééchantillonne une ligne brisée tous les `pas` unités (les courbes ont un point tous les 1,3, comme dans Nimbus). */
function reechantillonner(pts, pas = 1.3) {
  const sortie = [pts[0]]
  let reste = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const long = dist(a, b)
    let t = pas - reste
    while (t < long) {
      sortie.push([a[0] + ((b[0] - a[0]) * t) / long, a[1] + ((b[1] - a[1]) * t) / long])
      t += pas
    }
    reste = long - (t - pas)
  }
  const dernier = pts[pts.length - 1]
  if (dist(sortie[sortie.length - 1], dernier) > 0.4) sortie.push(dernier)
  else sortie[sortie.length - 1] = dernier
  return sortie
}

const bezier = (p0, c1, c2, p1, n = 24) => {
  const o = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    o.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ])
  }
  return o
}
const joindre = (...tableaux) => tableaux.flatMap((a, i) => (i ? a.slice(1) : a))

function carreArrondi(cx, cy, w, h, r, degres = 0, n = 4) {
  const hw = w / 2, hh = h / 2, pts = []
  const coins = [[hw - r, -hh + r, -90], [hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180]]
  for (const [x, y, a0] of coins) {
    for (let k = 0; k <= n; k++) {
      const a = rad(a0 + (90 * k) / n)
      pts.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)])
    }
  }
  return tourner(pts, degres, cx, cy)
}

// Lettre S et chiffre 1 : lignes centrales dans une boîte unité (x ± 0,32, y ± 0,5).
const LETTRES = {
  S: () => [joindre(
    bezier([0.3, -0.3], [0.3, -0.42], [0.18, -0.5], [0, -0.5]),
    bezier([0, -0.5], [-0.18, -0.5], [-0.3, -0.4], [-0.3, -0.25]),
    bezier([-0.3, -0.25], [-0.3, -0.08], [-0.15, -0.03], [0, 0]),
    bezier([0, 0], [0.15, 0.03], [0.3, 0.08], [0.3, 0.25]),
    bezier([0.3, 0.25], [0.3, 0.4], [0.18, 0.5], [0, 0.5]),
    bezier([0, 0.5], [-0.18, 0.5], [-0.3, 0.42], [-0.3, 0.3]),
  )],
  1: () => [[[-0.22, -0.3], [0.06, -0.5], [0.06, 0.5]]],
}

// ---------- le dessin, consigné en opérations puis écrit en SVG ou en vecteur Android ----------
const f1 = (n) => n.toFixed(1)
const D = (pts, ferme) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L') + (ferme ? ' Z' : '')

function melange(graine) {
  let a = graine >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Dessin {
  constructor(graine) {
    this.alea = melange(graine)
    this.ops = []
  }
  tremble(pts, a = 0.3) {
    return pts.map(([x, y]) => [x + (this.alea() * 2 - 1) * a, y + (this.alea() * 2 - 1) * a])
  }
  aplat(pts, couleur, alpha = 1) {
    this.ops.push({ k: 'aplat', d: D(pts, true), couleur, alpha })
  }
  /** Contour repassé deux fois : 100 % puis 55 % d'opacité, à 70 % de l'épaisseur. */
  trait(pts, { ferme = false, w = 2.6, couleur = GRAPHITE, j = 0.3 } = {}) {
    for (const [largeur, alpha] of [[w, 1], [w * 0.7, 0.55]]) {
      this.ops.push({ k: 'trait', d: D(this.tremble(pts, j), ferme), couleur, w: largeur, alpha })
    }
  }
  contour(pts, o = {}) {
    this.trait(pts, { ferme: true, ...o })
  }
  /** Hachures appuyées, à −38° tous les 3,6, tenues dans la forme. */
  hachure(forme, couleur, { angle = -38, ecart = 3.6, w = 1.2, alpha = 0.85 } = {}) {
    const xs = forme.map((p) => p[0]), ys = forme.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const demi = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 3
    const a = rad(angle), u = [Math.cos(a), Math.sin(a)], n = [-Math.sin(a), Math.cos(a)]
    let d = ''
    for (let o = -demi; o <= demi; o += ecart + (this.alea() * 2 - 1) * 0.35) {
      const pente = (this.alea() * 2 - 1) * 0.12
      const l = demi + (this.alea() * 2 - 1) * 1.5
      const p0 = [cx + n[0] * o - u[0] * l + (this.alea() * 2 - 1), cy + n[1] * o - u[1] * l + (this.alea() * 2 - 1)]
      const p1 = [cx + n[0] * (o + pente * 10) + u[0] * l + (this.alea() * 2 - 1), cy + n[1] * (o + pente * 10) + u[1] * l + (this.alea() * 2 - 1)]
      d += `M${f1(p0[0])} ${f1(p0[1])} L${f1(p1[0])} ${f1(p1[1])} `
    }
    this.ops.push({ k: 'hachure', clip: D(forme, true), d: d.trim(), couleur, w, alpha })
  }
  ombre(forme) {
    this.hachure(forme, GRAPHITE, { ecart: 2.6, w: 0.9, alpha: 0.35 })
  }
  lettre(c, cx, cy, h, degres, { w = 2.2, j = 0.22 } = {}) {
    for (const ligne of LETTRES[c]()) {
      const pts = reechantillonner(tourner(ligne.map(([x, y]) => [cx + x * h, cy + y * h]), degres, cx, cy), 1.3)
      this.trait(pts, { w, j })
    }
  }
  /** Tuile : ombre portée hachurée, tranche au crayon violet, face blanche, lettre et score. */
  tuile({ cx, cy, taille, r, degres, lettre, valeur, tranche, ow, lw, lh, ombre }) {
    const face = carreArrondi(cx, cy, taille, taille, r, degres)
    const bord = decaler(face, tranche[0], tranche[1])
    this.ombre(decaler(face, ombre[0], ombre[1]))
    this.aplat(bord, VIOLET_CLAIR, 0.6)
    this.hachure(bord, VIOLET_APPUYE)
    this.contour(bord, { w: ow })
    this.aplat(face, BLANC)
    this.contour(face, { w: ow })
    const [lx, ly] = tourner([[cx - 0.02 * taille, cy - 0.02 * taille]], degres, cx, cy)[0]
    this.lettre(lettre, lx, ly, lh, degres, { w: lw })
    const [sx, sy] = tourner([[cx + taille * 0.3, cy + taille * 0.3]], degres, cx, cy)[0]
    this.lettre(valeur, sx, sy, taille * 0.17, degres, { w: Math.max(1.2, lw * 0.42), j: 0.12 })
  }
}

const dessin = new Dessin(20261026)
dessin.tuile({ cx: 52.5, cy: 50.5, taille: 41, r: 6, degres: -7, lettre: 'S', valeur: '1', tranche: [3.5, 4.1], ow: 2.6, lw: 3.6, lh: 24, ombre: [7, 8] })

// SVG : le même assemblage que les logos Nimbus (papier, aplats, hachures coupées par un clipPath, contours).
function corpsSvg(ops) {
  const defs = []
  const corps = ops.map((op) => {
    if (op.k === 'aplat') return `<path d="${op.d}" fill="${op.couleur}"${op.alpha < 1 ? ` fill-opacity="${op.alpha}"` : ''}></path>`
    if (op.k === 'trait') return `<path d="${op.d}" fill="none" stroke="${op.couleur}" stroke-opacity="${op.alpha.toFixed(2)}" stroke-width="${op.w.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"></path>`
    const id = `h${defs.length + 1}`
    defs.push(`<clipPath id="${id}"><path d="${op.clip}"></path></clipPath>`)
    return `<path d="${op.d}" stroke="${op.couleur}" stroke-width="${op.w}" stroke-linecap="round" stroke-opacity="${op.alpha}" clip-path="url(#${id})"></path>`
  })
  return `<defs>${defs.join('')}</defs>` + corps.join('')
}
const ETIQUETTE = 'Scrabble : une tuile S penchée, la tranche au crayon violet'
const svg = (viewBox, fond) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${ETIQUETTE}">${fond}${corpsSvg(dessin.ops)}</svg>\n`

writeFileSync(new URL('design/logo/logo.svg', RACINE), svg('0 0 108 108', `<rect width="108" height="108" fill="${PAPIER}"></rect>`))
// App web : coins arrondis, dessin agrandi (la zone 18..90 de la grille).
writeFileSync(new URL('public/icon.svg', RACINE), svg('18 18 72 72', `<rect x="18" y="18" width="72" height="72" rx="16" fill="${PAPIER}"></rect>`))

// Vecteur Android : mêmes tracés, hachures coupées par un clip-path ; le calque monochrome garde traits et hachures.
const vecteur = (corps, taille = 108) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par design/logo/generer.mjs : ne pas modifier à la main. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${taille}dp"
    android:height="${taille}dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
${corps}
</vector>
`
function corpsAndroid(ops, mono) {
  const trait = (op) => `android:strokeColor="${mono ? '#FFFFFFFF' : op.couleur}" android:strokeAlpha="${op.alpha}" android:strokeWidth="${op.w}" android:strokeLineCap="round" android:strokeLineJoin="round"`
  return ops
    .map((op) => {
      if (op.k === 'aplat') return mono ? '' : `    <path android:fillColor="${op.couleur}"${op.alpha < 1 ? ` android:fillAlpha="${op.alpha}"` : ''} android:pathData="${op.d}" />\n`
      if (op.k === 'trait') return `    <path ${trait(op)} android:pathData="${op.d}" />\n`
      return `    <group>\n        <clip-path android:pathData="${op.clip}" />\n        <path ${trait(op)} android:pathData="${op.d}" />\n    </group>\n`
    })
    .join('')
    .trimEnd()
}
writeFileSync(new URL('drawable/ic_launcher_foreground.xml', RES), vecteur(corpsAndroid(dessin.ops, false)))
writeFileSync(new URL('drawable/ic_launcher_monochrome.xml', RES), vecteur(corpsAndroid(dessin.ops, true)))
writeFileSync(
  new URL('values/ic_launcher_background.xml', RES),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PAPIER}</color>\n</resources>\n`,
)

// Notification : silhouette d'une seule couleur, donc la tuile pleine avec le S évidé (contours d'Outfit).
// « S » d'Outfit 800 (corps 30) et « 1 » d'Outfit 700 (corps 8), ligne de base en y = 0.
const S =
  'M8.55 0.33Q5.88 0.33 3.92-0.48Q1.95-1.29 0.33-3.03L3.72-6.45Q4.83-5.28 6.09-4.67Q7.35-4.05 8.94-4.05Q10.29-4.05 11.03-4.51Q11.76-4.98 11.76-5.79Q11.76-6.54 11.22-7.04Q10.68-7.53 9.79-7.90Q8.91-8.28 7.84-8.63Q6.78-8.97 5.71-9.46Q4.65-9.96 3.76-10.68Q2.88-11.40 2.34-12.48Q1.80-13.56 1.80-15.15Q1.80-17.19 2.77-18.63Q3.75-20.07 5.49-20.85Q7.23-21.63 9.54-21.63Q11.85-21.63 13.80-20.85Q15.75-20.07 17.01-18.69L13.59-15.30Q12.63-16.26 11.64-16.74Q10.65-17.22 9.48-17.22Q8.37-17.22 7.74-16.83Q7.11-16.44 7.11-15.72Q7.11-15 7.65-14.55Q8.19-14.10 9.07-13.75Q9.96-13.41 11.03-13.05Q12.09-12.69 13.14-12.21Q14.19-11.73 15.07-10.98Q15.96-10.23 16.50-9.09Q17.04-7.95 17.04-6.33Q17.04-3.15 14.80-1.41Q12.57 0.33 8.55 0.33Z'
const UN = 'M2.50 0L1.25 0L1.25-4.58L0.16-4.58L0.16-5.65L2.50-5.65L2.50 0Z'

/** Applique échelle puis translation à un tracé fait de M, L, Q, Z en coordonnées absolues. */
function transformer(d, k, tx, ty) {
  return d.replace(/(-?\d*\.?\d+)[ ,]?(-?\d*\.?\d+)/g, (_, x, y) => `${(Number(x) * k + tx).toFixed(2)} ${(Number(y) * k + ty).toFixed(2)}`)
}
const jeton = (x, y) =>
  `M${x + 8} ${y}H${x + 38}A8 8 0 0 1 ${x + 46} ${y + 8}V${y + 38}A8 8 0 0 1 ${x + 38} ${y + 46}H${x + 8}A8 8 0 0 1 ${x} ${y + 38}V${y + 8}A8 8 0 0 1 ${x + 8} ${y}Z`
const evide = `        <path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="${jeton(31, 30)}${transformer(S, 1.25, 41.14, 66.31)}${transformer(UN, 1.1, 69.25, 71)}" />\n`
const groupe = (contenu) => `    <group android:rotation="-8" android:pivotX="54" android:pivotY="53">\n${contenu}    </group>`
writeFileSync(
  new URL('drawable/ic_stat_notify.xml', RES),
  vecteur(`    <group android:scaleX="1.9" android:scaleY="1.9" android:pivotX="54" android:pivotY="53">\n${groupe(evide)}\n    </group>`, 24),
)
console.log('logo.svg, icon.svg et icônes Android écrits')
