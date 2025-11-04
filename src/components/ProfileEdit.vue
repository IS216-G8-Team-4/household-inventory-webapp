<script>
import { createClient } from "@supabase/supabase-js";
import { useUserStore } from "@/stores/userStore.js";

export default {
  name: "ProfileFormEdit",
  data() {
    return {
      sb: null,
      profileId: null,
      profile_name: "",
      food_allergens: "",
      preferred_cuisines: "",
      avatar_url: "",
      showToast: false,
      toastMessage: "",
      toastType: "",
      showDeleteConfirm: false, // ✅ for custom delete confirmation
      availableAvatars: [
        "f_avatar1.png",
        "f_avatar2.png",
        "f_avatar3.png",
        "default.png",
        "m_avatar1.png",
        "m_avatar2.png",
        "m_avatar3.png",
      ],
    };
  },

  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

    this.profileId = this.$route.params.id;
    await this.loadProfile();
  },

  methods: {
    async loadProfile() {
      try {
        const { data, error } = await this.sb
          .from("profiles")
          .select("profile_name, food_allergens, preferred_cuisines")
          .eq("id", this.profileId)
          .single();

        if (error) throw error;

        this.profile_name = data.profile_name || "";
        this.food_allergens = (data.food_allergens || []).join(", ");
        this.preferred_cuisines = (data.preferred_cuisines || []).join(", ");

        const localAvatar = localStorage.getItem(`avatar_${this.profileId}`) || "default.png";
        this.avatar_url = localAvatar;

        const store = useUserStore();
        store.setAvatar(localAvatar);
      } catch (e) {
        console.error("Failed to load profile:", e.message);
      }
    },

    selectAvatar(avatar) {
      this.avatar_url = avatar;
      localStorage.setItem(`avatar_${this.profileId}`, avatar);
      const store = useUserStore();
      store.setAvatar(avatar);
      this.showToastMsg("✅ Profile picture updated locally!", "success");
    },

    showToastMsg(message, type) {
      this.toastMessage = message;
      this.toastType = type;
      this.showToast = true;
      setTimeout(() => (this.showToast = false), 3000);
    },

    async updateProfile() {
      try {
        const allergensArray = this.food_allergens
          ? this.food_allergens.split(",").map((a) => a.trim()).filter(Boolean)
          : [];
        const cuisinesArray = this.preferred_cuisines
          ? this.preferred_cuisines.split(",").map((c) => c.trim()).filter(Boolean)
          : [];

        const { error } = await this.sb
          .from("profiles")
          .update({
            profile_name: this.profile_name,
            food_allergens: allergensArray,
            preferred_cuisines: cuisinesArray,
          })
          .eq("id", this.profileId);

        if (error) throw error;

        const cleanAvatar = this.avatar_url.replace(/^\/?avatars\//, "").trim();
        localStorage.setItem(`avatar_${this.profileId}`, cleanAvatar);
        localStorage.setItem("userAvatar", cleanAvatar);

        const store = useUserStore();
        store.setAvatar(cleanAvatar);

        this.showToastMsg("✅ Profile updated successfully!", "success");
        await new Promise((r) => setTimeout(r, 800));
        this.$router.push("/ProfileList");
      } catch (e) {
        console.error("Failed to update profile:", e.message);
        this.showToastMsg(`❌ ${e.message}`, "error");
      }
    },

    // ✅ Replaced confirm() with custom toast-style confirmation
    deleteProfile() {
      this.showDeleteConfirm = true;
    },

    cancelDelete() {
      this.showDeleteConfirm = false;
    },

    async confirmDelete() {
      this.showDeleteConfirm = false;
      try {
        const { error } = await this.sb
          .from("profiles")
          .delete()
          .eq("id", this.profileId);
        if (error) throw error;

        localStorage.removeItem(`avatar_${this.profileId}`);
        const store = useUserStore();
        store.setAvatar("default.png");

        this.showToastMsg("🗑 Profile deleted successfully!", "success");
        await new Promise((r) => setTimeout(r, 1000));
        this.$router.push("/ProfileList");
      } catch (e) {
        console.error("Failed to delete profile:", e.message);
        this.showToastMsg(`❌ ${e.message}`, "error");
      }
    },

    cancelEdit() {
      this.$router.push("/ProfileList");
    },
  },
};
</script>

