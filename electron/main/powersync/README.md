# PowerSync — unique stockage local du Desktop

Cette étape retire Prisma/SQLite du Desktop et fait de PowerSync l'unique
point d'accès aux données locales. L'étape précédente (4.3.2) avait posé la
connexion PowerSync sans aucune donnée (`schema.ts` vide) ; celle-ci ajoute
la table `products`, le CRUD complet et la synchronisation bidirectionnelle.

Décisions basées sur la documentation officielle actuelle (docs.powersync.com,
package `@powersync/node@0.20.2` installé), consultée en août 2026 :
[voir aussi ../../../README.md et le plan de migration pour le détail des
choix].

## Pourquoi Prisma/SQLite a disparu côté Desktop

Avant cette étape, le Desktop avait **deux bases locales en parallèle** :
`prisma/dev.db` (Prisma, lu/écrit par `electron/main/ipc/products.ipc.ts`)
et `powersync.db` (PowerSync, connecté mais vide). C'est une source de
vérité ambiguë par construction : rien n'empêchait les deux bases de
diverger, et PowerSync gère déjà, seul, tout ce que Prisma faisait ici —
un moteur SQLite local (`better-sqlite3`), des migrations de schéma (via
`Schema`/`Table`, sans fichier `.sql` à maintenir), et en plus la
synchronisation avec le backend. Garder Prisma en plus n'apportait rien et
créait un risque d'incohérence. Le backend (`produit-api`) garde Prisma —
c'est son rôle légitime : parler à Neon PostgreSQL, aucune raison de
changer.

## Pourquoi PowerSync est la source de vérité locale

- Le schéma client (`schema.ts`) définit les tables SQLite exposées au
  reste de l'app — pas de fichier de migration à écrire : PowerSync
  applique le schéma directement sur `powersync.db` au démarrage.
- Chaque écriture locale (`INSERT`/`UPDATE`/`DELETE` via `powersyncDb.execute()`)
  est immédiate sur le SQLite local (l'app reste utilisable hors ligne),
  puis mise en file d'attente et envoyée au backend par `connector.ts` dès
  que la connexion est disponible.
- Chaque lecture peut être réactive (`powersyncDb.watch()`) : le résultat
  se met à jour tout seul, que le changement vienne d'une écriture locale
  ou d'une ligne reçue par la synchronisation (ex. modifiée depuis un autre
  poste).

## Lien avec les Sync Rules

`schema.ts` doit avoir **une `Table` par bucket** défini dans
`produit-api/src/powersync/sync-rules.yaml`, avec les mêmes noms de
colonnes que le `SELECT` du bucket. Exemple pour `products` :

```yaml
# produit-api/src/powersync/sync-rules.yaml
products:
  data:
    - SELECT id, name, price, stock, "createdAt", "updatedAt" FROM products
```

```ts
// electron/main/powersync/schema.ts
const products = new Table({
  name: column.text,
  price: column.real,
  stock: column.integer,
  createdAt: column.text,
  updatedAt: column.text
})
export const AppSchema = new Schema({ products })
```

Aucune colonne `id` déclarée : PowerSync en crée toujours une (`text`)
automatiquement. Si un nom de colonne ne correspond pas exactement entre
les deux fichiers, PowerSync synchronise silencieusement `null` pour cette
colonne — c'est la source d'erreur la plus fréquente en pratique.

## Flux de données complet

```text
React (composant)
  → hook (useProducts)                          src/features/products/hooks
  → service (ProductService)                    src/features/products/services
  → repository (ProductRepository)               src/features/products/repositories
  → window.api.products.*                        electron/preload/index.ts
  → IPC                                          electron/main/ipc/products.ipc.ts
  → powersyncDb (process main)                   electron/main/powersync/database.ts
  → SQLite local (powersync.db)
       │
       │ synchronisation automatique (watch + queue d'upload)
       ▼
  PowerSync Service (cloud)
       │
       ▼
  produit-api (Express, REST /api/products)      produit-api/src/modules/products
       │
       ▼
  Prisma → Neon PostgreSQL
```

