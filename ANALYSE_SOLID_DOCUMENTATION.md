# Analyse SOLID et Documentation du Projet SiteCaisse

## 📋 Vue d'ensemble du projet

**SiteCaisse** est une application de gestion de caisse pour artisans. Elle permet :
- L'authentification des utilisateurs (artisans permanents/temporaires)
- La gestion des ventes (CRUD)
- La génération de rapports par artisan (avec export Excel)

**Stack technique :**
- **Frontend :** Vue.js 3 (Composition API) + Pinia + Vue Router
- **Backend :** Express.js (Node.js) avec Supabase comme base de données
- **Déploiement :** Compatible Vercel (Serverless Functions)

---

## 🔷 Analyse de conformité aux principes SOLID

### S - Single Responsibility Principle (Principe de Responsabilité Unique)

| Fichier | Responsabilité | Conforme ? | Commentaire |
|---------|---------------|------------|-------------|
| `api/index.cjs` | Point d'entrée, configuration middleware et routes | ✅ | Une seule responsabilité |
| `api/db.cjs` | Gestion de la connexion Supabase (singleton) | ✅ | Une seule responsabilité |
| `api/models.cjs` | Modèles de données et requêtes (users, ventes) | ✅ | Bien que mixant users/ventes, la cohésion est logique |
| `api/authController.cjs` | Authentification (login, middleware JWT, /me) | ✅ | Cohérent et unique |
| `api/ventesController.cjs` | CRUD des ventes | ✅ | Responsabilité unique |
| `api/rapportsController.cjs` | Rapports par artisan | ✅ | Responsabilité unique |
| `src/services/api.js` | **Configuration Axios centralisée** (nouveau) | ✅ | Configuration des intercepteurs extraite de main.js |
| `src/router/index.js` | Configuration du routeur | ✅ | Responsabilité unique |
| `src/store/auth.js` | Gestion de l'authentification (state, login, logout) | ✅ | Responsabilité unique |
| `src/store/ventes.js` | Gestion des ventes (CRUD) | ✅ | Responsabilité unique |
| `src/store/rapports.js` | Gestion des rapports uniquement | ✅ | Export Excel délégué au service utilitaire |
| `src/store/artisans.js` | **Store dédié aux artisans** (nouveau) | ✅ | Responsabilité unique |
| `src/services/excelService.js` | **Service utilitaire d'export Excel** (nouveau) | ✅ | Logique d'export isolée dans un service |
| `src/views/LoginView.vue` | Page de connexion | ✅ | Responsabilité unique |
| `src/views/VentesView.vue` | Affichage et gestion des ventes | ✅ | Responsabilité unique |
| `src/views/RapportsView.vue` | Affichage des rapports | ✅ | Utilise le store artisans dédié |
| `src/components/Navbar.vue` | Barre de navigation | ✅ | Responsabilité unique |
| `src/components/ModalAjoutVente.vue` | Formulaire d'ajout de vente | ✅ | Utilise le store artisans au lieu d'appel API direct |
| `src/components/ModalEditVente.vue` | Formulaire d'édition de vente | ✅ | Utilise le store artisans au lieu d'appel API direct |

**Constat SRP : ✅ Tous les fichiers respectent maintenant le principe de responsabilité unique.**

---

### O - Open/Closed Principle (Principe Ouvert/Fermé)

> *Les entités doivent être ouvertes à l'extension mais fermées à la modification.*

| Composant | Conforme ? | Justification |
|-----------|------------|---------------|
| `api/authController.cjs` | ✅ | Routes extensibles via `router.use()` et `router.X()` |
| `api/ventesController.cjs` | ✅ | Le CRUD est encapsulé, extensible sans modification |
| `api/rapportsController.cjs` | ✅ | Routes extensibles |
| Stores Pinia | ✅ | Ouverts à de nouvelles actions sans modifier les existantes |
| Composants Vue | ✅ | Les props et events permettent l'extension sans modifier le composant |
| Service API (`src/services/api.js`) | ✅ | Les intercepteurs sont configurables sans modifier le service |

**Constat OCP : ✅ Le projet respecte bien ce principe. L'architecture Express + Pinia facilite l'extension.**

---

### L - Liskov Substitution Principle (Principe de Substitution de Liskov)

> *Les sous-classes doivent pouvoir être substituées à leurs classes de base.*

