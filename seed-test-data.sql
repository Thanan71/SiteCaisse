-- Script de données de test pour SiteCaisse
-- À exécuter dans le SQL Editor de Supabase.
-- Ce script réutilise les utilisateurs actifs déjà présents dans users
-- et génère des ventes plus réalistes du 1er avril 2026 jusqu'à aujourd'hui.
-- Les ventes sont réparties selon les jours de la semaine, avec des paiements CB, Espèce et Chèque.

DO $$
DECLARE
  artisan_ids INT[];
  article_names TEXT[] := ARRAY[
    'Bougie artisanale',
    'Coffret cadeau',
    'Porte-clés',
    'Céramique',
    'Bracelet',
    'Poterie',
    'Sculpture',
    'Petit carnet',
    'Tasse',
    'Miroir'
  ];
  start_date DATE := DATE '2026-04-01';
  end_date DATE := CURRENT_DATE;
  sale_date DATE;
  sales_count INT;
  sale_index INT;
  payment_type TEXT;
  vendeur_id_value INT;
  line_artisan_id INT;
  vente_id INT;
  article_index INT;
  article_count INT;
  article_qty INT;
  article_price NUMERIC(10, 2);
  article_name TEXT;
  day_offset INT;
  weekday_num INT;
BEGIN
  SELECT ARRAY_AGG(id ORDER BY id)
  INTO artisan_ids
  FROM users
  WHERE est_actif = TRUE
    AND role IN ('permanent', 'temporaire')
    AND lower(trim(nom_boutique)) IN (
      lower('TestTemporaire'),
      lower('Pik verre'),
      lower('EmauxChifflot'),
      lower('Les petites brindilles'),
      lower('Imagine Cuir'),
      lower('Fléa Créa'),
      lower('Denis Création'),
      lower('AS Bougie'),
      lower('Ane a Nath')
    );

  IF artisan_ids IS NULL OR array_length(artisan_ids, 1) IS NULL THEN
    SELECT ARRAY_AGG(id ORDER BY id)
    INTO artisan_ids
    FROM users
    WHERE est_actif = TRUE
      AND role IN ('permanent', 'temporaire');
  END IF;

  IF artisan_ids IS NULL OR array_length(artisan_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Aucun artisan actif trouvé dans users';
  END IF;

  FOR sale_date IN SELECT generate_series(start_date, end_date, INTERVAL '1 day')::DATE LOOP
    weekday_num := EXTRACT(DOW FROM sale_date);

    sales_count := CASE
      WHEN weekday_num IN (0, 6) THEN 7 + (EXTRACT(DAY FROM sale_date)::int % 3)
      ELSE 4 + (EXTRACT(DAY FROM sale_date)::int % 3)
    END;

    FOR sale_index IN 1..sales_count LOOP
      day_offset := ((EXTRACT(DOY FROM sale_date)::int + sale_index) % array_length(artisan_ids, 1));

      vendeur_id_value := artisan_ids[day_offset + 1];
      payment_type := CASE
        WHEN ((sale_index + EXTRACT(DAY FROM sale_date)::int) % 10) < 6 THEN 'CB'
        WHEN ((sale_index + EXTRACT(DAY FROM sale_date)::int) % 10) < 9 THEN 'Espece'
        ELSE 'Cheque'
      END;

      IF NOT EXISTS (
        SELECT 1
        FROM ventes
        WHERE date_vente = sale_date
          AND vendeur_id = vendeur_id_value
          AND type_paiement = payment_type
          AND created_at::date = sale_date
      ) THEN
        INSERT INTO ventes (type_paiement, vendeur_id, date_vente, created_at)
        VALUES (
          payment_type,
          vendeur_id_value,
          sale_date,
          sale_date::timestamp + make_interval(hours => 8 + ((sale_index + day_offset) % 12))
        )
        RETURNING id INTO vente_id;

        article_count := 1 + ((sale_index + day_offset) % 3);
        FOR article_index IN 1..article_count LOOP
          line_artisan_id := artisan_ids[((day_offset + article_index) % array_length(artisan_ids, 1)) + 1];
          article_name := article_names[((day_offset + article_index) % array_length(article_names, 1)) + 1];
          article_qty := 1 + ((sale_index + article_index + day_offset) % 3);
          article_price := ROUND(10 + (((sale_index + article_index + day_offset) % 7) * 4.5) + 0.5, 2);

          INSERT INTO vente_articles (vente_id, article, quantite, prix, artisan_id)
          VALUES (vente_id, article_name, article_qty, article_price, line_artisan_id);
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

SELECT date_vente, COUNT(*) AS nb_ventes
FROM ventes
WHERE date_vente BETWEEN DATE '2026-04-01' AND CURRENT_DATE
GROUP BY date_vente
ORDER BY date_vente;
