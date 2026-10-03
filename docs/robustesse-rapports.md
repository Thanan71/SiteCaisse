# Robustesse et interprétation des rapports

Cette note décrit le calcul courant, le chargement complet des données et les
limites de l'historique. Les rapports portent sur les lignes `vente_articles` et
leur vente parente ; ils ne constituent pas un journal comptable immuable.

## Chargement au-delà des limites de l'API

Supabase limite par défaut le nombre de lignes d'une réponse à 1 000 ; cette
limite est configurable. Une requête sans pagination explicite ne garantit donc
pas de recevoir une table entière. Voir la documentation officielle de
[`select`](https://supabase.com/docs/reference/javascript/select) et
[`range`](https://supabase.com/docs/reference/javascript/range).

Le chargement dans `api/models.cjs` suit ces règles :

- Les ventes, les articles et le catalogue des artisans sont lus par pages de
  1 000 lignes maximum. Le comptage exact initial fixe le nombre attendu ;
  l'offset avance du nombre réellement reçu. Un plafond serveur inférieur à
  1 000 reste donc compatible.
- L'ordre est déterministe : `created_at DESC, id DESC` pour les ventes,
  `id ASC` pour les articles et `nom ASC, id ASC` pour les artisans. L'identifiant
  départage notamment les ventes enregistrées au même instant.
- Les identifiants de ventes sont transmis aux requêtes d'articles par lots de
  200. Chaque lot est lui-même paginé : une seule vente contenant plus de
  1 000 lignes d'articles est intégralement chargée.
- Une erreur réseau/API, un doublon ou une page vide avant le nombre attendu
  fait échouer la lecture ; un rapport partiel n'est pas présenté comme complet.
- Les listes de ventes conservent leur pagination visible. Leurs articles sont
  néanmoins chargés en totalité pour les ventes de la page.
- Les rapports incluent les artisans archivés (`est_actif = false`) afin de
  conserver leur attribution et leurs paramètres actuels.

Ces lectures successives ne partagent pas une transaction. Un ajout, une
suppression, un changement de nom ou une modification de vente pendant la
lecture peut déplacer une page ou produire des données prises à des instants
différents. Les vérifications détectent certains écarts, sans offrir un
instantané transactionnel. De même, le chargement des ventes, des artisans et
des paramètres ne garantit pas un instant commun.

La création d'une vente et le remplacement de ses articles utilisent aussi
plusieurs requêtes. Une lecture concurrente peut voir un en-tête sans ses
articles pendant cette opération. Pour garantir un instantané fort, il faudra
regrouper les écritures dans une transaction et effectuer le calcul dans une
requête SQL ou une fonction transactionnelle côté base.

Le chargement reste proportionnel au volume total : les lots évitent la
troncature, mais les rapports globaux sont toujours assemblés en mémoire et
retournent leurs détails. À un volume nettement supérieur, des agrégats côté
base et un chargement séparé des détails seront nécessaires.

## Règles métier et précision

La quantité est la somme de `quantite`, et non le nombre de lignes. Le montant
brut correspond à la somme de `prix × quantite`, en convertissant d'abord le
prix en centimes entiers pour éviter l'accumulation des erreurs décimales. Une vente multi-artisans est
répartie selon `vente_articles.artisan_id` ; son vendeur ne détermine pas son
attribution. Le même en-tête peut apparaître dans plusieurs groupes, mais chaque
ligne d'article ne contribue qu'au groupe de son artisan.

Les mois proviennent de `ventes.date_vente` au format `YYYY-MM-DD`, et non de
`created_at`. Le schéma prévoit une date non nulle, des quantités entières
positives, des prix positifs à deux décimales et les paiements `CB`, `Espece`,
`Cheque`. Ces hypothèses supposent que les migrations et les contraintes
correspondantes sont effectivement appliquées à la base interrogée.

| Artisan | Assiette de commission | Taux appliqué |
| --- | --- | --- |
| Permanent | Ventes CB uniquement | Taux personnalisé s'il existe, sinon taux général permanent |
| Invité (`temporaire`) | Tous les paiements | Taux personnalisé s'il existe, sinon taux général invité |
| Artisan absent du catalogue ou article non attribué | Repli actuel sur CB | Taux général permanent |

Un taux personnalisé de **0 % est un taux configuré**. Il ne déclenche ni le
repli sur le taux général ni les règles de facturation d'un invité sans taux
personnalisé. Le champ historique `commission_cb` contient la commission de
l'assiette applicable, y compris tous les paiements pour un invité ; `total_cb`
reste exclusivement le montant des ventes CB.

La commission est calculée par un rapport entier `BigInt`, puis arrondie au
centime par artisan et par période demandée, afin de traiter exactement les
demi-centimes. Les taux généraux acceptent le séparateur décimal point ou virgule.
Le total de commission d'un rapport est la somme de ces commissions arrondies.
Additionner plusieurs commissions mensuelles peut donc donner quelques centimes
de différence avec une commission recalculée sur toute la période. Par exemple,
deux bases mensuelles de 0,03 € à 10 % produisent chacune 0,00 € de commission,
alors que leur base cumulée de 0,06 € produit 0,01 €. Cet écart d'arrondi ne doit
pas être interprété comme une vente manquante.

L'export Excel présente aussi un montant « À FACTURER », distinct du montant
brut et de la commission :

| Artisan | Calcul courant du total à facturer |
| --- | --- |
| Permanent | Ventes CB − commission |
| Invité sans taux personnalisé | Toutes les ventes − espèces − commission |
| Invité avec taux personnalisé, y compris 0 % | Toutes les ventes − commission |

Ces règles sont celles de `src/services/excelService.js` et des tests du
classeur. Un contrôle des rapports doit comparer la même grandeur, sans
confondre montant brut, montant CB, commission et montant à facturer.

Les articles sans artisan sont conservés dans le groupe « Artisan inconnu ».
La suppression d'un compte peut produire ce cas, car la clé étrangère prévoit
`ON DELETE SET NULL`. Un artisan promu `admin` ou `dev` sort également du
catalogue courant, qui sélectionne les rôles permanent et temporaire. Le total
brut reste attribué à son identifiant si celui-ci existe encore, mais son nom,
son rôle et son taux peuvent alors subir le repli décrit ci-dessus. Une
vérification de cohérence des montants ne certifie pas que cette attribution ou
cette commission est historiquement correcte.

## Contrôle de cohérence interne

Avant de retourner les agrégations, un parcours indépendant des ventes chargées
calcule les quantités, les montants en centimes et le nombre de lignes par
artisan. Pour les rapports mensuels, il établit également les références par
mois et par artisan dans chaque mois. Les lignes regroupées et les résumés par
artisan, par mois et globaux sont comparés à ces références.

Un écart lève une erreur `REPORT_INCONSISTENT` : le contrôleur retourne une erreur
serveur au lieu de transmettre le rapport incohérent. Le contrôle utilise les
données déjà chargées et n'ajoute pas de requête Supabase. Il inclut les lignes
non attribuées au même titre que les autres. Les commissions sont exclues de
cette égalité entre périodes, car leur arrondi dépend du regroupement demandé.
Les opérations monétaires refusent un montant non fini ou un résultat en
centimes dépassant la précision entière sûre de JavaScript. Elles refusent
également une conversion en euros qui ferait perdre un centime, même si le
nombre de centimes est encore un entier sûr.

Ce contrôle détecte des omissions ou doubles comptages dans l'agrégation ; il
ne peut pas prouver que les données chargées correspondent à la totalité de la
base. Une source déjà tronquée pourrait produire des sous-totaux cohérents.
L'exhaustivité repose donc aussi sur la pagination vérifiée et la comparaison
indépendante avec la base décrite ci-dessous. De même, deux réponses HTTP de
rapports successives peuvent différer si la base change entre les appels.

## Vérification avec les données de production

La comparaison doit être faite en lecture seule, sur le projet SiteCaisse
`uylpcvhdlwkfmuwstljt`, avec la configuration serveur autorisée du projet. Ne
jamais afficher ni copier les secrets dans le rapport de contrôle.

```sh
node --env-file=.env scripts/audit-rapports.mjs
```

Le script lit les tables plates par identifiant, établit une référence
indépendante en centimes puis compare les rapports globaux, mensuels et par
artisan. Les montants bruts, quantités, paiements CB et commissions doivent être
comparés sur un périmètre identique, avec les mêmes règles de période et
d'arrondi. Le détail de la sortie est limité à des compteurs et totaux sans
noms ni libellés d'articles.

Le script compare également l'empreinte de sa référence avant et après les
contrôles. Si elle change, recommencer pendant une période sans modification
des ventes ni des paramètres. Deux lectures identiques renforcent la confiance
dans le résultat, mais ne remplacent pas une transaction : une modification
transitoire entre les lectures peut rester invisible.

Conserver la date du contrôle, le commit exécuté, les volumes, le résultat des
comparaisons et tout écart observé. Le contrôle vérifie le code local contre les
données de production ; il ne prouve pas que ce même code est déjà déployé.

Une première comparaison réalisée le **3 octobre 2026** avec le code local de
cette tâche et les données réelles de production est conforme :

| Mesure | Résultat |
| --- | ---: |
| Ventes | 147 |
| Lignes d'articles | 216 |
| Quantités vendues | 270 |
| Groupes artisans | 14 |
| Mois | 1 |
| Montant brut | 3 711,50 € |
| Montant CB | 2 523,00 € |
| Commissions | 139,25 € |

Les vues globale, mensuelle, par mois et par artisan ont été comparées à la
référence indépendante en arithmétique entière `BigInt`. L'empreinte des données
lues avant et après le contrôle est identique. Ce jeu réel reste inférieur à
1 000 ventes et à 1 000 lignes : la validation au-delà des plafonds de l'API
repose séparément sur les jeux synthétiques des tests automatisés.

## Étude : figer le rôle et le taux historiques

### Constat et décision proposée

Aujourd'hui, `vente_articles` conserve le prix, la quantité et l'artisan, mais
aucun rôle, taux ni choix d'assiette appliqué. Les rapports consultent le rôle
et le taux personnalisé actuels de `users`, ainsi que les taux généraux actuels
de `parametres`. Modifier l'un de ces éléments recalcule les anciens rapports.
L'archivage d'un compte conserve son accès aux rapports, sans figer ses
conditions passées.

Pour reproduire une facture ou une commission passée, il est recommandé de
figer les conditions à l'enregistrement de **chaque ligne d'article**. Une vente
pouvant appartenir à plusieurs artisans, un instantané porté uniquement par
`ventes` serait insuffisant. La présente tâche documente ce besoin ; elle
n'introduit pas de migration ni de changement de règle historique.

### Données à conserver dans une évolution dédiée

Pour chaque ligne, conserver au minimum le rôle appliqué, l'assiette (`cb` ou
`tous_paiements`), le taux effectif, sa source (`personnalise` ou `general`), la
version de la règle et l'instant de capture. Conserver explicitement la source
du taux permet de distinguer un taux personnalisé nul d'un taux général nul.
Une référence d'artisan et un libellé historique doivent aussi survivre à
l'archivage ou à la suppression du compte.

La capture doit être effectuée côté serveur dans la même transaction que
l'enregistrement de la vente et des articles. Elle ne doit pas accepter des
conditions financières fournies librement par le navigateur. Le calcul
conserve la précision jusqu'à l'arrondi par artisan et période : arrondir chaque
commission de ligne changerait les totaux actuels.

Le choix entre « conditions à l'enregistrement » et « conditions à la date de
vente » doit être confirmé avant cette évolution. `date_vente` étant
modifiable, une vente saisie tardivement ne permet pas de retrouver un ancien
taux à partir des seules tables actuelles. Appliquer les conditions à la date
de vente nécessiterait aussi un historique des taux avec périodes d'effet.

Un rapport couvrant plusieurs taux ou rôles devra exposer le détail par règle
appliquée ; ses champs scalaires actuels (`taux_commission`,
`assiette_commission`, `commission_personnalisee`) ne suffisent plus. Les vues,
exports et montants à facturer devront être adaptés ensemble, en conservant
notamment la distinction des invités avec ou sans taux personnalisé.

### Ventes existantes et corrections

Ne pas remplir les ventes anciennes avec les paramètres actuels en prétendant
reconstituer leurs conditions d'origine. Les données sans preuve historique
doivent rester explicitement identifiées comme « conditions historiques non
connues ». Une reprise peut utiliser une facture, un export conservé ou une
autre source datée vérifiable, avec sa provenance ; les seuls paramètres
actuels ne constituent pas cette preuve.

À la bascule, garder une distinction claire entre les ventes nouvelles avec
conditions figées et l'historique ancien calculé selon les règles documentées.
Une éventuelle reprise manuelle doit être traçable et validée comme telle,
sans écraser silencieusement les résultats déjà utilisés.

La modification d'un prix ou d'une quantité doit préserver les conditions
d'origine par défaut. Un changement d'artisan, de paiement, de date ou une
correction explicite de commission doit suivre une politique définie : motif,
auteur, avant/après et lien vers la version précédente. Pour une période déjà
clôturée, privilégier une correction traçable à une réécriture silencieuse. Le
remplacement actuel de toutes les lignes dans `updateVente` devra donc évoluer
pour préserver les instantanés et leur provenance.

Les critères de validation de cette évolution devront couvrir le changement
d'un taux général ou personnalisé, le passage permanent/invité, le taux
personnalisé à 0 %, une vente multi-artisans, une saisie antidatée, l'archivage,
la suppression et la correction d'une vente. Les rapports et exports anciens
devront rester reproductibles pour les lignes dont les conditions sont figées.
