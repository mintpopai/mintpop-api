import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
// Tailwind v4 官方 Vite 插件（取代 v3 时代的 postcss + autoprefixer 链）
import tailwindcss from '@tailwindcss/vite'

// 开发时把 /api/v1 反向代理到后端；后端地址可用 VITE_BACKEND_ORIGIN 覆盖
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN || 'http://localhost:8080'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: BACKEND_ORIGIN,
        changeOrigin: true
      }
    }
  },
  // 单元测试：jsdom 环境 + 全局 API（描述/断言无需逐个 import）
  test: {
    environment: 'jsdom',
    globals: true,
    // 修正 jsdom 默认 navigator.language=en-US 导致 i18n 单例初始化为英文的问题
    setupFiles: ['./src/test-setup.ts']
  }
})
