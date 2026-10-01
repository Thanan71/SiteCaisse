-- Exécuter ce script dans le SQL Editor de Supabase (https://supabase.com/dashboard)
-- pour créer les tables nécessaires à l'application SiteCaisse.
--
-- Pour une base existante, appliquer plutôt les fichiers supabase-migrations dans l'ordre.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL CHECK (length(btrim(nom)) > 0),
  nom_boutique TEXT UNIQUE NOT NULL CHECK (length(btrim(nom_boutique)) > 0),
  password_hash TEXT NOT NULL,
  generated_password TEXT,
  commission_cb_personnalisee NUMERIC(5, 2)
    CHECK (
      commission_cb_personnalisee IS NULL
      OR commission_cb_personnalisee BETWEEN 0 AND 100
    ),
  role TEXT NOT NULL DEFAULT 'permanent'
    CHECK (role IN ('dev', 'admin', 'permanent', 'temporaire')),
  est_actif BOOLEAN NOT NULL DEFAULT true,
  password_change_required BOOLEAN NOT NULL DEFAULT false,
  date_fin DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_date_fin_role_check CHECK (role = 'temporaire' OR date_fin IS NULL)
);

CREATE TABLE IF NOT EXISTS ventes (
  id SERIAL PRIMARY KEY,
  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('CB', 'Espece', 'Cheque')),
  vendeur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date_vente DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vente_articles (
  id SERIAL PRIMARY KEY,
  vente_id INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  article TEXT NOT NULL CHECK (length(btrim(article)) > 0),
  quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix NUMERIC(12, 2) NOT NULL CHECK (prix > 0),
  artisan_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS parametres (
  id SERIAL PRIMARY KEY,
  cle TEXT UNIQUE NOT NULL CHECK (length(btrim(cle)) > 0),
  valeur TEXT NOT NULL CHECK (length(btrim(valeur)) > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT parametres_commission_values_check CHECK (
    cle NOT IN ('commission_cb_permanent', 'commission_cb_temporaire')
    OR CASE
      WHEN replace(valeur, ',', '.') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN replace(valeur, ',', '.')::numeric BETWEEN 0 AND 100
      ELSE false
    END
  )
);

CREATE TABLE IF NOT EXISTS action_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_nom TEXT,
  user_nom_boutique TEXT,
  action TEXT NOT NULL CHECK (length(btrim(action)) > 0),
  cible_type TEXT,
  cible_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suggestions (
  id SERIAL PRIMARY KEY,
  titre TEXT NOT NULL CHECK (length(btrim(titre)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  statut TEXT NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'en_cours', 'acceptee', 'refusee', 'terminee')),
  auteur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  auteur_nom TEXT NOT NULL,
  auteur_nom_boutique TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO parametres (cle, valeur, description) VALUES
  ('commission_cb_permanent', '1.70', 'Commission CB en % pour les artisans permanents'),
  ('commission_cb_temporaire', '1.70', 'Commission CB en % pour les artisans temporaires')
ON CONFLICT (cle) DO NOTHING;

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

DROP TRIGGER IF EXISTS trg_suggestions_updated_at ON suggestions;
CREATE TRIGGER trg_suggestions_updated_at
BEFORE UPDATE ON suggestions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
CREATE INDEX IF NOT EXISTS idx_suggestions_created_id ON suggestions(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_statut_created_id ON suggestions(statut, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_auteur_id ON suggestions(auteur_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_auteur_created_id ON suggestions(auteur_id, created_at DESC, id DESC);

-- L'API backend gère l'authentification et doit utiliser SUPABASE_SERVICE_ROLE_KEY.
-- users et suggestions ne sont accessibles qu'au serveur ; ses routes contrôlent les rôles.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE users, suggestions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE users_id_seq, suggestions_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users, suggestions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq, suggestions_id_seq TO service_role;
ALTER TABLE ventes DISABLE ROW LEVEL SECURITY;
ALTER TABLE vente_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE parametres DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs DISABLE ROW LEVEL SECURITY;