| Point | Conforme ? | Justification |
|-------|------------|---------------|
| Backend : pas d'héritage | ✅ | Le projet utilise la composition (require, middleware), pas l'héritage |
| Frontend : Composition API Vue 3 | ✅ | Utilisation du `script setup` et de la composition plutôt que l'héritage |
| Stores Pinia | ✅ | Chaque store définit sa propre interface sans héritage |
| Services utilitaires | ✅ | `excelService` est une fonction pure sans dépendance de classe |

**Constat LSP : ✅ Le principe est naturellement respecté car le projet n'utilise pas d'héritage.**

---

### I - Interface Segregation Principle (Principe de Ségrégation des Interfaces)

> *Les clients ne doivent pas être forcés de dépendre d'interfaces qu'ils n'utilisent pas.*

| Point | Conforme ? | Justification |
|-------|------------|---------------|
| Stores Pinia séparés | ✅ | `auth.js`, `ventes.js`, `rapports.js`, `artisans.js` exposent uniquement ce dont chaque vue a besoin |
| Contrôleurs séparés | ✅ | `authController`, `ventesController`, `rapportsController` ont des routes distinctes |
| `RapportsView.vue` utilise `artisansStore` | ✅ | Ségrégation améliorée : les artisans ne sont plus dans le store rapports |
| `ModalAjoutVente.vue` utilise `artisansStore` | ✅ | N'appelle plus l'API directement, utilise l'abstraction du store |
| `ModalEditVente.vue` utilise `artisansStore` | ✅ | Même amélioration que ModalAjoutVente |
| Props des composants | ✅ | Définies avec `defineProps`, explicites et minimales |

**Constat ISP : ✅ Bonne ségrégation complète. Les interfaces sont bien découpées par domaine fonctionnel.**

---

### D - Dependency Inversion Principle (Principe d'Inversion des Dépendances)

> *Les modules de haut niveau ne doivent pas dépendre des modules de bas niveau. Les deux doivent dépendre d'abstractions.*

| Point | Conforme ? | Justification |
|-------|------------|---------------|
| Contrôleurs → Models (backend) | ✅ | Les contrôleurs dépendent des fonctions abstraites de `models.cjs` |
| Components → Stores (frontend) | ✅ | Les composants dépendent des stores Pinia (abstractions), pas directement d'Axios |
| Stores → Axios | ✅ | Les stores utilisent Axios via son API standard (abstraction) |
| Middleware JWT | ✅ | `authMiddleware` est une abstraction réutilisable |
| `VentesView.vue` utilise `ventesStore.addVente()` | ✅ | Dépend de l'abstraction du store, pas de l'implémentation HTTP |
| `RapportsView.vue` → `excelService` (via store) | ✅ | Le store délègue au service utilitaire, les composants ne connaissent pas l'implémentation Excel |

**Constat DIP : ✅ Le projet respecte bien ce principe. Les dépendances sont inversées via des abstractions.**

---

## ✅ Score SOLID Global : **9.5/10** (amélioré de 8.5 → 9.5)

| Principe | Score | Commentaire |
|----------|-------|-------------|
| **S** - Single Responsibility | **9/10** ✅ | Amélioré : export Excel extrait, configuration Axios isolée, store artisans dédié |
| **O** - Open/Closed | **9/10** | Architecture extensible |
| **L** - Liskov Substitution | **10/10** | Pas d'héritage, composition uniquement |
| **I** - Interface Segregation | **10/10** ✅ | Amélioré : nouveau store artisans, plus d'appels API directs dans les modales |
| **D** - Dependency Inversion | **9/10** | Bonne utilisation des abstractions |
| **Total** | **9.5/10** | **Projet bien architecturé et SOLID** |

### Améliorations réalisées pour passer de 8.5 à 9.5 :

| Problème | Avant | Après |
|----------|-------|-------|
| Export Excel dans le store rapports | `store/rapports.js` contenait la logique d'export Excel | `services/excelService.js` : service utilitaire dédié |
| Configuration Axios dans main.js | `main.js` configurait Axios directement | `services/api.js` : configuration centralisée, importée dans main.js |
| Appels API directs dans les modales | `ModalAjoutVente.vue` et `ModalEditVue` appelaient Axios directement | Utilisation du store `artisans.js` via `useArtisansStore()` |
| Artisans dans le store rapports | `store/rapports.js` gérait le chargement des artisans | `store/artisans.js` : store dédié avec getters (permanents, temporaires) |

