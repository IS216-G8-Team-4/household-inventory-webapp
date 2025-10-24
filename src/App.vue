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
const activeProfileId = ref(null);

// Fetch active profile
const fetchActiveProfile = async () => {
  if (!session.value) return;

  const userId = session.value.user.id;
  const { data: households } = await supabase
    .from("households")
    .select("id")
    .eq("created_by", userId)
    .limit(1);

  const householdId = households?.[0]?.id;
  if (!householdId) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .maybeSingle();

  activeProfileId.value = profile?.id || null;
};

// Check user session on mount
onMounted(async () => {
  const { data: { session: s } } = await supabase.auth.getSession();
  session.value = s;

  if (session.value) await fetchActiveProfile();

  // Auth change watcher
  supabase.auth.onAuthStateChange((_event, sess) => {
    session.value = sess;
    if (sess) {
      fetchActiveProfile();
    } else {
      // ✅ automatically redirect guest back to Loading
      router.push("/Loading");
    }
  });

  // Listen for active profile changes
  window.addEventListener("activeProfileChanged", (e) => {
    activeProfileId.value = e.detail?.newActiveId || null;
  });
});

// log out 
const logout = async () => {
  try {
    await supabase.auth.signOut();

    // Clear session-related state
    session.value = null;
    activeProfileId.value = null;
    showMenu.value = false;

    // Force redirect after logout (avoids race condition)
    router.replace("/Loading");
  } catch (error) {
    console.error("Logout failed:", error.message);
  }
};

// Navigation
const goTo = (path) => {
  showMenu.value = false;
  router.push(path);
};

const goToProfileSettings = () => {
  if (!activeProfileId.value) {
    alert("No active profile found.");
    return;
  }
  router.push(`/ProfileEdit/${activeProfileId.value}`);
};

// Toggle dropdown
const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};
</script>

<template>
  <!-- Bootstrap Navbar -->
  <nav class="navbar navbar-expand-lg navbar-light bg-light shadow-sm sticky-top">
    <div class="container-fluid">
      <!-- 🌿 Brand (links to Loading page) -->
      <RouterLink class="navbar-brand eco-brand fw-bold" to="/Loading">
        Eco Pantry
      </RouterLink>

      <!-- Toggler for mobile view -->
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Navbar Links -->
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto align-items-center">

          <!-- Guest-only -->
          <template v-if="!session">
            <li class="nav-item">
              <RouterLink class="nav-link" to="/login">Login</RouterLink>
            </li>
          </template>

          <!-- Always visible -->
          <li class="nav-item">
            <RouterLink class="nav-link" to="/Donation">Donation</RouterLink>
          </li>

          <!-- Authenticated-only -->
          <template v-if="session">
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Dashboard">Dashboard</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Inventory">Inventory</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/Recipes">Recipes</RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" to="/SubmitDonation">Submit Donation</RouterLink>
            </li>
          </template>

          <!-- User dropdown -->
          <li v-if="session" class="nav-item dropdown position-relative">
            <img src="../assets/user-icon.png" alt="User" class="user-icon" @click="toggleMenu" />
            <ul v-show="showMenu"
              class="dropdown-menu dropdown-menu-end show position-absolute mt-2 shadow-sm border-0">
              <li><button class="dropdown-item" @click="goTo('/ProfileList')">👤 Manage Profiles</button></li>
              <li><button class="dropdown-item" @click="goToProfileSettings">⚙️ Settings</button></li>
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

  <!-- Page Content -->
  <RouterView />
</template>

<style scoped>
/* 🌿 Brand color styling */
.eco-brand {
  color: #2e7d32 !important;
  /* deep green */
  font-size: 1.4rem;
  letter-spacing: 0.3px;
  transition: color 0.25s ease;
}

.eco-brand:hover {
  color: #1b5e20 !important;
  /* darker green hover */
  text-decoration: none;
}

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
</style>
