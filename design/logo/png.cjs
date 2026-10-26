// Rend les PNG du logo à partir de design/logo/logo.svg : anciennes icônes Android (avant Android 8, sans icône
// adaptative), icônes de l'app web et écrans de démarrage. À relancer après design/logo/generer.mjs :
//   node design/logo/png.cjs
// Aucune dépendance : le script pilote le Chrome (ou le Edge) déjà installé en mode headless. Au besoin, indiquer
// son chemin dans la variable d'environnement CHROME_PATH.
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

const RACINE = path.join(__dirname, '..', '..')
const RES = path.join(RACINE, 'android', 'app', 'src', 'main', 'res')
const LOGO = fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8')
// Fond des écrans de démarrage : celui de l'app en thème clair.
const FOND = '#FAFAF7'
const COINS = '22%'
const DENSITES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }

const NAVIGATEUR = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((c) => c && fs.existsSync(c))
if (!NAVIGATEUR) throw new Error('Chrome ou Edge introuvable : renseigner CHROME_PATH')

// Le logo cadré sur une zone de la grille 108 : « 18 18 72 72 » est la partie visible de l'icône adaptative.
function logo(taille, zone = '18 18 72 72') {
  return LOGO.replace(/viewBox="[^"]*"/, `viewBox="${zone}" width="${taille}" height="${taille}"`)
}

function icone(taille, coins) {
  return `<div style="width:${taille}px;height:${taille}px;border-radius:${coins};overflow:hidden">${logo(taille)}</div>`
}

// Largeur et hauteur d'un PNG, lues dans son en-tête.
function dimensions(fichier) {
  const tete = fs.readFileSync(fichier).subarray(16, 24)
  return [tete.readUInt32BE(0), tete.readUInt32BE(4)]
}

const dossierTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrabble-logo-'))

function rendre(fichier, w, h, html, transparent = false) {
  const page = path.join(dossierTemp, 'page.html')
  fs.writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}svg{display:block}</style>${html}`,
  )
  // On contrôle ensuite la taille obtenue : le mode headless peut rogner la fenêtre.
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${path.join(dossierTemp, 'profil')}`, `--window-size=${w},${h}`,
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--screenshot=${fichier}`, pathToFileURL(page).href,
  ]
  execFileSync(NAVIGATEUR, args, { stdio: 'ignore' })
  const [lu, haut] = dimensions(fichier)
  if (lu !== w || haut !== h) throw new Error(`${fichier} : ${lu}×${haut} au lieu de ${w}×${h}`)
  console.log(path.relative(RACINE, fichier))
}

for (const [densite, taille] of Object.entries(DENSITES)) {
  const dossier = path.join(RES, `mipmap-${densite}`)
  rendre(path.join(dossier, 'ic_launcher.png'), taille, taille, icone(taille, COINS), true)
  rendre(path.join(dossier, 'ic_launcher_round.png'), taille, taille, icone(taille, '50%'), true)
}

// App web : carrés pleins (le système applique sa forme) ; la version « maskable » laisse de la marge autour du
// dessin pour qu'il reste dans le cercle sûr (80 % de l'icône).
const web = path.join(RACINE, 'public')
rendre(path.join(web, 'icon-192.png'), 192, 192, logo(192))
rendre(path.join(web, 'icon-512.png'), 512, 512, logo(512))
rendre(path.join(web, 'icon-maskable-512.png'), 512, 512, logo(512, '9 9 90 90'))

// Écrans de démarrage : l'icône au centre, sur un tiers du petit côté, sur le fond de l'app.
for (const dossier of fs.readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const fichier = path.join(RES, dossier, 'splash.png')
  if (!fs.existsSync(fichier)) continue
  const [w, h] = dimensions(fichier)
  const taille = Math.round(Math.min(w, h) * 0.32)
  const html = `<div style="width:${w}px;height:${h}px;background:${FOND};display:flex;align-items:center;justify-content:center">${icone(taille, COINS)}</div>`
  rendre(fichier, w, h, html)
}

fs.rmSync(dossierTemp, { recursive: true, force: true })
