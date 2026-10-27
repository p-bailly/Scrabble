# CLAUDE.md

Scrabble français (PWA React + Vite, TypeScript, APK Android via Capacitor, multijoueur Firebase). Code et commentaires en
français. Les commentaires et messages du code qui renvoient à une rubrique de ce fichier (Firebase, notifications push, commandes)
citent son titre : le garder en cas de renommage.

## Commandes
- `npm run dev` (5173), `npm test` (Vitest), `npm run typecheck`, `npm run build` (tsc + vite) puis `npm run preview`. Node 22.
- Les tests des règles Firestore (`src/multi/regles.test.ts`) ont besoin de l'émulateur (Java) et sont **ignorés sans lui** :
  `npx firebase-tools emulators:exec --only firestore --project demo-scrabble "npm test"` (c'est ce que fait la CI).
- Tester le multijoueur en local : `npx firebase-tools emulators:start --only auth,firestore --project demo-scrabble` (ports du
  `firebase.json`), puis un `firebase.config.json` avec `"projectId": "demo-scrabble"`, `"apiKey": "demo"`, `"emulateurs": true`.
  Attention : `firebase.config.json` est **versionné** (vrai projet `scrabble-pbailly`) : le restaurer avant de committer.
- APK en local : Android SDK (plateforme 36) + Java 21, `npm run android` → `android/app/build/outputs/apk/release/app-release.apk`.
- `npm run dico -- liste.txt "Nom"` : voir Dictionnaire. `scripts/dico.ts` et `src/jeu/construireDawg.ts` tournent directement sous Node
  (`.ts` importés avec extension, `erasableSyntaxOnly`) : `construireDawg.ts` reste sans import, sans enum ni syntaxe TS non effaçable.
- CI : `verification.yml` (PR : typecheck, tests avec émulateur, build, APK + contrôle du `versionName`), `deploy.yml` (Pages) et
  `android.yml` (APK, release « apk ») uniquement sur la branche par défaut.

## Architecture
- `src/jeu/` : règles et calculs en TypeScript pur (ni React ni réseau), testés. `generateur.ts` : tous les coups légaux
  (Appel-Jacobson sur le DAWG, jokers compris), comparé dans les tests à une force brute indépendante. Il tourne dans le Web
  Worker `src/moteur/` (≈ 59 000 coups en < 0,3 s dans le pire cas, deux jokers en milieu de partie).
- Jetons : `?` = joker sur le chevalet ou dans le sac, **minuscule** = joker posé sur le plateau (« e » = joker joué en E).
- Autres dossiers : `pages/` (écrans solo), `solo/` (sauvegardes, historiques), `multi/` (Firebase, parties à deux, invitations,
  veille des coups), `lib/` (routage par hash, stockage local, réglages, synchro, notifications), `functions/` (Cloud Function push).
- Réglages : tout est sur l'appareil (`src/lib/reglages.ts`) sauf « être trouvé par les autres joueurs » (Firestore). En haut l'essentiel
  (taille du texte, mode simple, thème, être prévenu, compte), le reste replié sous « Réglages avancés ». Taille du texte : `--texte`
  (`data-texte` sur `<html>`, posé aussi par `index.html`), qui multiplie les `font-size` de l'interface, jamais celles du plateau ni des jetons.
- Mode simple (réglage de l'appareil, pensé pour une personne âgée) : onglets Mes parties / Seul / Dictionnaire (Stats et Réglages par des
  liens discrets, `LiensModeSimple`), pas de duplicate, contre l'ordinateur en un toucher avec trois niveaux (Facile = Débutant, Moyen =
  Amateur, Difficile = Confirmé, `NIVEAUX_SIMPLES`), Stats réduites à « Mes résultats ». L'appli dit « l'ordinateur », jamais « l'IA ».
