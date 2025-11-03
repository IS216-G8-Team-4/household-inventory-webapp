<script>
import { supabase } from "../lib/supabase";

export default {
  data() {
    return {
      summary: {
        score: 0,
        co2Saved: "0 kg",
        itemsSaved: 0,
      },
      impact: {
        co2Prevented: 0,
        trees: 0,
      },
      savings: {
        valueSaved: "$0.00",
        itemsDonated: 0,
      },
      wastage: {
        expiredPercent: 0,
        usedPercent: 0,
      },
      tips: ["Plan meals around items expiring soon to keep wastage low."],
      expiryNotifications: {
        urgent: [],
        warning: [],
      },
      usageTrends: {
        weeklyChange: 0,
        mostConsumed: "N/A",
        fastestCategory: "N/A",
        shoppingFrequency: "N/A",
      },
    };
  },

  computed: {
    totalExpiringItems() {
      return this.expiryNotifications.urgent.length + this.expiryNotifications.warning.length;
    },
    urgent() {
      return this.expiryNotifications.urgent.length;
    },
    warning() {
      return this.expiryNotifications.warning.length;
    },
    weeklyTrend() {
      if (this.usageTrends.weeklyChange > 0) return 'up';
      if (this.usageTrends.weeklyChange < 0) return 'down';
      return 'same';
    },
  },

  methods: {
    calcPercent(wasted, saved) {
      const total = (wasted || 0) + (saved || 0);
      if (total === 0) {
        return 0;
      }
      else {
        return Math.round((wasted/total)*100)
      }
    },

    getDaysUntilExpiry(expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    },

    formatExpiryDate(date) {
      return new Date(date).toLocaleDateString('en-SG', {
        month: 'short',
        day: 'numeric',
      });
    },

    async fetchExpiringIngredients(householdId) {
      try {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        const { data: batches, error } = await supabase
          .from("ingredient_batches")
          .select(`
            id,
            quantity,
            expiry_date,
            status,
            ingredient:ingredients (
              id,
              name,
              category,
              unit
            )
          `)
          .eq("status", "active")
          .lte("expiry_date", threeDaysFromNow.toISOString().split('T')[0])
          .gte("expiry_date", today.toISOString().split('T')[0]);

        if (error) throw error;

        if (batches && batches.length > 0) {

          //fetch ingredients belonging to this household
          const { data: householdIngredients, error: ingredientError } = await supabase
            .from("ingredients")
            .select("id")
            .eq("household_id", householdId);

          if (ingredientError) {
            console.error("Error fetching household ingredients", ingredientError);
            return;
          }

          //extract ingredient IDs 
          let householdIngredientIds = new Set();

          if (householdIngredients && householdIngredients.length > 0) {
            const ids = [];

            for (let i = 0; i < householdIngredients.length; i++) {
              const ingredient = householdIngredients[i];
              ids.push(ingredient.id);
            }

            householdIngredientIds = new Set(ids);
          }

          //filter batches to only include those belonging to this household
          const filteredBatches = [];

          for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            //ensure ingredient exists and belongs to this household
            if (batch.ingredient && householdIngredientIds.has(batch.ingredient.id)) {
              filteredBatches.push(batch);
            }
          }

          const urgent = [];
          const warning = [];

          for (let i = 0; i < filteredBatches.length; i++) {
            const batch = filteredBatches[i];
            const daysUntil = this.getDaysUntilExpiry(batch.expiry_date);

            const item = {
              id: batch.id,
              name: batch.ingredient.name,
              quantity: batch.quantity,
              unit: batch.ingredient.unit,
              expiryDate: batch.expiry_date,
              daysUntil: daysUntil,
              category: batch.ingredient.category,
            };

            if (daysUntil <= 1) {
              urgent.push(item);
            } 
            else if (daysUntil <= 3) {
              warning.push(item);
            }
          }

          // sort and store
          this.expiryNotifications = {
            urgent: urgent.sort((a, b) => a.daysUntil - b.daysUntil),
            warning: warning.sort((a, b) => a.daysUntil - b.daysUntil)
          };
        }
    } 
    catch (error) {
        console.error("Error fetching expiring ingredients:", error.message);
      }
    },

  async fetchUsageTrends(householdId) {
  try {
    const today = new Date();

    //define date ranges
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(today.getDate() - 14);

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(today.getDate() - 30);

    //get ingredients for this household 
    const { data: householdIngredients } = await supabase
      .from("ingredients")
      .select("id")
      .eq("household_id", householdId);

    let ingredientIds = [];
    if (householdIngredients && householdIngredients.length > 0) {
      for (let i = 0; i < householdIngredients.length; i++) {
        ingredientIds.push(householdIngredients[i].id);
      }
    } 
    else {
      return;
    }

    //retrieve usage logs for last 2 weeks
    const { data: logs } = await supabase
      .from("ingredient_usage_logs")
      .select("ingredient_id, quantity_used, used_at, ingredients(name, category)")
      .in("ingredient_id", ingredientIds)
      .gte("used_at", twoWeeksAgo.toISOString())
      .order("used_at", { ascending: false });

    if (logs && logs.length > 0) {
      const thisWeekLogs = [];
      const lastWeekLogs = [];

      for (let i = 0; i < logs.length; i++) {
        const logDate = new Date(logs[i].used_at);
        if (logDate >= oneWeekAgo) {
          thisWeekLogs.push(logs[i]);
        } 
        else if (logDate >= twoWeeksAgo && logDate < oneWeekAgo) {
          lastWeekLogs.push(logs[i]);
        }
      }

      const thisWeekCount = thisWeekLogs.length;
      const lastWeekCount = lastWeekLogs.length;

      if (lastWeekCount > 0) {
        const change = ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100;
        this.usageTrends.weeklyChange = Math.round(change);
      } 
      else {
        this.usageTrends.weeklyChange = 0;
      }

      //calculate most consumed item ---
      const itemCounts = {};
      for (let i = 0; i < logs.length; i++) {
        let name = "Unknown";
        if (logs[i].ingredients) {
          name = logs[i].ingredients.name;
        }

        if (itemCounts[name]) {
          itemCounts[name] += 1;
        } 
        else {
          itemCounts[name] = 1;
        }
      }

      let mostConsumed = "N/A";
      let maxCount = 0;
      for (let key in itemCounts) {
        if (itemCounts[key] > maxCount) {
          maxCount = itemCounts[key];
          mostConsumed = key;
        }
      }
      this.usageTrends.mostConsumed = mostConsumed;

      //calculate fastest depleted category
      const categoryCounts = {};
      for (let i = 0; i < logs.length; i++) {
        let category = "Other";
        if (logs[i].ingredients) {
          category = logs[i].ingredients.category;
        }

        if (categoryCounts[category]) {
          categoryCounts[category] += 1;
        } else {
          categoryCounts[category] = 1;
        }
      }

      let fastestCategory = "N/A";
      let maxCategoryCount = 0;
      for (let key in categoryCounts) {
        if (categoryCounts[key] > maxCategoryCount) {
          maxCategoryCount = categoryCounts[key];
          fastestCategory = key;
        }
      }
      this.usageTrends.fastestCategory = fastestCategory;
    }

    //calculate shopping frequency
    const { data: batches } = await supabase
      .from("ingredient_batches")
      .select("created_at, ingredient:ingredients(household_id)")
      .gte("created_at", oneMonthAgo.toISOString());

    if (batches && batches.length > 0) {
      const householdBatches = [];
      for (let i = 0; i < batches.length; i++) {
        if (batches[i].ingredient) {
          if (batches[i].ingredient.household_id === householdId) {
            householdBatches.push(batches[i]);
          }
        }
      }
      this.usageTrends.shoppingFrequency = householdBatches.length;

      const trips = householdBatches.length;
      if (trips > 0) {
          const frequency = Math.round(30 / trips);
          this.usageTrends.shoppingFrequency = `Every ${frequency} days`;
        }
    }
  } 
  catch (error) {
        console.error("Error fetching usage trends:", error.message);
      }
  },

    async fetchDashboardData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const userId = session.user.id;

        const { data: household, error: householdErr } = await supabase
          .from("households")
          .select("id")
          .eq("created_by", userId)
          .maybeSingle();

        if (householdErr || !household) return;
        const householdId = household.id;
      
        await this.fetchExpiringIngredients(householdId);
        await this.fetchUsageTrends(householdId);

        const { data: metrics, error: metricsErr } = await supabase
          .from("sustainability_metrics")
          .select("*")
          .eq("household_id", householdId)
          .order("month", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metricsErr) console.error(metricsErr);

        if (metrics) {
          this.summary = {
            score: metrics.sustainability_score || 0,
            co2Saved: `${(metrics.co2_saved_kg || 0).toFixed(1)} kg`,
            itemsSaved: metrics.items_saved || 0,
          };

          this.impact = {
            co2Prevented: metrics.co2_saved_kg || 0,
            trees: (metrics.co2_saved_kg / 8.8).toFixed(1),
          };

          this.savings = {
            valueSaved: `$${(metrics.money_saved_sgd || 0).toFixed(2)}`,
            itemsDonated: metrics.items_donated || 0,
          };

          this.wastage = {
            expiredPercent: this.calcPercent(metrics.items_wasted, metrics.items_saved),
            usedPercent: 100 - this.calcPercent(metrics.items_wasted, metrics.items_saved),
          };
        }

        if (this.wastage.expiredPercent > 20) {
          this.tips = [
            "Check your pantry twice a week to cut down on food waste!",
          ];
        } else if (this.impact.co2Prevented > 10) {
          this.tips = [
            "Amazing! Keep donating to boost your CO₂ savings further 🌿",
          ];
        }
      } catch (error) {
        console.error("Error loading dashboard:", error.message);
      }
    },
  },

  mounted() {
    this.fetchDashboardData();
  },
};
</script>

