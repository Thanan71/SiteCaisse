-- Migration 007 : Ajouter artisan_id sur les lignes d'articles

BEGIN;

-- Ajouter la colonne artisan_id, référence vers users(id)
ALTER TABLE IF EXISTS vente_articles
  ADD COLUMN IF NOT EXISTS artisan_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Mettre à NULL par défaut pour les anciennes lignes
UPDATE vente_articles SET artisan_id = NULL WHERE artisan_id IS NULL;

-- Désactiver RLS
ALTER TABLE IF EXISTS vente_articles DISABLE ROW LEVEL SECURITY;

COMMIT;
