import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],

  build: {
    outDir: '.next/static',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        // 客户端入口
        client: path.resolve(__dirname, 'client/index.jsx')
      },

      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',

        // 细粒度代码分割 - 每个 Client Component 独立打包
        manualChunks(id) {
          // React 核心库
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor'
          }

          // ⭐ 移除 client-components 合并逻辑
          // 让每个 Client Component 自动成为独立的 chunk
          // Vite 会根据动态 import() 自动分割代码
        }
      }
    },

    // 生成 manifest
    manifest: true
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
