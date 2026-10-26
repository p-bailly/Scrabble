# Scrabble

Appli perso de **Scrabble en français**, en trois parties :

- **Duplicate en solo** : à chaque coup le même tirage pour tout le monde, on cherche le meilleur mot, puis c'est
  le top qui est posé ;
- **Parties à deux en différé** : chacun joue son coup quand il veut, sans être connecté en même temps que l'autre ;
- **Calculateur de meilleur coup** : on recopie un plateau et un tirage (par exemple d'une vraie partie), l'appli
  donne le top et la liste des meilleurs coups.

C'est une web app installable (PWA), aussi livrée en **APK Android**, reconstruite automatiquement par GitHub
Actions et suivie par « Mes applis » ([p-bailly/Managing-Apps](https://github.com/p-bailly/Managing-Apps)).

## Appli Android (APK)

**Télécharger :** https://github.com/p-bailly/Scrabble/releases/latest/download/scrabble.apk

1. Ouvrez le lien sur le téléphone Android et téléchargez le fichier.
2. Ouvrez-le : Android demande d'autoriser l'installation depuis le navigateur (« sources inconnues ») — acceptez.
3. L'appli **Scrabble** apparaît avec les autres applis.

L'APK est reconstruit automatiquement par GitHub Actions ([`android.yml`](.github/workflows/android.yml)) à chaque
push sur la branche par défaut et publié dans la release « apk » ; il suffit de le retélécharger pour mettre à jour
(il s'installe par-dessus l'ancien). « Mes applis » le fait d'un geste.

Il est signé avec une clé de signature personnelle **volontairement versionnée** (`android/app/scrabble.keystore`,
mot de passe dans `android/app/build.gradle`), pour que les APK construits n'importe où (en local ou par la CI) aient
la même signature. C'est adapté à un usage perso, pas à une publication sur le Play Store.

Pour que « Mes applis » continue de suivre l'appli, ne jamais changer : le dépôt (public), l'identifiant
`fr.perso.scrabble`, le nom de fichier `scrabble.apk`, la clé de signature ; le `versionCode` est le numéro de build
de la CI, toujours croissant.

## Règles du jeu

Scrabble francophone : plateau 15 × 15 avec les cases bonus du plateau classique (mot compte triple en rouge, mot
compte double en rose, lettre compte triple en bleu foncé, lettre compte double en bleu clair ; l'étoile centrale
compte double et le premier mot doit la couvrir). 102 jetons, répartition et valeurs françaises, 2 jokers. Poser
ses 7 lettres d'un coup (« scrabble ») rapporte 50 points de plus. Les mots croisés formés comptent aussi.

### Duplicate (solo)

Selon le principe du duplicate de la FISF :

- à chaque coup, un tirage de 7 lettres. On cherche son meilleur mot dans le temps imparti (3 minutes par défaut,
  réglable à 1, 2 ou 3 minutes, ou sans limite) ;
- **Noter** retient un coup (on peut en noter plusieurs, on garde le dernier) ; à la fin du temps ou avec
  **Valider**, c'est le meilleur entre le coup noté et celui posé sur le plateau qui compte ;
- puis l'appli pose le **top** (meilleur score possible). Les lettres qu'il n'utilise pas, complétées dans le sac,
  forment le tirage suivant ;
- le score cumulé est comparé au total des tops (en points et en %). La **correction** montre à chaque coup mon mot,
  le top et les autres bons coups, sur le plateau ;
- validation du tirage selon le règlement FISF : au moins 2 voyelles et 2 consonnes jusqu'au 15e coup, puis au
  moins 1 voyelle et 1 consonne ; sinon toutes les lettres retournent dans le sac et on retire. La partie s'arrête
  quand on ne peut plus former de tirage valable ou qu'aucun coup n'est possible.

**Conventions de l'appli** (le règlement ne les fixe pas) :

- le **Y est une voyelle** ;
- un **joker compte à la fois comme voyelle et comme consonne** (un tirage `?BCDFGA` est valable au 1er coup :
  2 voyelles avec le joker, 6 consonnes) ;
- quand plusieurs coups font le même score, le top retenu est celui qui utilise le moins de jokers, puis le mot le
  plus long, puis le premier sur le plateau (de haut en bas, de gauche à droite).

Partie en cours sauvegardée sur l'appareil et reprise à l'ouverture ; historique des parties et statistiques
(moyenne en %, meilleure partie, tops trouvés). Une **graine** (facultative) redonne exactement les mêmes tirages :
pratique pour rejouer une partie ou défier quelqu'un sur la même. Le mode solo marche entièrement hors ligne.

### Parties à deux (en différé)

Partie classique tour par tour : chacun son chevalet de 7 lettres. À son tour, on pose un mot, on change des
lettres (s'il en reste au moins 7 dans le sac) ou on passe. Un mot absent du dictionnaire est refusé à la pose.
Fin de partie : le sac est vide et un joueur a vidé son chevalet (il gagne la valeur des lettres restant à
l'adversaire, qui les perd), ou six passes de suite (chacun perd la valeur de ses lettres restantes).

- **Nouvelle partie** donne un code court et un lien à envoyer par SMS ou WhatsApp. Le lien ouvre l'appli Android si
  elle est installée, sinon la version web (voir « Liens d'invitation » plus bas) ; on peut aussi saisir le code.
- **Mes parties** : « À toi de jouer » en tête, puis « En attente de … », les invitations envoyées et les parties
  terminées. Plusieurs parties en parallèle.
- Mise à jour en direct quand l'appli est ouverte ; hors ligne, le coup est mis en file et envoyé au retour du
  réseau.
- Notification « À toi de jouer » quand l'appli détecte le coup de l'adversaire (au premier plan ou à la reprise).
- Historique des coups de la partie (mot, position, points) ; chaque coup reçu est revérifié par le client de
  l'adversaire (mots du dictionnaire, score), un coup non conforme est signalé.

## Dictionnaire

L'appli utilise la liste de l'**ODS8** (L'Officiel du jeu Scrabble, 8e édition, 2021 : 411 430 formes, dont
402 325 de 2 à 15 lettres gardées par l'appli), reprise du dépôt
[Thecoolsim/French-Scrabble-ODS8](https://github.com/Thecoolsim/French-Scrabble-ODS8). **Ce n'est pas une liste
libre** : l'ODS appartient à Larousse et à la FISF, et le dépôt d'origine n'indique aucune licence. Elle est utilisée
ici pour un usage personnel ; si un ayant droit le demande, il faudra la retirer et la remplacer par une liste
libre (voir ci-dessous). L'ODS9 (en vigueur depuis 2024) n'a pas été trouvé en accès libre : quelques mots récents
peuvent donc manquer.

Mots en majuscules, sans accents ni traits d'union, de 2 à 15 lettres. Ils sont stockés sous forme de **DAWG**
(graphe des mots qui partage préfixes et suffixes : 439 Ko, environ 270 Ko compressé), chargé dans un Web Worker et
mis en cache par le service worker pour le hors-ligne.

### Remplacer le dictionnaire

N'importe quel fichier texte « un mot par ligne » convient :

```bash
npm run dico -- chemin/vers/liste.txt "Nom affiché"
```

Le script ([`scripts/dico.ts`](scripts/dico.ts)) met les mots en majuscules, retire les accents (é → E, œ → OE),
écarte ceux qui contiennent un trait d'union, une apostrophe ou un chiffre, ou qui font moins de 2 ou plus de
15 lettres, puis écrit `public/dico/mots.dawg`. Incrémenter ensuite `VERSION` dans `public/sw.js`, pour que les
appareils déjà installés rechargent le dictionnaire.

Listes libres possibles : le dictionnaire de [Grammalecte](https://grammalecte.net) (MPL 2.0, formes fléchies
comprises) ou [Lexique](http://www.lexique.org) (CC BY-SA 4.0) ; elles contiennent des mots que l'ODS refuse et en
oublient d'autres.

## Moteur et calculateur

- Les règles et les calculs (validation d'un coup, mots secondaires, score, tirages du duplicate, partie classique,
  fin de partie) sont dans [`src/jeu/`](src/jeu), en TypeScript pur, sans React ni réseau, couverts par des tests
  Vitest.
- Le **générateur de coups** ([`generateur.ts`](src/jeu/generateur.ts)) trouve tous les coups légaux pour un tirage
  et un plateau (algorithme d'Appel et Jacobson sur le DAWG, jokers compris) et les trie du meilleur au moins bon. Il
  tourne dans un Web Worker. En milieu de partie avec deux jokers (le cas le plus lourd) : environ 59 000 coups en
  moins de 0,3 s sur un ordinateur ; bien moins sans joker. Les tests le comparent à une recherche par force brute
  indépendante, sur le dictionnaire complet.
- Le **calculateur** : toucher une case puis taper les lettres (toucher à nouveau la case change le sens, bouton
  « Joker » pour une lettre jouée par un joker), saisir le tirage, **Chercher**. Toucher un coup le montre sur le
  plateau ; « Poser ce coup » l'ajoute au plateau et retire ses lettres du tirage. Le plateau et le tirage sont gardés
  sur l'appareil.

## Parties à deux : créer le projet Firebase

Le multijoueur utilise **Firebase** en offre gratuite (Spark) : Authentication par **lien envoyé par e-mail** (sans
mot de passe ; un pseudo est choisi à la première connexion) et Cloud Firestore. (Pas de Supabase : ses projets
gratuits se mettent en pause après une semaine sans activité.) Sans configuration, le solo et le calculateur marchent
et l'onglet « Mes parties » l'explique.

1. Sur <https://console.firebase.google.com>, **Ajouter un projet** (nom au choix, ex. `mon-scrabble`). Google
   Analytics n'est pas utile.
2. **Build → Authentication → Commencer**, onglet *Sign-in method* : ouvrir **Adresse e-mail/Mot de passe** et activer
   aussi l'option **Lien envoyé par e-mail (connexion sans mot de passe)** (Firebase demande d'activer la ligne du
   dessus pour y accéder ; l'appli n'utilise jamais de mot de passe).
3. **Build → Firestore Database → Créer une base de données** : emplacement `eur3 (europe-west)`, démarrer en
   **mode production**.
4. Onglet **Règles** de Firestore : remplacer tout par le contenu de [`firestore.rules`](firestore.rules), puis
   **Publier**.
5. **Paramètres du projet** (roue dentée) → *Vos applications* → icône **Web** `</>` : nom `Scrabble`, sans
   Firebase Hosting. Copier l'objet `firebaseConfig` affiché.
6. Dans le dépôt, créer `firebase.config.json` sur le modèle de
   [`firebase.config.example.json`](firebase.config.example.json) avec ces valeurs (format JSON : clés et textes
   entre guillemets doubles), le committer et le pousser. La CI reconstruit l'APK et la version web avec.
   *Variante* : au lieu de committer le fichier, mettre son contenu dans une variable du dépôt nommée
   `FIREBASE_CONFIG` (Settings → Secrets and variables → Actions → onglet *Variables*) ; les workflows l'écrivent
   avant la compilation.
7. **Authentication → Paramètres → Domaines autorisés** : ajouter `scrabble.pbailly.fr` (la version web). Sans cela,
   Firebase refuse d'envoyer le lien de connexion. `localhost` y est déjà, pour le développement.

La configuration web de Firebase n'est **pas un secret** : la sécurité repose sur les règles Firestore.

### Connexion sans mot de passe

Dans « Mes parties », on saisit son adresse e-mail et Firebase envoie un lien ; le toucher connecte. Le compte est lié
à l'adresse, donc le même sur tous les appareils (mêmes parties, même pseudo, retrouvé dans Firestore).

- Le lien ramène sur la page d'où la connexion a été demandée : depuis une invitation (`#/rejoindre/CODE`), on rejoint
  la partie dès la connexion.
- Même navigateur que la demande : la connexion se termine toute seule. Autre appareil ou autre navigateur : l'appli
  redemande l'adresse pour confirmer.
- **Dans l'appli Android**, le lien de l'e-mail s'ouvre dans le navigateur, pas dans l'appli. Après avoir demandé le
  lien, coller le lien copié depuis l'e-mail dans le champ prévu à cet effet connecte l'appli ; sinon, jouer depuis la
  version web.
- L'e-mail part en français (`auth.languageCode`) de l'expéditeur Firebase (`noreply@…firebaseapp.com`) : il peut
  arriver dans les courriers indésirables. Le modèle du message se change dans *Authentication → Modèles*.
- Un lien ne sert qu'une fois et expire au bout d'un moment ; il suffit d'en redemander un.

### Règles de sécurité

[`firestore.rules`](firestore.rules) garantit que :

- seuls les deux joueurs d'une partie la lisent (une partie en attente d'adversaire est lisible par qui a le code,
  pour pouvoir la rejoindre) ;
- seul le joueur dont c'est le tour peut jouer, un coup à la fois (numéro de coup + 1, puis le tour passe à
  l'autre) ; la liste des joueurs ne peut plus changer une fois la partie commencée ;
- le chevalet de chaque joueur est dans un document que lui seul peut lire ;
- l'historique des coups ne peut pas être modifié après coup.

Elles sont vérifiées par des tests sur l'émulateur Firebase (création, rejoindre, jouer hors de son tour, lire le
chevalet de l'autre, etc.).

## Limites

- **Pas de notification appli fermée.** La notification « À toi de jouer » est locale : elle part quand l'appli est
  ouverte ou revient au premier plan et voit que l'adversaire a joué. De vraies notifications push, appli fermée,
  demanderaient Firebase Cloud Messaging *et* une Cloud Function déclenchée à chaque coup (écriture dans
  `parties/{code}`) qui envoie le message au joueur dont c'est le tour, avec les jetons FCM des appareils enregistrés
  dans Firestore. Les Cloud Functions exigent l'offre payante **Blaze** (paiement à l'usage, quasi gratuit à cette
  échelle mais carte bancaire obligatoire) ; côté appli il faudrait `@capacitor/push-notifications` et un fichier
  `google-services.json`.
- **La triche n'est pas impossible.** Sans serveur, c'est le téléphone du joueur qui tire les lettres et calcule le
  score, et le contenu du sac est lisible (les lettres de l'adversaire s'en déduisent). Chaque coup est revérifié
  par l'adversaire (mots, score, plateau), mais un joueur malin peut choisir ses lettres. C'est accepté pour un usage
  entre amis.

## Liens d'invitation

Le lien envoyé est celui de la version web : `https://scrabble.pbailly.fr/#/rejoindre/CODE`.

- Sur un téléphone sans l'appli, il ouvre la version web : on peut jouer directement dans le navigateur (après s'être
  connecté par e-mail). Sur Android, un bouton « Ouvrir dans l'appli » lance l'appli si elle est installée, sinon
  télécharge l'APK.
- L'appli Android déclare ce lien (et `fr.perso.scrabble://rejoindre/CODE`). Pour qu'Android l'ouvre **directement**
  dans l'appli, sans passer par le navigateur, il faut prouver que le domaine appartient à l'appli : c'est le rôle de
  [`public/.well-known/assetlinks.json`](public/.well-known/assetlinks.json), publié avec la version web à
  `https://scrabble.pbailly.fr/.well-known/assetlinks.json` (empreinte de la clé de signature de l'APK). Android
  vérifie le lien à l'installation de l'APK ; en cas de doute, l'activer à la main : Paramètres → Applis → Scrabble →
  Ouvrir par défaut → ajouter `scrabble.pbailly.fr`.

## Nom de domaine

La version web est servie sur `https://scrabble.pbailly.fr` (l'ancienne adresse `p-bailly.github.io/Scrabble`
redirige vers elle).

1. **OVH** (zone DNS de `pbailly.fr`) : ajouter une entrée **CNAME**, sous-domaine `scrabble`, cible
   `p-bailly.github.io.` (point final compris).
2. **GitHub** : *Settings → Pages → Custom domain* : `scrabble.pbailly.fr`, puis cocher *Enforce HTTPS* quand GitHub a
   émis le certificat (quelques minutes à une heure après la propagation DNS).
3. **Firebase** : ajouter `scrabble.pbailly.fr` aux domaines autorisés (étape 7 ci-dessus).

## Lancer l'app en local

Prérequis : [Node.js](https://nodejs.org) 22.

```bash
npm install
npm run dev             # http://localhost:5173
npm run dev -- --host   # pour l'ouvrir depuis votre téléphone sur le même Wi-Fi
npm test                # tests Vitest du moteur
npm run typecheck
```

Version de production : `npm run build` puis `npm run preview`.

Tester le multijoueur sans projet Firebase : lancer les émulateurs
(`npx firebase-tools emulators:start --only auth,firestore --project demo-scrabble`, avec un `firebase.json` qui
pointe vers `firestore.rules`) et créer un `firebase.config.json` avec `"projectId": "demo-scrabble"`,
`"apiKey": "demo"` et `"emulateurs": true` ; ne pas le committer.

APK en local : Android SDK (plateforme 36) + Java 21, puis `npm run android`
→ `android/app/build/outputs/apk/release/app-release.apk`.

## La mettre sur votre téléphone

- **Android** : l'APK ci-dessus (ou via « Mes applis »).
- **Version web** (iPhone, ordinateur, ou un adversaire sans l'APK) : le workflow
  [`deploy.yml`](.github/workflows/deploy.yml) la publie sur GitHub Pages à chaque push sur la branche par défaut,
  une fois Pages activé dans *Settings → Pages → Source : GitHub Actions* ; adresse :
  <https://scrabble.pbailly.fr/>. Puis :
  - **iPhone (Safari)** : Partager → *Sur l'écran d'accueil* ;
  - **Android (Chrome)** : menu ⋮ → *Installer l'application*.

## Structure

```
src/
  jeu/            moteur pur (sans React ni réseau) et ses tests
    lettres.ts      jetons, valeurs, voyelles
    plateau.ts      plateau 15 × 15, cases bonus
    coup.ts         analyse d'un coup : pose, mots formés, score, références (H4 / 4H)
    dawg.ts         lecture du dictionnaire compact ; construireDawg.ts : construction
    generateur.ts   tous les coups légaux (Appel-Jacobson)
    duplicate.ts    tirages FISF, déroulement d'une partie de duplicate
    classique.ts    partie à deux : pioche, échange, fin de partie
    hasard.ts       générateur pseudo-aléatoire reproductible (graine)
  moteur/         Web Worker du moteur et son accès depuis l'interface
  composants/     plateau zoomable, chevalet et glisser-déposer, aperçu du coup, icônes
  pages/          Solo (duplicate), Correction, Stats, Calculateur
  solo/           sauvegarde du duplicate et historique
  multi/          parties à deux : Firebase, connexion par e-mail, données Firestore, écrans, veille des coups
  lib/            routage par hash, stockage local, notifications
scripts/dico.ts   liste de mots → public/dico/mots.dawg
public/           manifest PWA, service worker, icônes, dictionnaire
android/          projet Android (Capacitor) qui embarque l'app web
design/logo/      logo : generer.mjs (SVG, icône adaptative), puis png.cjs (PNG, écrans de démarrage)
firestore.rules   règles de sécurité Firestore
```

Projet perso, sans lien avec Mattel, Hasbro, Larousse ou la FISF. Scrabble® est une marque déposée.
