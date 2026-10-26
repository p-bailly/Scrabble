# Scrabble

Appli perso de **Scrabble en français**, en quatre parties :

- **Duplicate en solo** : à chaque coup le même tirage pour tout le monde, on cherche le meilleur mot, puis c'est
  le top qui est posé ; en « entraînement » (partie entière) ou en « topping » (il faut trouver le top, avec indices) ;
- **Partie solo contre l'IA** : une partie classique tour par tour contre l'ordinateur, en cinq niveaux ;
- **Parties à deux en différé** : chacun joue son coup quand il veut, sans être connecté en même temps que l'autre ;
  on invite directement un joueur de l'appli (par son pseudo), ou on envoie un lien à qui ne l'a pas ;
- **Dictionnaire** : tous les mots valables, avec recherche (commence par, finit par, contient ; `?` = une lettre) ;
  toucher un mot affiche sa définition (Wiktionnaire, connexion nécessaire, gardée ensuite sur l'appareil).

Un onglet **Réglages** regroupe le thème, les notifications, le compte et les données de l'appareil.

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

L'onglet **Solo** ouvre un menu : « Duplicate » ou « Contre l'IA ». Le duplicate suit le principe de la FISF et les
deux modes de l'appli DupliJeu de la FFSc qui sont décrits publiquement (« Entraînement » et « Topping » ; les types
de partie « Joker », « 7 sur 8 », « 7 et 8 » ne sont pas repris, faute de règle publiée) :

- à chaque coup, un tirage de 7 lettres. On cherche son meilleur mot dans le temps imparti : **Normal** (3 min),
  **Semi-rapide** (2 min), **Rapide** (1 min), **Blitz** (30 s) ou sans limite. (Les noms sont ceux de DupliJeu, les
  durées sont des choix de l'appli.) ;
- **Entraînement** : **Noter** retient un coup (on peut en noter plusieurs, on garde le dernier) ; à la fin du temps
  ou avec **Valider**, c'est le meilleur entre le coup noté et celui posé sur le plateau qui compte ;
- **Topping** : **Valider** n'arrête le coup que si le mot vaut le top (sinon l'appli le dit et on continue de
  chercher) ; le coup s'arrête aussi à la fin du temps ou en **renonçant**. Les **indices** donnent la valeur du top,
  la longueur de son mot, sa direction et sa case de départ, un par un ; ils sont comptés dans la correction. À la
  fin, l'appli donne le nombre de tops trouvés et le temps moyen pour les trouver ;
- puis l'appli pose le **top** (meilleur score possible). Les lettres qu'il n'utilise pas, complétées dans le sac,
  forment le tirage suivant. Après chaque coup, le plateau montre le top et on peut toucher chacune des meilleures
  solutions (jusqu'à 15) pour la voir sur la grille ;
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

### Contre l'IA (solo)

Une partie classique à deux joueurs contre l'ordinateur, avec les mêmes règles que les parties à deux ci-dessous
(chevalet de 7 lettres ; on pose un mot, on change des lettres s'il reste au moins 7 jetons dans le sac, ou on
passe ; mêmes fins de partie). Tout se passe sur l'appareil, hors ligne. On choisit le niveau et qui commence ; la
partie en cours est sauvegardée, les résultats contre chaque niveau sont gardés (menu Solo et onglet Stats).

L'IA calcule tous les coups légaux (le générateur du calculateur) ; c'est le **niveau** qui règle ce qu'elle en
fait :

| Niveau    | Comportement                                                                                       | Score moyen* |
| --------- | -------------------------------------------------------------------------------------------------- | -----------: |
| Débutant  | mots de 2 à 4 lettres, vise 15 à 50 % du meilleur score, ne voit jamais un scrabble                |          160 |
| Amateur   | mots jusqu'à 5 lettres, vise 40 à 75 % du meilleur score, voit très rarement un scrabble           |          260 |
| Confirmé  | mots jusqu'à 7 lettres, vise 55 à 90 % du meilleur score, repère un scrabble sur trois             |          360 |
| Expert    | joue presque le meilleur coup (à quelques points près), garde un peu les bonnes lettres, repère 8 scrabbles sur 10 |  440 |
| Champion  | meilleur coup en tenant compte des lettres gardées, échange quand rien ne vaut la peine, et en fin de partie compare chaque coup à la meilleure réponse de l'adversaire |  550 |

\* Moyenne des scores d'une partie IA contre IA (réglage des niveaux, 20 parties par couple et par couleur sur le
dictionnaire complet). La valeur des lettres gardées (le joker et le S valent cher ; les doublons et un chevalet
déséquilibré en voyelles ou en consonnes se paient) apporte à elle seule environ 35 points par partie au Champion
face au meilleur coup « brut ». Le code est dans [`src/jeu/ia.ts`](src/jeu/ia.ts) et
[`src/jeu/contreIA.ts`](src/jeu/contreIA.ts) ; les tests vérifient l'ordre des niveaux et rejouent une partie
complète (jetons conservés, points, fin de partie).

