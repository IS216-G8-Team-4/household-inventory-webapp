<template>
  <div class="edit-profile-container">
    <h2>Edit Profile</h2>

    <form @submit.prevent="updateProfile">
      <label>Profile Name:</label>
      <input v-model="profile_name" required />

      <label>Allergens (comma separated):</label>
      <input v-model="food_allergens" placeholder="Peanuts, Dairy" />

      <label>Preferred Cuisines (comma separated):</label>
      <input v-model="preferred_cuisines" placeholder="Italian, Chinese" />

      <div class="button-group">
        <button type="submit" class="btn-update">Update Profile</button>
        <button type="button" class="btn-delete" @click="deleteProfile">Delete Profile</button>
      </div>
    </form>

    <p v-if="message">{{ message }}</p>
  </div>
</template>


<script>
import { createClient } from "@supabase/supabase-js";

export default {
  name: "ProfileFormEdit",
  data() {
    return {
      sb: null,
      profileId: null,
      profile_name: "",
      food_allergens: "",
      preferred_cuisines: "",
      message: "",
    };
  },
  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, { auth: { persistSession: true } });

    // Access the route param using this.$route.params
    this.profileId = this.$route.params.id;
    await this.loadProfile();
  },
  methods: {
    async loadProfile() {
      try {
        const { data, error } = await this.sb
          .from("profiles")
          .select("*")
          .eq("id", this.profileId)
          .single(); // fetch a single row

        if (error) throw error;

        this.profile_name = data.profile_name;
        this.food_allergens = data.food_allergens?.join(", ") || "";
        this.preferred_cuisines = data.preferred_cuisines?.join(", ") || "";
      } catch (e) {
        this.message = `❌ ${e.message}`;
      }
    },

    async updateProfile() {
      try {
        const { error } = await this.sb
          .from("profiles")
          .update({
            profile_name: this.profile_name,
            food_allergens: this.food_allergens
              .split(",")
              .map((s) => s.trim()),
            preferred_cuisines: this.preferred_cuisines
              .split(",")
              .map((s) => s.trim()),
          })
          .eq("id", this.profileId);

        if (error) throw error;
        this.message = "✅ Profile updated!";
      } catch (e) {
        this.message = `❌ ${e.message}`;
      }
    this.$router.push("/ProfileList");
    },

    async deleteProfile() {
      if (!confirm("Are you sure you want to delete this profile?")) return;

      try {
        const { error } = await this.sb
          .from("profiles")
          .delete()
          .eq("id", this.profileId);

        if (error) throw error;

        this.message = "✅ Profile deleted!";
        setTimeout(() => this.$router.push("/profile-list"), 800);
      } catch (e) {
        this.message = `❌ ${e.message}`;
      }
    },
  },
};
</script>


<style scoped>
.edit-profile-container {
  max-width: 500px;
  margin: 2rem auto;
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

form {
  display: flex;
  flex-direction: column;
}

input {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #ccc;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn-update {
  background-color: #2e7d32;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-delete {
  background-color: #b71c1c;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-update:hover { background-color: #1b5e20; }
.btn-delete:hover { background-color: #7f0000; }
</style>
