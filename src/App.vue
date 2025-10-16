<script setup>
import { RouterLink, RouterView, useRouter } from "vue-router";
import { createClient } from "@supabase/supabase-js";
import { ref, onMounted } from "vue";

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

const router = useRouter();
const session = ref(null);
const showMenu = ref(false);

// Check user session on mount
onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  session.value = data.session;

  // Watch for auth changes
  supabase.auth.onAuthStateChange((_event, sess) => {
    session.value = sess;
  });
});

// Logout function
const logout = async () => {
  await supabase.auth.signOut();
  showMenu.value = false;
  router.push("/login");
};

// Navigation function
const goTo = (path) => {
  showMenu.value = false;
  router.push(path);
};

// Toggle user dropdown
const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};
</script>

<template>
  <!-- Bootstrap Navbar -->
  <nav class="navbar navbar-expand-lg navbar-light bg-light shadow-sm sticky-top">
    <div class="container-fluid">
      <!-- Brand -->
      <RouterLink class="navbar-brand fw-bold text-success" to="/">
        Household Inventory
      </RouterLink>

      <!-- Toggler for mobile view -->
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Navbar Links -->
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto align-items-center">

          <!-- Always visible -->
          <li class="nav-item">
            <RouterLink class="nav-link" to="/Loading">Landing Page</RouterLink>
          </li>

          <!-- Show login only if logged out -->
          <li v-if="!session" class="nav-item">
            <RouterLink class="nav-link" to="/login">Login</RouterLink>
          </li>

          <!-- Protected links (only when logged in) -->
          <template v-if="session">
            <li class="nav-item">
              <RouterLink class="nav-link" to="/">Home</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Inventory">Inventory</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Recipes">Recipes</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Donation">Donation</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Dashboard">Dashboard</RouterLink>
            </li>
          </template>

          <!-- 🔹 User Icon Dropdown (only when logged in) -->
          <li v-if="session" class="nav-item dropdown position-relative">
            <img src="../assets/user-icon.png" alt="User" class="user-icon" @click="toggleMenu" />

            <ul v-show="showMenu"
              class="dropdown-menu dropdown-menu-end show position-absolute mt-2 shadow-sm border-0">
              <li><button class="dropdown-item" @click="goTo('/Profile')">👤 View Profile</button></li>
              <li><button class="dropdown-item" @click="goTo('/Settings')">⚙️ Settings</button></li>
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li><button class="dropdown-item text-danger" @click="logout">🚪 Logout</button></li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <!-- Page content -->
  <RouterView />
</template>

<style scoped>
/* Highlight active route */
.router-link-active {
  font-weight: 600;
  color: #0d6efd !important;
}

/* User Icon Styling */
.user-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  margin-left: 10px;
  transition: transform 0.2s;
}

.user-icon:hover {
  transform: scale(1.1);
}

/* Dropdown fix */
.dropdown-menu {
  right: 0;
  left: auto;
  display: block;
  min-width: 160px;
  z-index: 1050;
}

.dropdown-item {
  font-size: 0.95rem;
  padding: 8px 14px;
}
</style>Ï
