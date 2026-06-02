-- Exécuter ce script dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- pour créer les tables nécessaires à l'application SiteCaisse

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'permanent' CHECK(role IN ('permanent', 'temporaire')),
  est_actif INTEGER DEFAULT 1,
  password_change_required INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventes (
  id SERIAL PRIMARY KEY,
  article TEXT NOT NULL,
  quantite INTEGER DEFAULT 1,
  prix REAL NOT NULL,
  type_paiement TEXT NOT NULL CHECK(type_paiement IN ('CB', 'Espece', 'Cheque')),
  artisan_id INTEGER REFERENCES users(id),
  vendeur_id INTEGER REFERENCES users(id),
  date_vente TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS action_logs (
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

CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action);
CREATE INDEX IF NOT EXISTS idx_action_logs_cible_type ON action_logs(cible_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);

-- Désactiver RLS pour les tables (l'API backend gère l'authentification)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventes DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs DISABLE ROW LEVEL SECURITY;
