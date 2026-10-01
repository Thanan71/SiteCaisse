import { expect, test } from '@playwright/test'
import { authenticate, installApiMock } from './helpers/mockApi'

function userForRole(role) {
  return { id: 40, nom: `Compte ${role}`, nom_boutique: `Boutique ${role}`, role }
}

function suggestion(id, overrides = {}) {
  return {
    id,
    titre: `Idée ${id}`,
    description: `Description privée ${id}`,
    statut: 'nouvelle',
    auteur_id: 2,
    auteur_nom: 'Emma',
    auteur_nom_boutique: 'Atelier Emma',
    created_at: '2026-09-20T10:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

for (const role of ['permanent', 'temporaire', 'admin', 'dev']) {
  test(`${role} peut envoyer une suggestion et respecte la navigation privée`, async ({ page }) => {
    const user = userForRole(role)
    const state = await installApiMock(page, { user, suggestionDelayMs: 250 })
    await authenticate(page, user)
    const privateReads = []
    page.on('request', (request) => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/suggestions') {
        privateReads.push(request.url())
      }
    })
    await page.goto('/suggestions')
    await expect(page.getByRole('link', { name: 'Suggestions', exact: true })).toBeVisible()
    if (role === 'dev')
      await expect(page.getByRole('link', { name: 'Dev', exact: true })).toBeVisible()
    else await expect(page.getByRole('link', { name: 'Dev', exact: true })).toHaveCount(0)

    await page.getByLabel('Titre', { exact: true }).fill('Un filtre supplémentaire')
    await page.getByLabel('Description', { exact: true }).fill('Filtrer les rapports par boutique.')
    await page.getByRole('button', { name: 'Envoyer la suggestion' }).click()
    await expect(page.getByRole('button', { name: 'Envoi en cours...' })).toBeDisabled()
    await expect(page.getByRole('status')).toContainText('Votre suggestion a bien été envoyée')
    expect(state.suggestions).toHaveLength(1)
    expect(state.suggestions[0]).toMatchObject({ auteur_id: user.id, statut: 'nouvelle' })
    await expect(page.getByLabel('Titre', { exact: true })).toHaveValue('')

    if (role !== 'dev') {
      await page.goto('/dev/suggestions')
      await expect(page).toHaveURL('/')
      expect(privateReads).toHaveLength(0)
      const status = await page.evaluate(async () => {
        const response = await fetch('/api/suggestions', {
          headers: { Authorization: 'Bearer e2e-token' },
        })
        return response.status
      })
      expect(status).toBe(403)
    }
  })
}

