import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomBytes } from 'node:crypto'

const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=()',
}
export default defineConfig(({ command }) => {
  const nonce = command === 'serve' ? randomBytes(18).toString('base64') : undefined
  return {
    plugins: [react(), {
      name: 'local-development-csp',
      transformIndexHtml(html) {
        return nonce ? html.replace("script-src 'self';", "script-src 'self' 'nonce-" + nonce + "';") : html
      },
    }],
    html: { cspNonce: nonce },
    server: { headers },
    preview: { headers },
    build: {
      rollupOptions: {
        output: { manualChunks(id: string) {
          if (id.includes('/node_modules/three/')) return 'three'
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        } },
      },
    },
  }
})
