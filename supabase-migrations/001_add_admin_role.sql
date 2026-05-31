-- Migration 001: Ajout du rôle 'admin' dans la contrainte CHECK de la table users
-- Exécuter ce script dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- après avoir déployé le nouveau code (api/adminController.cjs)

-- Ajouter le rôle 'admin' dans la contrainte CHECK de la colonne role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'permanent', 'temporaire'));

-- Le compte administrateur (admin@sitecaisse.fr / password123) est créé automatiquement
-- au démarrage du serveur par la fonction seedAdminIfMissing() dans api/models.cjs