import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/anot/',
  plugins: [basicSsl()],
  server: {
    https: true
  },
  build: {
    outDir: 'docs'
  }
})
