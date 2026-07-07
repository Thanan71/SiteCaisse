-- Ajoute un taux de commission CB personnalisé par utilisateur.
-- NULL = utiliser la commission générale selon le rôle de l'utilisateur.
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_cb_personnalisee REAL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_commission_cb_personnalisee_check;
ALTER TABLE users ADD CONSTRAINT users_commission_cb_personnalisee_check
  CHECK (commission_cb_personnalisee IS NULL OR commission_cb_personnalisee >= 0);
