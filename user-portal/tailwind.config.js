import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 语义化 token，实际取值由 CSS 变量决定（见 styles/theme.css），支持深浅色切换
        bg: 'var(--bg)',
        card: 'var(--card)',
        bar: 'var(--bar)',
        border: 'var(--border)',
        border2: 'var(--border2)',
        text: 'var(--text)',
        text2: 'var(--text2)',
        text3: 'var(--text3)',
        mtext: 'var(--mtext)',
        muted: 'var(--muted)',
        track: 'var(--track)',
        hover: 'var(--hover)',
        rowline: 'var(--rowline)',
        ink: 'var(--ink)',
        accent: 'var(--accent)',
        pos: 'var(--pos)',
        neg: 'var(--neg)',
        // 次级灰阶（与设计稿一致，不随深浅色翻转）
        subtle: 'var(--subtle)',
        faint: 'var(--faint)'
      },
      fontFamily: {
        serif: ["'Newsreader'", 'serif'],
        sans: ["'Space Grotesk'", 'sans-serif']
      },
      borderRadius: {
        xl2: '16px',
        xl3: '18px',
        xl4: '22px'
      },
      boxShadow: {
        card: '0 2px 14px rgba(0,0,0,.05)',
        soft: '0 2px 10px rgba(0,0,0,.035)',
        pill: '0 1px 4px rgba(0,0,0,.05)',
        menu: '0 12px 40px rgba(0,0,0,.13)'
      }
    }
  },
  plugins: [typography]
}
