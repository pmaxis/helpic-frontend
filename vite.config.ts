import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

/**
 * The build's version, named as the backend names its own: VERSION when the
 * build is given one (the Makefile and Docker do), else what git says, else
 * "dev".
 */
function version(): string {
  if (process.env.VERSION) return process.env.VERSION
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Baked in, for the admin panel's Status page.
  define: {
    __APP_VERSION__: JSON.stringify(version()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
