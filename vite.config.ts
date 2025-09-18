import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/SepaSimulatorCBCG/',   // <-- OVO je ispravno za tvoj repo
})
