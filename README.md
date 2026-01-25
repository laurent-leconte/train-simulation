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

## Fonctionnalités à venir

- Phase 3: Aiguillages, gares, signaux
- Phase 4: Train avec physique réaliste
- Phase 5: Logique de simulation avancée
- Phase 6: Save/Load, optimisations

## Idées en vrac

- plusieurs trains
- déclencheurs sur les rails, pour activer un signal ou un aiguillage
- amélioration des visuels
- jour / nuit
- des gens montent / descendent du train à la gare
- eau, montagne
- ponts

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
