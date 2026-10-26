// Configuration Firebase du projet (firebase.config.json, à la racine du dépôt ; modèle : firebase.config.example.json).
// Elle n'a rien de secret : la sécurité repose sur les règles Firestore (firestore.rules). Ce module ne charge pas
// Firebase lui-même : les écrans qui ont seulement besoin de savoir ce qui est configuré peuvent l'importer sans le coût.

import type { FirebaseOptions } from 'firebase/app'

// Fichier facultatif : sans lui, l'appli marche en solo et l'onglet « Mes parties » explique quoi faire.
// Avec « "emulateurs": true », l'appli utilise les émulateurs Firebase locaux (tests, voir CLAUDE.md, « Commandes »).
// Notifications appli fermée (voir CLAUDE.md, « Notifications push ») : « "push": true » les propose ; « "vapidKey" » les
// active sur le web et l'iPhone, « "pushAndroid": true » dans l'APK (une fois google-services.json ajouté à android/app).
export type Configuration = FirebaseOptions & { emulateurs?: boolean; push?: boolean; vapidKey?: string; pushAndroid?: boolean }

const fichiers = import.meta.glob<Configuration>('/firebase.config.json', { eager: true, import: 'default' })
export const configuration: Configuration | null = Object.values(fichiers)[0] ?? null

/** Le projet est-il prêt pour les notifications appli fermée (fonction déployée, clé web renseignée) ? */
export const pushConfigure: boolean = !!configuration?.push
