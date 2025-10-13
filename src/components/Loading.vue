<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Hero Section -->
    <section class="bg-green-600 text-white py-20 px-6 text-center">
      <h1 class="text-4xl md:text-5xl font-bold mb-4">
        Reduce Food Waste, Save Money & Eat Sustainably
      </h1>
      <p class="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
        Track your household ingredients, get recipe suggestions, and share surplus food responsibly to promote sustainable living.
      </p>
      <div class="flex justify-center gap-4">
        <button
          class="bg-white text-green-600 font-semibold py-2 px-6 rounded hover:bg-gray-100 transition"
          @click="goToLogin"
        >
          Log In
        </button>
        <button
          class="bg-white text-green-600 font-semibold py-2 px-6 rounded hover:bg-gray-100 transition"
          @click="goToSignUp"
        >
          Sign Up
        </button>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-16 px-6 max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">
        Key Features
      </h2>
      <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div class="bg-white shadow rounded p-6 hover:shadow-lg transition">
          <h3 class="text-xl font-semibold mb-2">Real-time Ingredient Tracking</h3>
          <p>Monitor your fridge inventory and expiry dates to reduce forgotten ingredients and minimize waste.</p>
        </div>
        <div class="bg-white shadow rounded p-6 hover:shadow-lg transition">
          <h3 class="text-xl font-semibold mb-2">Personalized Meal Planning</h3>
          <p>Get recipe suggestions based on your inventory, dietary goals, and cuisine preferences.</p>
        </div>
        <div class="bg-white shadow rounded p-6 hover:shadow-lg transition">
          <h3 class="text-xl font-semibold mb-2">Donation & Sharing</h3>
          <p>Easily donate surplus food and find nearby items using integrated maps and availability tracking.</p>
        </div>
        <div class="bg-white shadow rounded p-6 hover:shadow-lg transition">
          <h3 class="text-xl font-semibold mb-2">Expiry Alerts</h3>
          <p>Receive notifications 3 days, 1 day, and on expiry to help reduce waste and prioritize usage.</p>
        </div>
        <div class="bg-white shadow rounded p-6 hover:shadow-lg transition">
          <h3 class="text-xl font-semibold mb-2">Analytics Dashboard</h3>
          <p>Track your food wastage, cost savings, environmental impact, and consumption patterns over time.</p>
        </div>
        <div class="bg-white shadow rounded p-6 hover:shadow-lg transition">
          <h3 class="text-xl font-semibold mb-2">User Profile & Multi-User Support</h3>
          <p>Set up dietary preferences, allergies, and allow family members to share the same household inventory.</p>
        </div>
      </div>
    </section>

    <!-- Footer / Call to Action -->
    <footer class="bg-green-700 text-white py-8 mt-auto text-center">
      <p class="mb-4">Ready to start reducing food waste?</p>
      <div class="flex justify-center gap-4">
        <button
          class="bg-white text-green-700 font-semibold py-2 px-6 rounded hover:bg-gray-100 transition"
          @click="goToSignUp"
        >
          Get Started
        </button>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: "LandingPage",
  methods: {
    goToLogin() {
      // Navigate to login page
      this.$router.push({ name: "Login" });
    },
    goToSignUp() {
      // Navigate to sign-up page
      this.$router.push({ name: "SignUp" });
    },
  },
};
</script>

<style scoped>
/* Optional: Add custom styling here */
</style>
