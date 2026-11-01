// Point d'entrée Cloudflare Worker. Secret à fournir : FIREBASE_SERVICE_ACCOUNT (JSON de la clé du compte de service
// Firebase) ; voir CLAUDE.md, « Notifications push ».

import { google, verifierJeton } from './google.js'
import { traiter } from './prevenir.js'

export default {
  async fetch(requete, env) {
    let compte
    try {
      compte = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
    } catch {
      return new Response('FIREBASE_SERVICE_ACCOUNT manquant ou illisible', { status: 500 })
    }
    try {
      return await traiter(requete, { projectId: compte.project_id }, { verifierJeton: (j) => verifierJeton(j, compte.project_id), google: google(compte) })
    } catch (e) {
      console.error(e)
      return new Response(JSON.stringify({ erreur: 'échec de l’envoi' }), { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } })
    }
  },
}
