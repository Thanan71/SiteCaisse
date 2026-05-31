/**
 * @module main
 * @description Point d'entrée de l'application Vue.js.
 * Initialise l'application avec Pinia (store), le routeur Vue Router,
 * la configuration Axios centralisée, et monte le composant racine App.
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './services/api' // Configuration centralisée d'Axios (intercepteurs, base URL)
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')