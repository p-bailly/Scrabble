// Tests des règles de sécurité Firestore (firestore.rules) sur l'émulateur. Ils ne tournent que si l'émulateur est lancé :
//   npx firebase-tools emulators:exec --only firestore --project demo-scrabble "npm test"
// (sans lui, ils sont ignorés : un simple « npm test » reste possible).

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, startAfter, updateDoc, where } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('règles Firestore', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-scrabble', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  })
  afterAll(() => env.cleanup())
  beforeEach(() => env.clearFirestore())

  const moi = () => env.authenticatedContext('moi').firestore()
  const autre = () => env.authenticatedContext('autre').firestore()
  const anonyme = () => env.unauthenticatedContext().firestore()

  describe('données solo synchronisées (joueurs/{uid}/solo)', () => {
    const element = (majLe: number, plus: Record<string, unknown> = {}) => ({
      type: 'duplicate-encours',
      id: 'P1',
      donnees: '{"id":"P1"}',
      majLe,
      supprime: false,
      ...plus,
    })
    const chemin = (db: ReturnType<typeof moi>, uid = 'moi') => doc(db, 'joueurs', uid, 'solo', 'duplicate-encours~P1')

    it('son propriétaire écrit, relit et supprime ses éléments', async () => {
      await assertSucceeds(setDoc(chemin(moi()), element(1000)))
      await assertSucceeds(getDoc(chemin(moi())))
      await assertSucceeds(deleteDoc(chemin(moi())))
    })

    it('personne d’autre n’y touche, connecté ou non', async () => {
      await assertSucceeds(setDoc(chemin(moi()), element(1000)))
      for (const db of [autre(), anonyme()]) {
        await assertFails(getDoc(chemin(db, 'moi')))
        await assertFails(setDoc(chemin(db, 'moi'), element(2000)))
        await assertFails(deleteDoc(chemin(db, 'moi')))
      }
    })

    it('la version la plus récente gagne : une écriture plus ancienne est refusée', async () => {
      await assertSucceeds(setDoc(chemin(moi()), element(2000)))
      await assertSucceeds(setDoc(chemin(moi()), element(3000)))
      await assertFails(setDoc(chemin(moi()), element(2500)))
      await assertSucceeds(setDoc(chemin(moi()), element(3000))) // même date : accepté
      // Une suppression est une version comme une autre.
      await assertSucceeds(setDoc(chemin(moi()), element(4000, { supprime: true, donnees: '' })))
      await assertFails(setDoc(chemin(moi()), element(3500)))
    })

    it('refuse un élément mal formé', async () => {
      await assertFails(setDoc(chemin(moi()), element(1000, { en_plus: 1 })))
      await assertFails(setDoc(chemin(moi()), element(1000, { majLe: '1000' })))
      await assertFails(setDoc(chemin(moi()), element(1000.5)))
      await assertFails(setDoc(chemin(moi()), element(1000, { supprime: 'non' })))
      await assertFails(setDoc(chemin(moi()), { type: 'x', id: 'P1', majLe: 1000, supprime: false })) // sans données
      await assertFails(setDoc(chemin(moi()), element(1000, { donnees: 'x'.repeat(900_000) })))
    })
  })

  describe('appareils des notifications (joueurs/{uid}/appareils)', () => {
    const jeton = (db: ReturnType<typeof moi>, uid = 'moi') => doc(db, 'joueurs', uid, 'appareils', 'jeton-1')
    it('seul son propriétaire les lit et les écrit', async () => {
      await assertSucceeds(setDoc(jeton(moi()), { token: 'jeton-1', plateforme: 'web', genres: ['tour'] }))
      await assertSucceeds(getDoc(jeton(moi())))
      await assertFails(getDoc(jeton(autre(), 'moi')))
      await assertFails(setDoc(jeton(autre(), 'moi'), { token: 'x', genres: [] }))
      await assertFails(getDoc(jeton(anonyme(), 'moi')))
    })
  })

  describe('fiche des joueurs', () => {
    it('lisible par les joueurs connectés, modifiable par son propriétaire seulement', async () => {
      await assertSucceeds(setDoc(doc(moi(), 'joueurs', 'moi'), { pseudo: 'Moi', visible: true }))
      await assertSucceeds(getDoc(doc(autre(), 'joueurs', 'moi')))
      await assertFails(setDoc(doc(autre(), 'joueurs', 'moi'), { pseudo: 'Pirate' }))
      await assertFails(getDoc(doc(anonyme(), 'joueurs', 'moi')))
    })

    it('la liste des joueurs se lit par pages de 10, jamais d’un coup', async () => {
      await env.withSecurityRulesDisabled(async (c) => {
        for (let i = 0; i < 12; i++) await setDoc(doc(c.firestore(), 'joueurs', 'j' + i), { pseudo: 'J' + i, visible: true, recherche: 'j' + String(i).padStart(2, '0') })
      })
      const joueurs = collection(moi(), 'joueurs')
      const borne = where('recherche', '>=', '')
      const page = await assertSucceeds(getDocs(query(joueurs, borne, orderBy('recherche'), limit(10))))
      await assertSucceeds(getDocs(query(joueurs, borne, orderBy('recherche'), startAfter(page.docs[9]), limit(10))))
      await assertFails(getDocs(query(joueurs, borne, orderBy('recherche'))))
      await assertFails(getDocs(query(joueurs, borne, orderBy('recherche'), limit(11))))
    })

    it('ceux qui refusent d’être trouvés ne se listent pas (leur pseudo ouvrirait leur compte)', async () => {
      await env.withSecurityRulesDisabled(async (c) => {
        await setDoc(doc(c.firestore(), 'joueurs', 'cache'), { pseudo: 'Mamie Jeanne', visible: false })
        await setDoc(doc(c.firestore(), 'joueurs', 'trouve'), { pseudo: 'Paul', visible: true, recherche: 'paul' })
      })
      const joueurs = collection(moi(), 'joueurs')
      // Sans borne sur la clé de recherche, la requête pourrait renvoyer les fiches cachées : refusée.
      await assertFails(getDocs(query(joueurs, limit(10))))
      await assertFails(getDocs(query(joueurs, orderBy('pseudo'), limit(10))))
      await assertFails(getDocs(query(joueurs, orderBy('recherche'), limit(10))))
      const s = await assertSucceeds(getDocs(query(joueurs, where('recherche', '>=', ''), orderBy('recherche'), limit(10))))
      expect(s.docs.map((d) => d.id)).toEqual(['trouve'])
      // La fiche cachée reste lisible par son identifiant (adversaire d'une partie), pas par une liste.
      await assertSucceeds(getDoc(doc(moi(), 'joueurs', 'cache')))
    })

    it('la fiche n’a que pseudo, visible et recherche ; recherche seulement si visible', async () => {
      const fiche = doc(moi(), 'joueurs', 'moi')
      await assertSucceeds(setDoc(fiche, { pseudo: 'Moi', visible: true, recherche: 'moi' }))
      await assertSucceeds(setDoc(fiche, { pseudo: 'Moi', visible: false }))
      await assertFails(setDoc(fiche, { pseudo: 'Moi', visible: false, recherche: 'moi' }))
      await assertFails(setDoc(fiche, { pseudo: 'Moi', visible: true, recherche: 'moi', role: 'admin' }))
    })
  })

  describe('parties', () => {
    const enAttente = (plus: Record<string, unknown> = {}) => ({
      code: 'ABCD12', createur: 'autre', joueurs: ['autre'], etat: 'attente', nbCoups: 0, invites: [], refus: [], pseudos: { autre: 'Autre' },
      sac: 'XYZ', plateau: '', ...plus,
    })
    const intrus = () => env.authenticatedContext('intrus').firestore()

    it('les parties en attente ne se listent pas ; on liste seulement ses parties et ses invitations', async () => {
      await env.withSecurityRulesDisabled(async (c) => {
        await setDoc(doc(c.firestore(), 'parties', 'ABCD12'), enAttente({ invites: ['moi'] }))
        await setDoc(doc(c.firestore(), 'parties', 'EFGH34'), enAttente({ code: 'EFGH34', createur: 'moi', joueurs: ['moi'] }))
      })
      const parties = collection(intrus(), 'parties')
      await assertFails(getDocs(query(parties, where('etat', '==', 'attente'))))
      await assertFails(getDocs(query(parties, limit(10))))
      const mesParties = await assertSucceeds(getDocs(query(collection(moi(), 'parties'), where('joueurs', 'array-contains', 'moi'))))
      expect(mesParties.docs.map((d) => d.id)).toEqual(['EFGH34'])
      const invitations = await assertSucceeds(getDocs(query(collection(moi(), 'parties'), where('invites', 'array-contains', 'moi'))))
      expect(invitations.docs.map((d) => d.id)).toEqual(['ABCD12'])
      // Avec le code (le lien d'invitation), une partie en attente se lit et se rejoint toujours.
      await assertSucceeds(getDoc(doc(intrus(), 'parties', 'ABCD12')))
      await assertSucceeds(updateDoc(doc(intrus(), 'parties', 'ABCD12'), { joueurs: ['autre', 'intrus'], etat: 'encours', invites: [], tour: 'autre' }))
      // Commencée, elle n'est plus lisible par un tiers.
      await assertFails(getDoc(doc(anonyme(), 'parties', 'ABCD12')))
      await assertFails(getDoc(doc(env.authenticatedContext('tiers').firestore(), 'parties', 'ABCD12')))
    })
  })
})
