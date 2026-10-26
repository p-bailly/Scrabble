// Web Worker du moteur : charge le dictionnaire une fois, puis valide les coups et cherche les meilleurs
// sans figer l'écran.

import { analyserCoup, type Analyse, type Coup, type Pose } from '../jeu/coup'
import { Dawg } from '../jeu/dawg'
import { genererCoups } from '../jeu/generateur'
import { decider, type ContexteIA, type Decision } from '../jeu/ia'
import type { Plateau } from '../jeu/plateau'

export type Requete =
  | { type: 'charger'; url: string }
  | { type: 'analyser'; plateau: Plateau; poses: Pose[] }
  | { type: 'generer'; plateau: Plateau; tirage: string[]; limite?: number }
  | { type: 'contient'; mots: string[] }
  | { type: 'ia'; contexte: ContexteIA }

export type Reponse =
  | { type: 'charge'; nbMots: number; nom: string }
  | { type: 'analyse'; analyse: Analyse }
  | { type: 'coups'; coups: Coup[]; total: number; duree: number }
  | { type: 'contient'; resultats: boolean[] }
  | { type: 'decision'; decision: Decision }

let dawg: Dawg | null = null
let chargement: Promise<Dawg> | null = null

async function charger(url: string): Promise<Dawg> {
  if (dawg) return dawg
  chargement ??= fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`Dictionnaire introuvable (${r.status})`)
    dawg = Dawg.depuisFichier(await r.arrayBuffer())
    return dawg
  })
  try {
    return await chargement
  } catch (e) {
    chargement = null
    throw e
  }
}

const portee = self as unknown as DedicatedWorkerGlobalScope

portee.onmessage = async (e: MessageEvent<{ id: number; requete: Requete }>) => {
  const { id, requete } = e.data
  try {
    let reponse: Reponse
    if (requete.type === 'charger') {
      const d = await charger(requete.url)
      reponse = { type: 'charge', nbMots: d.nbMots, nom: d.nom }
    } else {
      const d = dawg ?? (await chargement)
      if (!d) throw new Error('Dictionnaire non chargé')
      if (requete.type === 'analyser') reponse = { type: 'analyse', analyse: analyserCoup(requete.plateau, requete.poses, d) }
      else if (requete.type === 'contient') reponse = { type: 'contient', resultats: requete.mots.map((m) => d.contient(m)) }
      else if (requete.type === 'ia') reponse = { type: 'decision', decision: decider(d, requete.contexte) }
      else {
        const debut = performance.now()
        const tous = genererCoups(d, requete.plateau, requete.tirage)
        reponse = {
          type: 'coups',
          coups: requete.limite ? tous.slice(0, requete.limite) : tous,
          total: tous.length,
          duree: performance.now() - debut,
        }
      }
    }
    portee.postMessage({ id, reponse })
  } catch (err) {
    portee.postMessage({ id, erreur: err instanceof Error ? err.message : String(err) })
  }
}
