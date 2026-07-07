-- Stocke le dernier mot de passe généré par l'administration pour l'afficher après rechargement.
ALTER TABLE users ADD COLUMN IF NOT EXISTS generated_password TEXT;
