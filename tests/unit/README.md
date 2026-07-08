# Tests unitaires

Les tests unitaires sont organises par responsabilite :

- `backend/` : API Express, controleurs, modeles et services backend.
- `frontend/` : composants Vue, vues, router, composables, stores, services frontend et utilitaires.
- `fixtures/` : donnees reutilisables et sans logique de test.
- `helpers/` : outils de test generiques, sans dependance a un cas metier precis.

Principes suivis :

- Un fichier de test cible un seul module : composant, vue, composable, store, service, utilitaire ou router.
- Les mocks de chargement et d'execution Express restent dans des helpers dedies.
- Les donnees partagees vivent dans `fixtures/`, pas dans les tests metier.
- Les tests e2e restent separes dans `tests/e2e`.
