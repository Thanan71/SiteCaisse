-- Migration 004 : Ajout du support multi-articles pour les ventes
-- 
-- Cette migration crée la table vente_articles qui permet d'associer
-- plusieurs articles à une même vente (relation 1-N).
-- Elle migre aussi les données existantes depuis les colonnes dépréciées
-- de la table ventes (article, quantite, prix).

-- 1. Créer la table des lignes d'articles
CREATE TABLE IF NOT EXISTS vente_articles (
  id SERIAL PRIMARY KEY,
  vente_id INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  article TEXT NOT NULL,
  quantite INTEGER DEFAULT 1,
  prix REAL NOT NULL
);

-- 2. Copier les articles existants dans la nouvelle table
INSERT INTO vente_articles (vente_id, article, quantite, prix)
SELECT id, article, quantite, prix FROM ventes;

-- 3. Supprimer les colonnes devenues inutiles dans ventes
ALTER TABLE ventes DROP COLUMN IF EXISTS article;
ALTER TABLE ventes DROP COLUMN IF EXISTS quantite;
ALTER TABLE ventes DROP COLUMN IF EXISTS prix;

-- 4. Désactiver RLS
ALTER TABLE vente_articles DISABLE ROW LEVEL SECURITY;