-- Ajout de la colonne password_change_required pour forcer le changement de mot de passe
-- lors de la première connexion d'un utilisateur créé par un admin.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required INTEGER DEFAULT 0;