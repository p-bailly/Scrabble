// Logo de l'appli : un jeton « S » couleur sable, légèrement incliné, sur fond indigo (DA « Minimal moderne »).
//
// Écrit, sur la grille de l'icône adaptative Android (108 × 108, dessin dans le cercle sûr de 66) :
//  - design/logo/logo.svg (fond compris), repris par png.cjs pour les PNG ;
//  - public/icon.svg (icône de l'app web) ;
//  - les calques de l'icône adaptative Android (ic_launcher_foreground.xml, ic_launcher_monochrome.xml)
//    et la petite icône des notifications (ic_stat_notify.xml).
// Les contours des caractères viennent de la police Outfit (graisses 800 et 700, via opentype.js) et sont
// recopiés ici pour que le script n'ait aucune dépendance. Lancer : node design/logo/generer.mjs

import { writeFileSync } from 'node:fs'

const RACINE = new URL('../../', import.meta.url)
const RES = new URL('android/app/src/main/res/', RACINE)

export const INDIGO = '#4C5FD5'
const OMBRE = '#3346B8'
const SABLE = '#F3D9A4'
const ENCRE = '#2B2116'

// « S » d'Outfit 800 (corps 30) et « 1 » d'Outfit 700 (corps 8), ligne de base en y = 0.
const S =
  'M8.55 0.33Q5.88 0.33 3.92-0.48Q1.95-1.29 0.33-3.03L3.72-6.45Q4.83-5.28 6.09-4.67Q7.35-4.05 8.94-4.05Q10.29-4.05 11.03-4.51Q11.76-4.98 11.76-5.79Q11.76-6.54 11.22-7.04Q10.68-7.53 9.79-7.90Q8.91-8.28 7.84-8.63Q6.78-8.97 5.71-9.46Q4.65-9.96 3.76-10.68Q2.88-11.40 2.34-12.48Q1.80-13.56 1.80-15.15Q1.80-17.19 2.77-18.63Q3.75-20.07 5.49-20.85Q7.23-21.63 9.54-21.63Q11.85-21.63 13.80-20.85Q15.75-20.07 17.01-18.69L13.59-15.30Q12.63-16.26 11.64-16.74Q10.65-17.22 9.48-17.22Q8.37-17.22 7.74-16.83Q7.11-16.44 7.11-15.72Q7.11-15 7.65-14.55Q8.19-14.10 9.07-13.75Q9.96-13.41 11.03-13.05Q12.09-12.69 13.14-12.21Q14.19-11.73 15.07-10.98Q15.96-10.23 16.50-9.09Q17.04-7.95 17.04-6.33Q17.04-3.15 14.80-1.41Q12.57 0.33 8.55 0.33Z'
const UN = 'M2.50 0L1.25 0L1.25-4.58L0.16-4.58L0.16-5.65L2.50-5.65L2.50 0Z'

/** Applique échelle puis translation à un tracé fait de M, L, Q, Z en coordonnées absolues. */
function transformer(d, k, tx, ty) {
  return d.replace(/(-?\d*\.?\d+)[ ,]?(-?\d*\.?\d+)/g, (_, x, y) => `${(Number(x) * k + tx).toFixed(2)} ${(Number(y) * k + ty).toFixed(2)}`)
}

// Jeton : carré arrondi de 46 centré en (54, 53), incliné de -8° ; son ombre est décalée vers le bas.
const jeton = (x, y) =>
  `M${x + 8} ${y}H${x + 38}A8 8 0 0 1 ${x + 46} ${y + 8}V${y + 38}A8 8 0 0 1 ${x + 38} ${y + 46}H${x + 8}A8 8 0 0 1 ${x} ${y + 38}V${y + 8}A8 8 0 0 1 ${x + 8} ${y}Z`
const JETON = jeton(31, 30)
const OMBRE_JETON = jeton(33.5, 34)
// S : hauteur 27 environ, centré dans le jeton ; 1 : en bas à droite.
const LETTRE = transformer(S, 1.25, 41.14, 66.31)
const VALEUR = transformer(UN, 1.1, 69.25, 71)
const ROTATION = 'rotate(-8 54 53)'

const dessin = `<g transform="${ROTATION}"><path d="${OMBRE_JETON}" fill="${OMBRE}"/><path d="${JETON}" fill="${SABLE}"/><path d="${LETTRE}" fill="${ENCRE}"/><path d="${VALEUR}" fill="${ENCRE}"/></g>`

writeFileSync(
  new URL('design/logo/logo.svg', RACINE),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" fill="${INDIGO}"/>${dessin}</svg>\n`,
)
// App web : coins arrondis, dessin agrandi (la zone 18..90 de la grille).
writeFileSync(
  new URL('public/icon.svg', RACINE),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><rect x="18" y="18" width="72" height="72" rx="16" fill="${INDIGO}"/>${dessin}</svg>\n`,
)

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
const groupe = (contenu, extra = '') =>
  `    <group android:rotation="-8" android:pivotX="54" android:pivotY="53"${extra}>\n${contenu}    </group>`
const chemin = (d, couleur, evenOdd = false) =>
  `        <path android:fillColor="${couleur}"${evenOdd ? ' android:fillType="evenOdd"' : ''} android:pathData="${d}" />\n`

writeFileSync(
  new URL('drawable/ic_launcher_foreground.xml', RES),
  vecteur(groupe(chemin(OMBRE_JETON, OMBRE) + chemin(JETON, SABLE) + chemin(LETTRE, ENCRE) + chemin(VALEUR, ENCRE))),
)
// Icône monochrome (Android 13+) et icône de notification : le jeton, lettres évidées.
const evide = chemin(`${JETON}${LETTRE}${VALEUR}`, '#FFFFFFFF', true)
writeFileSync(new URL('drawable/ic_launcher_monochrome.xml', RES), vecteur(groupe(evide)))
// Notification : 24 dp, le jeton agrandi pour remplir l'icône.
writeFileSync(
  new URL('drawable/ic_stat_notify.xml', RES),
  vecteur(`    <group android:scaleX="1.9" android:scaleY="1.9" android:pivotX="54" android:pivotY="53">\n${groupe(evide)}\n    </group>`, 24),
)
writeFileSync(
  new URL('values/ic_launcher_background.xml', RES),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INDIGO}</color>\n</resources>\n`,
)
console.log('logo.svg, icon.svg et icônes Android écrits')
