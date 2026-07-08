import { expect, test } from '@playwright/test'
import { installApiMock, loginThroughUi } from './helpers/mockApi'

test('redirige vers la connexion puis permet de creer une vente', async ({ page }) => {
  await installApiMock(page)

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  await loginThroughUi(page)

  await expect(page.getByRole('heading', { name: 'Ventes' })).toBeVisible()
  await expect(page.getByText("Aucune vente aujourd'hui")).toBeVisible()

  await page.getByRole('button', { name: '+ Ajouter une vente' }).click()
  const modal = page.locator('.modal-card')
  await expect(modal.getByRole('heading', { name: 'Ajouter une vente' })).toBeVisible()

  await modal.getByLabel('Type de paiement').selectOption('CB')
  await modal.getByLabel("Nom de l'article").fill('Bol test E2E')
  await modal.getByLabel('Qté').fill('2')
  await modal.getByLabel('Artisan').selectOption('1')
  await modal.getByLabel('Prix (€)').fill('12')
  await modal.getByRole('button', { name: '+ Ajouter un article' }).click()
  await modal.getByLabel("Nom de l'article").nth(1).fill('Tasse test E2E')
  await modal.getByLabel('Qté').nth(1).fill('1')
  await modal.getByLabel('Artisan').nth(1).selectOption('2')
  await modal.getByLabel('Prix (€)').nth(1).fill('8')
  await modal.getByRole('button', { name: 'Ajouter la vente' }).click()

  const saleRow = page.getByRole('row', { name: /Bol test E2E/ })
  await expect(saleRow).toContainText('Atelier Marcel, Atelier Emma')
  await expect(saleRow).toContainText('Carte Bancaire')
  await expect(saleRow).toContainText(/32,00\s*€/)
})

test('filtre, modifie puis supprime une vente', async ({ page }) => {
  await installApiMock(page, {
    ventes: [
      {
        id: 10,
        type_paiement: 'CB',
        vendeur_nom: 'Admin E2E',
        date_vente: '2026-07-08',
        created_at: '2026-07-08T11:00:00.000Z',
        articles: [{ id: 1, article: 'Bol filtre', quantite: 1, prix: 20, artisan_id: 1 }],
      },
      {
        id: 11,
        type_paiement: 'Cheque',
        vendeur_nom: 'Admin E2E',
        date_vente: '2026-07-08',
        created_at: '2026-07-08T10:00:00.000Z',
        articles: [{ id: 2, article: 'Carnet filtre', quantite: 1, prix: 15, artisan_id: 2 }],
      },
    ],
  })
  await loginThroughUi(page)

  await page.getByRole('button', { name: /Toutes les ventes/ }).click()
  await page.locator('#filter-type-paiement').selectOption('Cheque')
  await page.getByRole('button', { name: /Filtrer/ }).click()

  await expect(page.getByText('Carnet filtre')).toBeVisible()
  await expect(page.getByText('Bol filtre')).toBeHidden()

  const filteredRow = page.getByRole('row', { name: /Carnet filtre/ })
  await filteredRow.getByTitle('Modifier').click()

  const editModal = page.locator('.modal-card')
  await editModal.getByLabel("Nom de l'article").fill('Carnet modifie')
  await editModal.getByLabel('Prix (€)').fill('18')
  await editModal.getByRole('button', { name: 'Enregistrer' }).click()

  const updatedRow = page.getByRole('row', { name: /Carnet modifie/ })
  await expect(updatedRow).toContainText('Chèque')
  await expect(updatedRow).toContainText(/18,00\s*€/)

  await updatedRow.getByTitle('Supprimer').click()
  await expect(page.getByRole('heading', { name: 'Supprimer la vente' })).toBeVisible()
  await page.getByRole('button', { name: 'Supprimer' }).click()

  await expect(page.getByText('Carnet modifie')).toBeHidden()
  await expect(page.getByText('Aucune vente')).toBeVisible()
})

test('affiche le message renvoye par l API quand la connexion echoue', async ({ page }) => {
  await installApiMock(page, { loginSucceeds: false })

  await page.goto('/login')
  await page.getByLabel('Nom de la boutique').fill('Administration')
  await page.getByLabel('Mot de passe').fill('mauvais-secret')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Nom de boutique ou mot de passe incorrect')).toBeVisible()
})
