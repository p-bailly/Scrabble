import { describe, expect, it } from 'vitest'
import { notificationsDepuisEtat } from '../../functions/messages.js'
import { champs, verifierJeton } from '../../worker/google.js'
import { traiter } from '../../worker/prevenir.js'

const partie = (modif: Record<string, unknown> = {}) => ({
  code: 'K7P2QX',
  createur: 'moi',
  joueurs: ['moi', 'lui'],
  pseudos: { moi: 'Moi', lui: 'Léa' },
  etat: 'encours',
  tour: 'lui',
  nbCoups: 1,
  scores: { moi: 12, lui: 0 },
  dernier: { uid: 'moi', type: 'mot', mot: 'maison', points: 12 },
  invites: [],
  refus: [],
  fin: null,
  ...modif,
})

describe('notifications depuis l’état actuel (Worker)', () => {
  it('prévient l’adversaire de l’auteur du dernier coup, et lui seul', () => {
    expect(notificationsDepuisEtat(partie(), 'moi').map((n) => [n.uid, n.genre, n.texte])).toEqual([['lui', 'tour', 'Moi a joué MAISON (12 pts).']])
    expect(notificationsDepuisEtat(partie(), 'lui')).toEqual([])
    expect(notificationsDepuisEtat(partie(), 'intrus')).toEqual([])
  })

  it('invitation : seul le créateur peut la faire envoyer ; refus : seul celui qui a refusé', () => {
    const attente = partie({ etat: 'attente', joueurs: ['moi'], tour: null, nbCoups: 0, dernier: null, invites: ['lui'] })
    expect(notificationsDepuisEtat(attente, 'moi').map((n) => [n.uid, n.titre])).toEqual([['lui', 'Invitation à jouer']])
    expect(notificationsDepuisEtat(attente, 'lui')).toEqual([])
    const refusee = { ...attente, invites: [], refus: ['lui'] }
    expect(notificationsDepuisEtat(refusee, 'lui').map((n) => [n.uid, n.titre])).toEqual([['moi', 'Invitation refusée']])
    expect(notificationsDepuisEtat(refusee, 'moi')).toEqual([])
  })

  it('l’invité qui rejoint prévient le créateur ; la fin de partie prévient l’adversaire du dernier joueur', () => {
    const rejoint = partie({ tour: 'moi', nbCoups: 0, dernier: null })
    expect(notificationsDepuisEtat(rejoint, 'lui').map((n) => [n.uid, n.texte])).toEqual([['moi', 'Léa a rejoint ta partie.']])
    const finie = partie({ etat: 'finie', tour: null, scores: { moi: 300, lui: 280 } })
    expect(notificationsDepuisEtat(finie, 'moi').map((n) => [n.uid, n.genre])).toEqual([['lui', 'fin']])
    expect(notificationsDepuisEtat(finie, 'lui')).toEqual([])
  })
})

const fs = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [
      k,
      typeof v === 'number'
        ? { integerValue: String(v) }
        : Array.isArray(v)
          ? { arrayValue: { values: v.map((x) => ({ stringValue: x })) } }
          : v === null
            ? { nullValue: null }
            : typeof v === 'object'
              ? { mapValue: { fields: fs(v as Record<string, unknown>) } }
              : { stringValue: String(v) },
    ]),
  )

describe('décodage Firestore (REST)', () => {
  it('relit nombres, listes, objets et nuls', () => {
    expect(champs(fs({ n: 3, l: ['a', 'b'], m: { x: 'y' }, z: null, s: 'ok' }))).toEqual({ n: 3, l: ['a', 'b'], m: { x: 'y' }, z: null, s: 'ok' })
  })
})