**Lecture réactive** : `products.ipc.ts` appelle `powersyncDb.watch(...)`
une seule fois au démarrage de l'app et diffuse le résultat à toutes les
fenêtres (canal `products:changed`) à chaque changement. `ProductRepository.subscribe()`
s'y abonne côté renderer ; `useProducts()` combine cet abonnement avec un
premier appel `list()` (pour ne pas attendre le premier push avant
d'afficher quelque chose).

**Écriture** : `products.ipc.ts` écrit directement en SQL (`INSERT`/`UPDATE`/`DELETE`)
sur `powersyncDb`, jamais sur un objet renvoyé par le backend — le retour de
l'écriture locale doit être immédiat, avant toute synchronisation réseau.

**Synchronisation sortante** : `connector.ts::uploadData()` vide la file
d'attente PowerSync (`transaction.crud`) en appelant les routes REST de
`produit-api` (`POST/PUT/DELETE /api/products`). Une erreur réseau ou 5xx
est relancée pour que le SDK réessaie plus tard ; une erreur 4xx (validation)
est journalisée et l'opération abandonnée, pour ne jamais bloquer
indéfiniment la file (recommandation officielle "Writing Client Changes").

**Synchronisation entrante** : gérée entièrement par le SDK PowerSync
(`powersyncDb.connect()`, démarré par `initializePowerSync()` dans
`index.ts`) — aucun code applicatif ne la déclenche manuellement.

## Pourquoi l'id est généré côté client

`products.ipc.ts::products:create` génère l'`id` avec `crypto.randomUUID()`
avant l'écriture locale (`INSERT`), au lieu de laisser le backend le
générer. C'est nécessaire pour que la ligne conserve le **même id** après
son aller-retour par la synchronisation : PowerSync envoie cet id dans
`op.id` lors de l'upload (`UpdateType.PUT`), et `produit-api` l'accepte
désormais explicitement (`CreateProductSchema.id`, optionnel) au lieu de
toujours générer le sien. Sans ça, la ligne synchronisée en retour aurait
un id différent de la ligne locale déjà affichée → doublon dans le bucket
global.

## Gestion des erreurs

| Cas | Comportement |
| --- | --- |
| Entrée invalide (nom vide, prix négatif, stock non entier) | Rejetée à la frontière IPC (`products.ipc.ts::assertValidProductInput`), reclassée en `ProductError{kind:'validation'}` par `ProductService`, affichée dans `ProductForm`. |
| Erreur SQLite locale (contrainte, disque plein, `powersync.db` verrouillé) | `toCleanError()` détecte le préfixe `SQLITE_` sur `error.code` et renvoie un message générique sans détail interne ; reclassée en `ProductError{kind:'sqlite'}` côté renderer. |
| `MAIN_VITE_POWERSYNC_URL`/`_TOKEN` absents | Comme avant cette étape : `state: 'disabled'`, l'app reste utilisable en local uniquement (les écritures restent en file d'attente jusqu'à configuration). |
| Erreur réseau / service PowerSync injoignable | Remontée en continu via `PowerSyncStatus.downloadError`/`uploadError` (`usePowerSyncStatus()`), affichée par `ProductsPage` comme avertissement séparé des erreurs de formulaire — jamais bloquant pour les écritures locales. |
| `produit-api` renvoie une erreur lors de l'upload | Voir "Synchronisation sortante" ci-dessus : 5xx → retry automatique du SDK ; 4xx → abandon journalisé, la ligne reste correcte localement. |

Aucun de ces cas ne fait planter l'application : soit l'erreur est
affichée explicitement dans l'UI, soit elle est journalisée côté process
main et le SDK gère lui-même la reprise.

## Comment ajouter un futur module synchronisé

Sur le modèle de `products` :

1. **Backend** : ajouter la table/le bucket dans
   `produit-api/src/powersync/sync-rules.yaml` (et `database-setup.sql` si
   une nouvelle table Postgres est créée) ; exposer les routes REST
   correspondantes (`modules/<module>/`).
2. **Schéma local** : ajouter une `Table` dans `schema.ts` avec les mêmes
   noms de colonnes que le `SELECT` du bucket.
3. **Connecteur** : étendre `connector.ts::uploadData()` (ou généraliser le
   `switch` existant) pour router `PUT`/`PATCH`/`DELETE` vers les nouvelles
   routes REST selon `op.table`.
4. **IPC** : créer `electron/main/ipc/<module>.ipc.ts` sur le modèle de
   `products.ipc.ts` (`list`/`create`/`update`/`delete` + `watch` diffusé
   via un canal `<module>:changed`), l'enregistrer dans `electron/main/index.ts`.
5. **Preload** : exposer le nouveau namespace dans `electron/preload/index.ts`.
6. **Renderer** : créer `src/features/<module>/{types,repositories,services,hooks,components}`
   en suivant exactement la structure de `src/features/products/`.

## Ce qui reste hors périmètre de cette étape

- L'endpoint `/api/auth/token` côté backend et le remplacement du dev token
  dans `connector.ts::fetchCredentials()`.
- Tests de synchronisation multi-postes, résolution de conflits,
  authentification, React Query, Zustand, optimisations de performance —
  explicitement exclus de cette étape.
- Le packaging (`asar`) : `better-sqlite3` et l'extension native PowerSync
  devront être exclus de l'archive (`asarUnpack`) le jour où ce projet
  ajoute `electron-builder`/`electron-forge`.
