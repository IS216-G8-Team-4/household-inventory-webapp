<script setup>

</script>

<script>
    export default { 
        data() {
            return {
                
            }
        }
    }
</script>

<template>
  <div class="container text-center mt-5">
    <h1>Welcome to Kyra’s Community Food Sharing</h1>
    <p class="text-muted">Donate surplus food or request what you need nearby.</p>
    <router-link to="/SubmitDonation" class="btn btn-success m-2">Donate Food</router-link>
    <router-link to="/Inventory" class="btn btn-outline-primary m-2">My Inventory</router-link>
  </div>
</template>

<style scope>
    a {
        margin: 5px;
        display: block;
    }
</style>
