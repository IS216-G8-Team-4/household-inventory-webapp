import {
    createRouter,
    createWebHistory
} from "vue-router";


import Main from '../components/Main.vue';
import Inventory from '../components/Inventory.vue';
import InventoryCreate from '../components/InventoryCreate.vue';
import Recipes from '../components/Recipes.vue';
import Donation from '../components/Donation.vue';
import SubmitDonation from '../components/SubmitDonation.vue';
import Dashboard from '../components/Dashboard.vue';
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
    path: '/Inventory/Create',
    component: InventoryCreate
  },
  {
    path: '/Recipes',
    component: Recipes
  },
  {
    path: '/Donation',
    component: Donation
  },
  {
    path:'/SubmitDonation',
    component: SubmitDonation
  }
  },
  {
    path:'/Dashboard',
    component: Dashboard
  }
  // To add more pages
]

const router = createRouter({
    routes,  
    history
  });

export default router;
