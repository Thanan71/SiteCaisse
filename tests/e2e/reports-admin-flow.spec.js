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

for (const scenario of [
  { nom: 'généraux', tauxPersonnalise: null, commissionPermanent: 1.5, commissionInvite: 15 },
  { nom: 'personnalisés', tauxPersonnalise: 3, commissionPermanent: 3, commissionInvite: 18 },
]) {
  test(`applique les taux ${scenario.nom} aux invités sur tous les paiements et aux permanents sur la CB`, async ({
    page,
  }) => {
    const artisans = [
      { id: 1, nom: 'Marcel', nom_boutique: 'Atelier Marcel', role: 'permanent' },
      { id: 2, nom: 'Emma', nom_boutique: 'Atelier Emma', role: 'temporaire' },
    ].map((artisan) => ({
      ...artisan,
      est_actif: true,
      commission_cb_personnalisee: scenario.tauxPersonnalise,
    }))
    const ventes = ['CB', 'Espece', 'Cheque'].map((type_paiement, index) => ({
      id: 30 + index,
      type_paiement,
      vendeur_nom: 'Admin E2E',
      date_vente: '2026-07-08',
      created_at: '2026-07-08T10:00:00.000Z',
      articles: artisans.map((artisan) => ({
        id: index * 2 + artisan.id,
        article: `Article ${artisan.nom} ${type_paiement}`,
        artisan_id: artisan.id,
        quantite: 1,
        prix: (index + 1) * 100,
      })),
    }))
    await installApiMock(page, { artisans, ventes })
    await authenticate(page)
    await page.goto('/rapports')

    const assertCommission = async (container, artisan) => {
      const invite = artisan.role === 'temporaire'
      const commission = invite ? scenario.commissionInvite : scenario.commissionPermanent
      const label = container.locator('.commission-label')
      await expect(label).toContainText(invite ? 'tous paiements' : ', CB)')
      await expect(label).toContainText(invite ? '600,00' : '100,00')
      if (scenario.tauxPersonnalise !== null) {
        await expect(label).toContainText('personnalisée')
      } else {
        await expect(label).not.toContainText('personnalisée')
      }
      await expect(container.locator('.commission-value')).toHaveText(
        new RegExp(`^-\\s*${commission.toFixed(2).replace('.', ',')}\\s*€$`),
      )
    }
    const assertGlobalReport = async () => {
      for (const artisan of artisans) {
        const report = page.locator('.rapport-table-block').filter({
          has: page.getByRole('heading', { name: artisan.nom_boutique, exact: true }),
        })
        await assertCommission(report, artisan)
      }
      await expect(page.locator('.stat-value-cb')).toHaveText(/200,00\s*€/)
      const commissionTotale = scenario.commissionPermanent + scenario.commissionInvite
      await expect(page.locator('.stat-value-commission')).toHaveText(
        new RegExp(`^${commissionTotale.toFixed(2).replace('.', ',')}\\s*€$`),
      )
    }

    await assertGlobalReport()
    await page.getByRole('button', { name: /Par mois/ }).click()
    const monthInput = page.getByLabel('Sélectionner un mois :')
    await monthInput.fill('2026-07')
    await monthInput.dispatchEvent('change')
    await expect(page.getByRole('heading', { name: 'Juillet 2026' })).toBeVisible()
    await assertGlobalReport()

    for (const artisan of artisans) {
      await page.getByLabel('Sélectionner un artisan').selectOption(String(artisan.id))
      await assertCommission(page.locator('.rapport-table-block'), artisan)

      await page.getByRole('button', { name: /Par mois/ }).click()
      await expect(
        page.getByRole('heading', { name: `Rapport mensuel - ${artisan.nom} (Juillet 2026)` }),
      ).toBeVisible()
      await assertCommission(page.locator('.rapport-table-block'), artisan)
      await expect(page.locator('.stat-value-cb')).toHaveText(/100,00\s*€/)
      const commission =
        artisan.role === 'temporaire' ? scenario.commissionInvite : scenario.commissionPermanent
      await expect(page.locator('.stat-value-commission')).toHaveText(
        new RegExp(`^${commission.toFixed(2).replace('.', ',')}\\s*€$`),
      )
    }
  })
}

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
  await page.getByLabel('Commission générale - Artisans invités (%)').fill('2.75')
  await page.getByRole('button', { name: 'Enregistrer les commissions' }).click()
  await expect(page.getByText('Commissions mises à jour avec succès !')).toBeVisible()

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
