import {
    createRouter,
    createWebHistory
} from "vue-router";


import Main from '../components/Main.vue';
import Inventory from '../components/Inventory.vue';
import Recipes from '../components/Recipes.vue';
import Donation from '../components/Donation.vue';
// To add more pages


const history = createWebHistory()
const routes = [
  {
    path: '/',
    component: Main
  },
  {
    path: '/Inventory',
    component: Inventory
  },
  {
    path: '/Recipes',
    component: Recipes
  },
  {
    path: '/Donation',
    component: Donation
  }
  // To add more pages
]

const router = createRouter({
    routes,  
    history
  });

export default router;