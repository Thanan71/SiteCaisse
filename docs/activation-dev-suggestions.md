# Activer le rôle Dev et la boîte à idées

Projet Supabase : `uylpcvhdlwkfmuwstljt` (SiteCaisse).
Projet Vercel : `site-caisse`, site public : https://site-caisse.vercel.app.

Les étapes distantes nécessitent un accès au projet SiteCaisse sur chaque plateforme.

## 1. Configurer et publier le nouveau code sur Vercel

Dans **Settings → Environment Variables**, vérifier pour **Production** :

- `VITE_PUBLIC_SUPABASE_URL` : `https://uylpcvhdlwkfmuwstljt.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur du même projet, déjà présente dans le
  fichier `.env` local. La garder côté serveur, sans préfixe `VITE_`.
- Conserver le `JWT_SECRET` existant et les autres variables du projet.

Publier la version de ce dossier qui contient `api/suggestionsController.cjs`,
`api/services/permissionService.cjs` et les nouvelles vues de suggestions.
Si Vercel déploie depuis GitHub, ces modifications locales doivent d'abord être
commitées et poussées sur la branche choisie. Attendre la réussite des tests CI
et du déploiement, puis vérifier que la connexion et les ventes fonctionnent.

Le déploiement doit précéder les étapes SQL : il active la clé serveur nécessaire
aux nouvelles protections des comptes et préserve un compte promu Dev au démarrage.
La boîte à idées devient utilisable après l'étape suivante.

## 2. Appliquer la migration Supabase

Dans le [SQL Editor de SiteCaisse](https://supabase.com/dashboard/project/uylpcvhdlwkfmuwstljt/sql/new),
exécuter le contenu de
[`20261001172633_add_dev_role_and_suggestions.sql`](../supabase-migrations/20261001172633_add_dev_role_and_suggestions.sql).
Les migrations historiques 001 à 011 doivent déjà être appliquées.

La migration ajoute le rôle Dev, crée la table des suggestions et protège les
comptes et suggestions contre l'accès direct avec la clé publique.

## 3. Activer le premier compte Dev

Dans le même SQL Editor, exécuter
[`promote-first-dev.sql`](../scripts/sql/promote-first-dev.sql).
Le résultat doit montrer le compte **Administration**, actif, avec le rôle **dev**.
Le mot de passe reste inchangé. Le script peut être relancé sans créer de compte.

## 4. Vérifier sur le site

1. Se déconnecter puis se reconnecter avec le compte **Administration**.
2. Vérifier la présence des liens **Admin**, **Suggestions** et **Dev**.
3. Envoyer une suggestion depuis **Suggestions**, puis la retrouver dans **Dev**.
4. Passer son statut à **Acceptée**, cliquer sur **Appliquer**, puis actualiser pour
   vérifier que la modification est conservée.
5. Avec un compte artisan ou admin ordinaire, vérifier que **Suggestions** est
   accessible et que `/dev/suggestions` redirige vers les ventes.
