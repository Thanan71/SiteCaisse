-- Script de suppression de toutes les ventes et lignes associées.
-- À exécuter avec prudence : cela supprime toutes les ventes de la base.

DELETE FROM vente_articles;
DELETE FROM ventes;

SELECT 'Ventes et lignes supprimées' AS statut;