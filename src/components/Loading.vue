<template>
  <div class="page">
    <!-- Hero Section -->
    <section class="hero text-center">
      <div class="hero-bg-shape" aria-hidden="true"></div>
      <div class="container">
        <div class="hero-badge">💚 Reduce waste • Save money • Eat better</div>
        <h1>Reduce Food Waste, Save Money & Eat Sustainably</h1>
        <p>Track your household ingredients, get recipe suggestions, and share surplus food responsibly.</p>
        <div class="button-group d-flex justify-content-center" aria-label="Primary call to action">
          <RouterLink to="/login" class="btn btn-cta">Get Started</RouterLink>
        </div>
      </div>
    </section>

    <!-- How it works (step rail) -->
    <section id="how" class="how-rail">
      <div class="container">
        <h2 class="text-center mb-4">How it works</h2>

        <ol class="steps list-unstyled d-flex flex-column flex-md-row justify-content-between align-items-start">
          <li class="step">
            <div class="dot"><i class="fa-solid fa-camera"></i></div>
            <div class="meta">
              <h3>Add Ingredients</h3>
              <p>we track quantities, locations, and expiry dates.</p>
            </div>
          </li>

          <li class="connector d-none d-md-block" aria-hidden="true"></li>

          <li class="step">
            <div class="dot"><i class="fa-solid fa-lightbulb"></i></div>
            <div class="meta">
              <h3>Get Smart Suggestions</h3>
              <p>Cook-now recipes for items expiring soon, sorted by your preferences.</p>
            </div>
          </li>

          <li class="connector d-none d-md-block" aria-hidden="true"></li>

          <li class="step">
            <div class="dot"><i class="fa-solid fa-hand-holding-heart"></i></div>
            <div class="meta">
              <h3>Donate Surplus</h3>
              <p>List extras to neighbours or connect to food banks via map pins.</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="features text-center">
      <h2>Key Features</h2>
      <div class="container">
        <div class="row g-4">
          <div class="col-12 col-md-6 col-lg-4">
            <div class="feature-card h-100">
              <div class="feature-top">
                <div class="icon-placeholder" aria-hidden="true">🥦</div>
                <span class="pill">Most used</span>
              </div>
              <h3>Real-time Ingredient Tracking</h3>
              <p>Monitor your fridge inventory and expiry dates to reduce forgotten ingredients and minimize waste.</p>
            </div>
          </div>
          <div class="col-12 col-md-6 col-lg-4">
            <div class="feature-card h-100">
              <div class="feature-top">
                <div class="icon-placeholder" aria-hidden="true">🍳</div>
                <span class="pill pill-accent">Smart AI</span>
              </div>
              <h3>Personalized Meal Planning</h3>
              <p>Get recipe suggestions based on your inventory, dietary goals, and cuisine preferences.</p>
            </div>
          </div>
          <div class="col-12 col-md-6 col-lg-4">
            <div class="feature-card h-100">
              <div class="icon-placeholder" aria-hidden="true">🤝</div>
              <h3>Donation & Sharing</h3>
              <p>Easily donate surplus food and find nearby items using integrated maps and availability tracking.</p>
            </div>
          </div>
          <div class="col-12 col-md-6 col-lg-4">
            <div class="feature-card h-100">
              <div class="icon-placeholder" aria-hidden="true">⏰</div>
              <h3>Expiry Alerts</h3>
              <p>Get notified 3 days, 1 day, and on expiry to reduce waste and prioritize usage.</p>
            </div>
          </div>
          <div class="col-12 col-md-6 col-lg-4">
            <div class="feature-card h-100">
              <div class="icon-placeholder" aria-hidden="true">📊</div>
              <h3>Analytics Dashboard</h3>
              <p>Track food wastage, cost savings, environmental impact, and consumption patterns over time.</p>
            </div>
          </div>
          <div class="col-12 col-md-6 col-lg-4">
            <div class="feature-card h-100">
              <div class="icon-placeholder" aria-hidden="true">👨‍👩‍👧‍👦</div>
              <h3>User Profile & Multi-User Support</h3>
              <p>Set dietary preferences, allergies, and allow family members to share one household inventory.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="stats">
      <h2>Our Impact in Numbers</h2>
      <div class="container">
        <div class="row text-center g-3">
          <div class="col-6 col-md-3">
            <div class="stat">
              <i class="fa-solid fa-users stat-icon" aria-hidden="true"></i>
              <div class="num">10k+</div>
              <div class="label">Active users</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat">
              <i class="fa-solid fa-leaf stat-icon" aria-hidden="true"></i>
              <div class="num">1.8 Tons</div>
              <div class="label">CO₂e saved</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat">
              <i class="fa-solid fa-trash-arrow-up stat-icon" aria-hidden="true"></i>
              <div class="num">55%</div>
              <div class="label">Less food wastage</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat">
              <i class="fa-solid fa-dollar-sign stat-icon" aria-hidden="true"></i>
              <div class="num">$420k</div>
              <div class="label">Total groceries savings </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Corporate Donation -->
    <section class="corporate-donation">
      <div class="container">
        <div class="row g-4 align-items-start">
          <div class="col-12 col-lg-6">
            <div class="corp-text">
              <h2>Corporate Donation</h2>
              <p>If you share the same vision with us and wish to connect or collaborate, please fill out the connect
                form so we can get back to you and better serve the community.</p>

              <div class="corp-button mb-3">
                <button class="btn-toggle" @click="showForm = !showForm">{{ showForm ? 'Close Form' : 'Connect'
                  }}</button>
              </div>

              <div v-if="showForm" class="corp-form">
                <form @submit.prevent="submitForm">
                  <div class="mb-3">
                    <label for="name" class="form-label fw-bold">Company Name</label>
                    <input id="name" type="text" class="form-control shadow-none" required />
                    <small class="text-muted">We reserve the right to ignore inappropriate submissions.</small>
                  </div>

                  <div class="mb-3">
                    <label for="email" class="form-label fw-bold">Email Address</label>
                    <input id="email" type="email" class="form-control shadow-none" placeholder="Enter your email"
                      required />
                    <small class="text-muted">We will never share your email with anyone else.</small>
                  </div>

                  <button type="submit" class="btn-submit">Submit</button>
                </form>
              </div>
            </div>
          </div>

          <div class="col-12 col-lg-6">
            <div class="corp-image">
              <img src="../assets/corporate.jpg" class="img-fluid rounded-4" alt="Corporate support" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ (simple dedicated section) -->
    <section id="faq" class="faq-simple">
      <div class="container">
        <h2 class="text-center mb-3">Frequently Asked Questions</h2>
        <p class="text-center text-muted mb-4">Quick answers about Eco Pantry, donations, and the app.</p>

        <div class="accordion" id="faqAccordionSimple">
          <!-- 1 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q1">
              <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#a1"
                aria-expanded="true">
                Who can donate through Eco Pantry?
              </button>
            </h2>
            <div id="a1" class="accordion-collapse collapse show" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                Food retailers, wholesalers, farms, corporate canteens, and verified community groups with surplus food.
              </div>
            </div>
          </div>

          <!-- 2 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q2">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a2">
                What items are accepted?
              </button>
            </h2>
            <div id="a2" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                Shelf-stable, chilled, and fresh items within safe consumption windows. We guide handling, storage, and
                category restrictions.
              </div>
            </div>
          </div>

          <!-- 3 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q3">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a3">
                How do pickups or deliveries work?
              </button>
            </h2>
            <div id="a3" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                Donors set pickup windows and notes; recipients confirm in-app. In selected areas, optional courier
                partners are available at cost.
              </div>
            </div>
          </div>

          <!-- 4 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q4">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a4">
                Are there any fees?
              </button>
            </h2>
            <div id="a4" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                Listing and claiming donations is free. Delivery, cold-chain or special handling—if used—may incur
                pass-through charges.
              </div>
            </div>
          </div>

          <!-- 5 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q5">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a5">
                How do expiry alerts and recipe suggestions work?
              </button>
            </h2>
            <div id="a5" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                We track item dates and notify you 3 days, 1 day, and on expiry. The planner suggests “cook-now” recipes
                using items expiring soon.
              </div>
            </div>
          </div>

          <!-- 6 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q6">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a6">
                What about data privacy?
              </button>
            </h2>
            <div id="a6" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                We store the minimum data required, never sell personal info, and let you export or delete your account
                anytime from Settings.
              </div>
            </div>
          </div>

          <!-- 7 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q7">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a7">
                How do companies run a donation campaign?
              </button>
            </h2>
            <div id="a7" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                Submit the corporate form with your campaign name, locations, and volume estimates. We set up contacts
                and reporting for you.
              </div>
            </div>
          </div>

          <!-- 8 -->
          <div class="accordion-item">
            <h2 class="accordion-header" id="q8">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#a8">
                How do I get support?
              </button>
            </h2>
            <div id="a8" class="accordion-collapse collapse" data-bs-parent="#faqAccordionSimple">
              <div class="accordion-body">
                Use the in-app Help, email support, or our contact form. We typically respond within 2 business days.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="testimonials">
      <div class="container">
        <div class="t-wrap text-center">
          <h2 class="t-title">Why People love Eco Pantry</h2>
        </div>

        <div class="row g-4">
          <div class="col-12 col-md-6 col-lg-4">
            <div class="t-card d-flex flex-column h-100">
              <div>
                <div class="t-stars" aria-label="5 out of 5 stars">★★★★★</div>
                <p class="t-quote">“Affordable and efficient. The <strong>real-time ingredient tracking</strong> plus
                  <strong>expiry alerts</strong> stopped my ‘forgotten veggie’ problem. I’m saving money and binning
                  less every week.”
                </p>
              </div>
              <div class="t-author mt-auto d-flex align-items-center gap-2">
                <img src="/public/avatars/f_avatar1.png"
                  alt="Cartoon avatar of a happy chef" />
                <div>
                  <div class="t-name">Jasmine</div>
                  <div class="t-role">Home cook & reseller</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="t-card d-flex flex-column h-100">
              <div>
                <div class="t-stars" aria-label="5 out of 5 stars">★★★★★</div>
                <p class="t-quote">“The <strong>Smart-inventory</strong> is brilliant. It suggests <strong>use-now
                    recipes</strong> for items expiring soon, so stock rotates naturally without me thinking.”</p>
              </div>
              <div class="t-author mt-auto d-flex align-items-center gap-2">
                <img src="/public/avatars/m_avatar2.png"
                  alt="Cartoon avatar of a shop owner" />
                <div>
                  <div class="t-name">Jonathan</div>
                  <div class="t-role">Small business owner</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="t-card d-flex flex-column h-100">
              <div>
                <div class="t-stars" aria-label="5 out of 5 stars">★★★★★</div>
                <p class="t-quote">“A total game changer! Our household shares one pantry via <strong>multi-user
                    profiles</strong>, and the <strong>donation map</strong> makes it easy to list extras. The
                  <strong>analytics</strong> show real savings and CO₂e reduced.”
                </p>
              </div>
              <div class="t-author mt-auto d-flex align-items-center gap-2">
                <img src="/public/avatars/f_avatar2.png"
                  alt="Cartoon avatar of a content creator" />
                <div>
                  <div class="t-name">Ashley</div>
                  <div class="t-role">Content creator</div>
                </div>
              </div>
            </div>
          </div>
        </div> <!-- /row -->
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer-min text-center py-4">
      <p class="mb-0">&copy; 2025 Eco Pantry — All Rights Reserved</p>
    </footer>
  </div>
</template>

<script>
import "./Loading.css"
export default {
  name: "FoodSaverLanding",
  data() {
    return { showForm: false };
  },
  methods: {
    submitForm() {
      alert("Thanks! We'll be in touch.");
      this.showForm = false;
    },
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
};
</script>

