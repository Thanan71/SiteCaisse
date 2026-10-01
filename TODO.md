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
│       ├── VenteFormModal.vue  # Modal ajout/modification
│       ├── VentesTable.vue     # Table de ventes réutilisable
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
  - [x] id, nom, nom_boutique, password_hash, role (permanent/temporaire), est_actif
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

## Rôle Dev et boîte à idées

Implémenté et validé localement le 01/10/2026 : 336 tests unitaires, 18 E2E, Biome, build et vérification visuelle mobile/tablette/desktop. Schéma et migration SQL testés sur PostgreSQL isolé (PGlite), y compris les refus d’accès direct aux comptes et suggestions. La procédure d'activation est décrite dans [le guide de mise en service](docs/activation-dev-suggestions.md) : publier le code avec la clé serveur, appliquer la migration puis promouvoir le premier compte Dev.

### 6. Rôle Dev
- [x] Ajouter un rôle `dev` au-dessus du rôle `admin`
- [x] Définir une hiérarchie claire des permissions : `dev > admin > permanent/temporaire`
- [x] Permettre au rôle `dev` d'accéder à toutes les fonctionnalités administrateur
- [x] Ajouter des fonctionnalités réservées au rôle `dev`
- [x] Adapter les middlewares backend pour reconnaître et sécuriser le rôle `dev`
- [x] Adapter le frontend (router, navbar, stores et composants) pour gérer le rôle `dev`
- [x] Masquer les comptes Dev et leurs mots de passe dans la liste des utilisateurs et son API
- [x] Ajouter des tests unitaires et E2E sur les permissions du rôle `dev`

### 7. Suggestions / boîte à idées
- [x] Ajouter un formulaire "Suggestion / Boîte à idées" accessible aux utilisateurs connectés
- [x] Permettre de saisir au minimum un titre et une description
- [x] Enregistrer les suggestions en base de données avec l'auteur et la date de création
- [x] Ajouter un espace de consultation des suggestions réservé au rôle `dev`
- [x] Empêcher les admins et les artisans de consulter la liste complète des suggestions
- [x] Permettre au rôle `dev` de marquer une suggestion comme nouvelle, en cours, acceptée ou refusée
- [x] Ajouter les tests backend, frontend et E2E associés
- [x] Contraintes UI/UX du formulaire de suggestion :
  - [x] Intégrer l'accès à la boîte à idées de manière visible mais non intrusive dans la navigation
  - [x] Conserver le design system existant du site (boutons, champs, espacements, typographie, modales/cartes)
  - [x] Limiter le formulaire aux champs réellement utiles afin de garder une soumission rapide
  - [x] Afficher clairement les champs obligatoires et les limites de caractères
  - [x] Ajouter un compteur de caractères lorsque pertinent
  - [x] Désactiver le bouton d'envoi pendant la soumission pour éviter les doublons
  - [x] Afficher un retour immédiat et explicite après succès ou erreur
  - [x] Ne pas perdre le contenu saisi en cas d'erreur réseau ou de validation
  - [x] Prévoir des états loading, vide et erreur cohérents avec le reste de l'application
  - [x] Rendre le formulaire entièrement utilisable au clavier avec labels explicites et focus visible
  - [x] Assurer un contraste suffisant et ne pas transmettre une information uniquement par la couleur
  - [x] Garantir une utilisation confortable sur mobile, tablette et desktop
  - [x] Éviter les modales trop hautes : contenu scrollable et actions principales toujours facilement accessibles
- [x] Contraintes UI/UX de l'espace Dev :
  - [x] Afficher les suggestions dans une liste lisible avec titre, auteur, date et statut immédiatement identifiables
  - [x] Utiliser des badges de statut cohérents pour nouvelle, en cours, acceptée et refusée
  - [x] Prévoir un tri et des filtres au minimum par statut et date
  - [x] Permettre d'ouvrir le détail d'une suggestion sans perdre la position dans la liste
  - [x] Rendre le changement de statut rapide tout en évitant les modifications accidentelles
  - [x] Afficher clairement lorsqu'aucune suggestion ne correspond aux filtres
  - [x] Ne jamais afficher dans l'interface des non-dev un lien ou un compteur révélant la liste privée des suggestions
  - [x] Prévoir une pagination ou un chargement progressif si le volume de suggestions augmente

## Fiabilisation des rapports

### 8. Robustesse des calculs et récupération des données
- [ ] Fiabiliser la récupération des ventes utilisées dans les rapports lorsque la base grossit
- [ ] Ajouter une pagination ou un chargement par lots pour éviter les limites de lignes Supabase sur les requêtes dites "sans pagination"
- [ ] Vérifier également l'exhaustivité du chargement des lignes `vente_articles`
- [ ] Garantir que les totaux par artisan restent exacts au-delà de 1 000 ventes et/ou 1 000 lignes d'articles
- [ ] Ajouter des tests avec un volume de données supérieur aux limites par défaut de l'API
- [ ] Comparer les calculs de rapports avec les données réelles de production dès que le projet Supabase SiteCaisse est accessible
- [ ] Ajouter un contrôle de cohérence entre total global, totaux par artisan et totaux mensuels
- [ ] Documenter les limites et hypothèses du calcul des rapports
- [ ] Étudier le besoin de figer historiquement le rôle et le taux de commission appliqués au moment de la vente afin qu'un changement futur de taux ne recalcule pas rétroactivement les anciens rapports

## Améliorations futures possibles
- [ ] Mode hors-ligne (PWA)
- [x] Tests unitaires et E2E
- [ ] Notifications/alertes
- [ ] Export PDF des rapports
- [ ] Mode sombre
- [x] Ajout d'un service logger pour log toutes les action en bdd et ajout sur la page admin l'acces au log
