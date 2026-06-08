# Simulateur de Train Électrique

Application web interactive pour créer et simuler des circuits de trains électriques.

🚂 **Démo en ligne : https://train.lau.rent**

Le circuit se construit sur une grille, en vue **de dessus** ou en vue
**isométrique 2.5D**, puis se simule (trains, gares, aiguillages).

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

L'application a deux **modes** (Édition / Simulation) et deux **vues**
(Dessus / Isométrique), commutables depuis la barre d'outils. Le monde est une
**grille de 50×50 px** ; chaque cellule peut contenir un rail, de l'eau ou du décor.

### Mode Édition

Outils de la barre d'outils :

- **🛤️ Rail** — tracer des rails en **cliquant-glissant**. L'orientation (droit
  ou courbe en quart de cercle) est déduite du trajet, et les rails adjacents se
  connectent automatiquement. Une jonction en Y crée automatiquement un aiguillage.
- **🏢 Gare** — poser une gare le long d'une voie droite (jusqu'à 3 cellules) :
  quai, bâtiments et nom peint sur le mur.
- **🚦 Signal** — placeholder (pas encore intégré à la simulation).
- **💧 Eau** — peindre des cellules d'eau. On ne peut pas poser de rail sur l'eau
  (les ponts viendront plus tard).
- **🗑️ Supprimer** / **⚠️ Tout effacer**.

### Mode Simulation

- Cliquer sur une voie pour **placer un train** (il démarre aussitôt).
- Cliquer sur un aiguillage pour le **basculer**.
- Le train **s'arrête en gare** quelques secondes puis repart.
- Panneau du bas : Play / Pause, Stop, vitesse (0.5× / 1× / 2×).

### Commandes

- **Clic-glisser (outil Rail)** : tracer des rails
- **Clic gauche** : action de l'outil actif / placer un train (en simulation)
- **Clic droit ou molette enfoncée + glisser** : déplacer la vue (pan), dans tous les modes
- **Molette** : zoom
- **Espace** : démarrer / arrêter le train · **R** : inverser son sens
- Bouton **Vue** : basculer entre vue de dessus et vue isométrique

## Fonctionnalités actuelles

✅ Vue **de dessus** et vue **isométrique 2:1** (bascule à tout moment)
✅ Pan / zoom cohérents dans les deux vues
✅ Tracé des rails au **cliquer-glisser** (droits + courbes), connexion automatique
✅ **Aiguillages** créés automatiquement sur les jonctions en Y (basculables)
✅ **Gares** multi-cellules : quai, bâtiments et **nom peint sur le mur**
✅ Cellules d'**eau** (étangs) ; rail interdit sur l'eau
✅ Décor procédural : arbres, buissons, fleurs, rochers
✅ **Simulation** : locomotive + wagons, suivi de voie, arrêts en gare
✅ Rendu détaillé en iso : locomotive à vapeur (chaudière, dômes, cheminée,
   roues à rayons, chasse-pierre), wagons à fenêtres, gares, terrain
✅ Déploiement sur Cloudflare (voir plus bas)

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
- **Rendering** : Canvas 2D — vue de dessus + projection isométrique 2:1 (2.5D),
  rendu procédural (pas de sprites)
- **Math** : courbes de Bézier (rails) ; primitives iso (boîtes, cylindres,
  disques) pour le rendu 2.5D
- **Structure** : architecture en couches (geometry, rendering, services, state, components)

## Structure du projet

```
src/
├── components/
│   ├── Canvas/              # Canvas principal (édition + simulation)
│   ├── Toolbar/             # Barre d'outils
│   └── SimulationControls/  # Contrôles de simulation
├── core/
│   └── geometry/            # Vector2D, courbes de Bézier
├── rendering/
│   ├── RenderingContext.ts  # Projection vue de dessus / isométrique
│   ├── GridRenderer.ts      # Terrain, grille, décor, eau
│   ├── iso.ts               # Primitives 2.5D (boîtes, cylindres, disques…)
│   └── renderers/           # Rails, trains, gares, aiguillages
├── services/                # Construction du circuit, physique, suivi de voie
├── state/                   # Store Zustand
└── types/                   # Types TypeScript
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
