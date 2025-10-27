<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Header -->
      <div class="header">
        <img src="../assets/logo.jpg" alt="Eco Logo" class="logo" />
        <h2 class="title">{{ pageTitle }}</h2>
      </div>

      <!-- Main Form -->
      <form @submit.prevent="onSubmit">
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

        <!-- Confirm Password -->
        <div v-if="mode === 'register'" class="form-group">
          <label>Confirm Password</label>
          <input v-model="confirmPassword" type="password" placeholder="Confirm your password" required />
        </div>

        <button type="submit" class="btn-primary" :disabled="isBusy">
          <span v-if="!isBusy">{{ submitLabel }}</span>
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
  name: "Login",
  data() {
    return {
      mode: "login",
      isBusy: false,
      message: "",
      email: "",
      password: "",
      confirmPassword: "",
      sb: null,
    };
  },
  computed: {
    pageTitle() {
      if (this.mode === "login") return "Login";
      if (this.mode === "register") return "Create Account";
      if (this.mode === "forgot") return "Forgot Password";
      return "Update Password";
    },
    submitLabel() {
      if (this.mode === "login") return "Login";
      if (this.mode === "register") return "Create Account";
      if (this.mode === "forgot") return "Send Reset Link";
      return "Update Password";
    },
  },
  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, { auth: { persistSession: true } });

    if (window.location.href.includes("type=recovery")) {
      this.mode = "update";
      this.message = "🔒 Please set your new password.";
    }
  },
  methods: {
    switchMode(next) {
      this.mode = next;
      this.message = "";
    },

    async onSubmit() {
      this.message = "";
      this.isBusy = true;
      try {
        if (this.mode === "login") await this.loginOrAutoCreate();
        else if (this.mode === "register") await this.register();
        else if (this.mode === "forgot") await this.forgot();
        else if (this.mode === "update") await this.updatePassword();
      } catch (e) {
        this.message = `❌ ${e.message || "Something went wrong."}`;
      } finally {
        this.isBusy = false;
      }
    },

    // Login or auto-create account + household
    async loginOrAutoCreate() {
      const { error: loginError, data: loginData } = await this.sb.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });

      if (!loginError) {
        // Successful login → ensure household exists
        await this.ensureHousehold();
        this.message = "Login successful!";
        this.$router.push("/ProfileList");
      }

      // If login fails due to invalid credentials
      const msg = (loginError.message || "").toLowerCase();
      const invalid = msg.includes("invalid login credentials");

      if (!invalid) throw loginError;

      // Otherwise, sign up automatically
      const { error: signUpErr, data: signUpData } = await this.sb.auth.signUp({
        email: this.email,
        password: this.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?type=recovery`,
        },
      });
      if (signUpErr) throw signUpErr;

      this.message = "A confirmation email has been sent to create your account.";
    },

    async register() {
      if (this.password !== this.confirmPassword) {
        this.message = "❌ Passwords do not match!";
        return;
      }

      const { error } = await this.sb.auth.signUp({
        email: this.email,
        password: this.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?type=recovery`,
        },
      });
      if (error) throw error;

      this.message = "Check your inbox to confirm your account.";
    },

    async forgot() {
      const { error } = await this.sb.auth.resetPasswordForEmail(this.email, {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      });
      if (error) throw error;
      this.message = "📧 Password reset link sent!";
    },

    async updatePassword() {
      const { error } = await this.sb.auth.updateUser({ password: this.password });
      if (error) throw error;
      this.message = "✅ Password updated! You can now log in.";
      this.switchMode("login");
    },

    // Create household if it doesn't exist
    async ensureHousehold() {
      const { data: { user }, error: userError } = await this.sb.auth.getUser();
      if (userError || !user) {
        console.error("User not logged in:", userError);
        return null;
      }

      // Try to find existing household
      const { data: existing, error: selectError } = await this.sb
        .from("households")
        .select("id")
        .eq("created_by", user.id)
        .limit(1)
        .single();

      if (!selectError && existing) {
        return existing.id; // ✅ Found
      }

      // If not found, try to create one (should rarely happen if trigger works)
      const { data: inserted, error: insertError } = await this.sb
        .from("households")
        .insert({
          name: user.email,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to create household:", insertError);
        return null;
      }

      return inserted.id;
    }
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

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.3rem;
}

.form-group input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
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
  transition: background-color 0.2s;
}

.btn-primary[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
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
  bottom: 0;
}

.footer-img {
  width: 100%;
  object-fit: cover;
  display: block;
}
</style>
