// Publie firestore.rules sur le projet Firebase, comme « Publier » dans la console (voir CLAUDE.md, « Firebase »).
//
//   FIREBASE_SERVICE_ACCOUNT="$(cat cle.json)" npm run regles
//
// La clé est celle d'un compte de service du projet (console Firebase → Paramètres du projet → Comptes de service →
// Générer une nouvelle clé privée) ; le projet visé est celui de la clé. Passe par l'API Firebase Rules (aucune
// dépendance) : rien n'est publié si les règles en ligne sont déjà celles du fichier.

import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const FICHIER = 'firestore.rules'
const API = 'https://firebaserules.googleapis.com/v1'

interface CompteDeService {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

const brut = process.env.FIREBASE_SERVICE_ACCOUNT
if (!brut) {
  console.error('Variable FIREBASE_SERVICE_ACCOUNT absente (contenu JSON de la clé du compte de service).')
  process.exit(1)
}
const compte = JSON.parse(brut) as CompteDeService
const projet = compte.project_id
const source = readFileSync(FICHIER, 'utf8')

const base64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

/** Jeton d'accès OAuth du compte de service (JWT signé échangé contre un jeton, sans bibliothèque Google). */
async function jetonAcces(): Promise<string> {
  const urlJeton = compte.token_uri ?? 'https://oauth2.googleapis.com/token'
  const maintenant = Math.floor(Date.now() / 1000)
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const contenu = base64url(
    JSON.stringify({
      iss: compte.client_email,
      scope: 'https://www.googleapis.com/auth/firebase',
      aud: urlJeton,
      iat: maintenant,
      exp: maintenant + 600,
    }),
  )
  const signature = createSign('RSA-SHA256').update(`${entete}.${contenu}`).sign(compte.private_key)
  const r = await fetch(urlJeton, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${entete}.${contenu}.${base64url(signature)}`,
    }),
  })
  if (!r.ok) throw new Error(`Connexion du compte de service refusée (${r.status}) : ${await r.text()}`)
  return ((await r.json()) as { access_token: string }).access_token
}

const jeton = await jetonAcces()

async function appel<T>(methode: string, chemin: string, corps?: unknown): Promise<{ statut: number; donnees: T }> {
  const r = await fetch(`${API}/${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  const texte = await r.text()
  if (!r.ok && r.status !== 404) throw new Error(`${methode} ${chemin} : ${r.status} ${texte}`)
  return { statut: r.status, donnees: (texte ? JSON.parse(texte) : {}) as T }
}

interface Ruleset {
  name: string
  source: { files: { name: string; content: string }[] }
}

// Règles en ligne : rien à faire si elles sont déjà celles du fichier.
const nomRelease = `projects/${projet}/releases/cloud.firestore`
const enLigne = await appel<{ rulesetName: string }>('GET', nomRelease)
if (enLigne.statut === 200) {
  const actuel = await appel<Ruleset>('GET', enLigne.donnees.rulesetName)
  if (actuel.donnees.source?.files?.[0]?.content === source) {
    console.log(`Règles Firestore de ${projet} déjà à jour.`)
    process.exit(0)
  }
}

// Nouveau jeu de règles (le serveur le compile et refuse une erreur de syntaxe), puis on le met en service.
const cree = await appel<Ruleset>('POST', `projects/${projet}/rulesets`, { source: { files: [{ name: FICHIER, content: source }] } })
const release = { name: nomRelease, rulesetName: cree.donnees.name }
if (enLigne.statut === 200) await appel('PATCH', nomRelease, { release })
else await appel('POST', `projects/${projet}/releases`, release)
console.log(`Règles Firestore publiées sur ${projet} (${cree.donnees.name}).`)
