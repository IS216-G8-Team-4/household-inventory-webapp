// main.js - Import libraries & Vue components

import { createApp } from 'vue'
import App from './App.vue'
import router from './route/routes.js' // For page routing 

// createApp(App).mount('#app') // Default
createApp(App).use(router).mount('#app') // Includes content from components folder
