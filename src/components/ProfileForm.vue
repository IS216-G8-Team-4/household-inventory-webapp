<script>
import { createClient } from "@supabase/supabase-js";

export default {
  name: "CreateProfile",
  data() {
    return {
      profileName: "",
      foodAllergens: "",
      selectedDiets: [],
      preferredCuisines: "",
      message: "",
      messageType: "success",
      isBusy: false,
      sb: null,
      dietaryOptions: [
        "Vegetarian",
        "Vegan",
        "Pescatarian",
        "Halal",
        "Kosher",
        "Gluten-Free",
        "Dairy-Free",
        "Keto",
        "Paleo",
      ],
    };
  },

  async mounted() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.sb = createClient(url, key, { auth: { persistSession: true } });
  },

  methods: {
    async createProfile() {
      // validate profile name 
      if (!this.profileName || this.profileName.trim().length === 0) {
        alert("Please enter a valid name", "error");
        return;
      }

      this.isBusy = true;
      this.message = "";

      try {
        // get currently logged-in user
        const { data: userData, error: userError } = await this.sb.auth.getUser();
        if (userError || !userData || !userData.user) {
          console.error("User not logged in or error fetching user");
          alert("User not logged in", "error");
          return;
        }
        const user = userData.user;

        // find household 
        const { data: householdRows, error: householdError } = await this.sb
          .from("households")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);

        if (householdError) {
          console.error("Error fetching household:", householdError);
          alert("Household not found", "error");
          return;
        }

        let householdId = null;
        if (householdRows && householdRows.length > 0) {
          householdId = householdRows[0].id;
        }

        if (!householdId) {
          console.error("Household not found for user:", user.id);
          alert("Household not found", "error");
          return;
        }

        //allergens array
        let allergensArray = [];
        if (this.foodAllergens && this.foodAllergens.length > 0) {
          const temp = this.foodAllergens.split(",");
          for (let i = 0; i < temp.length; i++) {
            const trimmed = temp[i].trim();
            if (trimmed.length > 0) {
              allergensArray.push(trimmed);
            }
          }
        }

        //cuisines array 
        let cuisinesArray = [];
        if (this.preferredCuisines && this.preferredCuisines.length > 0) {
          const temp = this.preferredCuisines.split(",");
          for (let i = 0; i < temp.length; i++) {
            const trimmed = temp[i].trim();
            if (trimmed.length > 0) {
              cuisinesArray.push(trimmed);
            }
          }
        }

        //insert new profile into database 
        const { error: insertError } = await this.sb
          .from("profiles")
          .insert({
            profile_name: this.profileName.trim(),
            household_id: householdId,
            food_allergens: allergensArray,
            dietary_preferences: this.selectedDiets,
            preferred_cuisines: cuisinesArray,
            is_active: false,
          });

        if (insertError) {
          console.error("Error inserting profile:", insertError);
          alert(`Failed to create profile: ${insertError.message}`, "error");
          return;
        }

        //clear form 
        this.profileName = "";
        this.foodAllergens = "";
        this.selectedDiets = [];
        this.preferredCuisines = "";

        this.$router.push("/ProfileList");
        this.isBusy = false;

      } 
      catch (e) {
        console.error("Failed to create profile:", e.message);
        alert(`Failed to create profile: ${e.message}`, "error");
        this.isBusy = false;
      } 
    },

    cancelCreate() {
      this.$router.push("/ProfileList");
    },
  },
};
</script>


