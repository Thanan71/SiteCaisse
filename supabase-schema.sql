-- Exécuter ce script dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- pour créer les tables nécessaires à l'application SiteCaisse

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'permanent' CHECK(role IN ('permanent', 'temporaire')),
  est_actif INTEGER DEFAULT 1,
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

-- Désactiver RLS pour les tables (l'API backend gère l'authentification)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventes DISABLE ROW LEVEL SECURITY;