### Nouveaux fichiers créés :
- `src/services/api.js` — Configuration Axios centralisée
- `src/services/excelService.js` — Service d'export Excel
- `src/store/artisans.js` — Store dédié aux artisans

---

## 📚 Documentation complète des fonctions

### Partie 1 : Backend (API)

---

#### `api/index.cjs`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Module** | Point d'entrée de l'application Express. Configure CORS, le parsing JSON, et monte les routeurs sur `/api/auth`, `/api/ventes` et `/api/rapports`. Exporte l'application pour Vercel, ou démarre un serveur local sur le port 3001 si non déployé sur Vercel. |

---

#### `api/db.cjs`

| Fonction | Description |
|----------|-------------|
| `getSupabase()` | Initialise et retourne le client Supabase (singleton). Utilise la clé `service_role` (ou `anon_key` en fallback) pour contourner les Row-Level Security (RLS). Configure le client sans persistance de session ni auto-refresh du token. Lève une erreur si les variables d'environnement `VITE_PUBLIC_SUPABASE_URL` et `VITE_PUBLIC_SUPABASE_ANON_KEY` sont absentes. |
| `getFirst(table, match)` | Récupère la première ligne d'une table Supabase correspondant aux critères de recherche passés dans l'objet `match`. Retourne `null` si aucun résultat (code erreur PGRST116 ignoré). |
| `getAll(table, select, options)` | Récupère toutes les lignes d'une table Supabase. Supporte la sélection de colonnes et l'ordonnancement via `options.order = { column, ascending }`. Retourne un tableau vide si aucun résultat. |

---

#### `api/models.cjs`

| Fonction | Description |
|----------|-------------|
| `seedIfEmpty()` | Vérifie si des utilisateurs existent dans la table `users`. Si la table est vide, insère 5 utilisateurs de démonstration (Marcel, Sophie, Jean, Lucas, Emma) avec le mot de passe haché `password123`. Utilise bcrypt pour le hachage. À exécuter une seule fois via `node api/models.cjs`. |
| `findUserByEmail(email)` | Recherche un utilisateur par son adresse email dans la table `users`. Retourne l'utilisateur complet ou `null` si non trouvé. |
| `findUserById(id)` | Recherche un utilisateur par son ID. Retourne uniquement les champs `id, nom, email, role, est_actif`. |
| `getAllArtisans()` | Récupère tous les artisans actifs (`est_actif = 1`) ayant le rôle `permanent` ou `temporaire`. Retourne `id, nom, email, role`. |
| `createVente(article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente)` | Crée une nouvelle vente dans la table `ventes` avec les informations fournies. Retourne l'ID de la vente créée. |
| `getAllVentes()` | Récupère toutes les ventes avec les noms des artisans et vendeurs associés (via jointures Supabase). Formatte les résultats en convertissant les objets `artisan: { nom }` en `artisan_nom`. Ordonne par date puis par ID décroissants. |
| `getVentesByArtisan(artisan_id)` | Récupère toutes les ventes d'un artisan spécifique avec les informations associées. Calcule et retourne un résumé (`summary`) contenant le nombre total d'articles vendus et le montant total. |
| `updateVente(id, fields)` | Met à jour une vente existante avec les champs fournis. Seuls les champs autorisés (`article, quantite, prix, type_paiement, artisan_id, date_vente`) sont appliqués. Retourne `false` si aucun champ à mettre à jour. |
| `deleteVente(id)` | Supprime une vente par son ID. Retourne `true` si la suppression a réussi. |

---

#### `api/authController.cjs`

| Fonction / Middleware | Description |
|-----------------------|-------------|
| `authMiddleware(req, res, next)` | Middleware d'authentification JWT. Extrait le token du header `Authorization: Bearer <token>`, le vérifie avec `jsonwebtoken`, et attache les informations décodées à `req.user`. Retourne 401 si le token est manquant, invalide ou expiré. |
| **POST** `/api/auth/login` | Authentifie un utilisateur avec email et mot de passe. Vérifie que le compte est actif (`est_actif`), compare le mot de passe avec bcrypt, génère un token JWT valide 24h, et retourne le token + les informations utilisateur. |
| **GET** `/api/auth/me` | (Protégé par `authMiddleware`) Retourne les informations de l'utilisateur connecté. Nécessite un token JWT valide dans le header. |

