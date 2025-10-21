<template>
  <div class="profile-list-container">
    <h2>Your Household Profiles</h2>

    <div v-if="isBusy" class="loading">Loading profiles...</div>
    <div v-else-if="profiles.length === 0" class="empty">
      No profiles found. <router-link to="/ProfileForm">Create one</router-link>
    </div>

    <div v-else class="profiles-grid">
      <!-- Profile Cards -->
      <div
        v-for="p in profiles"
        :key="p.id"
        class="profile-card"
        :class="{ active: p.is_active }"
        @mouseenter="hoverProfile = p.id"
        @mouseleave="hoverProfile = null"
      >
        <div class="edit-icon" v-if="hoverProfile === p.id" @click="goToEditProfile(p.id)">
          ✎
        </div>

        <h3>{{ p.profile_name }}</h3>
        <p><strong>Allergens:</strong> {{ p.food_allergens?.join(", ") || "None" }}</p>
        <p><strong>Cuisines:</strong> {{ p.preferred_cuisines?.join(", ") || "None" }}</p>

        <button v-if="!p.is_active" @click="setActive(p.id)" class="btn-secondary">
          Set Active
        </button>
        <span v-else class="active-label">Active</span>
      </div>

      <!-- Add New Profile Card -->
      <div class="profile-card add-profile" @click="goToCreateProfile">
        <div class="plus-icon">+</div>
        <p>Add Profile</p>
      </div>
    </div>


    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<script>
import { createClient } from "@supabase/supabase-js";

export default {
  name: "ProfileList",
  data() {
    return {
      profiles: [],
      message: "",
      isBusy: false,
      sb: null,
      hoverProfile: null, // hover state for edit icon
    };
  },
  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, { auth: { persistSession: true } });
    await this.loadProfiles();
  },
  methods: {
    async loadProfiles() {
      this.isBusy = true;
      try {
        const { data: { user } } = await this.sb.auth.getUser();
        if (!user) throw new Error("User not logged in");

        const { data: householdRows } = await this.sb
          .from("households")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);

        const householdId = householdRows?.[0]?.id;
        if (!householdId) throw new Error("Household not found");

        const { data, error } = await this.sb
          .from("profiles")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        this.profiles = data;
      } catch (e) {
        this.message = `❌ ${e.message}`;
      } finally {
        this.isBusy = false;
      }
    },

    async setActive(profileId) {
      try {
        const { data: { user } } = await this.sb.auth.getUser();
        const { data: householdRows } = await this.sb
          .from("households")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);

        const householdId = householdRows?.[0]?.id;

        await this.sb.from("profiles").update({ is_active: false }).eq("household_id", householdId);
        await this.sb.from("profiles").update({ is_active: true }).eq("id", profileId);

        window.dispatchEvent(new CustomEvent("activeProfileChanged", { detail: { newActiveId: profileId } }));

        await this.sb
          .from("profiles")
          .update({ is_active: false })
          .eq("household_id", householdId);

        await this.sb
          .from("profiles")
          .update({ is_active: true })
          .eq("id", profileId);

        this.message = "Active profile updated!";
        await this.loadProfiles();
      } catch (e) {
        this.message = `❌ ${e.message}`;
      }
      this.$router.push("/Dashboard");
    },

    goToCreateProfile() {
      this.$router.push("/ProfileForm");
    },

    goToManageProfiles() {
      this.$router.push("/manage-profiles");
    },

    goToEditProfile(profileId) {
      this.$router.push(`/ProfileEdit/${profileId}`);
    },
  },
};
</script>

<style scoped>
/* Container */
.profile-list-container {
  max-width: 900px;
  margin: 2rem auto;
  padding: 1rem;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-family: system-ui, sans-serif;
}

h2 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 1.5rem;
}

.profiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  justify-items: center;
}

/* Card */
.profile-card {
  position: relative; /* required for edit icon */
  background: #f9fafb;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #ddd;
  width: 160px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-card:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  z-index: 10;
}

/* Active card */
.profile-card.active {
  border-color: #2e7d32;
  background: #e8f5e9;
}

/* Add profile card */
.add-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  font-weight: bold;
}

.add-profile .plus-icon {
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: 0.2rem;
}

/* Edit icon */
.edit-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.6);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  text-align: center;
  line-height: 24px;
  cursor: pointer;
  font-size: 14px;
}

/* Buttons */
.btn-secondary {
  margin-top: 0.5rem;
  padding: 0.4rem 0.8rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background: #2563eb;
}

.active-label {
  display: inline-block;
  margin-top: 0.5rem;
  color: #2e7d32;
  font-weight: 600;
}

.manage-container {
  margin-top: 2rem;
  text-align: center;
}

.btn-manage {
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: none;
  background: #2e7d32;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.btn-manage:hover {
  background: #1b5e20;
}

.message {
  margin-top: 1rem;
  text-align: center;
}

.empty, .loading {
  text-align: center;
  color: #777;
}
</style>
