import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
// 站点字体自托管（替代 Google Fonts 外链，保证中国大陆可达），
// 字重与原 fonts.googleapis.com 请求一致：Newsreader 400-600 / Space Grotesk 400-700
// （Fredoka 曾注册为 font-display 但全仓无使用，已随之移除，勿再引入死字重）
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import './styles/theme.css'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
app.mount('#app')