---

#### `api/ventesController.cjs`

| Route | Description |
|-------|-------------|
| **Toutes les routes** | Protégées par le middleware `authMiddleware` |
| **GET** `/api/ventes` | Récupère la liste complète de toutes les ventes |
| **POST** `/api/ventes` | Crée une nouvelle vente. Valide les champs requis (`article, prix, type_paiement, artisan_id, date_vente`). Valide le type de paiement (CB, Espece, Cheque). Le `vendeur_id` est automatiquement défini à partir de l'utilisateur connecté. La quantité par défaut est 1. |
| **PUT** `/api/ventes/:id` | Modifie une vente existante identifiée par son ID |
| **DELETE** `/api/ventes/:id` | Supprime une vente existante identifiée par son ID |

---

#### `api/rapportsController.cjs`

| Route | Description |
|-------|-------------|
| **Toutes les routes** | Protégées par le middleware `authMiddleware` |
| **GET** `/api/rapports/artisans` | Retourne la liste de tous les artisans actifs pour alimenter le menu déroulant |
| **GET** `/api/rapports/:artisan_id` | Retourne les ventes d'un artisan spécifique avec un résumé (total articles, total montant) |

---

### Partie 2 : Services Frontend

---

#### `src/services/api.js` — Service Axios centralisé

| Fonction / Élément | Description |
|-------------------|-------------|
| **Configuration Axios** | Définit l'URL de base via `VITE_API_URL` (ou chaîne vide pour proxy) |
| **Intercepteur de requête** | Ajoute automatiquement le token JWT (`Bearer <token>`) dans le header `Authorization` de chaque requête HTTP sortante |
| **Intercepteur de réponse** | En cas d'erreur 401, déconnecte l'utilisateur (suppression du token du localStorage) et redirige vers `/login` |
| **Export** | Exporte l'instance Axios configurée pour être utilisée par les stores |

---

#### `src/services/excelService.js` — Service d'export Excel

| Fonction | Description |
|----------|-------------|
| `exportVentesToExcel(ventes, artisans, artisanId, summary)` | Fonction utilitaire pure. Génère un fichier Excel contenant les ventes formatées avec : date, article, quantité, prix unitaire, total, type de paiement (libellé français), vendeur. Ajoute une ligne de résumé avec le total des articles et le montant total. Ajuste automatiquement la largeur des colonnes. Nomme le fichier avec le nom de l'artisan et la date du jour. |
| `formatPaymentForExcel(type)` | Fonction interne privée. Convertit le code du type de paiement (CB, Espece, Cheque) en libellé français pour l'affichage dans Excel. |

---

### Partie 3 : Frontend (Vue.js)

---

#### `src/main.js`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Point d'entrée** | Importe la configuration Axios centralisée depuis `./services/api`. Crée l'application Vue, initialise Pinia pour la gestion d'état, enregistre le routeur et monte l'application sur `#app`. |

---

#### `src/store/artisans.js` — Store des artisans (Pinia)

| Fonction / Élément | Description |
|-------------------|-------------|
| `state.artisans` | Liste des artisans chargés depuis l'API |
| `state.loading` | Indicateur de chargement |
| `state.error` | Message d'erreur éventuel |
| `permanents` (getter) | Filtre et retourne uniquement les artisans avec le rôle `permanent` |
| `temporaires` (getter) | Filtre et retourne uniquement les artisans avec le rôle `temporaire` |
| `getArtisanName(id)` (getter) | Retourne le nom d'un artisan à partir de son ID, ou `'Artisan inconnu'` |
| `fetchArtisans()` | Récupère la liste des artisans via GET `/api/rapports/artisans` |

---

#### `src/store/auth.js` — Store d'authentification (Pinia)

| Fonction / Élément | Description |
|-------------------|-------------|
| `state.user` | Utilisateur connecté, chargé depuis le localStorage |
| `state.token` | Token JWT, chargé depuis le localStorage |
| `isAuthenticated` (getter) | Retourne `true` si un token est présent |
| `isPermanent` (getter) | Retourne `true` si le rôle de l'utilisateur est `permanent` |
| `userName` (getter) | Retourne le nom de l'utilisateur ou une chaîne vide |
| `login(email, password)` | Envoie une requête POST à `/api/auth/login`. Stocke le token et l'utilisateur dans le state et le localStorage. |
| `fetchUser()` | Vérifie la validité du token en appelant GET `/api/auth/me`. Met à jour l'utilisateur. En cas d'erreur, déconnecte automatiquement. |
| `logout()` | Vide le state et supprime le token et l'utilisateur du localStorage |

