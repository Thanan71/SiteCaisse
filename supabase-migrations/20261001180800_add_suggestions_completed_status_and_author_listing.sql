-- Après 20261001172633_add_dev_role_and_suggestions.sql.
-- Conserver les suggestions existantes et autoriser le statut Terminé.
BEGIN;

ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_statut_check;
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_statut_check
  CHECK (statut IN ('nouvelle', 'en_cours', 'acceptee', 'refusee', 'terminee'));

-- Les listes personnelles filtrent par auteur avant leur tri et leur pagination.
CREATE INDEX IF NOT EXISTS idx_suggestions_auteur_created_id
  ON public.suggestions(auteur_id, created_at DESC, id DESC);

COMMIT;
