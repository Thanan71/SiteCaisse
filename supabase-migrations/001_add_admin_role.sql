-- Migration 001: Ajout du rôle 'admin' dans la contrainte CHECK de la table users
-- Exécuter ce script dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- après avoir déployé le nouveau code (api/adminController.cjs)

-- Ajouter le rôle 'admin' dans la contrainte CHECK de la colonne role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'permanent', 'temporaire'));

-- Créer un compte administrateur par défaut (mot de passe: "password123")
-- Note: Le hash ci-dessous est généré par bcrypt avec le sel fixe "$2a$10$" pour "password123"
INSERT INTO users (nom, email, password_hash, role)
SELECT 'Admin', 'admin@sitecaisse.fr', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@sitecaisse.fr');