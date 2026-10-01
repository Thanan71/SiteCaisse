-- Après la migration 011. L'API doit utiliser SUPABASE_SERVICE_ROLE_KEY.
-- Aucun compte n'est promu automatiquement au rôle dev.
BEGIN;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('dev', 'admin', 'permanent', 'temporaire'));

CREATE TABLE IF NOT EXISTS public.suggestions (
  id SERIAL PRIMARY KEY,
  titre TEXT NOT NULL CHECK (length(btrim(titre)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  statut TEXT NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'en_cours', 'acceptee', 'refusee')),
  auteur_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  auteur_nom TEXT NOT NULL,
  auteur_nom_boutique TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_created_id
  ON public.suggestions(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_statut_created_id
  ON public.suggestions(statut, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_auteur_id ON public.suggestions(auteur_id);

DROP TRIGGER IF EXISTS trg_suggestions_updated_at ON public.suggestions;
CREATE TRIGGER trg_suggestions_updated_at
BEFORE UPDATE ON public.suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Authentification applicative : seul le serveur peut accéder à ces tables.
-- Bloquer aussi users empêche la modification directe d'un rôle via la Data API.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users, public.suggestions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.users_id_seq, public.suggestions_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users, public.suggestions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq, public.suggestions_id_seq TO service_role;

COMMIT;