<template>
  <div class="create-profile-wrapper">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-md-10 col-lg-8 col-xl-6">
          <div class="create-profile-container">
            <div class="profile-header">
              <div class="header-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
              </div>
              <h2>Create New Profile</h2>
              <p class="subtitle">Add a new household member with their preferences</p>
            </div>

            <div class="profile-form">
              <div class="mb-4">
                <label for="profile-name" class="form-label d-flex align-items-center">
                  <span class="label-icon me-2">👤</span>
                  Profile Name
                  <span class="required ms-1">*</span>
                </label>
                <input 
                  id="profile-name"
                  v-model="profileName" 
                  type="text"
                  placeholder="e.g., John, Mom, Dad"
                  class="form-control form-input"
                />
              </div>

              <div class="mb-4">
                <label for="allergens" class="form-label d-flex align-items-center">
                  <span class="label-icon me-2">⚠️</span>
                  Food Allergens
                </label>
                <input 
                  id="allergens"
                  v-model="foodAllergens" 
                  type="text"
                  placeholder="e.g., Peanuts, Shellfish, Dairy"
                  class="form-control form-input"
                />
                <small class="form-text helper-text">Separate multiple allergens with commas</small>
              </div>

              <div class="mb-4">
                <label class="form-label d-flex align-items-center">
                  <span class="label-icon me-2">🥗</span>
                  Dietary Preferences
                </label>
                <div class="row g-2 dietary-options">
                  <div class="col-12 col-sm-6" v-for="diet in dietaryOptions" :key="diet">
                    <label class="checkbox-label">
                      <input 
                        type="checkbox" 
                        :value="diet" 
                        v-model="selectedDiets"
                        class="checkbox-input"
                      />
                      <span class="checkbox-custom"></span>
                      <span class="checkbox-text">{{ diet }}</span>
                    </label>
                  </div>
                </div>
                <small class="form-text helper-text">Select all that apply</small>
              </div>

              <div class="mb-4">
                <label for="cuisines" class="form-label d-flex align-items-center">
                  <span class="label-icon me-2">🍽️</span>
                  Preferred Cuisines
                </label>
                <input 
                  id="cuisines"
                  v-model="preferredCuisines" 
                  type="text"
                  placeholder="e.g., Italian, Chinese, Mexican"
                  class="form-control form-input"
                />
                <small class="form-text helper-text">Separate multiple cuisines with commas</small>
              </div>

              <div class="row g-3 mt-4">
                <div class="col-12 col-sm-6">
                  <button type="button" class="btn btn-create w-100 d-flex align-items-center justify-content-center" @click="createProfile" :disabled="isBusy">
                    <svg v-if="!isBusy" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <div v-else class="spinner-small me-2"></div>
                    <span v-if="!isBusy">Create Profile</span>
                    <span v-else>Creating...</span>
                  </button>
                </div>
                <div class="col-12 col-sm-6">
                  <button type="button" class="btn btn-cancel w-100 d-flex align-items-center justify-content-center" @click="cancelCreate" :disabled="isBusy">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <transition name="fade">
              <div v-if="message" :class="['alert', messageType]">
                <span class="alert-icon">{{ messageType === 'success' ? '✓' : '✕' }}</span>
                <span>{{ message }}</span>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-profile-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%);
  padding: 2rem 1rem;
  display: flex;
  align-items: center;
}

.create-profile-container {
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
  color: white;
}

/* Form Section */
.profile-form {
  padding: 2rem;
}

.form-label {
  font-weight: 600;
  color: #2e7d32;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.label-icon {
  font-size: 1.2rem;
}

.required {
  color: #ef4444;
  font-weight: 700;
}

.form-input {
  padding: 0.875rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #fafafa;
}

.form-input:focus {
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

/* Dietary Options */
.dietary-options {
  margin-bottom: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.625rem;
  background: #fafafa;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  transition: all 0.2s ease;
  user-select: none;
  width: 100%;
  height: 100%;
}

.checkbox-label:hover {
  background: #f5f5f5;
  border-color: #bdbdbd;
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid #bdbdbd;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-input:checked + .checkbox-custom {
  background: #2e7d32;
  border-color: #2e7d32;
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '✓';
  color: white;
  font-size: 0.875rem;
  font-weight: 700;
}

.checkbox-text {
  font-size: 0.875rem;
  color: #424242;
  font-weight: 500;
}

.checkbox-input:checked ~ .checkbox-text {
  color: #2e7d32;
  font-weight: 600;
}

/* Buttons */
.btn {
  padding: 0.875rem 1.5rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:not(:disabled):active {
  transform: translateY(0);
}

.btn-create {
  background: linear-gradient(135deg, #2e7d32, #388e3c);
  color: white;
}

.btn-create:not(:disabled):hover {
  background: linear-gradient(135deg, #1b5e20, #2e7d32);
  color: white;
}

.btn-cancel {
  background: #f5f5f5;
  color: #616161;
}

.btn-cancel:not(:disabled):hover {
  background: #e0e0e0;
  color: #616161;
}

/* Spinner */
.spinner-small {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

/* Responsive adjustments */
@media (max-width: 576px) {
  .profile-header {
    padding: 2rem 1.5rem 1.5rem;
  }

  .profile-header h2 {
    font-size: 1.5rem;
  }

  .profile-form {
    padding: 1.5rem;
  }
}
</style>
