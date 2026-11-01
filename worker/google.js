// Accès à Google depuis le Worker, sans bibliothèque : vérification du jeton Firebase de l'appelant, jeton d'accès du compte
// de service, lecture de Firestore (REST) et envoi FCM (HTTP v1). Voir CLAUDE.md, « Notifications push ».

const encodeur = new TextEncoder()

const base64url = (octets) =>
  btoa(String.fromCharCode(...new Uint8Array(octets))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

const depuisBase64url = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))

const json = (octets) => JSON.parse(new TextDecoder().decode(depuisBase64url(octets)))

const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
let cleCache = { le: 0, cles: /** @type {any[]} */ ([]) }

/**
 * Vérifie un jeton d'identité Firebase (RS256, clés publiques de Google) et renvoie l'uid, ou null s'il est invalide.
 * @param {string} jeton
 * @param {string} projectId
 * @param {typeof fetch} [chercher]
 * @param {number} [maintenant] secondes
 */
export async function verifierJeton(jeton, projectId, chercher = fetch, maintenant = Math.floor(Date.now() / 1000)) {
  try {
    const [entete, charge, signature] = jeton.split('.')
    if (!entete || !charge || !signature) return null
    const h = json(entete)
    const c = json(charge)
    if (h.alg !== 'RS256') return null
    if (c.aud !== projectId || c.iss !== `https://securetoken.google.com/${projectId}`) return null
    if (typeof c.sub !== 'string' || !c.sub || c.exp <= maintenant || c.iat > maintenant + 300) return null
    if (cleCache.le + 3600 < maintenant || !cleCache.cles.some((k) => k.kid === h.kid)) {
      const r = await chercher(JWKS)
      if (!r.ok) return null
      cleCache = { le: maintenant, cles: (await r.json()).keys }
    }
    const jwk = cleCache.cles.find((k) => k.kid === h.kid)
    if (!jwk) return null
    const cle = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cle, depuisBase64url(signature), encodeur.encode(`${entete}.${charge}`))
    return ok ? c.sub : null
  } catch {
    return null
  }
}

let acces = { jeton: '', expire: 0 }

/** Jeton d'accès OAuth du compte de service (Firestore et FCM), gardé jusqu'à son expiration. */
export async function jetonAcces(compte, chercher = fetch, maintenant = Math.floor(Date.now() / 1000)) {
  if (acces.expire > maintenant + 60) return acces.jeton
  const entete = base64url(encodeur.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const charge = base64url(
    encodeur.encode(
      JSON.stringify({
        iss: compte.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: maintenant,
        exp: maintenant + 3600,
      }),
    ),
  )
  const pem = compte.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
  const cle = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cle, encodeur.encode(`${entete}.${charge}`)))
  const r = await chercher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${entete}.${charge}.${signature}` }),
  })
  if (!r.ok) throw new Error('Jeton d’accès refusé : ' + r.status)
  const d = await r.json()
  acces = { jeton: d.access_token, expire: maintenant + (d.expires_in ?? 3600) }
  return acces.jeton
}

/** Valeur Firestore (format REST) → valeur JavaScript. */
export function valeur(v) {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(valeur)
  if ('mapValue' in v) return champs(v.mapValue.fields)
  return null
}

export const champs = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, valeur(v)]))

/**
 * Accès à Firestore et FCM avec les droits du compte de service.
 * @param {{ project_id: string, client_email: string, private_key: string }} compte
 * @param {typeof fetch} [chercher]
 */
export function google(compte, chercher = fetch) {
  const projet = compte.project_id
  const racine = `https://firestore.googleapis.com/v1/projects/${projet}/databases/(default)/documents`
  const appeler = async (url, options = {}) =>
    chercher(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${await jetonAcces(compte, chercher)}` } })
  return {
    projet,
    /** Document de la partie (champs décodés), ou null s'il n'existe pas. */
    async lirePartie(code) {
      const r = await appeler(`${racine}/parties/${code}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error('Lecture de la partie : ' + r.status)
      return champs((await r.json()).fields)
    },
    /** Appareils d'un joueur : jeton FCM, genres de notification voulus, et nom du document (pour l'oublier). */
    async lireAppareils(uid) {
      const r = await appeler(`${racine}/joueurs/${uid}/appareils?pageSize=20`)
      if (!r.ok) throw new Error('Lecture des appareils : ' + r.status)
      const d = await r.json()
      return (d.documents ?? []).map((doc) => ({ nom: doc.name, ...champs(doc.fields) }))
    },
    async oublierAppareil(nom) {
      await appeler(`https://firestore.googleapis.com/v1/${nom}`, { method: 'DELETE' })
    },
    /** Envoie une notification à un jeton ; renvoie 'ok', 'perime' (jeton à oublier) ou 'erreur'. */
    async envoyer(jeton, n) {
      const r = await appeler(`https://fcm.googleapis.com/v1/projects/${projet}/messages:send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: jeton,
            notification: { title: n.titre, body: n.texte },
            // Le lien et le tag servent à l'appli : ouvrir la partie au toucher, et remplacer la notification locale.
            data: { hash: n.hash, tag: n.tag, titre: n.titre, texte: n.texte },
            android: { notification: { icon: 'ic_stat_notify', color: '#4C5FD5', tag: n.tag } },
          },
        }),
      })
      if (r.ok) return 'ok'
      const texte = await r.text()
      return r.status === 404 || texte.includes('UNREGISTERED') ? 'perime' : 'erreur'
    },
  }
}