### Parties à deux (en différé)

Partie classique tour par tour : chacun son chevalet de 7 lettres. À son tour, on pose un mot, on change des
lettres (s'il en reste au moins 7 dans le sac) ou on passe. Un mot absent du dictionnaire est refusé à la pose.
Fin de partie : le sac est vide et un joueur a vidé son chevalet (il gagne la valeur des lettres restant à
l'adversaire, qui les perd), ou six passes de suite (chacun perd la valeur de ses lettres restantes).

- **Nouvelle partie** ouvre l'écran d'invitation, de deux façons :
  - **Inviter un joueur de l'appli** : on tape son pseudo (deux lettres suffisent) ou on touche un adversaire déjà
    rencontré (« Joué récemment »). L'invité trouve l'invitation en tête de **Mes parties** (« Invitations reçues »),
    avec une pastille sur l'onglet, et l'**accepte** (la partie commence, l'inviteur joue en premier) ou la **refuse**
    (l'inviteur en est informé et peut inviter quelqu'un d'autre). Un seul invité à la fois : en inviter un autre
    remplace le premier, et l'inviteur peut annuler. À la fin d'une partie, **Proposer une revanche** crée une
    nouvelle partie avec le même adversaire déjà invité.
  - **Un code court et un lien** à envoyer par SMS ou WhatsApp, pour qui n'a pas encore l'appli ou n'est pas
    trouvable. Le lien ouvre l'appli Android si elle est installée, sinon la version web (voir « Liens d'invitation »
    plus bas) ; on peut aussi saisir le code. Le lien reste valable même si un joueur est invité : le premier qui
    rejoint prend la place.
- **Mes parties** : « Invitations reçues » et « À toi de jouer » en tête, puis « En attente de … », les invitations
  envoyées et les parties terminées. Plusieurs parties en parallèle.
- Mise à jour en direct quand l'appli est ouverte ; hors ligne, le coup est mis en file et envoyé au retour du
  réseau.
- Notification « À toi de jouer » quand l'appli détecte le coup de l'adversaire (au premier plan ou à la reprise),
  de même pour une invitation reçue, un refus ou la fin d'une partie.
- Historique des coups de la partie (mot, position, points) ; chaque coup reçu est revérifié par le client de
  l'adversaire (mots du dictionnaire, score), un coup non conforme est signalé.

## Apparence

L'interface s'inspire de **DupliJeu**, l'appli officielle du duplicate de la Fédération Française de Scrabble
(simple inspiration visuelle : aucun élément graphique n'en est repris) : fond bleu ciel, plateau vert quadrillé de
blanc, cases « double » en étoiles à huit pointes (rose pour le mot, bleu clair pour la lettre) et cases « triple »
en carrés pleins (rouge, bleu), jetons crème à lettres noires, bleues tant qu'ils ne sont pas validés, rouges pour
un joker. Sur l'écran de jeu : le chevalet dans un bac bleu juste sous le plateau (il passe au rouge pendant les
15 dernières secondes), la ligne du coup en cours, les boutons carrés, puis tout en bas le chrono encadré avec le
score (`74 / 93 pts (−19 | 79,6 %)`) et sa jauge verte. Thème clair ou sombre selon le téléphone (ou au choix, dans les Réglages), police système.
Les couleurs sont des variables CSS en tête de [`src/styles.css`](src/styles.css).

## Réglages

L'onglet **Réglages** ([`src/pages/Reglages.tsx`](src/pages/Reglages.tsx)). Tout est gardé sur l'appareil
([`src/lib/reglages.ts`](src/lib/reglages.ts)), sauf la visibilité dans la recherche, qui est dans Firestore :

| Rubrique | Réglage |
| --- | --- |
| Apparence | **Thème** : automatique (suit le téléphone), clair ou sombre ; **étiquettes des cases bonus** (MT, MD, LT, LD) affichées ou non sur le plateau |
| Jeu | **Confirmer avant de passer** son tour (parties à deux et contre l'IA) |
| Notifications | Activer ou non « À toi de jouer » et les invitations ; état de l'autorisation du système, bouton pour la demander et pour envoyer un essai |
| Parties à deux | **Pseudo** ; **être trouvé par les autres joueurs** (désactivé, on ne peut te faire jouer que par code ou lien) ; **se déconnecter** |
| Données de cet appareil | Effacer l'historique du duplicate (et ses statistiques), les résultats contre l'IA, les définitions gardées |
| À propos | Date de construction, dictionnaire, recherche d'une mise à jour (ou lien de l'APK dans l'appli Android), partage de l'appli |

Le thème est posé avant le premier affichage par un petit script d'[`index.html`](index.html) (pas d'éclair clair sur un
téléphone en mode sombre), puis suivi par `reglages.ts` ; les couleurs sombres sont sous `:root[data-theme='dark']`
dans [`src/styles.css`](src/styles.css). La rubrique « Parties à deux » ne se charge (avec Firebase) que si un compte
existe sur l'appareil.

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
- Au **clavier**, on tape directement les lettres du mot (Retour arrière efface, Espace change le sens, Échap reprend
  tout, Entrée valide). Un mot proposé en duplicate doit avoir au moins 2 voyelles ou 2 consonnes (Y et apostrophe
  comptent pour les deux).
- **Mises à jour** : au lancement (et au retour au premier plan), la PWA cherche une nouvelle version et se recharge
  toute seule si elle en trouve une.

## Parties à deux : créer le projet Firebase

Le multijoueur utilise **Firebase** en offre gratuite (Spark) : Authentication par **nom d'utilisateur** (sans mot de
passe ni e-mail, voir plus bas) et Cloud Firestore. (Pas de Supabase : ses projets gratuits se mettent en pause après
une semaine sans activité.) Sans configuration, le solo et le calculateur marchent et l'onglet « Mes parties »
l'explique.

1. Sur <https://console.firebase.google.com>, **Ajouter un projet** (nom au choix, ex. `mon-scrabble`). Google
   Analytics n'est pas utile.
2. **Build → Authentication → Commencer**, onglet *Sign-in method* : activer **Adresse e-mail/Mot de passe** (laisser
   « Lien envoyé par e-mail » désactivé). L'appli s'en sert en coulisses pour les noms d'utilisateur, sans jamais
   envoyer d'e-mail.
3. **Build → Firestore Database → Créer une base de données** : emplacement `eur3 (europe-west)`, démarrer en
   **mode production**.
4. Onglet **Règles** de Firestore : remplacer tout par le contenu de [`firestore.rules`](firestore.rules), puis
   **Publier**. **À refaire quand ce fichier évolue** (c'est le cas avec les invitations directes) : tant que les règles
   publiées sont anciennes, tout marche sauf « Inviter un joueur », qui répond que les règles ne sont pas à jour (le
   code et le lien d'invitation restent utilisables).
5. **Paramètres du projet** (roue dentée) → *Vos applications* → icône **Web** `</>` : nom `Scrabble`, sans
   Firebase Hosting. Copier l'objet `firebaseConfig` affiché.
6. Dans le dépôt, créer `firebase.config.json` sur le modèle de
   [`firebase.config.example.json`](firebase.config.example.json) avec ces valeurs (format JSON : clés et textes
   entre guillemets doubles), le committer et le pousser. La CI reconstruit l'APK et la version web avec.
   *Variante* : au lieu de committer le fichier, mettre son contenu dans une variable du dépôt nommée
   `FIREBASE_CONFIG` (Settings → Secrets and variables → Actions → onglet *Variables*) ; les workflows l'écrivent
   avant la compilation.

La configuration web de Firebase n'est **pas un secret** : la sécurité repose sur les règles Firestore.

### Compte : un nom d'utilisateur

Au premier lancement, l'appli demande un **nom d'utilisateur** (écran « Mes parties » ; « Jouer en solo sans compte »
saute cette étape). Saisir le même nom sur un autre téléphone ou sur le site ouvre le même compte : mêmes parties,
même pseudo. Aucun mot de passe, aucun e-mail.

- **Comment ça marche.** Firebase ne propose pas de connexion par simple nom. L'appli fabrique donc, à partir du nom,
  une adresse (`jean-luc@joueurs.scrabble.pbailly.fr`, qui n'existe pas et ne reçoit rien) et un mot de passe
  (`scrabble-jean-luc`), puis crée le compte la première fois ou s'y connecte ensuite
  ([`src/multi/firebase.ts`](src/multi/firebase.ts)). Le nom ignore les accents, les majuscules et la ponctuation :
  « Jean Luc » et « jean-luc » désignent le même compte. Le nom saisi devient le pseudo vu par l'adversaire.
- **Revers : le nom n'est pas secret.** Ni mot de passe ni code de vérification : quiconque connaît un nom (ou le
  devine) peut s'y connecter et lire ses parties. C'est le prix de la simplicité, acceptable entre proches. Pour
  durcir, il suffirait d'ajouter un code secret à quatre chiffres demandé en plus du nom et mélangé au mot de passe
  fabriqué ci-dessus.
- **Retrouver un joueur.** Pour pouvoir inviter quelqu'un par son pseudo, sa fiche (`joueurs/{uid}`) porte une clé de
  recherche : son pseudo sans accents ni majuscules. N'importe quel joueur connecté peut chercher par début de pseudo
  (dix fiches au plus par requête, les règles refusent une requête sans limite) : c'est une exposition de plus des
  noms, déjà peu secrets (voir ci-dessus). Chacun peut s'en retirer dans Réglages → « Être trouvé par les autres
  joueurs » ; la clé disparaît alors de sa fiche. Les fiches d'avant les invitations reçoivent leur clé au prochain
  lancement de l'appli.
- Se déconnecter (Réglages → Parties à deux) permet de changer de compte sur un même appareil.

### Règles de sécurité

[`firestore.rules`](firestore.rules) garantit que :

- seuls les deux joueurs d'une partie la lisent (une partie en attente d'adversaire est lisible par qui a le code,
  pour pouvoir la rejoindre) ;
- seul le joueur dont c'est le tour peut jouer, un coup à la fois (numéro de coup + 1, puis le tour passe à
  l'autre) ; la liste des joueurs ne peut plus changer une fois la partie commencée ;
- une invitation directe ne peut être envoyée (ou annulée) que par le créateur, tant que la partie attend son
  adversaire, avec un invité au plus ; l'invité peut la lire et la refuser (il se retire alors de la liste et le
  créateur le voit), sans rien pouvoir changer d'autre ;
- le chevalet de chaque joueur est dans un document que lui seul peut lire ;
- l'historique des coups ne peut pas être modifié après coup.

Elles sont vérifiées par des tests sur l'émulateur Firebase (création, rejoindre, jouer hors de son tour, lire le
chevalet de l'autre, etc.).

## Limites

- **Pas de notification appli fermée.** La notification « À toi de jouer » est locale : elle part quand l'appli est
  ouverte ou revient au premier plan et voit que l'adversaire a joué (ou qu'on a reçu une invitation). De vraies notifications push, appli fermée,
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

- Sur un téléphone sans l'appli, il ouvre la version web : on peut jouer directement dans le navigateur (après avoir
  saisi son nom d'utilisateur, la partie est rejointe aussitôt). Sur Android, un bouton « Ouvrir dans l'appli » lance
  l'appli si elle est installée, sinon télécharge l'APK.
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

Firebase n'a pas besoin de connaître le domaine : la connexion par nom d'utilisateur ne passe par aucune redirection.

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
    duplicate.ts    tirages FISF, déroulement d'une partie de duplicate (entraînement, topping, indices)
    classique.ts    partie à deux : pioche, échange, fin de partie
    ia.ts           l'adversaire artificiel : cinq niveaux, valeur des lettres gardées, choix du coup
    contreIA.ts     partie contre l'IA : état sauvegardable et transitions (mot, échange, passe, fin)
    hasard.ts       générateur pseudo-aléatoire reproductible (graine)
  moteur/         Web Worker du moteur (analyse, coups, coup de l'IA) et son accès depuis l'interface
  composants/     plateau zoomable, chevalet et glisser-déposer, aperçu du coup, changement de lettres, icônes, lignes de réglage
  pages/          Solo (menu), Duplicate, ContreIA, Correction, Stats, Dictionnaire, Réglages
  solo/           sauvegarde du duplicate et de la partie contre l'IA, historiques
  multi/          parties à deux : Firebase, nom d'utilisateur, données Firestore (dont invitations), écrans, section compte des réglages, veille des coups et des invitations
  lib/            routage par hash, stockage local, réglages, notifications, adresses à partager
scripts/dico.ts   liste de mots → public/dico/mots.dawg
public/           manifest PWA, service worker, icônes, dictionnaire
android/          projet Android (Capacitor) qui embarque l'app web
design/logo/      logo « La tuile » au crayon, comme les logos Nimbus : generer.mjs (SVG, icône adaptative), puis png.cjs (PNG, écrans de démarrage ; Chrome ou Edge requis)
firestore.rules   règles de sécurité Firestore
```

Projet perso, sans lien avec Mattel, Hasbro, Larousse ou la FISF. Scrabble® est une marque déposée.
