import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, Vite serves the client and forwards API calls to Express on :3000.
// In production, Express serves the built client itself, so the same relative
// URLs (/api/..., /health) work in both and no server URL is hard-coded.
export default defineConfig({
  plugins: [react()],
  server: {
    // The dev server is shared through a Cloudflare Tunnel at this host name,
    // and Vite rejects requests for host names it doesn't know.
    allowedHosts: ['local.brijeshhq.com'],
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
