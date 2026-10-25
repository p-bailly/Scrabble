// Transforme une liste de mots (fichier texte, un mot par ligne) en dictionnaire de l'appli : public/dico/mots.dawg.
//
//   npm run dico -- chemin/vers/liste.txt "Nom affiché"
//
// Les mots sont mis en majuscules et débarrassés de leurs accents ; ceux qui contiennent autre chose que des
// lettres (trait d'union, apostrophe…) ou qui ont moins de 2 ou plus de 15 lettres sont écartés.
// Penser ensuite à incrémenter VERSION dans public/sw.js pour que les appareils rechargent le dictionnaire.

import { readFileSync, writeFileSync } from 'node:fs'
import { construireDawg, fichierDawg, preparerListe } from '../src/jeu/construireDawg.ts'

const [source, nom = 'Dictionnaire'] = process.argv.slice(2)
if (!source) {
  console.error('Usage : npm run dico -- liste.txt "Nom affiché"')
  process.exit(1)
}

const debut = Date.now()
const lignes = readFileSync(source, 'utf8').split(/\r?\n/)
const mots = preparerListe(lignes)
const arcs = construireDawg(mots)
const sortie = new URL('../public/dico/mots.dawg', import.meta.url)
writeFileSync(sortie, fichierDawg(arcs, mots.length, nom))
console.log(
  `${mots.length} mots (sur ${lignes.length} lignes) → ${arcs.length} arcs, ` +
    `${Math.round((arcs.length * 4) / 1024)} Ko, en ${Date.now() - debut} ms`,
)
