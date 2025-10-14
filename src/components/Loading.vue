<template>
  <div class="page">

    <!-- Hero Section -->
    <section class="hero">
      <h1>Reduce Food Waste, Save Money & Eat Sustainably</h1>
      <p>
        Track your household ingredients, get recipe suggestions, and share surplus food responsibly 
        to promote sustainable living.
      </p>
      <div class="button-group">
        <button class="btn">Log In</button>
        <button class="btn">Sign Up</button>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <h2>Key Features</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <h3>Real-time Ingredient Tracking</h3>
          <p>Monitor your fridge inventory and expiry dates to reduce forgotten ingredients and minimize waste.</p>
        </div>
        <div class="feature-card">
          <h3>Personalized Meal Planning</h3>
          <p>Get recipe suggestions based on your inventory, dietary goals, and cuisine preferences.</p>
        </div>
        <div class="feature-card">
          <h3>Donation & Sharing</h3>
          <p>Easily donate surplus food and find nearby items using integrated maps and availability tracking.</p>
        </div>
        <div class="feature-card">
          <h3>Expiry Alerts</h3>
          <p>Receive notifications 3 days, 1 day, and on expiry to help reduce waste and prioritize usage.</p>
        </div>
        <div class="feature-card">
          <h3>Analytics Dashboard</h3>
          <p>Track your food wastage, cost savings, environmental impact, and consumption patterns over time.</p>
        </div>
        <div class="feature-card">
          <h3>User Profile & Multi-User Support</h3>
          <p>Set up dietary preferences, allergies, and allow family members to share the same household inventory.</p>
        </div>
      </div>
    </section>

    <!-- Footer / Call to Action -->
    <footer class="footer">
      <p>Ready to start reducing food waste?</p>
      <div class="button-group">
        <button class="btn">Get Started</button>
      </div>
    </footer>

  </div>
</template>

<script>
export default {
  name: "FoodSaverLanding"
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f9fafb;
  display: flex;
  flex-direction: column;
  font-family: "Segoe UI", Roboto, sans-serif;
  color: #333;
}

/* Hero Section */
.hero {
  background-color: #16a34a;
  color: white;
  text-align: center;
  padding: 5rem 1.5rem;
}

.hero h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.125rem;
  max-width: 600px;
  margin: 0 auto 2rem;
}

.button-group {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.btn {
  background-color: white;
  color: #15803d;
  font-weight: 600;
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:hover {
  background-color: #f3f4f6;
}

/* Features Section */
.features {
  padding: 4rem 1.5rem;
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.features h2 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 3rem;
}

.feature-grid {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.feature-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  text-align: left;
  transition: box-shadow 0.2s;
}

.feature-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

/* Footer */
.footer {
  background-color: #15803d;
  color: white;
  text-align: center;
  padding: 2rem 1rem;
  margin-top: auto;
}

.footer p {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}
</style>

