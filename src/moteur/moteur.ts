// Accès au Web Worker du moteur depuis l'interface : chaque appel renvoie une promesse.

import type { Analyse, Coup, Pose } from '../jeu/coup'
import type { ContexteIA, Decision } from '../jeu/ia'
import type { Plateau } from '../jeu/plateau'
import type { Reponse, Requete } from './worker'

type EnAttente = { resoudre: (r: Reponse) => void; rejeter: (e: Error) => void }

let worker: Worker | null = null
let compteur = 0
const attente = new Map<number, EnAttente>()

function lancer(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ id: number; reponse?: Reponse; erreur?: string }>) => {
    const a = attente.get(e.data.id)
    if (!a) return
    attente.delete(e.data.id)
    if (e.data.erreur) a.rejeter(new Error(e.data.erreur))
    else a.resoudre(e.data.reponse!)
  }
  return worker
}

function envoyer(requete: Requete): Promise<Reponse> {
  const w = lancer()
  const id = ++compteur
  return new Promise((resoudre, rejeter) => {
    attente.set(id, { resoudre, rejeter })
    w.postMessage({ id, requete })
  })
}

/** Adresse du dictionnaire, relative à la page (marche à la racine comme dans un sous-dossier). */
export const URL_DICO = new URL('dico/mots.dawg', document.baseURI).href

let charge: Promise<{ nbMots: number; nom: string }> | null = null

/** Charge le dictionnaire (une seule fois). */
export function chargerDico(): Promise<{ nbMots: number; nom: string }> {
  charge ??= envoyer({ type: 'charger', url: URL_DICO }).then((r) => {
    if (r.type !== 'charge') throw new Error('Réponse inattendue')
    return { nbMots: r.nbMots, nom: r.nom }
  })
  charge.catch(() => (charge = null))
  return charge
}

export async function analyser(plateau: Plateau, poses: Pose[]): Promise<Analyse> {
  await chargerDico()
  const r = await envoyer({ type: 'analyser', plateau, poses })
  if (r.type !== 'analyse') throw new Error('Réponse inattendue')
  return r.analyse
}

export async function chercherCoups(plateau: Plateau, tirage: string[], limite?: number): Promise<{ coups: Coup[]; total: number; duree: number }> {
  await chargerDico()
  const r = await envoyer({ type: 'generer', plateau, tirage, limite })
  if (r.type !== 'coups') throw new Error('Réponse inattendue')
  return { coups: r.coups, total: r.total, duree: r.duree }
}

export async function motsConnus(mots: string[]): Promise<boolean[]> {
  await chargerDico()
  const r = await envoyer({ type: 'contient', mots })
  if (r.type !== 'contient') throw new Error('Réponse inattendue')
  return r.resultats
}

/** Coup de l'IA : le Web Worker génère tous les coups légaux et choisit selon le niveau. */
export async function decisionIA(contexte: ContexteIA): Promise<Decision> {
  await chargerDico()
  const r = await envoyer({ type: 'ia', contexte })
  if (r.type !== 'decision') throw new Error('Réponse inattendue')
  return r.decision
}
