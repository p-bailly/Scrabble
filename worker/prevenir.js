// Le Worker : quand un joueur vient d'écrire dans une partie (coup, invitation, refus, fin), son appli appelle
// `POST /prevenir` avec son jeton Firebase et le code de la partie ; on prévient l'autre joueur par notification push.
// Remplace la Cloud Function (functions/) pour qui n'a pas l'offre Blaze. Voir CLAUDE.md, « Notifications push ».

import { notificationsDepuisEtat } from '../functions/messages.js'

const CORS = {
  'Access-Control-Allow-Origin': '*', // aucun cookie : l'appelant s'identifie par son jeton, pas par son origine
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const reponse = (statut, corps) =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }) },
  })

/**
 * @param {Request} requete
 * @param {{ projectId: string }} config
 * @param {{ verifierJeton: (jeton: string) => Promise<string | null>, google: any }} dep
 */
export async function traiter(requete, config, dep) {
  if (requete.method === 'OPTIONS') return reponse(204)
  if (new URL(requete.url).pathname !== '/prevenir' || requete.method !== 'POST') return reponse(404, { erreur: 'introuvable' })

  const jeton = (requete.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const uid = jeton ? await dep.verifierJeton(jeton) : null
  if (!uid) return reponse(401, { erreur: 'connexion requise' })

  let code = ''
  try {
    code = String((await requete.json()).code ?? '')
  } catch {
    /* corps illisible : refusé ci-dessous */
  }
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return reponse(400, { erreur: 'code de partie invalide' })

  const partie = await dep.google.lirePartie(code)
  if (!partie) return reponse(404, { erreur: 'partie inconnue' })

  let envoyes = 0
  for (const n of notificationsDepuisEtat(partie, uid)) {
    const appareils = (await dep.google.lireAppareils(n.uid)).filter((a) => (a.genres ?? []).includes(n.genre) && a.token)
    for (const a of appareils) {
      const resultat = await dep.google.envoyer(a.token, n)
      if (resultat === 'ok') envoyes++
      // Un jeton refusé par FCM (appli désinstallée, données effacées) ne servira plus : on l'oublie.
      else if (resultat === 'perime') await dep.google.oublierAppareil(a.nom)
    }
  }
  return reponse(200, { envoyes })
}