<template>
  <main class="dashboard">
    <!-- sustainability score -->
    <header class="card score-card fade-in">
      <h2 style="color: white;">
        <span><img src="../assets/earth.png" class="feature-icon"></span>
        Sustainability Score: <strong>{{ summary.score }}</strong>
      </h2>
      <p class="muted" style="color: white;">
        You saved <b>{{ summary.co2Saved }}</b> CO₂ and
        <b>{{ summary.itemsSaved }}</b> items this month.
      </p>
    </header>

    <!-- main grid -->
    <section class="grid">
      <!-- Environmental Impact -->
      <section class="card fade-in">
        <h3>Environmental Impact</h3>
        <div class="circle">
          <div class="circle-text">{{ impact.co2Prevented }} kg CO₂</div>
        </div>
        <p class="muted">≈ {{ impact.trees }} trees saved</p>
      </section>

      <!-- wastage overview -->
      <section class="card fade-in">
        <h3>Wastage Overview</h3>

        <!-- used/donated -->
        <div class="metric-block">
          <div class="metric-labels">
            <span>Used / Donated</span>
            <span class="used">{{ wastage.usedPercent }}%</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill used-fill"
              :style="{ width: wastage.usedPercent + '%' }" 
            ></div>
          </div>
        </div>

        <!-- expired -->
        <div class="metric-block">
          <div class="metric-labels">
            <span>Expired</span>
            <span class="expired">{{ wastage.expiredPercent }}%</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill expired-fill"
              :style="{ width: wastage.expiredPercent + '%' }"
            ></div>
          </div>
        </div>

        <!-- expiry notifications -->
        <div class="expiry-notifications">
          <div class="notification-header">
            <span class="notification-title">⚠️ Expiring Soon</span>
            <span class="notification-count" v-if="totalExpiringItems > 0">
              {{ totalExpiringItems }}
            </span>
          </div>

          <div v-if="totalExpiringItems === 0" class="no-expiry">
            <span class="checkmark">✓</span>
            <span>No items expiring soon</span>
          </div>

          <div v-else class="notification-columns">
            <div v-if="expiryNotifications.urgent.length > 0" class="notification-column">
              <div class="section-label urgent-label">
                🔴 Today/Tomorrow:  {{ urgent }} 
              </div>
              <div class="notification-scroll-container">
                <div class="notification-items">
                  <div 
                    v-for="item in expiryNotifications.urgent" 
                    :key="item.id"
                    class="notification-item urgent-item"
                  >
                    <div class="item-info">
                      <span class="item-name">{{ item.name }}</span>
                      <span class="item-quantity">{{ item.quantity }} {{ item.unit }}</span>
                    </div>
                    <div class="item-expiry urgent-expiry">
                      {{ item.daysUntil === 0 ? 'Today' : 'Tomorrow' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="expiryNotifications.warning.length > 0" class="notification-column">
              <div class="section-label warning-label">
                🟠 2-3 Days: {{ warning }}
              </div>
              <div class="notification-scroll-container">
                <div class="notification-items">
                  <div 
                    v-for="item in expiryNotifications.warning" 
                    :key="item.id"
                    class="notification-item warning-item"
                  >
                    <div class="item-info">
                      <span class="item-name">{{ item.name }}</span>
                      <span class="item-quantity">{{ item.quantity }} {{ item.unit }}</span>
                    </div>
                    <div class="item-expiry warning-expiry">
                      {{ formatExpiryDate(item.expiryDate) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- cost savings -->
      <section class="card fade-in">
        <h3>Cost Savings</h3>
            
        <div class="savings-display">
          <div class="savings-amount">
            {{ savings.valueSaved }}
          </div>
          <div class="hint-text">saved this month</div>
        </div>
        
        <div class="summary-list">
          <div class="summary-row amber-row">
            <div class="label-group">
              <span>Items Donated</span>
            </div>
            <span class="value amber-text">{{ savings.itemsDonated }}</span>
          </div>

          <div class="summary-row green-row">
            <div class="label-group">
              <span>Items Saved</span>
            </div>
            <span class="value green-text">{{ summary.itemsSaved }}</span>
          </div>
        </div>
      </section>

      <!-- usage trends -->
      <section class="card fade-in">
        <h3>Tips</h3>
        
        <div class="trends-grid">
          <!-- weekly change -->
          <!-- <div class="trend-card">
            <div class="trend-icon" :class="weeklyTrend">
              <span v-if="weeklyTrend === 'up'">📈</span>
              <span v-else-if="weeklyTrend === 'down'">📉</span>
              <span v-else>➡️</span>
            </div>
            <div class="trend-content">
              <div class="trend-label">This Week</div>
              <div class="trend-value" :class="weeklyTrend + '-text'">
                {{ usageTrends.weeklyChange > 0 ? '+' : '' }}{{ usageTrends.weeklyChange }}%
              </div>
              <div class="trend-sublabel">vs last week</div>
            </div>
          </div> -->

          <!-- most consumed -->
          <!-- <div class="trend-card">
            <div class="trend-icon star">🌟</div>
            <div class="trend-content">
              <div class="trend-label">Most Consumed</div>
              <div class="trend-value">{{ usageTrends.mostConsumed }}</div>
              <div class="trend-sublabel">this month</div>
            </div>
          </div> -->

          <!-- fastest category -->
          <!-- <div class="trend-card">
            <div class="trend-icon fast">⚡</div>
            <div class="trend-content">
              <div class="trend-label">Top Category</div>
              <div class="trend-value">{{ usageTrends.fastestCategory }}</div>
              <div class="trend-sublabel">most used</div>
            </div>
          </div> -->

          <!-- shopping frequency -->
          <!-- <div class="trend-card">
            <div class="trend-icon shop">🛒</div>
            <div class="trend-content">
              <div class="trend-label">Shopping</div>
              <div class="trend-value">{{ usageTrends.shoppingFrequency }}</div>
              <div class="trend-sublabel">average</div>
            </div>
          </div> -->
        </div>

        <div class="tip">
          <span class="bulb">💡</span>
          <p>{{ tips[0] }}</p>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.feature-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.dashboard {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  font-family: "Inter", system-ui, sans-serif;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%);
  animation: fadeSlideIn 0.8s ease;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.grid {
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr;
  margin-top: 20px;
}

@media (min-width: 800px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  transition: all 0.25s ease-in-out;
  opacity: 0;
  transform: translateY(12px);
  animation: fadeUp 0.6s ease forwards;
}

.card:nth-child(1) { animation-delay: 0.1s; }
.card:nth-child(2) { animation-delay: 0.2s; }
.card:nth-child(3) { animation-delay: 0.3s; }
.card:nth-child(4) { animation-delay: 0.4s; }

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(56, 142, 60, 0.15);
  border-color: #a5d6a7;
}

@keyframes fadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.score-card {
  text-align: center;
  background: #2e7d32;
  border: none;
  box-shadow: 0 4px 12px rgba(56, 142, 60, 0.1);
  animation-delay: 0s;
}

h2, h3 {
  margin-bottom: 10px;
  color: #1b5e20;
}

.muted {
  color: #6b7280;
}

.circle {
  background-image: url("../assets/earths.png");
  background-size: cover;
  background-position: center;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 4px solid #a5d6a7;
  display: grid;
  place-items: center;
  margin: 12px auto;
  animation: pulse 3s infinite ease-in-out;
}

.circle-text {
  font-weight: 600;
  color: #2e7d32;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(129, 199, 132, 0.3);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 20px 5px rgba(129, 199, 132, 0.15);
  }
}

.metric-block {
  margin-bottom: 20px;
}

.metric-labels {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 6px;
  font-weight: 600;
  color: #4b5563;
}

.used {
  color: #059669;
}

.expired {
  color: #dc2626;
}

.progress-bar {
  height: 12px;
  background: #f3f4f6;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: inset 0 0 3px rgba(0,0,0,0.12);
}

.progress-fill {
  height: 100%;
  transition: width 1s cubic-bezier(.2,.9,.2,1);
  border-radius: 8px;
}

.used-fill {
  background: linear-gradient(90deg, #34d399, #059669);
}

.expired-fill {
  background: linear-gradient(90deg, #fb7185, #dc2626);
}

.expiry-notifications {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid #f3f4f6;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.notification-title {
  font-size: 16px;
  font-weight: 700;
  color: #374151;
}

.notification-count {
  background: #ef4444;
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
}

.no-expiry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  color: #166534;
  font-size: 14px;
  font-weight: 500;
}

.checkmark {
  font-size: 18px;
  color: #16a34a;
}

.notification-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.notification-columns:has(.notification-column:only-child) {
  grid-template-columns: 1fr;
}

.notification-column {
  display: flex;
  flex-direction: column;
  min-width: 0; 
}

.section-label {
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 8px;
  text-align: center;
  white-space: nowrap;
}

.urgent-label {
  background: #fee2e2;
  color: #991b1b;
}

.warning-label {
  background: #fed7aa;
  color: #9a3412;
}

.notification-scroll-container {
  max-height: 75px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.notification-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
  animation: slideIn 0.4s ease-out backwards;
}

.notification-item:nth-child(1) { animation-delay: 0.1s; }
.notification-item:nth-child(2) { animation-delay: 0.2s; }
.notification-item:nth-child(3) { animation-delay: 0.3s; }

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.urgent-item {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.urgent-item:hover {
  background: #fee2e2;
  transform: scale(1.02);
}

.warning-item {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.warning-item:hover {
  background: #fef3c7;
  transform: scale(1.02);
}

.item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.item-name {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.item-quantity {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
}

.item-expiry {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  text-align: center;
  align-self: flex-end;
}

.urgent-expiry {
  background: #dc2626;
  color: white;
}

.warning-expiry {
  background: #f59e0b;
  color: white;
}

.tip {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  animation: slideIn 0.6s ease-out both;
}

.bulb {
  font-size: 1.3rem;
}

.radar-placeholder {
  border: 2px dashed #d1d5db;
  height: 180px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  margin-bottom: 12px;
  color: #9ca3af;
  background: radial-gradient(circle, rgba(255,255,255,0.9), rgba(241,245,249,0.5));
  animation: pulseBorder 3s infinite ease-in-out;
}

.fade-in {
  animation: fadeUp 0.7s ease both;
}

.savings-display {
  text-align: center;
  margin-bottom: 24px;
}

.savings-amount {
  font-size: 42px;
  font-weight: 800;
  color: #d97706;
  transition: transform .3s ease;
}

.card:hover .savings-amount {
  transform: scale(1.08);
}

.hint-text {
  color: #6b7280; 
  font-size: 13px;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  border-radius: 14px;
  font-size: 16px;
  align-items: center;
}

.label-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #374151;
}

.value {
  font-size: 22px;
  font-weight: 700;
}

.amber-row {
  background: #fff7e6;
}

.green-row {
  background: #e6f7eb;
}

.amber-text {
  color: #d97706;
}

.green-text {
  color: #059669;
}

.trends-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.trend-card {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s ease;
}

.trend-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #cbd5e1;
}

.trend-icon {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.trend-icon.up {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
}

.trend-icon.down {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
}

.trend-icon.same {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
}

.trend-icon.star {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
}

.trend-icon.fast {
  background: linear-gradient(135deg, #ddd6fe, #c4b5fd);
}

.trend-icon.shop {
  background: linear-gradient(135deg, #fbcfe8, #f9a8d4);
}

.trend-content {
  flex: 1;
  min-width: 0;
}

.trend-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.trend-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trend-value.up-text {
  color: #059669;
}

.trend-value.down-text {
  color: #dc2626;
}

.trend-value.same-text {
  color: #6366f1;
}

.trend-sublabel {
  font-size: 10px;
  color: #94a3b8;
}

@media (max-width: 600px) {
  .trends-grid {
    grid-template-columns: 1fr;
  }
}
</style>
