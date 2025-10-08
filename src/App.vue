<!-- App.vue - Main component that is mounted to the <div> element with id "app" in index.html via main.js -->

<script setup></script>

<template>

  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <!-- Brand -->
      <RouterLink class="navbar-brand" to="/">Household Inventory</RouterLink>

      <!-- Toggler for mobile view -->
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Navbar Links -->
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
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
        </ul>
      </div>
    </div>
  </nav>
  
  <RouterView /> <!-- Content from components folder -->
</template>

<style scoped>
  /* Highlight the current/active route link globally */
  .router-link-active {
    font-weight: 600;
    color: #0d6efd !important;
  }
</style>
