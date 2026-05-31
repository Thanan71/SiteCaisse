-- Migration : Ajout de la table parametres pour stocker les paramètres système
-- Exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS parametres (
  id SERIAL PRIMARY KEY,
  cle TEXT UNIQUE NOT NULL,
  valeur TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer les valeurs par défaut des commissions CB
INSERT INTO parametres (cle, valeur, description) VALUES
  ('commission_cb_permanent', '1.70', 'Commission CB en % pour les artisans permanents'),
  ('commission_cb_temporaire', '1.70', 'Commission CB en % pour les artisans temporaires')
ON CONFLICT (cle) DO NOTHING;

ALTER TABLE parametres DISABLE ROW LEVEL SECURITY;