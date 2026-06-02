-- ⚠️ ATTENTION : Ce script vide toutes les tables et recrée la structure
-- Exécuter dans le SQL Editor de Supabase (https://supabase.com/dashboard)

-- ============================================
-- 1. SUPPRIMER LES DONNÉES EXISTANTES
-- ============================================
TRUNCATE TABLE action_logs CASCADE;
TRUNCATE TABLE vente_articles CASCADE;
TRUNCATE TABLE ventes CASCADE;
TRUNCATE TABLE parametres CASCADE;
TRUNCATE TABLE users CASCADE;

-- ============================================
-- 2. RECRÉER LES TABLES (propre)
-- ============================================

-- Table des utilisateurs
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT 'permanent' CHECK(role IN ('admin', 'permanent', 'temporaire')),
  est_actif INTEGER DEFAULT 1,
  auth_id UUID UNIQUE DEFAULT NULL,
  date_fin TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des ventes
DROP TABLE IF EXISTS ventes CASCADE;
CREATE TABLE ventes (
  id SERIAL PRIMARY KEY,
  type_paiement TEXT NOT NULL CHECK(type_paiement IN ('CB', 'Espece', 'Cheque')),
  artisan_id INTEGER REFERENCES users(id),
  vendeur_id INTEGER REFERENCES users(id),
  date_vente TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des lignes d'articles pour chaque vente
DROP TABLE IF EXISTS vente_articles CASCADE;
CREATE TABLE vente_articles (
  id SERIAL PRIMARY KEY,
  vente_id INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  article TEXT NOT NULL,
  quantite INTEGER DEFAULT 1,
  prix REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des logs d'actions
DROP TABLE IF EXISTS action_logs CASCADE;
CREATE TABLE action_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_nom TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  cible_type TEXT,
  cible_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des paramètres système
DROP TABLE IF EXISTS parametres CASCADE;
CREATE TABLE parametres (
  id SERIAL PRIMARY KEY,
  cle TEXT UNIQUE NOT NULL,
  valeur TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. INDEX
-- ============================================
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action);
CREATE INDEX IF NOT EXISTS idx_action_logs_cible_type ON action_logs(cible_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_ventes_date_vente ON ventes(date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_artisan_id ON ventes(artisan_id);
CREATE INDEX IF NOT EXISTS idx_vente_articles_vente_id ON vente_articles(vente_id);

-- ============================================
-- 4. INSÉRER LE COMPTE ADMIN UNIQUE
-- ============================================
-- L'auth_id sera mis à jour automatiquement lors du premier login
-- par le backend (api/authController.cjs)
INSERT INTO users (nom, email, password_hash, role, est_actif)
VALUES (
  'Admin',
  'admin@sitecaisse.fr',
  '$2b$10$x9x1IYYeIdsWvZLdblOn.evQd3jTYjfbu8HnJ1baL8T6BGKCE2i6.', -- bcrypt hash de "password123"
  'admin',
  1
);

-- ============================================
-- 5. INSÉRER LES PARAMÈTRES PAR DÉFAUT
-- ============================================
INSERT INTO parametres (cle, valeur, description) VALUES
  ('commission_cb_permanent', '1.8', 'Commission CB pour les artisans permanents (en %)'),
  ('commission_cb_temporaire', '2.5', 'Commission CB pour les artisans temporaires (en %)');

-- ============================================
-- 6. DÉSACTIVER RLS (l'API backend gère l'auth)
-- ============================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventes DISABLE ROW LEVEL SECURITY;
ALTER TABLE vente_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE parametres DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. MESSAGE DE CONFIRMATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Base réinitialisée avec succès !';
  RAISE NOTICE '📧 admin@sitecaisse.fr';
  RAISE NOTICE '🔑 password123';
END $$;