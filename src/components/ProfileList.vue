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
      hoverProfile: null,
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
      this.message = "";
      try {
        // get current user
        const userResult = await this.sb.auth.getUser();
        if (!userResult.data || !userResult.data.user) {
          this.message = "❌ user not logged in";
          this.isBusy = false;
          return;
        }
        const user = userResult.data.user;

        // fetch household for this user
        const { data: householdRows, error: householdError } = await this.sb
          .from("households")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);

        if (householdError) {
          this.message = `❌ ${householdError.message}`;
          this.isBusy = false;
          return;
        }

        if (!householdRows || householdRows.length === 0) {
          this.message = "❌ household not found";
          this.isBusy = false;
          return;
        }

        const householdId = householdRows[0].id;

        // fetch profiles for the household
        const { data: profilesData, error: profilesError } = await this.sb
          .from("profiles")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: true });

        if (profilesError) {
          this.message = `❌ ${profilesError.message}`;
          this.isBusy = false;
          return;
        }

        // update state
        if (profilesData) {
          this.profiles = profilesData;
        }
      } catch (e) {
        this.message = `❌ ${e.message}`;
        this.isBusy = false;
      } 
    },

    async setActive(profileId) {
      this.isBusy = true;
      this.message = "";
      try {
        // get current user
        const userResult = await this.sb.auth.getUser();
        if (!userResult.data || !userResult.data.user) {
          this.message = "❌ user not logged in";
          this.isBusy = false;
          return;
        }
        const user = userResult.data.user;

        // fetch household for user
        const { data: householdRows, error: householdError } = await this.sb
          .from("households")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);

        if (householdError) {
          this.message = `❌ ${householdError.message}`;
          this.isBusy = false;
          return;
        }

        if (!householdRows || householdRows.length === 0) {
          this.message = "❌ household not found";
          this.isBusy = false;
          return;
        }

        const householdId = householdRows[0].id;

        // set all profiles inactive
        await this.sb
          .from("profiles")
          .update({ is_active: false })
          .eq("household_id", householdId);

        // set selected profile active
        await this.sb
          .from("profiles")
          .update({ is_active: true })
          .eq("id", profileId);

        // dispatch event to notify other components
        window.dispatchEvent(new CustomEvent("activeProfileChanged", { detail: { newActiveId: profileId } }));

        this.message = "✅ active profile updated!";
        await this.loadProfiles();

        // only navigate on success
        this.$router.push("/Dashboard");
      } catch (e) {
        this.message = `❌ ${e.message}`;
        this.isBusy = false;
      }
    },

    goToCreateProfile() {
      this.$router.push("/ProfileForm");
    },

    goToEditProfile(profileId) {
      this.$router.push(`/ProfileEdit/${profileId}`);
    },

    getInitial(name) {
      if (!name || name.length === 0) return "?";
      return name.charAt(0).toUpperCase();
    },

    formatList(arr) {
      if (!arr || arr.length === 0) return "none";
      if (arr.length <= 2) return arr.join(", ");
      return `${arr.slice(0, 2).join(", ")} +${arr.length - 2}`;
    },
  },
};
</script>


<template>
  <div class="profile-list-wrapper">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-xl-10">
          <div class="profile-list-container">
            <!-- Header Section -->
            <div class="profile-header">
              <div class="header-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h2>Household Profiles</h2>
              <p class="subtitle">Manage your family's dietary preferences and allergens</p>
            </div>

            <!-- Empty State -->
            <div v-if="profiles.length === 0" class="empty-state">
              <div class="empty-icon">👥</div>
              <h3>No Profiles Yet</h3>
              <p>Create your first household profile to get started</p>
              <button @click="goToCreateProfile" class="btn btn-primary d-inline-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create First Profile
              </button>
            </div>

            <div v-else class="profiles-section">
              <div class="section-header d-flex justify-content-between align-items-center">
                <h3>Your Profiles</h3>
                <span class="profile-count">{{ profiles.length }} {{ profiles.length === 1 ? 'Profile' : 'Profiles' }}</span>
              </div>

              <div class="row g-3 g-md-4">
                <div
                  v-for="p in profiles"
                  :key="p.id"
                  class="col-12 col-sm-6 col-lg-4 col-xl-3"
                >
                  <div
                    class="profile-card"
                    :class="{ active: p.is_active }"
                    @mouseenter="hoverProfile = p.id"
                    @mouseleave="hoverProfile = null"
                  >
                    <div v-if="p.is_active" class="active-badge d-flex align-items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="me-1">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Active
                    </div>

                    <button 
                      v-if="hoverProfile === p.id" 
                      class="edit-button d-flex align-items-center justify-content-center"
                      @click="goToEditProfile(p.id)"
                      title="Edit Profile"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>

                    <div class="profile-avatar d-flex align-items-center justify-content-center mx-auto">
                      <span class="avatar-initial">{{ getInitial(p.profile_name) }}</span>
                    </div>

                    <div class="profile-info text-center">
                      <h4 class="profile-name">{{ p.profile_name }}</h4>
                      
                      <div class="profile-details d-flex flex-column">
                        <div class="detail-item d-flex align-items-start">
                          <span class="detail-text">Allergies: {{ formatList(p.food_allergens) }}</span>
                        </div>
                        
                        <div class="detail-item d-flex align-items-start"> 
                          <span class="detail-text">Preferences: {{ formatList(p.preferred_cuisines) }}</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      v-if="!p.is_active" 
                      @click="setActive(p.id)" 
                      class="btn-set-active w-100"
                    >
                      Set as Active
                    </button>
                  </div>
                </div>

                <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
                  <div class="profile-card add-card d-flex align-items-center justify-content-center" @click="goToCreateProfile">
                    <div class="add-content text-center">
                      <div class="add-icon d-flex align-items-center justify-content-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </div>
                      <p class="add-text">Add New Profile</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <transition name="fade">
              <div v-if="message" class="alert success d-flex align-items-center">
                <span class="alert-icon d-flex align-items-center justify-content-center">✓</span>
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
.profile-list-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%);
  padding: 2rem 1rem;
}

