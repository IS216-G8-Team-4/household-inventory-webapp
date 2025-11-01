<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Header -->
      <div class="header">
        <img src="../assets/logo.jpg" alt="Eco Logo" class="logo" />
        <h2 class="title">{{ pageTitle }}</h2>
      </div>

      <!-- Auth Form -->
      <form @submit.prevent="handleSubmit">
        <!-- Email -->
        <div v-if="mode !== 'update'" class="form-group">
          <label>Email</label>
          <input v-model.trim="email" type="email" placeholder="Enter your email" required />
        </div>

        <!-- Password -->
        <div v-if="mode !== 'forgot'" class="form-group">
          <label>{{ mode === 'update' ? 'New Password' : 'Password' }}</label>
          <input v-model="password" type="password" placeholder="Enter your password" required />
        </div>

        <!-- Confirm Password (only when registering) -->
        <div v-if="mode === 'register'" class="form-group">
          <label>Confirm Password</label>
          <input v-model="confirmPassword" type="password" placeholder="Confirm your password" required />
        </div>

        <!-- Submit Button -->
        <button type="submit" class="btn-primary" :disabled="isLoading">
          <span v-if="!isLoading">{{ submitLabel }}</span>
          <span v-else>Processing…</span>
        </button>
      </form>

      <!-- Links -->
      <div class="links" v-if="mode !== 'update'">
        <a v-if="mode === 'login'" @click="switchMode('forgot')">Forgot password?</a>
        <a v-if="mode === 'login'" @click="switchMode('register')">Create account</a>
        <a v-if="mode !== 'login'" @click="switchMode('login')">Back to login</a>
      </div>

      <!-- Feedback -->
      <p v-if="message" class="message">{{ message }}</p>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <img src="../assets/footer.jpg" alt="Green Footer" class="footer-img" />
    </footer>
  </div>
</template>

<script>
import { createClient } from "@supabase/supabase-js";

export default {
  name: "LoginPage",
  data() {
    return {
      mode: "login", // can be: login, register, forgot
      email: "",
      password: "",
      confirmPassword: "",
      message: "",
      isLoading: false,
      sb: null,
    };
  },
  computed: {
    pageTitle() {
      const titles = {
        login: "Login",
        register: "Create Account",
        forgot: "Forgot Password",
      };
      return titles[this.mode];
    },
    submitLabel() {
      const labels = {
        login: "Login",
        register: "Create Account",
        forgot: "Send Reset Link",
      };
      return labels[this.mode];
    },
  },
  async mounted() {
    // Initialize Supabase client once
    this.sb = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: true } }
    );
  },
  methods: {
    switchMode(next) {
      this.mode = next;
      this.message = "";
      this.email = "";
      this.password = "";
      this.confirmPassword = "";
    },

    async handleSubmit() {
      this.message = "";
      this.isLoading = true;

      try {
        if (this.mode === "login") {
          await this.loginUser();
        } else if (this.mode === "register") {
          await this.registerUser();
        } else if (this.mode === "forgot") {
          await this.resetPassword();
        }
      } catch (err) {
        this.message = `❌ ${err.message || "Something went wrong."}`;
      } finally {
        this.isLoading = false;
      }
    },

    // 🔹 LOGIN EXISTING USER
    async loginUser() {
      const { error } = await this.sb.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });
      if (error) throw error;

      this.message = "✅ Login successful!";
      await this.ensureHousehold();
      this.$router.push("/ProfileList");
    },

    // 🔹 REGISTER NEW USER (Auto Login)
    async registerUser() {
      if (this.password !== this.confirmPassword) {
        this.message = "❌ Passwords do not match!";
        return;
      }

      // 1️⃣ Create user (no email verification)
      const { error: signUpError } = await this.sb.auth.signUp({
        email: this.email,
        password: this.password,
        options: { emailRedirectTo: null },
      });
      if (signUpError) throw signUpError;

      // 2️⃣ Log them in immediately
      const { error: loginError } = await this.sb.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });
      if (loginError) throw loginError;

      // 3️⃣ Ensure household exists
      await this.ensureHousehold();

      this.message = "🎉 Account created! Logged in successfully.";
      this.$router.push("/ProfileList");
    },

    // 🔹 SEND PASSWORD RESET EMAIL
    async resetPassword() {
      const { error } = await this.sb.auth.resetPasswordForEmail(this.email);
      if (error) throw error;
      this.message = "📧 Password reset link has been sent!";
    },

    // 🔹 Ensure household entry exists
    async ensureHousehold() {
      const { data: { user } } = await this.sb.auth.getUser();
      if (!user) return;

      const { data: existing } = await this.sb
        .from("households")
        .select("id")
        .eq("created_by", user.id)
        .maybeSingle();

      if (!existing) {
        await this.sb.from("households").insert({
          name: user.email,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    },
  },
};
</script>

<style scoped>
.auth-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  background: #f3f7f0;
  font-family: system-ui, -apple-system, sans-serif;
}

.auth-card {
  background: #fff;
  padding: 2rem;
  border-radius: 16px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  margin: 4rem auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.logo {
  width: 38px;
  height: 38px;
}

.title {
  font-size: 1.6rem;
  font-weight: 600;
  color: #2e7d32;
}

.form-group {
  text-align: left;
  margin-bottom: 1rem;
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.3rem;
}

input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

input:focus {
  border-color: #3b82f6;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background-color: #3b82f6;
  border: none;
  border-radius: 10px;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.links {
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.links a {
  color: #3b82f6;
  cursor: pointer;
  text-decoration: none;
}

.links a:hover {
  text-decoration: underline;
}

.message {
  margin-top: 1rem;
  color: #444;
  font-size: 0.95rem;
}

.footer {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.footer-img {
  width: 100%;
  object-fit: cover;
  display: block;
}
</style>