test('conserve la saisie apres erreur et permet une nouvelle soumission au clavier', async ({
  page,
}) => {
  const user = userForRole('permanent')
  const state = await installApiMock(page, { user, suggestionFailures: 1 })
  await authenticate(page, user)
  await page.goto('/suggestions')
  await page.getByLabel('Titre', { exact: true }).fill('Une idée conservée')
  await page.getByLabel('Description', { exact: true }).fill('Le réseau peut être indisponible.')
  await page.getByRole('button', { name: 'Envoyer la suggestion' }).click()
  await expect(page.getByRole('alert')).toContainText('Réessayez')
  await expect(page.getByLabel('Titre', { exact: true })).toHaveValue('Une idée conservée')
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue(
    'Le réseau peut être indisponible.',
  )
  await page.getByRole('button', { name: 'Envoyer la suggestion' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('Votre suggestion a bien été envoyée')
  expect(state.suggestions).toHaveLength(1)
})

test('Dev consulte, filtre, pagine et change un statut explicitement', async ({ page }) => {
  const user = userForRole('dev')
  const state = await installApiMock(page, {
    user,
    suggestions: Array.from({ length: 23 }, (_, index) => suggestion(index + 1)),
  })
  await authenticate(page, user)
  await page.goto('/dev/suggestions')
  await expect(page.getByRole('heading', { name: 'Suggestions reçues' })).toBeVisible()
  await expect(page.locator('details[data-suggestion-id]')).toHaveCount(20)
  await page.getByRole('button', { name: 'Suivant', exact: true }).click()
  await expect(page.getByText('Page 2 / 2')).toBeVisible()
  await expect(page.locator('details[data-suggestion-id]')).toHaveCount(3)

  const detail = page.locator('details[data-suggestion-id="3"]')
  await detail.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(detail.locator('.suggestion-description')).toHaveText('Description privée 3')
  await detail.getByLabel('Nouveau statut').selectOption('en_cours')
  expect(state.suggestions.find((item) => item.id === 3).statut).toBe('nouvelle')
  await detail.getByRole('button', { name: 'Appliquer', exact: true }).click()
  await expect(detail.getByRole('status')).toHaveText('Statut mis à jour.')
  await expect(detail).toHaveAttribute('open', '')
  await expect(page.getByText('Page 2 / 2')).toBeVisible()

  await page.locator('#suggestion-status-filter').selectOption('en_cours')
  await page.getByLabel('Du', { exact: true }).fill('2026-09-20')
  await page.getByLabel('Au', { exact: true }).fill('2026-09-20')
  await page.getByLabel('Ordre des dates').selectOption('asc')
  await page.getByRole('button', { name: 'Appliquer les filtres' }).click()
  await expect(page.locator('details[data-suggestion-id]')).toHaveCount(1)
  await expect(page.locator('details[data-suggestion-id="3"]')).toBeVisible()
  await page.locator('#suggestion-status-filter').selectOption('refusee')
  await page.getByRole('button', { name: 'Appliquer les filtres' }).click()
  await expect(page.getByText('Aucune suggestion ne correspond aux filtres.')).toBeVisible()
})

test('Dev accede a l administration et peut creer un compte administrateur', async ({ page }) => {
  const user = userForRole('dev')
  const state = await installApiMock(page, { user })
  await authenticate(page, user)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Utilisateurs/ }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Gestionnaire')
  await page.getByLabel('Nom de la boutique').fill('Gestion boutique')
  await page.getByLabel('Rôle', { exact: true }).selectOption('admin')
  await page.getByRole('button', { name: "Ajouter l'utilisateur" }).click()
  await expect(page.getByText('Gestion boutique', { exact: true }).first()).toBeVisible()
  expect(state.users.find((item) => item.nom_boutique === 'Gestion boutique').role).toBe('admin')
  expect(state.artisans.some((item) => item.nom_boutique === 'Gestion boutique')).toBe(false)
})

test('le filtre de dates inclut le jour affiche a Paris autour de minuit', async ({ page }) => {
  const user = userForRole('dev')
  await installApiMock(page, {
    user,
    suggestions: [
      suggestion(1, { created_at: '2026-09-30T21:59:59.999Z' }),
      suggestion(2, { created_at: '2026-09-30T22:00:00.000Z' }),
      suggestion(3, { created_at: '2026-09-30T22:30:00.000Z' }),
      suggestion(4, { created_at: '2026-10-01T21:59:59.999Z' }),
      suggestion(5, { created_at: '2026-10-01T22:00:00.000Z' }),
    ],
  })
  await authenticate(page, user)
  await page.goto('/dev/suggestions')

  const boundarySuggestion = page.locator('details[data-suggestion-id="3"]')
  await expect(boundarySuggestion.locator('time')).toHaveText(/01\/10\/2026.*00:30/)
  await page.getByLabel('Du', { exact: true }).fill('2026-10-01')
  await page.getByLabel('Au', { exact: true }).fill('2026-10-01')
  await page.getByRole('button', { name: 'Appliquer les filtres' }).click()

  await expect(page.locator('details[data-suggestion-id]')).toHaveCount(3)
  await expect(boundarySuggestion).toBeVisible()
  await expect(page.locator('details[data-suggestion-id="2"]')).toBeVisible()
  await expect(page.locator('details[data-suggestion-id="4"]')).toBeVisible()
  await expect(page.locator('details[data-suggestion-id="1"]')).toHaveCount(0)
  await expect(page.locator('details[data-suggestion-id="5"]')).toHaveCount(0)
})

test('la boîte à idées reste utilisable sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const user = userForRole('permanent')
  await installApiMock(page, { user })
  await authenticate(page, user)
  await page.goto('/suggestions')
  await expect(page.getByRole('heading', { name: 'Proposer une amélioration' })).toBeVisible()
  await page.getByLabel('Titre', { exact: true }).fill('Idée mobile')
  await page.getByLabel('Description', { exact: true }).fill('Formulaire accessible sur téléphone.')
  await page.getByRole('button', { name: 'Envoyer la suggestion' }).click()
  await expect(page.getByRole('status')).toContainText('Votre suggestion a bien été envoyée')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
