# Refactoring SOLID

## Objectif

Analyser le projet SiteCaisse sous l'angle des principes SOLID et appliquer les
refactorisations sûres sans modifier les contrats publics de l'API ni les ecrans existants.

## Diagnostic

Le projet respectait deja plusieurs bonnes pratiques :

- le front Vue est majoritairement decoupe en vues, composants, stores Pinia et composables ;
- les appels HTTP sont centralises dans `src/services/api.js` ;
- les commissions, les logs et les parametres avaient deja leurs services backend ;
- les routes sensibles utilisent un middleware d'authentification.

Les principaux ecarts SOLID etaient concentres cote backend :

- `api/models.cjs` avait trop de responsabilites : acces Supabase, formatage des ventes,
  aggregation par artisan et aggregation par mois ;
- `api/rapportsController.cjs` melangeait HTTP, orchestration de donnees, recuperation des
  parametres et calcul des commissions ;
- `api/ventesController.cjs` contenait la validation metier des ventes directement dans les
  routes ;
- `api/adminController.cjs` melangeait routes Express, acces base, hachage des mots de passe,
  generation de mots de passe et regles admin.

## Modifications appliquees

### 1. Service d'agregation des ventes

Fichier ajoute : `api/services/venteAggregationService.cjs`

- Extraction des calculs purs de rapports : resume des articles, resume des ventes, filtrage
  par artisan, groupement par artisan et groupement par mois.
- `api/models.cjs` conserve le chargement Supabase et delegue l'agregation au service.
- Gain SOLID : meilleure responsabilite unique (SRP) et logique testable sans base de donnees.

### 2. Service de rapports

Fichier ajoute : `api/services/rapportService.cjs`

- Centralisation de l'orchestration des rapports : donnees de ventes, parametres de commission
  et enrichissement des totaux CB.
- `api/rapportsController.cjs` ne porte plus les calculs de commission.
- Gain SOLID : le controleur depend d'un cas d'usage haut niveau au lieu de connaitre tous les
  details de calcul.

### 3. Service de validation des ventes

Fichier ajoute : `api/services/venteValidationService.cjs`

- Extraction de la validation des articles, des types de paiement et des parametres de liste.
- Ajout d'erreurs de validation explicites pour garder les reponses HTTP en 400.
- Controle explicite des IDs invalides sur modification et suppression de vente.
- Gain SOLID : les routes de ventes sont plus courtes et la validation est reutilisable.

### 4. Service admin utilisateurs

Fichier ajoute : `api/services/adminUserService.cjs`

- Extraction des operations utilisateurs admin : liste, creation, suppression, commission
  personnalisee, reset mot de passe et prolongation temporaire.
- Deplacement du hachage `bcrypt`, de la generation de mot de passe et des requetes Supabase
  hors du controleur.
- Ajout d'erreurs domaine `AdminUserError` pour distinguer les erreurs attendues des erreurs
  serveur.
- Gain SOLID : `adminController` gere davantage HTTP, tandis que le service gere les cas d'usage.

### 5. Corrections de conformite Biome

- Correction d'une concatenation dans `src/utils/formatters.js`.
- Formatage sans changement fonctionnel de quelques fichiers signales par `npm run check`.

## Fichiers modifies

- `api/models.cjs`
- `api/rapportsController.cjs`
- `api/ventesController.cjs`
- `api/adminController.cjs`
- `api/services/parametresService.cjs`
- `src/components/GraphiquesRapports.vue`
- `src/components/SummaryCard.vue`
- `src/composables/useCommissions.js`
- `src/composables/useLogs.js`
- `src/store/artisans.js`
- `src/utils/formatters.js`
- `src/views/RapportsView.vue`
- `src/views/VentesView.vue`

## Fichiers ajoutes

- `api/services/venteAggregationService.cjs`
- `api/services/venteValidationService.cjs`
- `api/services/rapportService.cjs`
- `api/services/adminUserService.cjs`
- `REFACTORING_SOLID.md`

## Points conserves volontairement

- Les noms des routes et les formats de reponse API sont conserves.
- Le front n'a pas ete reorganise car il etait deja raisonnablement separe.
- Les migrations et le schema SQL n'ont pas ete modifies.
- Aucun changement de dependance n'a ete ajoute.

## Recommandations futures

- Ajouter des tests unitaires sur `venteAggregationService.cjs`, `venteValidationService.cjs`
  et `commissionService.cjs`.
- Extraire progressivement les operations d'authentification vers un `authService`.
- Remplacer les suppressions manuelles de ventes liees a un utilisateur par une contrainte SQL
  claire ou une transaction serveur si le backend evolue vers PostgreSQL direct.
- Ajouter une couche d'erreurs HTTP commune pour harmoniser les controles admin, ventes et auth.
