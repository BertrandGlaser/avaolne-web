# Avalon Web

Application locale mobile-first pour jouer a Avalon sur un seul telephone.

## Lancer le projet

```bash
npm install
npm run dev
```

Le serveur Vite est disponible sur l'URL affichee dans le terminal.

## Parcours de jeu

1. Saisir 5 a 10 pseudonymes.
2. Choisir la composition des personnages. Les quotas officiels Bien/Mal sont controles et Merlin est obligatoire.
3. Reveler les roles un par un.
4. Le chef choisit exactement la taille d'equipe de la mission.
5. Tout le monde vote en prive, a tour de role. Une majorite stricte accepte l'equipe.
6. Seuls les joueurs de l'equipe verrouillee jouent une carte de mission.
7. Le resultat global est revele sans exposer les cartes individuelles.

## Organisation du code

- `src/App.tsx` gere l'affichage et les interactions de l'application.
- `src/game/engine.ts` contient les transitions de partie et les invariants de session.
- `src/game/setup.ts` gere les compositions et la distribution aleatoire des roles.
- `src/game/constants.ts` centralise les tailles d'equipe, quotas et pouvoirs.
- `src/game/knowledge.ts` calcule les informations secretes vues par chaque role.
- `src/game/types.ts` definit les contrats TypeScript de la partie.

Le moteur reste independant de React afin de pouvoir etre teste ou reutilise plus tard pour une version iOS ou multijoueur.

## Verification

```bash
npm run build
```

Le build execute le controle TypeScript puis la compilation Vite.

## Application iOS et Android

Le projet utilise Capacitor pour reutiliser le code React dans des applications natives.

```bash
npm run mobile:sync
npm run mobile:ios
npm run mobile:android
```

`mobile:sync` reconstruit l'application web et copie les assets dans les projets natifs.
`mobile:ios` ouvre le projet dans Xcode. `mobile:android` ouvre le projet dans Android Studio.

Prerequis :

- iOS : macOS, Xcode et un compte Apple Developer pour installer ou publier sur un iPhone.
- Android : Android Studio et un SDK Android installe.

L'application est actuellement locale et ne demande aucun serveur ni compte utilisateur.
