<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Header -->
      <h2 class="title">
        {{ mode === 'login' ? 'Login' : mode === 'register' ? 'Create Account' : 'Forgot Password' }}
      </h2>

      <!-- Login / Register / Forgot Password Form -->
      <form @submit.prevent="handleSubmit">
        <!-- Email -->
        <div class="form-group">
          <label>Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="Enter your email"
            required
          />
        </div>

        <!-- Password (only for login & register) -->
        <div v-if="mode !== 'forgot'" class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Enter your password"
            required
          />
        </div>

        <!-- Confirm Password (only for register) -->
        <div v-if="mode === 'register'" class="form-group">
          <label>Confirm Password</label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            required
          />
        </div>

        <!-- Submit Button -->
        <button type="submit" class="btn-primary">
          {{ mode === 'login' ? 'Login' : mode === 'register' ? 'Create Account' : 'Reset Password' }}
        </button>
      </form>

      <!-- Links -->
      <div class="links">
        <a v-if="mode === 'login'" @click="mode = 'forgot'">Forgot password?</a>
        <a v-if="mode === 'login'" @click="mode = 'register'">Create account</a>
        <a v-if="mode !== 'login'" @click="mode = 'login'">Back to login</a>
      </div>

      <!-- Message -->
      <p v-if="message" class="message">{{ message }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: "AuthPage",
  data() {
    return {
      mode: "login", // login | register | forgot
      email: "",
      password: "",
      confirmPassword: "",
      message: ""
    };
  },
  methods: {
    handleSubmit() {
      if (this.mode === "login") {
        if (this.email === "test@example.com" && this.password === "123456") {
          this.message = "✅ Login successful!";
        } else {
          this.message = "❌ Invalid email or password.";
        }
      } else if (this.mode === "register") {
        if (this.password !== this.confirmPassword) {
          this.message = "❌ Passwords do not match!";
        } else {
          this.message = "✅ Account created successfully!";
        }
      } else if (this.mode === "forgot") {
        this.message = "📧 Password reset link sent to your email!";
      }
    }
  }
};
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f2f4f7;
  font-family: system-ui, -apple-system, sans-serif;
}

.auth-card {
  background: #fff;
  padding: 2rem;
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.title {
  font-size: 1.6rem;
  font-weight: 600;
  margin-bottom: 1.2rem;
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
  color: #555;
  font-size: 0.95rem;
}
</style>
