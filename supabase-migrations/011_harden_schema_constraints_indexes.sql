-- Migration 011 : durcir le schéma sans perdre l'historique.
-- A exécuter après les migrations 001 à 010.

BEGIN;

-- users ----------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS date_fin DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS generated_password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS est_actif INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_cb_personnalisee NUMERIC(5, 2);

UPDATE users SET role = 'permanent' WHERE role IS NULL;

DO $$
DECLARE
  est_actif_type TEXT;
  password_change_required_type TEXT;
BEGIN
  SELECT data_type INTO est_actif_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'est_actif';

  SELECT data_type INTO password_change_required_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'password_change_required';

  IF est_actif_type = 'boolean' THEN
    UPDATE users SET est_actif = true WHERE est_actif IS NULL;
  ELSE
    UPDATE users SET est_actif = 1 WHERE est_actif IS NULL;
  END IF;

  IF password_change_required_type = 'boolean' THEN
    UPDATE users SET password_change_required = false WHERE password_change_required IS NULL;
  ELSE
    UPDATE users SET password_change_required = 0 WHERE password_change_required IS NULL;
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_commission_cb_personnalisee_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_est_actif_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_change_required_check;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'permanent',
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN est_actif DROP DEFAULT,
  ALTER COLUMN est_actif TYPE BOOLEAN
    USING lower(est_actif::text) IN ('1', 't', 'true', 'yes', 'on'),
  ALTER COLUMN est_actif SET DEFAULT true,
  ALTER COLUMN est_actif SET NOT NULL,
  ALTER COLUMN password_change_required DROP DEFAULT,
  ALTER COLUMN password_change_required TYPE BOOLEAN
    USING lower(password_change_required::text) IN ('1', 't', 'true', 'yes', 'on'),
  ALTER COLUMN password_change_required SET DEFAULT false,
  ALTER COLUMN password_change_required SET NOT NULL,
  ALTER COLUMN commission_cb_personnalisee TYPE NUMERIC(5, 2)
    USING round(commission_cb_personnalisee::numeric, 2);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'permanent', 'temporaire')) NOT VALID;

ALTER TABLE users ADD CONSTRAINT users_commission_cb_personnalisee_check
  CHECK (
    commission_cb_personnalisee IS NULL
    OR commission_cb_personnalisee BETWEEN 0 AND 100
  ) NOT VALID;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nom_not_empty_check;
ALTER TABLE users ADD CONSTRAINT users_nom_not_empty_check
  CHECK (length(btrim(nom)) > 0) NOT VALID;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nom_boutique_not_empty_check;
ALTER TABLE users ADD CONSTRAINT users_nom_boutique_not_empty_check
  CHECK (length(btrim(nom_boutique)) > 0) NOT VALID;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_date_fin_role_check;
ALTER TABLE users ADD CONSTRAINT users_date_fin_role_check
  CHECK (role = 'temporaire' OR date_fin IS NULL) NOT VALID;

-- ventes ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ventes
    WHERE date_vente IS NULL
      OR btrim(date_vente::text) = ''
      OR date_vente::text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
  ) THEN
    RAISE EXCEPTION 'Impossible de convertir ventes.date_vente en DATE: une valeur est vide ou invalide';
  END IF;
END $$;

ALTER TABLE ventes
  ALTER COLUMN date_vente TYPE DATE USING (date_vente::text)::date,
  ALTER COLUMN date_vente SET NOT NULL;

ALTER TABLE ventes DROP CONSTRAINT IF EXISTS ventes_type_paiement_check;
ALTER TABLE ventes ADD CONSTRAINT ventes_type_paiement_check
  CHECK (type_paiement IN ('CB', 'Espece', 'Cheque')) NOT VALID;

ALTER TABLE ventes DROP CONSTRAINT IF EXISTS ventes_vendeur_id_fkey;
ALTER TABLE ventes ADD CONSTRAINT ventes_vendeur_id_fkey
  FOREIGN KEY (vendeur_id) REFERENCES users(id) ON DELETE SET NULL;

-- vente_articles -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vente_articles (
  id SERIAL PRIMARY KEY,
  vente_id INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  article TEXT NOT NULL,
  quantite INTEGER DEFAULT 1,
  prix NUMERIC(12, 2) NOT NULL,
  artisan_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

UPDATE vente_articles SET quantite = 1 WHERE quantite IS NULL;

ALTER TABLE vente_articles
  ADD COLUMN IF NOT EXISTS artisan_id INTEGER;

ALTER TABLE vente_articles
  ALTER COLUMN quantite SET DEFAULT 1,
  ALTER COLUMN quantite SET NOT NULL,
  ALTER COLUMN prix TYPE NUMERIC(12, 2) USING round(prix::numeric, 2),
  ALTER COLUMN prix SET NOT NULL,
  ALTER COLUMN article SET NOT NULL;

ALTER TABLE vente_articles DROP CONSTRAINT IF EXISTS vente_articles_vente_id_fkey;
ALTER TABLE vente_articles ADD CONSTRAINT vente_articles_vente_id_fkey
  FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE;

ALTER TABLE vente_articles DROP CONSTRAINT IF EXISTS vente_articles_artisan_id_fkey;
ALTER TABLE vente_articles ADD CONSTRAINT vente_articles_artisan_id_fkey
  FOREIGN KEY (artisan_id) REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ventes'
      AND column_name = 'artisan_id'
  ) THEN
    UPDATE vente_articles va
    SET artisan_id = v.artisan_id
    FROM ventes v
    WHERE va.vente_id = v.id
      AND va.artisan_id IS NULL
      AND v.artisan_id IS NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_ventes_artisan_id;
