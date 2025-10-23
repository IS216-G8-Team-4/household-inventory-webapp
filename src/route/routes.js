// src/router/route.js
import { createRouter, createWebHistory } from "vue-router";
import { createClient } from "@supabase/supabase-js";

// Pages
import Main from "@/components/Main.vue";
import Inventory from "@/components/Inventory.vue";
import InventoryCreate from "@/components/InventoryCreate.vue";
import InventoryEdit from "@/components/InventoryEdit.vue";
import Recipes from "@/components/Recipes.vue";
import Donation from "@/components/Donation.vue";
import SubmitDonation from "@/components/SubmitDonation.vue";
import Dashboard from "@/components/Dashboard.vue";
import Loading from "@/components/Loading.vue";
import Login from "@/components/login.vue";

// ---- Supabase singleton for guards ----
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
);

// Simple session cache so we don't call getSession on every nav
let cachedSession = null;
async function getSession() {
  if (cachedSession !== null) return cachedSession;
  const { data } = await supabase.auth.getSession();
  cachedSession = data?.session ?? null;
  return cachedSession;
}
supabase.auth.onAuthStateChange((_evt, session) => {
  cachedSession = session ?? null;
});

// ---- Routes ----
const routes = [
  { path: "/", redirect: "/Loading" },

  // Guest-only pages
  { path: "/Loading", component: Loading, meta: { guestOnly: true, hideWhenAuthed: true } },
  { path: "/login", component: Login, meta: { guestOnly: true, hideWhenAuthed: true } },

  // Donation: accessible to everyone (no meta)
  { path: "/Donation", component: Donation }, // <-- changed

  // App pages (auth required)
  { path: "/Dashboard", component: Dashboard, meta: { requiresAuth: true } },
  { path: "/Inventory", component: Inventory, meta: { requiresAuth: true } },
  { path: "/Inventory/Create", component: InventoryCreate, meta: { requiresAuth: true } },
  { path: "/Inventory/Edit", component: InventoryEdit, meta: { requiresAuth: true } },
  { path: "/Recipes", component: Recipes, meta: { requiresAuth: true } },
  { path: "/SubmitDonation", component: SubmitDonation, meta: { requiresAuth: true } },
  { path: "/Main", component: Main, meta: { requiresAuth: true } },

  { path: "/:pathMatch(.*)*", redirect: "/Loading" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

// ---- Global guard ----
router.beforeEach(async (to) => {
  const session = await getSession();

  // Block guest-only routes when authed (hide Loading, Login, Donation after login)
  if (to.meta?.guestOnly && session) {
    return { path: "/Dashboard" };
  }

  // Protect authed routes
  if (to.meta?.requiresAuth && !session) {
    return { path: "/login", query: { next: to.fullPath } };
  }

  return true;
});

export default router;Ï
