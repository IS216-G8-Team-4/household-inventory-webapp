
import { createApp } from 'vue'
import App from './App.vue'
import router from './route/routes.js' 

// Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Pinia
import { createPinia } from "pinia";
const app = createApp(App);   //  create app FIRST
const pinia = createPinia();  //  then create pinia

app.use(pinia);               //  register pinia
app.use(router);              //  register router
app.mount('#app');            //  mount last
