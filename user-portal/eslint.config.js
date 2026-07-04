// ESLint 9 flat config（取代旧 .eslintrc.cjs）：
// eslint:recommended + typescript-eslint recommended + eslint-plugin-vue flat/recommended
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 让 `eslint .` 把 ts/vue 一并纳入（flat config 下 CLI 只认 files 声明过的扩展名）
  { files: ['**/*.{js,mjs,cjs,ts,mts,tsx,vue}'] },
  // 与旧 ignorePatterns 对齐：构建产物与各类 config 文件不检查
  { ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts', 'vite.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // .vue 的 <script lang="ts"> 交给 typescript-eslint 解析
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.es2022 } } },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      // 保持 warn 档位：CI 由 --max-warnings 0 兜底拦截
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
)