- Écran d'ouverture : « Mes parties » (premier onglet) ; seul qui a choisi de jouer sans compte arrive sur le menu Solo. Le bilan face à face est dans l'onglet Stats. Partie à deux pensée pour une personne âgée : « Nouvelle partie »
  d'un toucher, puis on touche le nom d'un joueur (tous ceux qui acceptent d'être trouvés, récents en tête) ou « Envoyer le lien » ;
  aucun code affiché ni à saisir (il reste dans le lien). L'onglet Dictionnaire ne fait que vérifier un mot (`VerifierMot`) ; en partie, la loupe sous le chevalet ouvre le même outil.
- Thème : variables CSS en tête de `src/styles.css`, sombre sous `:root[data-theme='dark']`, posé avant le premier rendu par un script
  d'`index.html`. Grand écran (≥ 900 px) : deux colonnes via le `@media` en fin de `styles.css` ; `ColonneJeu` (`EcranJeu.tsx`) n'ajoute
  aucun niveau sur téléphone. UI inspirée de DupliJeu (visuel seulement, aucun élément repris).

## Règles du jeu (choix non évidents)
- Plateau classique, 102 jetons français (`lettres.ts`), 50 points pour 7 lettres posées d'un coup. Échange seulement s'il reste
  ≥ 7 jetons dans le sac ; fin : sac vide + chevalet vidé, ou 6 passes de suite. Mot absent du dictionnaire : refusé à la pose.
- Duplicate (FISF + modes « Entraînement » et « Topping » de DupliJeu ; les modes Joker, 7 sur 8, 7 et 8 ne sont pas repris).
  Validation du **tirage** (jamais du mot posé) : ≥ 2 voyelles et 2 consonnes jusqu'au 15e coup, puis ≥ 1 et ≥ 1 ; sinon tout
  retourne au sac. Conventions : **Y = voyelle**, **joker = voyelle et consonne à la fois**. Égalité de score : le top retenu a le
  moins de jokers, puis le mot le plus long, puis la première position (haut en bas, gauche à droite).
- IA : le niveau ne règle que le **choix** parmi tous les coups légaux (`ia.ts`, `contreIA.ts`). Score moyen IA contre IA (20 parties
  par couple et par couleur, dictionnaire complet) : Débutant 160, Amateur 260, Confirmé 360, Expert 440, Champion 550. La valeur
  des lettres gardées vaut ≈ 35 points par partie au Champion. Les tests vérifient l'ordre des niveaux.
- Analyse d'une partie (`pages/Analyse.tsx`) : exige le **chevalet de chaque tour** (`PartieIA.coups[].chevalet`, champ `chevalet`
  de `parties/{code}/coups/{n}`) ; les parties plus anciennes ne sont pas analysables. « Meilleur » = le plus de points (lettres gardées
  et points de fin de partie ignorés). À deux, l'analyse n'ouvre qu'après la fin de partie (elle montre le jeu de l'adversaire).
- Le dictionnaire n'a volontairement **aucune** recherche (début, fin, « avec mes lettres »…) : il vérifie un mot précis.
- Définitions : Wiktionnaire (`src/lib/definitions.ts`, en-tête `Api-User-Agent`), graphie accentuée retrouvée par `opensearch` ;
  pour une forme fléchie (« Pluriel de chat. »), la définition du mot d'origine suit. Cache sur l'appareil (300 mots).

