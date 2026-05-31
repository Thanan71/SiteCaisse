# Projet Site Caisse - TODO List

## Architecture MVC

```
SiteCaisse/
├── api/                        # Backend Express (API Routes)
│   ├── index.js                # Serveur Express
│   ├── db.js                   # Connexion SQLite
│   ├── models.js               # Modèles BDD
│   ├── authController.js       # Contrôleur Auth
│   ├── ventesController.js     # Contrôleur Ventes
│   └── rapportsController.js   # Contrôleur Rapports
├── src/                        # Frontend Vue.js
│   ├── main.js                 # Entry point
│   ├── App.vue                 # Root component
│   ├── style.css               # Styles globaux
│   ├── router/index.js         # Routes Vue
│   ├── store/                  # Pinia stores
│   │   ├── auth.js             # Store auth
│   │   ├── ventes.js           # Store ventes
│   │   └── rapports.js         # Store rapports
│   ├── views/                  # Pages
│   │   ├── LoginView.vue       # Connexion
│   │   ├── VentesView.vue      # Liste ventes
│   │   └── RapportsView.vue    # Rapports
│   └── components/             # Composants
│       ├── Navbar.vue          # Navigation
│       ├── ModalAjoutVente.vue # Modal ajout
│       └── GraphiquesRapports.vue # Graphiques statistiques
├── vercel.json                 # Config déploiement
├── vite.config.js              # Config Vite
└── package.json                # Dépendances
```

## Fonctionnalités

### 1. Authentification
- [x] Connexion artisans permanents (identifiant fixe)
- [x] Connexion artisans temporaires (identifiant temporaire)
- [x] Stockage session token
- [x] Protection routes privées
- [x] Déconnexion

### 2. Page Ventes
- [x] Liste des ventes (tableau)
  - [x] Nom article
  - [x] Nom artisan
  - [x] Prix
  - [x] Date
  - [x] Bouton modifier
  - [x] Pagination de la liste
  - [x] Filtres avancés
    - [x] Par date (début/fin)
    - [x] Par type de paiement
- [x] Modal ajout vente
  - [x] Date (auto)
  - [x] Nom article
  - [x] Quantité
  - [x] Nom artisan (sélection)
  - [x] Prix
  - [x] Type paiement (CB/Espèce/Chèque)
- [x] Enregistrement en BDD
  - [x] Données vente
  - [x] Nom vendeur (utilisateur connecté)

### 3. Page Rapports
- [x] Menu déroulant par artisan
  - [x] Liste produits vendus (nom, quantité, prix)
  - [x] Total articles vendus
  - [x] Somme totale
- [x] Export Excel (.xlsx)
- [x] Statistiques graphiques (Chart.js)
  - [x] Répartition par type de paiement (donut)
  - [x] Top articles les plus vendus (barres horizontales)
  - [x] Évolution mensuelle des ventes (ligne)
  - [x] Répartition par artisan (camembert, vue globale)
  - [x] Commissions CB intégrées

### 4. Base de Données
- [x] Table `users` (artisans)
  - [x] id, nom, email, password_hash, role (permanent/temporaire), est_actif
- [x] Table `ventes`
  - [x] id, article, quantite, prix, type_paiement, artisan_id, vendeur_id, date_vente, created_at

### 5. Déploiement Vercel
- [x] Configuration vercel.json
- [x] Build automatique
- [x] API serverless ready

## Pages/Routes

| Route | Page | Auth requise |
|-------|------|--------------|
| `/login` | Connexion | Non |
| `/` | Ventes | Oui |
| `/rapports` | Rapports | Oui |
| `/admin` | Administration | Admin |

## Flux de données

```
User Action → Vue Component → Pinia Store → API Express → Supabase/PostgreSQL
                    ↓                                              ↓
              Mise à jour UI ← Store ← Réponse JSON  ← Contrôleur
```

## Améliorations futures possibles
- [ ] Mode hors-ligne (PWA)
- [ ] Tests unitaires et E2E
- [ ] Notifications/alertes
- [ ] Export PDF des rapports
- [ ] Mode sombre
- [x] Ajout d'un service logger pour log toutes les action en bdd et ajout sur la page admin l'acces au log