<template>
  <div class="edit-profile-wrapper">
    <div class="edit-profile-container">
      <div class="profile-header">
        <div class="icon-circle">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="white" stroke-width="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h2>Edit Profile</h2>
        <p class="subtitle">Update your personal information and preferences</p>
      </div>

      <div class="profile-form">
        <!-- Avatar -->
        <div class="avatar-section">
          <h3 class="avatar-title">Profile Picture</h3>
          <img :src="'/avatars/' + avatar_url" alt="Current Avatar" class="current-avatar" />
          <div class="avatar-grid">
            <div
              v-for="(avatar, index) in availableAvatars"
              :key="index"
              class="avatar-option"
              :class="{ active: avatar === avatar_url }"
              @click="selectAvatar(avatar)"
            >
              <img :src="'/avatars/' + avatar" :alt="'Avatar ' + index" />
            </div>
          </div>
        </div>

        <!-- Profile Fields -->
        <div class="form-group">
          <label><span class="label-icon">👤</span> Profile Name</label>
          <input v-model="profile_name" type="text" placeholder="Enter your name" class="form-input" />
        </div>

        <div class="form-group">
          <label><span class="label-icon">⚠️</span> Food Allergens</label>
          <input v-model="food_allergens" type="text" placeholder="e.g., Peanuts, Dairy, Shellfish" class="form-input" />
        </div>

        <div class="form-group">
          <label><span class="label-icon">🍽️</span> Preferred Cuisines</label>
          <input v-model="preferred_cuisines" type="text" placeholder="e.g., Italian, Chinese, Mexican" class="form-input" />
        </div>

        <!-- Buttons -->
        <div class="button-group">
          <button class="btn btn-update" @click="updateProfile">💾 Save Changes</button>
          <button class="btn btn-cancel" @click="cancelEdit">✖ Cancel</button>
        </div>

        <button type="button" class="btn btn-delete" @click="deleteProfile">🗑 Delete Profile</button>
      </div>
    </div>

    <!-- ✅ Custom confirmation toast (same design theme, minimal) -->
    <transition name="fade">
      <div v-if="showDeleteConfirm" class="confirm-toast">
        <div class="confirm-header">
          <div class="confirm-icon">⚠️</div>
          <div class="confirm-text">
            <strong>Confirm Delete</strong>
            <p>This action cannot be undone.</p>
          </div>
        </div>
        <div class="confirm-actions">
          <button class="confirm-btn delete" @click="confirmDelete">Yes, Delete</button>
          <button class="confirm-btn cancel" @click="cancelDelete">Cancel</button>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="showToast" class="toast" :class="toastType">{{ toastMessage }}</div>
    </transition>
  </div>
</template>

<style scoped>
.confirm-toast {
  position: fixed;
  bottom: 25px;
  right: 25px;
  background: #ecfdf5;
  border-left: 6px solid #22c55e;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 18px 20px;
  width: 320px;
  animation: slideUp 0.3s ease-out;
  color: #065f46;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.confirm-header {
  display: flex;
  gap: 10px;
  align-items: center;
}

.confirm-icon {
  font-size: 1.8rem;
}

.confirm-text strong {
  color: #064e3b;
  font-weight: 700;
}

.confirm-text p {
  margin: 2px 0 0;
  font-size: 0.9rem;
  color: #047857;
}

.confirm-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.confirm-btn {
  flex: 1;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s ease;
}

.confirm-btn.delete {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.confirm-btn.cancel {
  background: #f5f5f5;
  color: #444;
}

.confirm-btn.delete:hover {
  background: linear-gradient(135deg, #16a34a, #15803d);
}

.confirm-btn.cancel:hover {
  background: #e0e0e0;
}

.icon-circle {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 24px;
  border-radius: 10px;
  font-weight: 600;
  color: white;
  z-index: 9999;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
}

.toast.success {
  background: linear-gradient(135deg, #43a047, #2e7d32);
}

.toast.error {
  background: linear-gradient(135deg, #e53935, #c62828);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.4s ease;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

/* Existing layout */
.avatar-section {
  text-align: center;
  margin-bottom: 2rem;
}

.avatar-title {
  font-weight: 600;
  color: #2e7d32;
  margin-bottom: 1rem;
}

.current-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #2e7d32;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2);
  margin-bottom: 1rem;
}

.avatar-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.avatar-option {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: 0.2s ease;
}

.avatar-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-option:hover {
  transform: scale(1.08);
}

.avatar-option.active {
  border-color: #2e7d32;
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.2);
}

.edit-profile-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%);
  padding: 2rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-profile-container {
  max-width: 600px;
  width: 100%;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideUp 0.5s ease-out;
}

.profile-header {
  background: linear-gradient(135deg, #2e7d32 0%, #388e3c 100%);
  color: white;
  padding: 3rem 2rem 2.5rem;
  text-align: center;
}

.subtitle {
  opacity: 0.9;
  font-size: 0.95rem;
}

.profile-form {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.75rem;
}

.label-icon {
  font-size: 1.2rem;
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 1rem;
  background: #fafafa;
  transition: 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #2e7d32;
  background: white;
  box-shadow: 0 0 0 4px rgba(46, 125, 50, 0.1);
}

.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn {
  padding: 0.875rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: 0.3s;
}

.btn-update {
  background: linear-gradient(135deg, #2e7d32, #388e3c);
  color: white;
}

.btn-cancel {
  background: #f5f5f5;
  color: #616161;
}

.btn-delete {
  background: linear-gradient(135deg, #d32f2f, #c62828);
  color: white;
  width: 100%;
}
</style>
