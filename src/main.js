// main.js - Import libraries & Vue components

import { createApp } from 'vue'
import App from './App.vue'
import router from './route/routes.js' // For page routing

// Import Bootstrap CSS and JS globally
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Create and mount the Vue app with router
createApp(App).use(router).mount('#app')