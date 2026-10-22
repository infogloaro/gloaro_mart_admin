import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // '/' for local dev; the live build sets ADMIN_BASE=/admin/ because the
  // backend serves the console at https://<backend>/admin.
  base: process.env.ADMIN_BASE ?? '/',
})