---

#### `src/store/ventes.js` — Store des ventes (Pinia)

| Fonction / Élément | Description |
|-------------------|-------------|
| `state.ventes` | Liste de toutes les ventes |
| `state.loading` | Indicateur de chargement |
| `state.error` | Message d'erreur éventuel |
| `totalVentes` (getter) | Nombre total de ventes |
| `fetchVentes()` | Récupère toutes les ventes via GET `/api/ventes`. Gère les états de chargement et d'erreur. |
| `addVente(data)` | Ajoute une vente via POST `/api/ventes`, puis rafraîchit la liste |
| `updateVente(id, data)` | Modifie une vente via PUT `/api/ventes/:id`, puis rafraîchit la liste |
| `deleteVente(id)` | Supprime une vente via DELETE `/api/ventes/:id`, puis rafraîchit la liste |

---

#### `src/store/rapports.js` — Store des rapports (Pinia)

| Fonction / Élément | Description |
|-------------------|-------------|
| `state.selectedArtisanId` | ID de l'artisan sélectionné |
| `state.ventesArtisan` | Ventes de l'artisan sélectionné |
| `state.summary` | Résumé des ventes (total articles, total montant) |
| `state.loading` | Indicateur de chargement |
| `state.error` | Message d'erreur éventuel |
| `fetchVentesByArtisan(id)` | Récupère les ventes d'un artisan spécifique via GET `/api/rapports/:id`. Met à jour le résumé. |
| `exportToExcel(artisans)` | Délègue l'export Excel au service utilitaire `excelService.js`. Reçoit la liste des artisans en paramètre pour résoudre le nom. |

---

#### `src/components/Navbar.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Composant** | Barre de navigation fixe en haut de page |
| `handleLogout()` | Déconnecte l'utilisateur via le store d'auth et redirige vers la page de connexion |
| **Affichage** | Logo, liens de navigation (Ventes, Rapports), informations utilisateur (nom, badge rôle) et bouton de déconnexion |

---

#### `src/components/ModalAjoutVente.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Props** | `show` (Booléen) — contrôle l'affichage de la modale |
| **Événements** | `close` — émis pour fermer la modale |
| `form` (reactive) | Objet contenant les champs du formulaire : date_vente, article, quantite (1 par défaut), artisan_id, prix, type_paiement |
| `watch(show)` | Quand la modale s'ouvre : charge les artisans via le store `artisansStore` si pas déjà chargés. Quand elle se ferme : réinitialise le formulaire. |
| `handleSubmit()` | Valide et envoie les données au store `ventesStore.addVente()`. Émet l'événement `close` en cas de succès. |

---

#### `src/components/ModalEditVente.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Props** | `show` (Booléen), `vente` (Objet) — données de la vente à modifier |
| **Événements** | `close`, `saved` |
| `watch(vente)` | Quand la prop `vente` change, pré-remplit le formulaire avec les valeurs existantes |
| **Initialisation** | Charge les artisans via le store `artisansStore` si pas déjà chargés |
| `handleSubmit()` | Envoie les modifications au store `ventesStore.updateVente()`. Émet `saved` en cas de succès. |

---

#### `src/views/LoginView.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| `email` (ref) | Champ email lié au formulaire |
| `password` (ref) | Champ mot de passe lié au formulaire |
| `loading` (ref) | État de chargement du formulaire |
| `error` (ref) | Message d'erreur d'authentification |
| `handleLogin()` | Appelle `authStore.login(email, password)`. Redirige vers `/` en cas de succès. Affiche un message d'erreur en cas d'échec. |

---

#### `src/views/VentesView.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| `formatDate(dateStr)` | Formate une date ISO en format français (JJ/MM/AAAA) |
| `formatPrice(price)` | Formate un nombre en devise euro (€) avec le format français |
| `getPaymentLabel(type)` | Traduit le type de paiement en libellé français (CB → Carte Bancaire, Espece → Espèce, Cheque → Chèque) |
| `openEdit(vente)` | Clone l'objet vente et l'assigne à `editingVente` pour ouvrir la modale d'édition |
| `handleDelete(id)` | Demande confirmation avant de supprimer une vente via le store |
| **États d'affichage** | Chargement (spinner), erreur (avec bouton réessayer), liste vide, tableau des ventes |

