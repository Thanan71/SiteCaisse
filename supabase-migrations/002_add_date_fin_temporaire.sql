-- Migration 002: Ajout de la colonne date_fin pour les utilisateurs temporaires
-- Exécuter ce script dans le SQL Editor de Supabase (https://supabase.com/dashboard)

-- Ajouter la colonne date_fin (optionnelle, pour les utilisateurs temporaires)
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_fin DATE;