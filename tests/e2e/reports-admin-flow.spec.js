import { expect, test } from '@playwright/test'
import { authenticate, connectedUser, installApiMock } from './helpers/mockApi'

const ventesRapport = [
  {
    id: 20,
    type_paiement: 'CB',
    vendeur_nom: 'Admin E2E',
    date_vente: '2026-07-08',
    created_at: '2026-07-08T10:00:00.000Z',
    articles: [{ id: 1, article: 'Vase rapport', quantite: 2, prix: 30, artisan_id: 1 }],
  },
  {
    id: 21,
    type_paiement: 'CB',
    vendeur_nom: 'Admin E2E',
    date_vente: '2026-07-08',
    created_at: '2026-07-08T09:00:00.000Z',
    articles: [{ id: 2, article: 'Echarpe rapport', quantite: 1, prix: 40, artisan_id: 2 }],
  },
]

test('navigue dans les rapports globaux, artisan et mensuels', async ({ page }) => {
  await installApiMock(page, { ventes: ventesRapport })
  await authenticate(page)

  await page.goto('/rapports')

  await expect(page.getByRole('heading', { name: 'Rapports' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Atelier Marcel' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Atelier Emma' })).toBeVisible()
  await expect(page.getByText('Résumé global')).toBeVisible()

  await page.getByRole('button', { name: /Par mois/ }).click()
  const monthInput = page.getByLabel('Sélectionner un mois :')
  await monthInput.fill('2026-07')
  await monthInput.dispatchEvent('change')
  await expect(page.getByRole('heading', { name: 'Juillet 2026' })).toBeVisible()
  await expect(page.getByText('Résumé du mois')).toBeVisible()

  await page.getByLabel('Sélectionner un artisan').selectOption('2')
  await expect(page.getByText('Echarpe rapport')).toBeVisible()
  await expect(page.getByText('Vase rapport')).toBeHidden()

  await page.getByRole('button', { name: /Par mois/ }).click()
  await expect(
    page.getByRole('heading', { name: /Rapport mensuel - Emma \(Juillet 2026\)/ }),
  ).toBeVisible()
})

test('gere utilisateurs, commissions et logs dans l administration', async ({ page }) => {
  await installApiMock(page, { ventes: ventesRapport })
  await authenticate(page, connectedUser)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

  await page.getByLabel('Nom', { exact: true }).fill('Nouveau')
  await page.getByLabel('Nom de la boutique').fill('Boutique Nouvelle')
  await page.getByLabel('Rôle').selectOption('permanent')
  await page.getByRole('button', { name: "Ajouter l'utilisateur" }).click()

  await expect(page.getByRole('heading', { name: /Utilisateur créé/ })).toBeVisible()
  await expect(page.locator('.password-display')).toHaveText('boutiquenouvelle0042')
  await page.getByRole('button', { name: 'Fermer' }).click()
  await expect(page.getByRole('row', { name: /Boutique Nouvelle/ })).toBeVisible()

  await page.getByRole('button', { name: 'Commissions' }).click()
  await page.getByLabel('Commission générale - Artisans permanents (%)').fill('1.75')
  await page.getByLabel('Commission générale - Artisans temporaires (%)').fill('2.75')
  await page.getByRole('button', { name: 'Enregistrer les commissions' }).click()
  await expect(page.getByText('Commissions CB mises à jour avec succès !')).toBeVisible()

  await page.getByRole('button', { name: 'Ajouter une commission personnalisée' }).click()
  await page.getByLabel('Artisan', { exact: true }).selectOption('3')
  await page.getByLabel('Taux personnalisé (%)').fill('3.25')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('row', { name: /Boutique Nouvelle/ })).toContainText('3,25%')

  await page.getByRole('button', { name: 'Logs' }).click()
  await expect(page.getByRole('heading', { name: 'Journal des actions' })).toBeVisible()
  const logsTable = page.getByRole('table')
  await expect(logsTable.getByText('Vente créée')).toBeVisible()

  await page.getByLabel('Action').selectOption('user.create')
  await page.getByRole('button', { name: 'Actualiser' }).click()
  await expect(logsTable.getByText('Utilisateur créé')).toBeVisible()
  await expect(logsTable.getByText('Vente créée')).toBeHidden()
})