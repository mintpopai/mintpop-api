// ESLint 9 flat config（取代旧 .eslintrc.cjs）：
// eslint:recommended + typescript-eslint recommended + eslint-plugin-vue flat/recommended
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 让 `eslint .` 把 ts/vue 一并纳入（flat config 下 CLI 只认 files 声明过的扩展名）
  { files: ['**/*.{js,mjs,cjs,ts,mts,tsx,vue}'] },
  // 只排除构建产物与 vue-tsc -b 的本地生成物（vite.config.js/.d.ts，已 gitignore）；
  // 各类 config 源文件（vite.config.ts / tailwind / postcss / 本文件）纳入 lint 覆盖
  { ignores: ['dist/**', 'node_modules/**', 'vite.config.js', 'vite.config.d.ts'] },
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