describe('jeton Firebase', () => {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const maintenant = 1_800_000_000

  async function fabriquer(modif: Record<string, unknown> = {}) {
    const paire = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const jwk = { ...(await crypto.subtle.exportKey('jwk', paire.publicKey)), kid: 'k' + Math.random(), alg: 'RS256' }
    const entete = enc({ alg: 'RS256', kid: jwk.kid })
    const charge = enc({ aud: 'p', iss: 'https://securetoken.google.com/p', sub: 'uid1', iat: maintenant - 10, exp: maintenant + 3000, ...modif })
    const signature = b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', paire.privateKey, new TextEncoder().encode(`${entete}.${charge}`)))
    const chercher = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as typeof fetch
    return { jeton: `${entete}.${charge}.${signature}`, chercher }
  }

  it('accepte un jeton bien signé et rend l’uid', async () => {
    const { jeton, chercher } = await fabriquer()
    expect(await verifierJeton(jeton, 'p', chercher, maintenant)).toBe('uid1')
  })
  it('refuse un jeton expiré, d’un autre projet ou à la signature modifiée', async () => {
    const a = await fabriquer({ exp: maintenant - 1 })
    expect(await verifierJeton(a.jeton, 'p', a.chercher, maintenant)).toBeNull()
    const b = await fabriquer()
    expect(await verifierJeton(b.jeton, 'autre', b.chercher, maintenant)).toBeNull()
    const c = await fabriquer()
    const [h, p, s] = c.jeton.split('.')
    expect(await verifierJeton(`${h}.${enc({ aud: 'p', iss: 'https://securetoken.google.com/p', sub: 'uid2', iat: 0, exp: maintenant + 5 })}.${s}`, 'p', c.chercher, maintenant)).toBeNull()
    expect(p).toBeTruthy()
  })
})

describe('Worker /prevenir', () => {
  const faux = (p: unknown, envoi: string[] = [], perimes: string[] = [], resultat = 'ok') => ({
    lirePartie: async () => p,
    lireAppareils: async (uid: string) => [
      { nom: 'doc/' + uid, token: 'T-' + uid, genres: ['tour', 'fin'] },
      { nom: 'doc2/' + uid, token: 'muet-' + uid, genres: [] },
    ],
    envoyer: async (jeton: string) => {
      envoi.push(jeton)
      return resultat
    },
    oublierAppareil: async (nom: string) => void perimes.push(nom),
  })
  const appel = (corps: unknown, jeton = 'bon') =>
    new Request('https://w.test/prevenir', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton }, body: JSON.stringify(corps) })
  const verifier = async (j: string) => (j === 'bon' ? 'moi' : null)

  it('envoie aux appareils qui veulent ce genre de notification', async () => {
    const envoi: string[] = []
    const r = await traiter(appel({ code: 'K7P2QX' }), { projectId: 'p' }, { verifierJeton: verifier, google: faux(partie(), envoi) })
    expect(r.status).toBe(200)
    expect(envoi).toEqual(['T-lui'])
  })
  it('oublie un jeton périmé', async () => {
    const perimes: string[] = []
    await traiter(appel({ code: 'K7P2QX' }), { projectId: 'p' }, { verifierJeton: verifier, google: faux(partie(), [], perimes, 'perime') })
    expect(perimes).toEqual(['doc/lui'])
  })
  it('refuse sans connexion, avec un code invalide, ou pour une partie inconnue', async () => {
    const dep = { verifierJeton: verifier, google: faux(partie()) }
    expect((await traiter(appel({ code: 'K7P2QX' }, 'mauvais'), { projectId: 'p' }, dep)).status).toBe(401)
    expect((await traiter(appel({ code: '../x' }), { projectId: 'p' }, dep)).status).toBe(400)
    expect((await traiter(appel({ code: 'K7P2QX' }), { projectId: 'p' }, { ...dep, google: faux(null) })).status).toBe(404)
  })
  it('n’envoie rien si l’appelant n’est pas l’auteur du dernier coup', async () => {
    const envoi: string[] = []
    await traiter(appel({ code: 'K7P2QX' }), { projectId: 'p' }, { verifierJeton: verifier, google: faux(partie({ dernier: { uid: 'lui', type: 'passe', points: 0 } }), envoi) })
    expect(envoi).toEqual([])
  })
})
