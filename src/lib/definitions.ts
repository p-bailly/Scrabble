// Définitions des mots : Wiktionnaire français (API MediaWiki publique, nécessite une connexion), mises en cache sur l'appareil.
// L'ancienne adresse « /api/rest_v1/page/definition/… » répond 501 depuis que Wikimédia l'a retirée.

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

const normaliser = (t: string) => t.replace(/\s+/g, ' ').trim()

/** Niveau (2 à 6) du titre que représente cet élément, ou 0 si ce n'en est pas un. Les titres sont dans un `div.mw-heading` récent, ou directs. */
function niveauTitre(el: Element): number {
  const h = /^H[1-6]$/.test(el.tagName) ? el : el.classList.contains('mw-heading') ? el.querySelector('h1,h2,h3,h4,h5,h6') : null
  return h ? Number(h.tagName[1]) : 0
}

/** Sens et définitions de la section « Français » d'une page du Wiktionnaire (HTML rendu, `action=parse`). */
export function lireSens(html: string): Definition['sens'] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const racine = doc.querySelector('.mw-parser-output') ?? doc.body
  const sens: Definition['sens'] = []
  let enFrancais = false
  // Nature (« Nom commun », « Verbe »…) de la section en cours ; null hors d'une section de définitions (étymologie, synonymes…).
  let nature: string | null = null
  for (const el of racine.children) {
    const niveau = niveauTitre(el)
    if (niveau === 2) {
      if (enFrancais) break
      enFrancais = !!el.querySelector('.sectionlangue#fr') || normaliser(el.textContent ?? '') === 'Français'
      nature = null
    } else if (niveau && enFrancais) {
      const titre = el.querySelector('.titredef')
      nature = titre ? normaliser((titre.textContent ?? '').replace(/\d+$/, '')) : null
    } else if (enFrancais && nature && el.tagName === 'OL') {
      const definitions: string[] = []
      for (const li of el.children) {
        // On garde la définition ; ses exemples (liste imbriquée) et ses notes de bas de page n'en font pas partie.
        const copie = li.cloneNode(true) as Element
        copie.querySelectorAll('ul, ol, dl, sup, style, .example').forEach((x) => x.remove())
        const t = normaliser(copie.textContent ?? '')
        if (t) definitions.push(t)
      }
      if (definitions.length) sens.push({ nature, definitions: definitions.slice(0, 5) })
    }
  }
  return sens
}

async function definitionDe(titre: string): Promise<Definition | null> {
  const r = await fetch(
    `${API}/w/api.php?action=parse&page=${encodeURIComponent(titre)}&redirects=1&prop=text&disabletoc=1&disableeditsection=1&format=json&formatversion=2&origin=*`,
  )
  if (!r.ok) throw new Error(`Wiktionnaire indisponible (${r.status})`)
  const json = (await r.json()) as { error?: { code: string }; parse?: { text: string } }
  // Une page qui n'existe pas n'est pas une panne : le Wiktionnaire n'a simplement pas ce mot.
  if (json.error?.code === 'missingtitle' || json.error?.code === 'invalidtitle') return null
  if (json.error || !json.parse) throw new Error(`Wiktionnaire indisponible (${json.error?.code ?? 'réponse vide'})`)
  const sens = lireSens(json.parse.text)
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
