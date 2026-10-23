# Sauvegarde quotidienne de la base

Le workflow [Daily database backup](../.github/workflows/database-backup.yml) lance une
sauvegarde tous les jours à **22 h, heure de Paris**, été comme hiver. GitHub Actions peut
retarder le démarrage en période de charge. La planification devient active lorsque le
workflow est présent sur `main`, la branche par défaut du dépôt.

Chaque exécution conserve un artefact distinct pendant **7 jours** à compter de son
téléversement. Les paramètres actuels du dépôt autorisent cette durée. Ne pas réduire
la limite de conservation du dépôt sous 7 jours ni supprimer les exécutions à conserver.

## Configuration

Dans le dépôt GitHub, ouvrir **Settings → Secrets and variables → Actions → New repository
secret** et configurer :

| Secret | Valeur |
| --- | --- |
| `SUPABASE_DB_URL` | URI PostgreSQL du projet SiteCaisse `uylpcvhdlwkfmuwstljt`, avec le mot de passe de la base. |
| `SUPABASE_BACKUP_PASSPHRASE` | Phrase secrète aléatoire d'au moins 32 caractères, sur une seule ligne. |

Récupérer l'URI depuis **Supabase → Connect → Session pooler**, port **5432** :

```text
postgresql://postgres.uylpcvhdlwkfmuwstljt:<mot-de-passe-encode>@<hote>.pooler.supabase.com:5432/postgres
```

Encoder les caractères spéciaux du mot de passe dans l'URI. Le pooler session fonctionne
avec les runners GitHub IPv4. Le pooler transaction sur 6543 est refusé. Une connexion
directe au même projet sur 5432 est aussi acceptée si le runner dispose de l'accès réseau
nécessaire. La connexion utilise TLS par défaut ; ne pas ajouter `sslmode=disable` à l'URI.
La clé API `service_role` ne remplace pas le mot de passe PostgreSQL.

Conserver la phrase secrète dans un gestionnaire de mots de passe extérieur à GitHub :
elle est nécessaire pour restaurer les archives. Lors d'une rotation, conserver aussi
l'ancienne phrase tant que des sauvegardes l'utilisent. Le dépôt est public ; seul le
fichier chiffré est téléversé.

Le workflow utilise les clients PostgreSQL 17. Si la base passe à une version majeure
supérieure, mettre à jour l'image `postgres:17-bookworm` avant la prochaine sauvegarde.
Une erreur de version, de connexion ou de droits fait échouer le job ; aucun export
partiel n'est publié comme une sauvegarde réussie.

## Contenu et contrôles

L'archive chiffrée AES256 contient :

- `database.dump` : export PostgreSQL au format custom, sans filtre de schéma ou de table ;
  données, séquences, objets volumineux PostgreSQL, schémas dont `public`, `auth` et `storage`,
  fonctions, triggers, règles RLS, propriétaires et privilèges ;
- `roles.sql` : rôles PostgreSQL et appartenances, sans leurs mots de passe ;
- `archive.list` : inventaire des objets de l'export ;
- `metadata.txt` : horaires UTC, projet cible, commit et version du client.

`pg_dump` produit un instantané cohérent des données même pendant les ventes. Les rôles
sont exportés séparément : éviter de modifier les rôles ou le schéma pendant une sauvegarde.
Le script vérifie que les exports sont présents, lit entièrement l'archive avec `pg_restore`,
puis chiffre, déchiffre et compare l'archive avant publication. Ces contrôles ne constituent
pas une restauration sur une autre base.

Cette sauvegarde couvre la base PostgreSQL. Les fichiers binaires de Supabase Storage,
la configuration du projet (clés API, fournisseurs Auth, fonctions Edge) et les clés externes
nécessaires aux secrets Vault doivent être conservés séparément s'ils sont utilisés.
Les mots de passe des rôles PostgreSQL devront être redéfinis lors d'une restauration ;
les mots de passe des utilisateurs applicatifs stockés en base sont inclus dans l'export.

## Déclenchement et téléchargement

Ouvrir **Actions → Daily database backup → Run workflow**, sélectionner `main` puis lancer.
Une exécution verte doit afficher l'artefact `sitecaisse-database-<run>-<tentative>`.
Télécharger et décompresser le ZIP de l'artefact : il contient un fichier `.tar.gz.gpg`.
Vérifier la première exécution après activation des secrets et fusion du workflow.

## Déchiffrement et restauration de contrôle

Avec GnuPG et les clients PostgreSQL 17 ou supérieurs installés, dans un répertoire privé :

```bash
umask 077
gpg --output backup.tar.gz --decrypt sitecaisse-database-<date>-<run>-<tentative>.tar.gz.gpg
mkdir contenu
tar -xzf backup.tar.gz -C contenu
pg_restore --list contenu/database.dump
```

GnuPG demande la phrase secrète. Une phrase incorrecte ou un fichier altéré doit faire
échouer le déchiffrement. Les fichiers obtenus sont en clair : les garder dans un emplacement
privé et les supprimer après utilisation.

Pour vérifier les données applicatives dans une **base de test vide**, définir les paramètres
de connexion PostgreSQL de cette base, puis utiliser :

```bash
createdb sitecaisse_restore_check
pg_restore --exit-on-error --no-owner --no-acl --schema=public \
  --dbname=sitecaisse_restore_check contenu/database.dump
psql --dbname=sitecaisse_restore_check --command='SELECT count(*) FROM public.ventes;'
```

Ce contrôle ne restaure que `public`. Les dépendances à d'autres schémas ou extensions
doivent exister dans la cible. Pour une restauration complète, préparer une cible compatible,
examiner `roles.sql` et `archive.list`, puis restaurer les rôles nécessaires et les objets
appropriés avec `psql` et `pg_restore`. Les rôles réservés et schémas internes existent déjà
dans un projet Supabase : adapter la sélection des objets avant d'y restaurer une archive
complète. Ne pas exécuter aveuglément `roles.sql` ou un nettoyage complet sur la production.

Références : [planification GitHub et fuseaux horaires](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[rétention des artefacts](https://github.com/actions/upload-artifact#retention-period),
[export de toutes les lignes Supabase](https://supabase.com/kb/troubleshooting/pg_dump-fails-with-query-would-be-affected-by-row-level-security-policy),
[archives PostgreSQL](https://www.postgresql.org/docs/17/app-pgdump.html),
[limites des sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups).
