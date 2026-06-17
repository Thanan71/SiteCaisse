-- Script SQL pour vider la base de données et ne garder qu'un seul compte admin
-- Utilisez-le dans le SQL Editor Supabase ou un client PostgreSQL.

BEGIN;

-- Supprimer les données dépendantes avant d'effacer les utilisateurs
DELETE FROM vente_articles;
DELETE FROM ventes;
DELETE FROM action_logs;
DELETE FROM parametres;

-- Conserver uniquement l'admin et supprimer tous les autres comptes
DELETE FROM users
WHERE email <> 'admin@sitecaisse.fr';

-- Créer ou mettre à jour le compte admin avec un mot de passe connu
INSERT INTO users (nom, email, password_hash, role, est_actif, password_change_required, created_at)
VALUES (
  'Admin',
  'admin@sitecaisse.fr',
  '$2b$10$KjIvYPinFfUhH/oAAOA9uufdBD1lR4bVgqgPViN/bRRx0rZj69IcW',
  'admin',
  1,
  0,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
  nom = EXCLUDED.nom,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  est_actif = EXCLUDED.est_actif,
  password_change_required = EXCLUDED.password_change_required;

COMMIT;
