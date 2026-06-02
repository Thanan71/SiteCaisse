import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/vue-chartjs')) {
            return 'vendor-chart'
          }
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/file-saver')) {
            return 'vendor-xlsx'
          }
          if (id.includes('node_modules/@supabase/supabase-js')) {
            return 'vendor-supabase'
          }
          if (
            id.includes('node_modules/vue') ||
            id.includes('node_modules/vue-router') ||
            id.includes('node_modules/pinia')
          ) {
            return 'vendor-vue'
          }
        },
      },
    },
  },
})
