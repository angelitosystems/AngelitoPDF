import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' + hash routes: the build works from any static host or sub-path (Vercel, GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['..'] } }, // benches/results.json lives outside website/
})
