-- Ajout du champ auth_id pour lier les utilisateurs à Supabase Auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE DEFAULT NULL;

-- Index pour la recherche par auth_id
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);