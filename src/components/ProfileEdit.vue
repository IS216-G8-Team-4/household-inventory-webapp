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
    };
  },

  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, { auth: { persistSession: true } });

    //get profile ID 
    this.profileId = this.$route.params.id;

    //load the profile data 
    await this.loadProfile();
  },

  methods: {
    async loadProfile() {
      try {
        const { data, error } = await this.sb
          .from("profiles")
          .select("*")
          .eq("id", this.profileId)
          .single();

        if (error) {
          console.error("Error loading profile:", error);
          return;
        }

        this.profile_name = data.profile_name;

        //handle food allergens
        if (data.food_allergens && data.food_allergens.length > 0) {
          const allergensList = [];
          for (let i = 0; i < data.food_allergens.length; i++) {
            if (data.food_allergens[i]) {
              allergensList.push(data.food_allergens[i]);
            }
          }
          this.food_allergens = allergensList.join(", ");
        } else {
          this.food_allergens = "";
        }

        //handle preferred cuisines
        if (data.preferred_cuisines && data.preferred_cuisines.length > 0) {
          const cuisinesList = [];
          for (let i = 0; i < data.preferred_cuisines.length; i++) {
            if (data.preferred_cuisines[i]) {
              cuisinesList.push(data.preferred_cuisines[i]);
            }
          }
          this.preferred_cuisines = cuisinesList.join(", ");
        } else {
          this.preferred_cuisines = "";
        }

      } catch (e) {
        console.error("Failed to load profile:", e.message);
      }
    },

    async updateProfile() {
      try {
        //convert strings to arrays, trim whitespace, remove empty strings
        let allergensArray = [];
        if (this.food_allergens && this.food_allergens.length > 0) {
          const temp = this.food_allergens.split(",");
          for (let i = 0; i < temp.length; i++) {
            const trimmed = temp[i].trim();
            if (trimmed.length > 0) {
              allergensArray.push(trimmed);
            }
          }
        }

        let cuisinesArray = [];
        if (this.preferred_cuisines && this.preferred_cuisines.length > 0) {
          const temp = this.preferred_cuisines.split(",");
          for (let i = 0; i < temp.length; i++) {
            const trimmed = temp[i].trim();
            if (trimmed.length > 0) {
              cuisinesArray.push(trimmed);
            }
          }
        }

        const { error } = await this.sb
          .from("profiles")
          .update({
            profile_name: this.profile_name,
            food_allergens: allergensArray,
            preferred_cuisines: cuisinesArray,
          })
          .eq("id", this.profileId);

        if (error) {
          console.error("Error updating profile:", error);
          return;
        }

        this.$router.push("/ProfileList");

      } catch (e) {
        console.error("Failed to update profile:", e.message);
      }
    },

    async deleteProfile() {
      const confirmDelete = confirm(
        "⚠️ Are you sure you want to delete this profile? This action cannot be undone."
      );
      if (!confirmDelete) {
        return;
      }

      try {
        const { error } = await this.sb
          .from("profiles")
          .delete()
          .eq("id", this.profileId);

        if (error) {
          console.error("Error deleting profile:", error);
          return;
        }

        this.$router.push("/ProfileList");

      } catch (e) {
        console.error("Failed to delete profile:", e.message);
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
        <div class="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h2>Edit Profile</h2>
        <p class="subtitle">Update your personal information and preferences</p>
      </div>

      <div class="profile-form">
        <div class="form-group">
          <label for="profile-name">
            <span class="label-icon">👤</span>
            Profile Name
          </label>
          <input 
            id="profile-name"
            v-model="profile_name" 
            type="text"
            placeholder="Enter your name"
            required 
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="allergens">
            <span class="label-icon">⚠️</span>
            Food Allergens
          </label>
          <input 
            id="allergens"
            v-model="food_allergens" 
            type="text"
            placeholder="e.g., Peanuts, Dairy, Shellfish"
            class="form-input"
          />
          <span class="helper-text">Separate multiple allergens with commas</span>
        </div>

        <div class="form-group">
          <label for="cuisines">
            <span class="label-icon">🍽️</span>
            Preferred Cuisines
          </label>
          <input 
            id="cuisines"
            v-model="preferred_cuisines" 
            type="text"
            placeholder="e.g., Italian, Chinese, Mexican"
            class="form-input"
          />
          <span class="helper-text">Separate multiple cuisines with commas</span>
        </div>

        <div class="button-group">
          <button type="button" class="btn btn-update" @click="updateProfile">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save Changes
          </button>
          <button type="button" class="btn btn-cancel" @click="cancelEdit">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cancel
          </button>
        </div>

        <button type="button" class="btn btn-delete" @click="deleteProfile">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete Profile
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Header Section */
.profile-header {
  background: linear-gradient(135deg, #2e7d32 0%, #388e3c 100%);
  color: white;
  padding: 3rem 2rem 2.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.profile-header::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.header-icon {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  border: 3px solid rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 1;
}

.header-icon svg {
  color: white;
}

.profile-header h2 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  font-weight: 700;
  position: relative;
  z-index: 1;
}

.subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 0.95rem;
  position: relative;
  z-index: 1;
}

/* Form Section */
.profile-form {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.75rem;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #2e7d32;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
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
  transition: all 0.3s ease;
  background: #fafafa;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #2e7d32;
  background: white;
  box-shadow: 0 0 0 4px rgba(46, 125, 50, 0.1);
}

.form-input::placeholder {
  color: #9e9e9e;
}

.helper-text {
  display: block;
  font-size: 0.8rem;
  color: #757575;
  margin-top: 0.375rem;
  font-style: italic;
}

/* Button Group */
.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn-update {
  background: linear-gradient(135deg, #2e7d32, #388e3c);
  color: white;
}

.btn-update:hover {
  background: linear-gradient(135deg, #1b5e20, #2e7d32);
}

.btn-cancel {
  background: #f5f5f5;
  color: #616161;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

/* Danger Zone */
.danger-zone {
  background: #ffebee;
  border: 2px solid #ffcdd2;
  border-radius: 16px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.danger-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.danger-icon {
  font-size: 1.25rem;
}

.danger-title {
  font-weight: 700;
  color: #c62828;
  font-size: 1.05rem;
}

.danger-description {
  color: #d32f2f;
  font-size: 0.9rem;
  margin: 0 0 1rem;
  line-height: 1.5;
}

.btn-delete {
  background: linear-gradient(135deg, #d32f2f, #c62828);
  color: white;
  width: 100%;
}

.btn-delete:hover {
  background: linear-gradient(135deg, #b71c1c, #d32f2f);
}

/* Alert Messages */
.alert {
  position: fixed;
  top: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: slideInRight 0.4s ease-out;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.alert.success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 2px solid #a5d6a7;
}

.alert.error {
  background: #ffebee;
  color: #c62828;
  border: 2px solid #ef9a9a;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.875rem;
}

.alert.success .alert-icon {
  background: #2e7d32;
  color: white;
}

.alert.error .alert-icon {
  background: #c62828;
  color: white;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Responsive Design */
@media (max-width: 640px) {
  .edit-profile-wrapper {
    padding: 1rem;
  }

  .profile-header {
    padding: 2rem 1.5rem 1.5rem;
  }

  .profile-header h2 {
    font-size: 1.5rem;
  }

  .profile-form {
    padding: 1.5rem;
  }

  .button-group {
    grid-template-columns: 1fr;
  }

  .alert {
    right: 1rem;
    left: 1rem;
  }
}
</style>
