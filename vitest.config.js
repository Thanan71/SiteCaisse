import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    coverage: {
      all: true,
      include: ['api/**/*.cjs', 'src/**/*.{js,vue}'],
      reporter: ['text', 'html', 'lcov'],
    },
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
})
