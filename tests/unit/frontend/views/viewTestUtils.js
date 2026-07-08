import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

export function installViewTest() {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  window.localStorage.clear()
}

export function getCurrentDateParts() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return {
    currentDateISO: `${year}-${month}-${day}`,
    currentMonth: `${year}-${month}`,
  }
}

export const commonViewStubs = {
  DataState: {
    props: ['loading', 'empty'],
    template: '<section data-testid="data-state"><slot /></section>',
  },
  SummaryCard: {
    props: [
      'title',
      'totalArticles',
      'totalMontant',
      'totalCb',
      'totalCommission',
      'commissionDetail',
    ],
    template: '<article data-testid="summary-card">{{ title }} {{ totalMontant }}</article>',
  },
  TabNav: {
    emits: ['change', 'update:modelValue'],
    props: ['modelValue', 'tabs'],
    template: `
      <nav data-testid="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :data-testid="'tab-' + tab.key"
          type="button"
          @click="$emit('update:modelValue', tab.key); $emit('change', tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>
    `,
  },
}
