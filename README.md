# SiteCaisse

SiteCaisse est une application de caisse et gestion des ventes pour artisans, construite avec Vue 3, Vite, Pinia et un backend Express + Supabase. Elle permet de gérer les utilisateurs, enregistrer des ventes, consulter des rapports et administrer des comptes.

## 🚀 Stack

- Frontend
  - Vue 3
  - Vite
  - Pinia
  - Vue Router
  - Axios
  - Chart.js / vue-chartjs
- Backend
  - Express
  - Supabase (PostgreSQL)
  - JSON Web Tokens (JWT)
  - bcryptjs
- Déploiement
  - Vercel

## ✨ Fonctionnalités principales

- Authentification utilisateur via JWT
- Gestion des rôles : `admin`, `permanent`, `temporaire`
- Enregistrement des ventes avec ligne d’articles
- Filtrage par date et type de paiement
- Vue synthétique des ventes mensuelles et rapports
- Interface d’administration réservée aux admins
- Gestion des mots de passe et changement obligatoire
- Seed initial d’utilisateurs de démonstration
- Journalisation des actions et des erreurs

## 🧩 Architecture

- `src/` : application Vue
  - `main.js` : initialisation de Vue, Pinia et Vue Router
  - `router/` : définition des routes et guard d’authentification
  - `store/` : stores Pinia, notamment `auth.js`
  - `services/api.js` : configuration Axios centralisée
  - `views/` : pages principales (`Login`, `Ventes`, `Rapports`, `Admin`, `ChangePassword`)
  - `components/` : composants réutilisables
- `api/` : backend Express
  - `index.cjs` : point d’entrée serveur
  - `authController.cjs` : login, profil, changement de mot de passe
  - `ventesController.cjs`, `rapportsController.cjs`, `adminController.cjs` : API métier
  - `db.cjs` : connexion Supabase
  - `models.cjs` : logique de données et accès aux tables Supabase
- `supabase-schema.sql` : schéma des tables nécessaires
- `vercel.json` : configuration de déploiement Vercel

## ⚙️ Prérequis

- Node.js 18+ (ou version compatible)
- npm
- Compte Supabase
- Projet Vercel (optionnel pour déploiement)

## 📦 Installation locale

1. Cloner le dépôt

```bash
git clone <repo_url>
cd SiteCaisse
```

2. Installer les dépendances

```bash
npm install
```

3. Configurer les variables d’environnement

Créer un fichier `.env` ou `.env.local` à la racine avec :

```env
VITE_API_URL=http://localhost:3001
VITE_PUBLIC_SUPABASE_URL=https://<votre-projet>.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=<clé-anonyme-supabase>
SUPABASE_SERVICE_ROLE_KEY=<clé-service-role-supabase>
JWT_SECRET=<secret-jwt-personnel>
PORT=3001
```

> Note : `SUPABASE_SERVICE_ROLE_KEY` est recommandé pour permettre au backend d’exécuter les opérations Supabase sans RLS. Ne partagez jamais cette clé publiquement.

4. Créer les tables Supabase

- Exécuter `supabase-schema.sql` depuis l’éditeur SQL du dashboard Supabase.
- Vérifier que les tables `users`, `ventes` et `action_logs` sont présentes.

5. Lancer l’application

- Démarrer le backend :

```bash
npm run start
```

- Démarrer le frontend :

```bash
npm run dev
```

6. Ouvrir le frontend

- Accéder à `http://localhost:5173`

## 🧪 Scripts utiles

- `npm run dev` : démarre Vite en mode développement
- `npm run build` : génère le build de production
- `npm run preview` : prévisualisation du build
- `npm run start` : démarre le backend Express localement
- `npm run format` : formate le code avec Biome
- `npm run lint` : lance Biome lint
- `npm run check` : vérifie le projet avec Biome
- `npm run check:fix` : corrige les erreurs Biome automatiquement
- `npm run vercel-build` : build utilisé par Vercel

## 🔌 API disponibles

### Authentification

- `POST /api/auth/login`
  - Body : `{ email, password }`
  - Retourne : `{ token, user, password_change_required }`
- `GET /api/auth/me`
  - Header : `Authorization: Bearer <token>`
  - Retourne : profil de l’utilisateur
- `POST /api/auth/change-password`
  - Body : `{ newPassword, currentPassword? }`
  - Permet de changer le mot de passe

### Ventes

- `POST /api/ventes` : création d’une vente
- `GET /api/ventes` : récupération des ventes
- `PUT /api/ventes/:id` : modification d’une vente
- `DELETE /api/ventes/:id` : suppression d’une vente

### Rapports

- `GET /api/rapports` : rapports globaux et mensuels
- `GET /api/rapports/mois` : rapports par mois

### Administration

- `GET /api/admin/users` : liste des utilisateurs actifs
- `PUT /api/admin/users/:id` : mise à jour d’un utilisateur
- `POST /api/admin/users` : création d’un utilisateur

## 🧾 Schéma de base de données

Le fichier `supabase-schema.sql` déclare :

- `users` : comptes, rôles, état actif, mot de passe, date de fin pour accès temporaire
- `ventes` : ventes enregistrées avec type de paiement, artisan, vendeur, date et montant
- `action_logs` : journalisation des actions utilisateur et erreurs

## 🔐 Rôles et autorisations

- `admin` : accès à la page Admin et gestion des utilisateurs
- `permanent` : accès complet à la caisse et aux rapports
- `temporaire` : accès limité avec date d’expiration possible

## 📄 Notes importantes

- Le frontend stocke le `token` JWT et les données utilisateur dans `localStorage`
- Le backend vérifie le token pour chaque route protégée
- Les utilisateurs temporaires dont `date_fin` est dépassée ne peuvent plus se connecter
- La clé `JWT_SECRET` doit être sécurisée en environnement de production

## 📍 Déploiement Vercel

La configuration `vercel.json` expose :

- `api/*` vers `api/index.cjs`
- toutes les autres routes vers `index.html`

Sur Vercel, le build front-end est généré par `npm run vercel-build`.

## 🧰 Fichiers importants

- `src/main.js`
- `src/router/index.js`
- `src/store/auth.js`
- `src/services/api.js`
- `api/index.cjs`
- `api/authController.cjs`
- `api/models.cjs`
- `supabase-schema.sql`
- `vercel.json`

## 📌 Exemple de comptes de démonstration

Le seed initial crée plusieurs utilisateurs avec le mot de passe `password123` :

- `admin@sitecaisse.fr` (admin)
- `marcel@artisan.fr` (permanent)
- `sophie@artisan.fr` (permanent)
- `jean@artisan.fr` (permanent)
- `lucas@artisan.fr` (temporaire)
- `emma@artisan.fr` (temporaire)

---

Pour toute question liée au projet ou pour ajouter des améliorations, consultez le code des contrôleurs dans `api/` et des vues dans `src/views/`.