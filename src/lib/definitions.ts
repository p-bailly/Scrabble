// Définitions des mots : Wiktionnaire français (API publique, nécessite une connexion), mises en cache sur l'appareil.

import { ecrire, lire } from './stockage'

export interface Definition {
  /** Titre trouvé dans le Wiktionnaire (avec ses accents). */
  titre: string
  sens: { nature: string; definitions: string[] }[]
}

const CLE = 'dictionnaire.definitions'
const API = 'https://fr.wiktionary.org'
const memoire = new Map<string, Definition | null>(Object.entries(lire<Record<string, Definition | null>>(CLE, {})))

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')

function texte(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function definitionDe(titre: string): Promise<Definition | null> {
  const r = await fetch(`${API}/api/rest_v1/page/definition/${encodeURIComponent(titre)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Wiktionnaire indisponible (${r.status})`)
  const json = (await r.json()) as Record<string, { partOfSpeech: string; definitions: { definition: string }[] }[]>
  const sens = (json.fr ?? [])
    .map((s) => ({ nature: s.partOfSpeech, definitions: s.definitions.map((d) => texte(d.definition)).filter(Boolean).slice(0, 5) }))
    .filter((s) => s.definitions.length)
  return sens.length ? { titre, sens } : null
}

/** Nombre de mots dont la définition est gardée sur l'appareil. */
export const nbDefinitionsGardees = () => memoire.size

export function viderDefinitions() {
  memoire.clear()
  ecrire(CLE, null)
}

/** Définition d'un mot du dictionnaire (majuscules sans accents) ; null si le Wiktionnaire n'en a pas. */
export async function chercherDefinition(mot: string): Promise<Definition | null> {
  const m = mot.toLowerCase()
  if (memoire.has(m)) return memoire.get(m) ?? null
  let trouvee = await definitionDe(m)
  if (!trouvee) {
    // Le dictionnaire n'a pas d'accents : on cherche la graphie accentuée (école, cœur…).
    const r = await fetch(`${API}/w/api.php?action=opensearch&search=${encodeURIComponent(m)}&limit=10&format=json&origin=*`)
    if (r.ok) {
      const [, titres] = (await r.json()) as [string, string[]]
      for (const t of titres) {
        if (sansAccents(t.toLowerCase()) === m && t.toLowerCase() !== m) {
          trouvee = await definitionDe(t)
          if (trouvee) break
        }
      }
    }
  }
  memoire.set(m, trouvee)
  ecrire(CLE, Object.fromEntries([...memoire].slice(-300)))
  return trouvee
}