## Dictionnaire
- ODS8 (2021 ; 411 430 formes dont 402 325 de 2 à 15 lettres gardées), repris de `Thecoolsim/French-Scrabble-ODS8`. **Pas une liste
  libre** (Larousse/FISF, dépôt d'origine sans licence) : usage perso ; à retirer si un ayant droit le demande. Pas d'ODS9 en accès libre.
  Alternatives libres : Grammalecte (MPL 2.0), Lexique (CC BY-SA 4.0), qui contiennent des mots que l'ODS refuse et en oublient d'autres.
- Stocké en DAWG (`public/dico/mots.dawg`, ≈ 439 Ko), mots en majuscules sans accents ni traits d'union, chargé dans le Worker.
- Remplacer : `npm run dico -- liste.txt "Nom"` (un mot par ligne ; majuscules, accents retirés, é → E, œ → OE ; écarte trait d'union,
  apostrophe, chiffre, < 2 ou > 15 lettres). Puis **incrémenter `VERSION` dans `public/sw.js`** (sinon les appareils gardent l'ancien
  dictionnaire en cache) ; `VERSION` aussi à changer quand l'icône ou la coque de l'app change.

## Firebase (parties à deux)
- Offre gratuite Spark (pas Supabase : projets gratuits mis en pause après une semaine). Sans `firebase.config.json`, le solo marche
  et « Mes parties » explique quoi faire. La config web n'est **pas un secret** : la sécurité repose sur `firestore.rules`.
- **Parties à deux : créer le projet Firebase** : (1) console.firebase.google.com, nouveau projet (sans Analytics) ;
  (2) Authentication → Sign-in method : activer *Adresse e-mail/Mot de passe* (lien par e-mail désactivé) ; (3) Firestore, emplacement
  `eur3`, mode production ; (4) onglet Règles : coller `firestore.rules` et publier ; (5) Paramètres → appli Web `</>` « Scrabble », sans
  Hosting, copier `firebaseConfig` ; (6) créer `firebase.config.json` sur le modèle de `firebase.config.example.json` (JSON strict),
  le committer, ou le mettre dans la variable de dépôt `FIREBASE_CONFIG` que les workflows écrivent avant le build.
- **Republier les règles à chaque changement de `firestore.rules`** (console, ou `npx firebase-tools deploy --only firestore:rules
  --project <projectId>`), sinon la liste des joueurs à inviter et la synchro solo sont refusées (le lien d'invitation marche encore).
- Compte = simple nom d'utilisateur, sans mot de passe : `src/multi/firebase.ts` fabrique l'e-mail `<nom>@joueurs.scrabble.pbailly.fr`
  (n'existe pas) et le mot de passe `scrabble-<nom>`. Le nom ignore accents, casse et ponctuation. **Le nom n'est pas secret** (qui le
  connaît ouvre le compte, lit les parties et les données de synchro) : accepté entre proches ; durcissement possible = code à 4 chiffres mêlé au mot de passe.
- Données : `parties/{code}` (+ `coups/{n}`, `chevalets/{uid}` lisible par son seul joueur), `joueurs/{uid}` (clé `recherche` = pseudo
  sans accents ni casse, requêtes limitées à 10 fiches : la liste des joueurs à inviter se lit par pages ; + `solo/{element}`, `appareils/{jeton}`). Règles : seuls les 2 joueurs lisent une
  partie (celle en attente est lisible par code) ; coup seulement à son tour, numéro +1 ; joueurs figés après le début ; invitation
  directe créée/annulée par le créateur, 1 invité au plus, refus possible par l'invité ; historique des coups immuable.
- Triche possible, acceptée : le téléphone tire les lettres, calcule le score, et le contenu du sac est lisible ; chaque coup est
  revérifié par le client adverse (mots, score, plateau).
- Synchro solo (`src/lib/synchro.ts`, `moteurSynchro.ts`, `src/multi/synchro.ts`) : sous `joueurs/{uid}/solo`, en direct. Fusion par
  élément, la version la plus récente gagne (les règles refusent une écriture plus ancienne) ; une suppression est une version gardée
  6 mois. Plafonds : 60 duplicates, 100 résultats IA, 10 parties IA gardées. Même partie sur deux appareils : la dernière sauvegarde
  gagne, le chrono du coup en cours reste local. Notifications non synchronisées. Changer de compte demande de remplacer les parties solo.

## Notifications push (appli fermée) — éteintes par défaut
- Par défaut : notifications **locales** seulement (appli ouverte ou revenue au premier plan). Code push complet mais inactif tant que
  `firebase.config.json` n'a pas `"push": true`. Chaque appareil dépose son jeton FCM dans `joueurs/{uid}/appareils/{jeton}` ; la Cloud
  Function `functions/index.js` réagit à chaque écriture de partie ; `functions/messages.js` reprend les règles de `src/multi/veille.ts`
  (tests : `src/multi/messages.test.ts`). Notification locale et serveur de même identifiant : l'une remplace l'autre (web).
- Activation, dans l'ordre : projet Firebase en **offre Blaze** (carte obligatoire, quota gratuit suffisant) ; région dans `functions/index.js`
  (`europe-west1` aujourd'hui) à aligner sur Firestore ; `cd functions && npm install`, `npx firebase-tools login`, `npx firebase-tools deploy
  --only functions,firestore:rules --project <projectId>` ; web/iPhone : clé Web Push (Cloud Messaging) → `"push": true` + `"vapidKey"` (iPhone :
  iOS ≥ 16.4, appli sur l'écran d'accueil) ; Android : appli Android `fr.perso.scrabble` dans la console, `google-services.json` dans
  `android/app/` (pas de secret) + `"pushAndroid": true` ; puis Réglages → Notifications → « Aussi quand l'appli est fermée ».
- Non vérifié de bout en bout (pas de projet Blaze) : envoi réel FCM, affichage iPhone/Android ; logs : console → Functions.
- Permission système demandée à la création du compte et à chaque partie créée/rejointe ; Android : `POST_NOTIFICATIONS`.

## Android, versions, liens
- APK signé par une clé **volontairement versionnée** (`android/app/scrabble.keystore`, mot de passe dans `build.gradle`) : même signature en
  local et en CI. Usage perso, pas Play Store. Pour que « Mes applis » suive l'appli, ne jamais changer : dépôt public, `applicationId`
  `fr.perso.scrabble`, nom `scrabble.apk`, clé de signature. `versionCode` = `github.run_number`.
- Version `majeur.mineur.build` : `majeur.mineur` = champ `version` de `package.json` (à relever à la main pour une fonctionnalité notable),
  `build` = `GITHUB_RUN_NUMBER` (0 en local). Utilisée par l'APK, `vite.config.ts` (`__VERSION__`) et les Réglages ; `verification.yml` contrôle l'APK.
- Liens d'invitation : `https://scrabble.pbailly.fr/#/rejoindre/CODE` (routage par hash) et `fr.perso.scrabble://rejoindre/CODE`. Pour
  l'ouverture directe dans l'appli, `public/.well-known/assetlinks.json` (empreinte de la clé de signature) est publié avec la version web ;
  Android le vérifie à l'installation ; sinon Paramètres → Applis → Scrabble → Ouvrir par défaut → `scrabble.pbailly.fr`.
- Domaine : OVH, CNAME `scrabble` → `p-bailly.github.io.` ; GitHub *Settings → Pages* : domaine personnalisé + *Enforce HTTPS*, source
  *GitHub Actions* (pas de fichier CNAME dans le dépôt). Firebase n'a pas besoin de connaître le domaine.
- Logo (`design/logo/`) : `node design/logo/generer.mjs` (SVG, icônes adaptatives, `public/icon.svg`) puis `node design/logo/png.cjs`
  (PNG, écrans de démarrage ; pilote Chrome ou Edge, chemin dans `CHROME_PATH`).
