# Scrabble

Appli perso de **Scrabble en français**, web app installable (PWA) aussi livrée en APK Android :

- **Duplicate en solo** : même tirage pour tout le monde, on cherche le meilleur mot (« entraînement » ou « topping ») ;
- **Partie solo contre l'ordinateur**, en cinq niveaux ;
- **Parties à deux en différé** : on touche le nom d'un joueur de l'appli pour l'inviter, ou on envoie un lien ;
- **Dictionnaire** (ODS8) : vérification d'un mot et de sa valeur, définitions ;
- **Mode simple** et **taille du texte** (Réglages) : une appli dépouillée et lisible pour une personne âgée.

Le solo et le dictionnaire marchent hors ligne et sans configuration ; seules les parties à deux demandent Firebase.

## Installer

- **Android** : <https://github.com/p-bailly/Scrabble/releases/latest/download/scrabble.apk> (Android demande d'autoriser
  l'installation depuis le navigateur). L'APK est reconstruit par GitHub Actions à chaque push sur la branche par défaut
  et s'installe par-dessus l'ancien ; il est aussi suivi par [« Mes applis »](https://github.com/p-bailly/Managing-Apps).
- **Web** (iPhone, ordinateur) : <https://scrabble.pbailly.fr/>. iPhone (Safari) : Partager → *Sur l'écran d'accueil* ;
  Android (Chrome) : menu ⋮ → *Installer l'application*.

## Lancer en local

Prérequis : [Node.js](https://nodejs.org) 22.

```bash
npm install
npm run dev             # http://localhost:5173 (ajouter -- --host pour l'ouvrir depuis un téléphone)
npm test                # tests Vitest
```

Usage : onglet **Solo** → *Duplicate* ou *Contre l'ordinateur* ; onglet **Mes parties** → *Nouvelle partie* → toucher le nom d'un
joueur ou envoyer le lien.

Autres commandes (build, APK en local, tests des règles Firestore, changement de dictionnaire) et architecture :
voir [`CLAUDE.md`](CLAUDE.md).

## Parties à deux : créer le projet Firebase

Le multijoueur utilise Firebase en offre gratuite (Authentication par nom d'utilisateur + Cloud Firestore). Il faut créer
un projet, publier [`firestore.rules`](firestore.rules) et ajouter `firebase.config.json` (modèle :
[`firebase.config.example.json`](firebase.config.example.json)). La procédure pas à pas, les notifications push (appli
fermée) et le nom de domaine sont détaillés dans [`CLAUDE.md`](CLAUDE.md).

## Licence

Projet perso de p-bailly, sans lien avec Mattel, Hasbro, Larousse ou la FISF. Scrabble® est une marque déposée. La liste de
mots (ODS8) n'est pas libre : elle est utilisée ici pour un usage personnel (détails dans [`CLAUDE.md`](CLAUDE.md)).
