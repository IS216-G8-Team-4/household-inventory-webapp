
    <template>
      <!-- (Optional) Font Awesome; keep only if you use FA icons -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        crossorigin="anonymous" referrerpolicy="no-referrer" />
      <div class="page">

        <!-- Hero Section -->
        <section class="hero text-center">
          <h1>Reduce Food Waste, Save Money & Eat Sustainably</h1>
          <p>
            Track your household ingredients, get recipe suggestions, and share surplus food responsibly
            to promote sustainable living.
          </p>
          <div class="button-group d-flex justify-content-center gap-3">
            <button class="btn">Log In</button>
            <button class="btn">Sign Up</button>
          </div>
        </section>

        <!-- Features (Bootstrap grid: 3 per row lg, 2 per row md, 1 per row sm) -->
        <section class="features text-center">
          <h2>Key Features</h2>
          <div class="container">
            <div class="row g-4">
              <div class="col-12 col-md-6 col-lg-4">
                <div class="feature-card h-100">
                  <div class="icon-placeholder">🥦</div>
                  <h3>Real-time Ingredient Tracking</h3>
                  <p>Monitor your fridge inventory and expiry dates to reduce forgotten ingredients and minimize waste.
                  </p>
                </div>
              </div>
              <div class="col-12 col-md-6 col-lg-4">
                <div class="feature-card h-100">
                  <div class="icon-placeholder">🍳</div>
                  <h3>Personalized Meal Planning</h3>
                  <p>Get recipe suggestions based on your inventory, dietary goals, and cuisine preferences.</p>
                </div>
              </div>
              <div class="col-12 col-md-6 col-lg-4">
                <div class="feature-card h-100">
                  <div class="icon-placeholder">🤝</div>
                  <h3>Donation & Sharing</h3>
                  <p>Easily donate surplus food and find nearby items using integrated maps and availability tracking.
                  </p>
                </div>
              </div>
              <div class="col-12 col-md-6 col-lg-4">
                <div class="feature-card h-100">
                  <div class="icon-placeholder">⏰</div>
                  <h3>Expiry Alerts</h3>
                  <p>Receive notifications 3 days, 1 day, and on expiry to help reduce waste and prioritize usage.</p>
                </div>
              </div>
              <div class="col-12 col-md-6 col-lg-4">
                <div class="feature-card h-100">
                  <div class="icon-placeholder">📊</div>
                  <h3>Analytics Dashboard</h3>
                  <p>Track your food wastage, cost savings, environmental impact, and consumption patterns over time.
                  </p>
                </div>
              </div>
              <div class="col-12 col-md-6 col-lg-4">
                <div class="feature-card h-100">
                  <div class="icon-placeholder">👨‍👩‍👧‍👦</div>
                  <h3>User Profile & Multi-User Support</h3>
                  <p>Set up dietary preferences, allergies, and allow family members to share the same household
                    inventory.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Corporate Donation (Bootstrap grid) -->
        <section class="corporate-donation">
          <div class="container">
            <div class="row g-4 align-items-start">
              <div class="col-12 col-lg-6">
                <div class="corp-text">
                  <h2>Corporate Donation</h2>
                  <p>
                    If you share the same vision with us and wish to connect or collaborate,
                    please fill out the connect form so we can get back to you and better serve the community.
                  </p>

                  <div class="corp-button mb-3">
                    <button class="btn-toggle" @click="showForm = !showForm">
                      {{ showForm ? 'Close Form' : 'Participate' }}
                    </button>
                  </div>

                  <div v-if="showForm" class="corp-form">
                    <form @submit.prevent="submitForm">
                      <div class="mb-3">
                        <label for="name" class="form-label fw-bold">Full Name</label>
                        <input type="text" id="name" class="form-control shadow-none" placeholder="Enter your name"
                          required />
                        <small class="text-muted">We reserve the right to ignore inappropriate submissions.</small>
                      </div>

                      <div class="mb-3">
                        <label for="email" class="form-label fw-bold">Email Address</label>
                        <input type="email" id="email" class="form-control shadow-none" placeholder="Enter your email"
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

        <hr class="divider" />

        <!-- Testimonials (Bootstrap grid) -->
        <section class="testimonials">
          <div class="container">
            <div class="t-wrap text-center">
              <h2 class="t-title">People love Eco Pantry</h2>
            </div>

            <div class="row g-4">
              <div class="col-12 col-md-6 col-lg-4">
                <div class="t-card d-flex flex-column h-100">
                  <div>
                    <div class="t-stars" aria-label="5 out of 5 stars">★★★★★</div>
                    <p class="t-quote">
                      “Affordable and efficient. The <strong>real-time ingredient tracking</strong> plus
                      <strong>expiry alerts</strong> stopped my ‘forgotten veggie’ problem. I’m saving money and binning
                      less every week.”
                    </p>
                  </div>
                  <div class="t-author mt-auto d-flex align-items-center gap-2">
                    <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=SunnyChef"
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
                    <p class="t-quote">
                      “The <strong>Smart-inventory</strong> is brilliant. It suggests
                      <strong>use-now recipes</strong> for items expiring soon, so stock rotates naturally without me
                      thinking.”
                    </p>
                  </div>
                  <div class="t-author mt-auto d-flex align-items-center gap-2">
                    <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=ShopOwnerSue"
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
                    <p class="t-quote">
                      “A total game changer! Our household shares one pantry via <strong>multi-user profiles</strong>,
                      and the <strong>donation map</strong> makes it easy to list extras. The
                      <strong>analytics</strong> show real savings and CO₂e reduced.”
                    </p>
                  </div>
                  <div class="t-author mt-auto d-flex align-items-center gap-2">
                    <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=CreatorJake"
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
        <footer class="footer-new">
          <div class="footer-bottom container text-center">
            <hr />
            <p class="mb-0">&copy; 2025 FoodSaver — All Rights Reserved</p>
          </div>
          <button id="scrollTop" @click="scrollToTop"><i class="fas fa-arrow-up"></i></button>
        </footer>

      </div>
    </template>

    <script>
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

    <style scoped>
      .page {
        min-height: 100vh;
        background-color: #f9fafb;
        display: flex;
        flex-direction: column;
        font-family: "Segoe UI", Roboto, sans-serif;
        color: #333;
      }

      /* Hero */
      .hero {
        background-color: #16a34a;
        color: #fff;
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

      .btn {
        background-color: #fff;
        color: #15803d;
        font-weight: 600;
        padding: 0.5rem 1.5rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color .2s;
      }

      .btn:hover {
        background-color: #f3f4f6;
      }

      /* Features */
      .features {
        padding: 4rem 1.5rem;
      }

      .features h2 {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 2rem;
      }

      .feature-card {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, .1);
        padding: 1.5rem;
        text-align: left;
        transition: box-shadow .2s;
      }

      .feature-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, .15);
      }

      .icon-placeholder {
        font-size: 2rem;
        margin-bottom: .75rem;
      }

      /* Corporate Donation */
      .corporate-donation {
        padding: 3rem 1.5rem;
      }

      .corp-text h2 {
        font-size: 1.75rem;
        color: #14532d;
        margin-bottom: .75rem;
      }

      .corp-text p {
        color: #334155;
        margin-bottom: 1rem;
      }

      .btn-toggle {
        background-color: #16a34a;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: .55rem 1.05rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color .2s;
      }

      .btn-toggle:hover {
        background-color: #15803d;
      }

      .corp-form {
        background: #fff;
        border-radius: 12px;
        padding: 1.25rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, .06);
        max-width: 520px;
      }

      .btn-submit {
        background-color: #16a34a;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: .55rem 1.1rem;
        font-weight: 700;
        cursor: pointer;
      }

      .btn-submit:hover {
        background-color: #15803d;
      }

      /* Testimonials */
      .testimonials {
        background: #fff;
        padding: 4rem 1.5rem 3rem;
      }

      .t-title {
        font-size: clamp(1.8rem, 3.6vw, 3rem);
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 2rem;
      }

      .t-card {
        background: #f3f4f6;
        border-radius: 18px;
        padding: 1.25rem;
        box-shadow: 0 1px 0 rgba(17, 24, 39, .02);
      }

      .t-stars {
        letter-spacing: 2px;
        color: #f4b000;
        font-size: 1.1rem;
        margin-bottom: .75rem;
      }

      .t-quote {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.55;
        margin-bottom: 1rem;
      }

      .t-author img {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #fff;
      }

      /* Footer */
      .footer-new {
        background: #15803d;
        color: #fff;
        padding: 2rem 1.5rem 1.25rem;
        text-align: center;
        margin-top: auto;
      }

      .footer-new hr {
        height: 1px;
        border: 0;
        background: rgba(255, 255, 255, .2);
      }

      #scrollTop {
        position: fixed;
        bottom: 20px;
        right: 25px;
        background: #16a34a;
        border: none;
        border-radius: 50%;
        width: 45px;
        height: 45px;
        color: #fff;
        cursor: pointer;
        font-size: 1.25rem;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background-color .2s, transform .2s;
        box-shadow: 0 4px 10px rgba(0, 0, 0, .2);
      }

      #scrollTop:hover {
        background: #15803d;
        transform: translateY(-3px);
      }
    </style>
