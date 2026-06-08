# Simulateur de Train Électrique

Application web interactive pour créer et simuler des circuits de trains électriques.

## Installation

```bash
npm install
```

## Démarrage

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173/`

## Utilisation

### Mode Édition

#### Système de grille

Le simulateur utilise une **grille de 50x50 pixels** pour placer les rails. Chaque rail occupe exactement **une cellule de grille**.

#### Types de rails disponibles

**Rails droits :**

- **Horizontal (─)** : Rail est-ouest
- **Vertical (│)** : Rail nord-sud

**Rails courbes (quarts de cercle) :**

- **NE (╰)** : Courbe de bas vers droite
- **ES (╮)** : Courbe de haut vers droite
- **SW (╯)** : Courbe de haut vers gauche
- **WN (╭)** : Courbe de bas vers gauche

#### Placer des rails

1. Sélectionner le type de rail dans la barre d'outils
2. Cliquer sur une cellule de la grille pour placer le rail
3. Le rail est créé instantanément !
4. Les rails se connectent automatiquement s'ils sont adjacents

#### Supprimer des rails

1. Cliquer sur le bouton "🗑️ Supprimer"
2. Cliquer sur un rail pour le supprimer

#### Commandes

- **Clic gauche** : Placer ou supprimer un rail (selon l'outil actif)
- **Cliquer + glisser** : Déplacer la vue (pan)
- **Molette** : Zoom in/out
- La cellule survolée est mise en surbrillance en bleu

### Mode Simulation

_(À venir dans les prochaines phases)_

## Fonctionnalités actuelles (Phase 1 & 2)

✅ Canvas interactif avec pan/zoom
✅ Grille de 50x50 pixels toujours active
✅ **Système simplifié** : rails à 90° uniquement
✅ **Rails droits** : horizontal et vertical
✅ **Rails courbes** : 4 quarts de cercle (NE, ES, SW, WN)
✅ **Placement simple** : un clic pour placer un rail
✅ Highlight de la cellule survolée
✅ Rendu réaliste des rails (2 lignes + traverses)
✅ Connexion automatique des rails adjacents
✅ Suppression de rails avec outil dédié
✅ Gestion des nœuds et graphe du circuit

## Prochaines étapes

1. **Améliorer le rendu des étangs / plans d'eau**
2. **Gérer l'eau multi-cellules** : fusionner les cellules adjacentes en un seul plan d'eau continu
3. **Ajouter un train « TGV »** (locomotive/rame moderne)
4. **Simplifier la navigation et les menus**
5. **Améliorer le tracé des rails** : revenir en arrière efface, garantir la continuité du tracé
6. **Ajouter des ponts** : poser des rails au-dessus de l'eau
7. **Améliorer le rendu des gares** (surtout le panneau de nom) et rendre le nom **éditable**
8. **Ajouter des animations** (voyageurs dans la gare, etc.)
9. **Gérer le cycle jour / nuit** (éclairage)
10. **Ajouter d'autres décors / types de tuiles** : montagnes, maisons, terrains variés
11. **Améliorer les graphismes** : étudier l'usage de textures ou d'autres techniques

### Idées de plus long terme

- Plusieurs trains simultanés
- Déclencheurs sur les rails (activer un signal ou un aiguillage)
- Signaux réellement intégrés à la simulation
- Sauvegarde / chargement de circuits

## Architecture technique

- **Framework** : React 18 + TypeScript
- **Build** : Vite
- **State** : Zustand avec Immer
- **Rendering** : Canvas 2D HTML5
- **Math** : Courbes de Bézier pour les rails courbes
- **Structure** : Architecture en couches (models, rendering, services, components)

## Structure du projet

```
src/
├── components/        # Composants React
│   ├── Canvas/       # Canvas principal
│   └── Toolbar/      # Barre d'outils
├── core/             # Logique métier
│   ├── geometry/     # Utilitaires mathématiques
│   ├── models/       # Modèles de données
│   ├── physics/      # Moteur physique (à venir)
│   └── graph/        # Représentation en graphe
├── rendering/        # Système de rendu
│   └── renderers/    # Renderers spécialisés
├── services/         # Services métier
├── state/            # Store Zustand
├── types/            # Types TypeScript
└── hooks/            # Custom hooks React
```

## Développement

### Commandes disponibles

```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Build de production
npm run preview  # Preview du build
npm run lint     # Linter
npm run deploy   # Build + déploiement sur Cloudflare
```

### Déploiement

L'application est déployée sur **Cloudflare Workers** (static assets) et servie
sur https://train.lau.rent. La configuration est dans `wrangler.jsonc` (worker
`train-simulation`, sert le dossier `./dist`).

```bash
npx wrangler login   # authentification (une fois, ouvre le navigateur)
npm run deploy       # build puis `wrangler deploy`
```

### Technologies utilisées

- React 18.3
- TypeScript 5.6
- Vite 6.0
- Zustand 4.5 (state management)
- Tailwind CSS 3.4
- Bezier.js 6.1 (calculs de courbes)
- Nanoid 5.0 (génération d'IDs)

## Licence

Ce projet est à usage personnel.
