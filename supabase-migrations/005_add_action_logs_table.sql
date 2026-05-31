-- Migration 005 : Ajout du journal des actions
-- Exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS action_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_nom TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  cible_type TEXT,
  cible_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action);
CREATE INDEX IF NOT EXISTS idx_action_logs_cible_type ON action_logs(cible_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);

ALTER TABLE action_logs DISABLE ROW LEVEL SECURITY;
