// main.js - Import libraries & Vue components

import { createApp } from 'vue'
import App from './App.vue'
import router from './route/routes.js' // For page routing

// Create and mount the Vue app with router
createApp(App).use(router).mount('#app')