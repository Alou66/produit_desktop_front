# Desktop — socle technique

Application Desktop (Electron + React + TypeScript + Vite), base d'une future application de gestion. Cette étape met en place uniquement le socle technique : aucune fonctionnalité métier, aucun IPC, aucune persistance.

## Stack

- **Electron** — shell desktop natif.
- **React 19** — interface utilisateur.
- **TypeScript (strict)** — sécurité de typage sur tout le code (main, preload, renderer).
- **Vite** via **electron-vite** — bundling et Hot Module Replacement pour les trois cibles (main, preload, renderer) avec une configuration unique.

## Structure du projet

```text
desktop/
├── electron/
│   ├── main/index.ts       # Process principal Electron (Node.js)
│   └── preload/index.ts    # Pont sécurisé entre main et renderer
├── src/
│   ├── app/                # Initialisation applicative (providers globaux, futur)
│   ├── assets/              # Images, icônes, polices
│   ├── components/          # Composants UI réutilisables et génériques
│   ├── features/            # Modules métier isolés (futur : produits, stock, etc.)
│   ├── layouts/              # Structures de mise en page (sidebar, header, etc.)
│   ├── routes/               # Définition du routage applicatif
│   ├── shared/                # Utilitaires, types, hooks partagés
│   ├── styles/                # Styles globaux
│   ├── App.tsx                 # Composant racine React
│   ├── main.tsx                 # Point d'entrée du renderer
│   └── vite-env.d.ts             # Déclarations de types pour Vite
├── public/                        # Fichiers statiques copiés tels quels
├── index.html                      # Point d'entrée HTML du renderer
├── electron.vite.config.ts          # Configuration unique main/preload/renderer
├── tsconfig.json                     # Config TypeScript du renderer (React/DOM)
└── tsconfig.node.json                 # Config TypeScript du main/preload (Node)
```

### Rôle des dossiers

