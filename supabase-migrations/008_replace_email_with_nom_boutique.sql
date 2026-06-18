-- Migration 008 : Remplacer l'adresse mail par le nom de boutique
-- A executer dans le SQL Editor Supabase pour monter la base existante.

BEGIN;

-- Utilisateurs : l'ancien email devient l'identifiant "nom_boutique".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nom_boutique'
  ) THEN
    ALTER TABLE users RENAME COLUMN email TO nom_boutique;
  END IF;
END $$;

UPDATE users
SET nom_boutique = COALESCE(NULLIF(nom_boutique, ''), nom, 'Boutique #' || id::text)
WHERE nom_boutique IS NULL OR nom_boutique = '';

ALTER TABLE users ALTER COLUMN nom_boutique SET NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nom_boutique_key;
ALTER TABLE users ADD CONSTRAINT users_nom_boutique_key UNIQUE (nom_boutique);

-- Logs : conserver l'historique en renommant la colonne.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_logs' AND column_name = 'user_email'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'action_logs' AND column_name = 'user_nom_boutique'
  ) THEN
    ALTER TABLE action_logs RENAME COLUMN user_email TO user_nom_boutique;
  END IF;
END $$;

COMMIT;