ALTER TABLE ventes DROP CONSTRAINT IF EXISTS ventes_artisan_id_fkey;
ALTER TABLE ventes DROP COLUMN IF EXISTS artisan_id;

ALTER TABLE vente_articles DROP CONSTRAINT IF EXISTS vente_articles_article_not_empty_check;
ALTER TABLE vente_articles ADD CONSTRAINT vente_articles_article_not_empty_check
  CHECK (length(btrim(article)) > 0) NOT VALID;

ALTER TABLE vente_articles DROP CONSTRAINT IF EXISTS vente_articles_quantite_positive_check;
ALTER TABLE vente_articles ADD CONSTRAINT vente_articles_quantite_positive_check
  CHECK (quantite > 0) NOT VALID;

ALTER TABLE vente_articles DROP CONSTRAINT IF EXISTS vente_articles_prix_positive_check;
ALTER TABLE vente_articles ADD CONSTRAINT vente_articles_prix_positive_check
  CHECK (prix > 0) NOT VALID;

-- parametres -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS parametres (
  id SERIAL PRIMARY KEY,
  cle TEXT UNIQUE NOT NULL,
  valeur TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO parametres (cle, valeur, description) VALUES
  ('commission_cb_permanent', '1.70', 'Commission CB en % pour les artisans permanents'),
  ('commission_cb_temporaire', '1.70', 'Commission CB en % pour les artisans temporaires')
ON CONFLICT (cle) DO NOTHING;

ALTER TABLE parametres DROP CONSTRAINT IF EXISTS parametres_cle_not_empty_check;
ALTER TABLE parametres ADD CONSTRAINT parametres_cle_not_empty_check
  CHECK (length(btrim(cle)) > 0) NOT VALID;

ALTER TABLE parametres DROP CONSTRAINT IF EXISTS parametres_valeur_not_empty_check;
ALTER TABLE parametres ADD CONSTRAINT parametres_valeur_not_empty_check
  CHECK (length(btrim(valeur)) > 0) NOT VALID;

ALTER TABLE parametres DROP CONSTRAINT IF EXISTS parametres_commission_values_check;
ALTER TABLE parametres ADD CONSTRAINT parametres_commission_values_check
  CHECK (
    cle NOT IN ('commission_cb_permanent', 'commission_cb_temporaire')
    OR CASE
      WHEN replace(valeur, ',', '.') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN replace(valeur, ',', '.')::numeric BETWEEN 0 AND 100
      ELSE false
    END
  ) NOT VALID;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parametres_updated_at ON parametres;
CREATE TRIGGER trg_parametres_updated_at
BEFORE UPDATE ON parametres
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- action_logs ----------------------------------------------------------------

ALTER TABLE action_logs ADD COLUMN IF NOT EXISTS user_nom_boutique TEXT;

UPDATE action_logs SET details = '{}'::jsonb WHERE details IS NULL;

ALTER TABLE action_logs
  ALTER COLUMN details SET DEFAULT '{}'::jsonb,
  ALTER COLUMN details SET NOT NULL;

ALTER TABLE action_logs DROP CONSTRAINT IF EXISTS action_logs_action_not_empty_check;
ALTER TABLE action_logs ADD CONSTRAINT action_logs_action_not_empty_check
  CHECK (length(btrim(action)) > 0) NOT VALID;

-- index ----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_role_actif ON users(role, est_actif);
CREATE INDEX IF NOT EXISTS idx_ventes_date_vente ON ventes(date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_created_at ON ventes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_type_paiement ON ventes(type_paiement);
CREATE INDEX IF NOT EXISTS idx_ventes_vendeur_id ON ventes(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_vente_articles_vente_id ON vente_articles(vente_id);
CREATE INDEX IF NOT EXISTS idx_vente_articles_artisan_id ON vente_articles(artisan_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action);
CREATE INDEX IF NOT EXISTS idx_action_logs_cible_type ON action_logs(cible_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);

ALTER TABLE vente_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE parametres DISABLE ROW LEVEL SECURITY;

COMMIT;
