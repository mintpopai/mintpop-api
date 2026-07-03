import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'theme'
type Mode = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<Mode>(readInitial())

  function readInitial(): Mode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }

  function apply(): void {
    document.documentElement.classList.toggle('dark', mode.value === 'dark')
  }

  function setMode(m: Mode): void {
    followSystem = false // 手动选择后不再跟随系统主题
    mode.value = m
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      // 忽略持久化失败
    }
    apply()
  }

  function toggle(): void {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  // 用户未手动选过主题时，跟随系统深浅色切换（store 与应用同生命周期，监听无需清理）
  let followSystem = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === null
    } catch {
      return false
    }
  })()
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!followSystem) return
      mode.value = e.matches ? 'dark' : 'light'
      apply()
    })
  } catch {
    // matchMedia 不可用（如测试环境）时不跟随
  }

  // 初始化即应用到 <html>
  apply()

  return { mode, setMode, toggle }
})
