-- À exécuter après le déploiement du nouveau code et la migration
-- 20261001172633_add_dev_role_and_suggestions.sql, sur le projet SiteCaisse.
-- Le compte Administration a été identifié comme administrateur initial.
-- Ne modifie ni le mot de passe ni les autres comptes. Réexécutable.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.users
      WHERE nom_boutique = 'Administration'
        AND role IN ('admin', 'dev') AND est_actif = true) <> 1 THEN
    RAISE EXCEPTION 'Un unique compte Administration actif, admin ou dev, est requis';
  END IF;
END;
$$;

UPDATE public.users SET role = 'dev'
WHERE nom_boutique = 'Administration' AND role = 'admin' AND est_actif = true;

SELECT id, nom, nom_boutique, role, est_actif
FROM public.users WHERE nom_boutique = 'Administration';

COMMIT;
