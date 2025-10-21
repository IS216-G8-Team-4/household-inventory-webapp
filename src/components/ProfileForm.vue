<template>
  <div class="profile-form-container">
    <h2>Create a New Profile</h2>

    <form @submit.prevent="createProfile">
      <div class="form-group">
        <label>Profile Name</label>
        <input v-model="profileName" type="text" placeholder="Enter profile name" required />
      </div>

      <div class="form-group">
        <label>Food Allergens (comma-separated)</label>
        <input v-model="foodAllergens" type="text" placeholder="e.g. peanuts, shellfish" />
      </div>

      <div class="form-group">
        <label>Dietary Preferences (JSON format or leave empty)</label>
        <textarea v-model="dietaryPreferences" rows="2" placeholder='e.g. ["vegetarian","halal"]'></textarea>
      </div>

      <div class="form-group">
        <label>Preferred Cuisines (comma-separated)</label>
        <input v-model="preferredCuisines" type="text" placeholder="e.g. Italian, Chinese" />
      </div>

      <button type="submit" class="btn-primary" :disabled="isBusy">
        <span v-if="!isBusy">Create Profile</span>
        <span v-else>Creating...</span>
      </button>

      <p class="message">{{ message }}</p>
    </form>
  </div>
</template>

<script>
import { createClient } from "@supabase/supabase-js";

export default {
  name: "CreateProfile",
  data() {
    return {
      profileName: "",
      foodAllergens: "",
      dietaryPreferences: "",
      preferredCuisines: "",
      message: "",
      isBusy: false,
      sb: null,
    };
  },
  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, { auth: { persistSession: true } });
  },
  methods: {
    async createProfile() {
      this.isBusy = true;
      this.message = "";

      try {
        // 1️⃣ Get current logged-in user
        const { data: { user }, error: userError } = await this.sb.auth.getUser();
        if (userError || !user) throw new Error("User not logged in");

        // 2️⃣ Find the household
        const { data: householdRows } = await this.sb
          .from("households")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);

        const householdId = householdRows?.[0]?.id;
        if (!householdId) throw new Error("Household not found");

        // 3️⃣ Insert the new profile
        const { error } = await this.sb.from("profiles").insert({
          profile_name: this.profileName.trim(),
          household_id: householdId,
          food_allergens: this.foodAllergens
            ? this.foodAllergens.split(",").map((a) => a.trim())
            : [],
          dietary_preferences: this.dietaryPreferences
            ? JSON.parse(this.dietaryPreferences)
            : [],
          preferred_cuisines: this.preferredCuisines
            ? this.preferredCuisines.split(",").map((c) => c.trim())
            : [],
          is_active: false,
        });

        if (error) throw error;
        this.message = "✅ Profile created successfully!";
        this.profileName = this.foodAllergens = this.dietaryPreferences = this.preferredCuisines = "";
      } catch (e) {
        this.message = `❌ ${e.message}`;
      } finally {
        this.isBusy = false;
      }
      this.$router.push("/Dashboard");
    },
  },
};
</script>

<style scoped>
.profile-form-container {
  max-width: 420px;
  background: #fff;
  padding: 2rem;
  margin: 2rem auto;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-family: system-ui, sans-serif;
}

h2 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
  text-align: left;
}

.form-group label {
  font-weight: 500;
  display: block;
  margin-bottom: 0.4rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.message {
  margin-top: 1rem;
  text-align: center;
}
</style>
