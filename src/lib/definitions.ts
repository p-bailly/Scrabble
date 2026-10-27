// Définitions des mots : Wiktionnaire français (API MediaWiki publique, nécessite une connexion), mises en cache sur l'appareil.
// L'ancienne adresse « /api/rest_v1/page/definition/… » répond 501 depuis que Wikimédia l'a retirée.

import { ecrire, lire } from './stockage'

export interface Definition {
  /** Titre trouvé dans le Wiktionnaire (avec ses accents). */
  titre: string
  sens: { nature: string; definitions: string[] }[]
  /** Forme fléchie (« Pluriel de chat. », « … de manger. ») : la définition du mot dont elle vient. */
  lemme?: Definition
}

// Cache de l'ancienne version (sans les mots d'origine, avec des « pas de définition » parfois dus à une panne) : abandonné.
ecrire('dictionnaire.definitions', null)
const CLE = 'dictionnaire.definitions.v2'
const API = 'https://fr.wiktionary.org'
// Wikimédia demande aux applis de s'identifier (sinon limites plus strictes) ; ce nom d'en-tête est autorisé en CORS.
const ENTETES = { 'Api-User-Agent': 'Scrabble (https://scrabble.pbailly.fr)' }
const memoire = new Map<string, Definition | null>(Object.entries(lire<Record<string, Definition | null>>(CLE, {})))

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')

const normaliser = (t: string) => t.replace(/\s+/g, ' ').trim()

/** Niveau (2 à 6) du titre que représente cet élément, ou 0 si ce n'en est pas un. Les titres sont dans un `div.mw-heading` récent, ou directs. */
function niveauTitre(el: Element): number {
  const h = /^H[1-6]$/.test(el.tagName) ? el : el.classList.contains('mw-heading') ? el.querySelector('h1,h2,h3,h4,h5,h6') : null
  return h ? Number(h.tagName[1]) : 0
}

/** Éléments de premier niveau de la page ; le rendu Parsoid range chaque section dans un `<section>`, qu'on traverse. */
function* elements(parent: Element): Generator<Element> {
  for (const el of parent.children) {
    if (el.tagName === 'SECTION') yield* elements(el)
    else yield el
  }
}

/** Mot d'origine cité par une définition de forme fléchie : son dernier lien vers une page du Wiktionnaire (pas une annexe). */
function lienLemme(li: Element): string | undefined {
  const liens = [...li.querySelectorAll('a[title]')].filter((a) => !a.classList.contains('new') && !a.getAttribute('title')!.includes(':'))
  return liens.at(-1)?.getAttribute('title') ?? undefined
}

/**
 * Sens et définitions de la section « Français » d'une page du Wiktionnaire (HTML rendu, `action=parse`), et, si la
 * page n'est qu'une forme fléchie (pluriel, conjugaison…), le mot d'origine.
 */
export function lirePage(html: string): { sens: Definition['sens']; lemme?: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const racine = doc.querySelector('.mw-parser-output') ?? doc.body
  const sens: Definition['sens'] = []
  let lemme: string | undefined
  let enFrancais = false
  // Nature (« Nom commun », « Verbe »…) de la section en cours ; null hors d'une section de définitions (étymologie, synonymes…).
  let nature: string | null = null
  for (const el of elements(racine)) {
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
        if (t && /^forme d/i.test(nature)) lemme ??= lienLemme(copie)
      }
      if (definitions.length) sens.push({ nature, definitions: definitions.slice(0, 5) })
    }
  }
  // Un mot qui a aussi un sens propre (« porte » : nom et forme de « porter ») se suffit à lui-même.
  return sens.every((s) => /^forme d/i.test(s.nature)) ? { sens, lemme } : { sens }
}

async function definitionDe(titre: string, suivreLemme = true): Promise<Definition | null> {
  const r = await fetch(
    `${API}/w/api.php?action=parse&page=${encodeURIComponent(titre)}&redirects=1&prop=text&disabletoc=1&disableeditsection=1&format=json&formatversion=2&origin=*`,
    { headers: ENTETES },
  )
  if (!r.ok) throw new Error(`Wiktionnaire indisponible (${r.status})`)
  const json = (await r.json()) as { error?: { code: string }; parse?: { text: string } }
  // Une page qui n'existe pas n'est pas une panne : le Wiktionnaire n'a simplement pas ce mot.
  if (json.error?.code === 'missingtitle' || json.error?.code === 'invalidtitle') return null
  if (json.error || !json.parse) throw new Error(`Wiktionnaire indisponible (${json.error?.code ?? 'réponse vide'})`)
  const { sens, lemme } = lirePage(json.parse.text)
  if (!sens.length) return null
  const origine = suivreLemme && lemme && lemme.toLowerCase() !== titre.toLowerCase() ? await definitionDe(lemme, false) : null
  return origine ? { titre, sens, lemme: origine } : { titre, sens }
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
    // Une panne ici ne doit pas être gardée comme « pas de définition ».
    const r = await fetch(`${API}/w/api.php?action=opensearch&search=${encodeURIComponent(m)}&limit=50&format=json&origin=*`, { headers: ENTETES })
    if (!r.ok) throw new Error(`Wiktionnaire indisponible (${r.status})`)
    const [, titres] = (await r.json()) as [string, string[]]
    for (const t of titres) {
      if (sansAccents(t.toLowerCase()) === m && t.toLowerCase() !== m) {
        trouvee = await definitionDe(t)
        if (trouvee) break
      }
    }
  }
  memoire.set(m, trouvee)
  ecrire(CLE, Object.fromEntries([...memoire].slice(-300)))
  return trouvee
}