.profile-list-container {
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

/* Empty State */
.empty-state {
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  color: #2e7d32;
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.empty-state p {
  color: #757575;
  margin: 0 0 2rem;
}

/* Profiles Section */
.profiles-section {
  padding: 2rem;
}

.section-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.section-header h3 {
  margin: 0;
  color: #2e7d32;
  font-size: 1.25rem;
}

.profile-count {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 0.375rem 0.875rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
}

/* Profile Card */
.profile-card {
  position: relative;
  background: #fafafa;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;
  animation: fadeIn 0.5s ease-out backwards;
  height: 100%;
}

.profile-card:nth-child(1) { animation-delay: 0.1s; }
.profile-card:nth-child(2) { animation-delay: 0.2s; }
.profile-card:nth-child(3) { animation-delay: 0.3s; }
.profile-card:nth-child(4) { animation-delay: 0.4s; }

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.profile-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: #2e7d32;
}

.profile-card.active {
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border-color: #2e7d32;
}

/* Active Badge */
.active-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: #2e7d32;
  color: white;
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.25rem;
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.3);
}

/* Edit Button */
.edit-button {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.edit-button:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}

.profile-avatar {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #2e7d32, #388e3c);
  border-radius: 50%;
  margin-bottom: 1rem;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2);
}

.avatar-initial {
  color: white;
  font-size: 2rem;
  font-weight: 700;
}

.profile-info {
  margin-bottom: 1rem;
}

.profile-name {
  margin: 0 0 1rem;
  color: #1f2937;
  font-size: 1.125rem;
  font-weight: 700;
}

.profile-details {
  gap: 0.625rem;
}

.detail-item {
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border-radius: 8px;
  text-align: left;
}

.detail-item.empty {
  justify-content: center;
  color: #9e9e9e;
  font-style: italic;
}

.detail-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.detail-text {
  font-size: 0.8125rem;
  color: #616161;
  line-height: 1.4;
  word-break: break-word;
}

.btn-set-active {
  padding: 0.625rem;
  background: linear-gradient(135deg, #2e7d32, #388e3c);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-set-active:hover {
  background: linear-gradient(135deg, #1b5e20, #2e7d32);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
}

.add-card {
  border: 2px dashed #bdbdbd;
  background: #fafafa;
  min-height: 250px;
}

.add-card:hover {
  border-color: #2e7d32;
  background: #f1f8f6;
}

.add-icon {
  width: 60px;
  height: 60px;
  background: #e8f5e9;
  border-radius: 50%;
  margin-bottom: 0.75rem;
}

.add-icon svg {
  color: #2e7d32;
}

.add-text {
  margin: 0;
  color: #2e7d32;
  font-weight: 600;
  font-size: 0.9375rem;
}

.btn {
  gap: 0.5rem;
  padding: 0.875rem 1.75rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #2e7d32, #388e3c);
  color: white;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #1b5e20, #2e7d32);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(46, 125, 50, 0.4);
  color: white;
}

.alert {
  position: fixed;
  top: 2rem;
  right: 2rem;
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

.alert-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2e7d32;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .profile-list-wrapper {
    padding: 1rem;
  }

  .profile-header {
    padding: 2rem 1.5rem 1.5rem;
  }

  .profile-header h2 {
    font-size: 1.5rem;
  }

  .profiles-section {
    padding: 1.5rem;
  }

  .alert {
    right: 1rem;
    left: 1rem;
  }
}
</style>
