import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  optimizeDeps: {
    // Tell Vite to safely ignore mobile-only packages during web dependency scanning
    exclude: ['react-native', 'lucide-react-native', 'expo-haptics', 'expo-camera', 'expo-audio'],
  }
})
