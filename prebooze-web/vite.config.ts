import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Lighthouse best-practices flagged the prod bundle shipping with no
  // source maps — makes any real production error report unreadable
  // (minified names/positions only). The JS itself is already public to
  // the browser either way, so there's no exposure trade-off here.
  build: { sourcemap: true },
})