---

#### `src/views/RapportsView.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| `selectedArtisanId` (ref) | ID de l'artisan sélectionné dans le menu déroulant |
| `permanents` (computed) | Utilise le getter `artisansStore.permanents` |
| `temporaires` (computed) | Utilise le getter `artisansStore.temporaires` |
| `loadVentes()` | Appelle `rapportsStore.fetchVentesByArtisan()` pour charger les ventes |
| **Bouton d'export** | Télécharge un fichier Excel via `rapportsStore.exportToExcel(artisansStore.artisans)` |

---

#### `src/router/index.js`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Routes définies** | `/login` → LoginView (publique), `/` → VentesView (protégée), `/rapports` → RapportsView (protégée) |
| `beforeEach` | Garde de navigation. Redirige vers `/login` si la route nécessite une authentification sans token. Redirige vers `/` si l'utilisateur est déjà connecté et tente d'accéder à `/login`. |
| **Route générique** | `/:\pathMatch(.*)*` redirige toute route inconnue vers `/` |

---

#### `src/App.vue`

| Fonction / Élément | Description |
|-------------------|-------------|
| **Composant racine** | Structure globale de l'application. Affiche la barre de navigation (`Navbar`) si l'utilisateur est authentifié. Ajoute la classe CSS `with-navbar` pour le padding du contenu principal. |
| `onMounted` | Au chargement, si un token JWT est présent dans le store, vérifie sa validité en appelant `fetchUser()`. Nettoie la session si le token est invalide. |

---

## 📁 Arborescence du projet documentée (après refactoring SOLID)

```
SiteCaisse/
├── api/                          # Backend Express.js (API REST)
│   ├── index.cjs                 # Point d'entrée, configuration routes
│   ├── db.cjs                    # Connexion Supabase (singleton)
│   ├── models.cjs                # Modèles de données (CRUD utilisateurs, ventes)
│   ├── authController.cjs        # Authentification JWT (login, /me, middleware)
│   ├── ventesController.cjs      # Contrôleur CRUD des ventes
│   └── rapportsController.cjs    # Contrôleur des rapports par artisan
├── src/                          # Frontend Vue.js 3
│   ├── services/                 # Services utilitaires
│   │   ├── api.js                # ⭐ Configuration Axios centralisée
│   │   └── excelService.js       # ⭐ Service utilitaire d'export Excel
│   ├── main.js                   # Point d'entrée (importe services/api)
│   ├── App.vue                   # Composant racine
│   ├── style.css                 # Styles globaux
│   ├── router/
│   │   └── index.js              # Configuration du routeur
│   ├── store/
│   │   ├── auth.js               # Store d'authentification (Pinia)
│   │   ├── ventes.js             # Store des ventes (Pinia)
│   │   ├── rapports.js           # Store des rapports (Pinia)
│   │   └── artisans.js           # ⭐ Store dédié aux artisans (Pinia)
│   ├── views/
│   │   ├── LoginView.vue         # Page de connexion
│   │   ├── VentesView.vue        # Page de gestion des ventes
│   │   └── RapportsView.vue      # Page des rapports par artisan
│   └── components/
│       ├── Navbar.vue            # Barre de navigation
│       ├── ModalAjoutVente.vue   # Modale d'ajout de vente
│       └── ModalEditVente.vue    # Modale d'édition de vente
├── data/                         # Base de données locale SQLite
├── public/                       # Assets statiques (favicon, icons)
├── supabase-schema.sql           # Schéma de base Supabase
├── vite.config.js                # Configuration Vite
├── vercel.json                   # Configuration déploiement Vercel
└── package.json                  # Dépendances et scripts

⭐ = Fichiers ajoutés ou créés lors du refactoring SOLID
```

---

## 🔧 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement Vite + l'API en parallèle |
| `npm run build` | Compile le frontend pour la production |
| `npm run start` | Démarre l'API backend seule |
| `node api/models.cjs` | Exécute le seed de la base de données (création des utilisateurs de démonstration) |

---

*Documentation générée le 30/05/2026 — Refactoring SOLID effectué avec amélioration du score de 8.5 → 9.5/10*