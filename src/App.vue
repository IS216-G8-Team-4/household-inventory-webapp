<!-- App.vue - Main component that is mounted to the <div> element with id "app" in index.html via main.js -->

<script setup></script>

<template>
  <h1>You did it!</h1>
  <p>
    Visit <a href="https://vuejs.org/" target="_blank" rel="noopener">vuejs.org</a> to read the
    documentation
  </p>

  <RouterLink to="/">Home</RouterLink> 
  <RouterLink to="/Inventory">Inventory</RouterLink> 
  <RouterLink to="/Recipes">Recipes</RouterLink> 
  <RouterLink to="/Donation">Donation</RouterLink> 
  <RouterLink to="/Dashboard">Dashboard</RouterLink> 
  
  <RouterView /> <!-- Content from components folder -->
</template>

<style scoped></style>