| Dossier | Rôle |
|---|---|
| `electron/` | Tout le code qui tourne dans le contexte Node.js/Electron, séparé du code React. |
| `electron/main/` | Cycle de vie de l'application (fenêtres, menus, événements système). Accès complet à Node.js et aux API Electron. |
| `electron/preload/` | Seul pont autorisé entre `main` et le renderer, via `contextBridge`. Exécuté dans un contexte isolé, avant le chargement de la page. |
| `src/` | Code du renderer (l'application React), sans accès direct à Node.js. |
| `src/app/` | Composition applicative de haut niveau (providers, contexte global) — vide pour l'instant, prêt pour l'étape routing/state. |
| `src/features/` | Un sous-dossier par domaine métier (ex. `features/produits/`), regroupant composants, hooks et logique propres à ce domaine. Évite un dossier `components/` fourre-tout à mesure que l'app grossit. |
| `src/shared/` | Code transverse réutilisé par plusieurs `features` (types, helpers, hooks génériques) sans logique métier propre. |
| `src/layouts/` | Ossature visuelle des pages (ex. `MainLayout` avec sidebar + contenu), indépendante du contenu métier. |
| `src/routes/` | Déclaration des routes de l'application, centralisée pour préparer l'intégration d'un routeur. |

### Fichiers clés

- **`electron.vite.config.ts`** — un seul fichier de configuration qui décrit les trois builds (main, preload, renderer). Évite la duplication de configuration Vite/Electron.
- **`electron/main/index.ts`** — crée la fenêtre principale avec des `webPreferences` sécurisées (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), charge le serveur de dev Vite en développement et le bundle statique en production.
- **`electron/preload/index.ts`** — expose une API vide via `contextBridge.exposeInMainWorld('api', {})`, prête à être enrichie par de l'IPC typé lors d'une prochaine étape.
- **`index.html`** — inclut une Content-Security-Policy restrictive (`default-src 'self'`) conforme aux recommandations de sécurité Electron.
- **`tsconfig.json` / `tsconfig.node.json`** — deux configurations TypeScript strictes et indépendantes : l'une pour le renderer (DOM, JSX), l'autre pour le code Node.js (main, preload, fichier de config).

## Choix techniques justifiés

- **electron-vite** plutôt que deux configurations Vite séparées : c'est l'outil de référence de l'écosystème Electron+Vite, il gère nativement les trois cibles de build avec HMR pour le renderer et rebuild automatique du main/preload.
- **Pas de `type: module`** dans `package.json` : le main et le preload sont buildés en CommonJS, le format le plus compatible avec l'écosystème Electron actuel.
- **Sécurité par défaut** : `nodeIntegration` désactivé, `contextIsolation` activé, `sandbox` activé, CSP stricte dans le HTML. Aucune de ces options n'est laissée à sa valeur par défaut implicite — toutes sont déclarées explicitement.
- **Alias `@/*` → `src/*`** : configuré dans `tsconfig.json` et `electron.vite.config.ts`, pour éviter les imports relatifs profonds (`../../../shared/...`) à mesure que `features/` grossit.

## Scripts npm

| Commande | Effet |
|---|---|
| `npm run dev` | Lance le serveur de développement Vite (HMR) + l'application Electron. |
| `npm run build` | Build de production des trois cibles (main, preload, renderer) dans `out/`. |
| `npm run preview` | Lance l'application buildée (`out/`) sans passer par le serveur de dev. |
| `npm run typecheck` | Vérifie les types sur `src/` et `electron/` sans émettre de fichiers. |

## Démarrer le projet

```bash
npm install
npm run dev
```

## Prochaine étape

Ce socle est volontairement limité : pas de routing, pas de state manager, pas d'IPC, pas de persistance. Ces sujets seront introduits dans des étapes dédiées, une fois la base validée.

> Depuis l'étape 4.3.2/4.3.4, ce socle a évolué : routing, PowerSync, SQLite
> local et le CRUD `products` sont en place — voir
> [`electron/main/powersync/README.md`](electron/main/powersync/README.md)
> pour l'architecture complète. La section ci-dessous documente comment
> **valider** cette architecture Local First (étape 4.3.5).

## Tests — Validation Local First (étape 4.3.5)

Cette section décrit comment vérifier manuellement que l'app fonctionne bien
en Local First : écritures locales instantanées, tolérance totale à la perte
de réseau, et synchronisation automatique dès que le réseau et PowerSync sont
disponibles. Elle ne remplace pas `electron/main/powersync/README.md` (qui
explique le *pourquoi* de l'architecture) — elle explique le *comment tester*.

### Prérequis pour un test avec synchronisation réelle

Sans `MAIN_VITE_POWERSYNC_URL` / `MAIN_VITE_POWERSYNC_TOKEN` renseignés dans
`.env` (voir `.env.example`), l'app tourne en **local uniquement** : c'est un
mode valide (pas une erreur), affiché comme tel dans l'UI
(« Synchronisation désactivée »), mais il ne permet de tester que les
écritures locales — pas la synchronisation vers Postgres. Pour tester la
synchronisation complète :

1. Suivre la checklist manuelle de [`produit-api/src/powersync/README.md`](../produit-api/src/powersync/README.md)
   (compte PowerSync Cloud, réplication logique Neon, `database-setup.sql`,
   déploiement de `sync-rules.yaml`).
2. Renseigner `MAIN_VITE_POWERSYNC_URL` / `MAIN_VITE_POWERSYNC_TOKEN` dans
   `desktop/.env` (URL et dev token depuis le dashboard PowerSync) et
   `MAIN_VITE_API_URL` (URL de `produit-api`, ex. `http://localhost:3000/api`).
3. `npm run build && npm run preview` (ou `npm run dev`), avec `produit-api`
   démarré (`npm run dev` dans `produit-api/`) et sa `DATABASE_URL` valide.

### Comment tester le mode hors ligne

1. Couper `produit-api` (Ctrl+C) et/ou couper l'accès réseau de la machine.
2. Dans l'app, créer/modifier/supprimer des produits normalement.
3. Attendu : chaque opération reste instantanée, aucune erreur bloquante,
   aucune perte de données — les écritures locales ne dépendent jamais du
   réseau (`electron/main/ipc/products.ipc.ts` écrit directement sur
   `powersync.db` via `powersyncDb.execute()`, avant toute tentative de sync).
   Si PowerSync est configuré, le bandeau d'état passe à « Erreur de
   synchronisation : les produits restent enregistrés localement en
   attendant » — c'est le comportement attendu, pas un bug.

Vérifié lors de la validation 4.3.5 : 4 créations consécutives (`Pain`,
`Lait`, `Sucre`, `Riz`) avec `produit-api` **arrêté** et PowerSync **non
configuré** — les 4 produits apparaissent immédiatement, sans erreur console,
et survivent à un redémarrage complet de l'app (voir plus bas).

### Comment tester la synchronisation

Avec PowerSync configuré (voir Prérequis ci-dessus) et `produit-api` +
Postgres accessibles :

1. Créer/modifier/supprimer un produit dans l'app.
2. Vérifier côté Postgres (section suivante) que la ligne apparaît/se met à
   jour/disparaît sous quelques secondes, **sans action manuelle** — il n'y a
   volontairement aucun bouton « Synchroniser » dans l'UI :
   `powersyncDb.connect()` (démarré une fois par `initializePowerSync()`)
   maintient une connexion persistante et retente automatiquement, avec un
   intervalle de retry géré par le SDK (~5 s par défaut) en cas d'échec.
3. Couper puis rétablir le réseau pendant que l'app tourne : le bandeau de
   statut doit repasser de « Erreur de synchronisation » à connecté sans
   redémarrer l'app, et toute écriture faite hors ligne entre-temps doit
   partir automatiquement dès la reconnexion.

### Comment vérifier PostgreSQL (Neon)

Le plus simple est de passer par l'API plutôt que par la console Neon
directement :

```bash
curl http://localhost:3000/health          # { "success": true, "message": "OK" }
curl http://localhost:3000/api/products     # liste actuelle des produits
```

Si `produit-api` est arrêté ou que Neon est injoignable, `npm run dev` dans
`produit-api/` échoue au démarrage avec un message explicite
(`[database] Failed to connect to the database.` + la cause exacte) plutôt
que de démarrer un serveur qui ne pourrait pas servir de données — voir
`produit-api/README.md`. Note testée en pratique lors de cette validation :
Neon (branche serverless) peut mettre quelques secondes à sortir de veille
après une période d'inactivité ; un premier `npm run dev` qui échoue juste
après une longue pause n'est pas nécessairement un bug, réessayer avant de
creuser plus loin.

### Comment vérifier SQLite (local)

Le fichier local est `powersync.db`, dans le dossier `userData` d'Electron
pour cette app (`app.getPath('userData')`, voir `electron/main/powersync/database.ts`) :

- Linux : `~/.config/desktop/powersync.db`
- macOS : `~/Library/Application Support/desktop/powersync.db`
- Windows : `%APPDATA%/desktop/powersync.db`

Pour l'inspecter directement (le module natif `better-sqlite3` est compilé
pour l'ABI Node d'Electron, pas celle du Node système — il faut donc
l'exécuter via le binaire Electron en mode Node) :

```bash
cd desktop
ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron -e "
  const Database = require('better-sqlite3');
  const db = new Database('<chemin-vers-powersync.db>', { readonly: true });
  console.log(db.prepare('SELECT id, name, price, stock, createdAt, updatedAt FROM products').all());
"
```

`products` est une vue que PowerSync expose au-dessus de sa table interne
`ps_data__products` — interroger `products` directement (comme le fait
`products.ipc.ts`) est le comportement normal, pas un contournement.

### Comment diagnostiquer un problème de synchronisation

1. **Logs du process main** (console lancée avec `npm run dev`/`npm run
   preview`) : tout log PowerSync est préfixé `[powersync]`. Une erreur de
   connexion réseau apparaît sous la forme `[powersync]: Sync error
   [TypeError: fetch failed] { [cause]: Error: getaddrinfo ENOTFOUND ... }`
   (DNS/host injoignable) — répétée à chaque tentative de retry du SDK, ce
   qui est normal et attendu, pas une boucle infinie anormale.
2. **Statut exposé à l'UI** : `usePowerSyncStatus()` renvoie
   `state: 'disabled' | 'connecting' | 'connected' | 'error'` — voir
   `electron/shared/powersync.types.ts`. `ProductsPage` affiche ce statut
   séparément des erreurs de formulaire.
3. **Vérifier dans l'ordre** : `.env` du Desktop (URL/token renseignés ?) →
   `produit-api` démarré et connecté à Neon (`GET /health`) → connectivité
   réseau générale → PowerSync Dashboard (instance active, Sync Rules
   déployées, `database-setup.sql` exécuté sur Neon) → `sync-rules.yaml`
   (noms de colonnes exactement alignés avec `electron/main/powersync/schema.ts`,
   la source d'erreur la plus fréquente en pratique selon la doc officielle).

### Ce qui n'a pas pu être testé dans cet environnement

- **Synchronisation cloud bout-en-bout** (écriture locale → Postgres, ou
  l'inverse) : nécessite un projet PowerSync Cloud réel connecté à Neon
  (voir Prérequis) ; `desktop/.env` n'a pas ces identifiants renseignés dans
  cet environnement de validation.
- **Synchronisation multi-appareils** : nécessite deux instances desktop
  connectées au même projet PowerSync avec sync activée — hors de portée
  d'une session de validation à une seule machine/un seul environnement.
  Avec l'architecture actuelle (bucket global `products`, voir
  `produit-api/src/powersync/sync-rules.yaml`), le mécanisme attendu est :
  chaque client connecté reçoit automatiquement tout changement via son flux
  PowerSync (`powersyncDb.watch()` redéclenche le rendu), sans action
  manuelle ni redémarrage — mais cela reste à confirmer avec deux postes
  réels une fois PowerSync configuré.
