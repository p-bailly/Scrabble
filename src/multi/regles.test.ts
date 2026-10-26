// Tests des règles de sécurité Firestore (firestore.rules) sur l'émulateur. Ils ne tournent que si l'émulateur est lancé :
//   npx firebase-tools emulators:exec --only firestore --project demo-scrabble "npm test"
// (sans lui, ils sont ignorés : un simple « npm test » reste possible).

import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

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
  })
})
