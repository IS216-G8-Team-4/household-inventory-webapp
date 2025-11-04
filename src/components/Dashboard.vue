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
      allTips: [
        "Plan meals around items expiring soon to keep wastage low.",
        "Check your pantry twice a week to stay on top of expiry dates.",
        "Store leftovers in clear containers so you remember to eat them.",
        "Freeze items before they expire to extend their shelf life.",
        "Share surplus food with neighbors or local food banks.",
        "Use the 'first in, first out' method when organizing your pantry.",
        "Turn overripe fruits into smoothies, jams, or baked goods.",
        "Compost food scraps to reduce waste and nourish your garden.",
        "Buy only what you need and stick to your shopping list.",
        "Keep your fridge at the right temperature (below 5°C) to preserve food longer.",
        "Learn to distinguish 'best before' from 'use by' dates.",
        "Use the recipes feature to create a weekly meal plan to avoid impulse purchases.",
        "Donate unexpired items you won't use to those in need."
      ],
      expiryNotifications: {
        urgent: [],
        warning: [],
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
  },

  methods: {
    //standardize quantities to "item count" based on unit
    standardizeQuantity(quantity, unit) {
      const amount = parseFloat(quantity) || 0;
      
      //define standard serving sizes for each unit
      const standardServings = {
        'kg': 1,      
        'g': 0.01,   
        'L': 1,       
        'ml': 0.004,  
        'pcs': 1,     
        'pack': 1.5,    
      };
      
      const multiplier = standardServings[unit] || 1;
      return amount * multiplier;
    },

    calcPercent(wasted, saved) {
      const total = (wasted || 0) + (saved || 0);
      if (total === 0) {
        return 0;
      }
      return Math.round((wasted/total)*100);
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

    //calculate sustainability score based on saved vs wasted items
    calculateSustainabilityScore(itemsSaved, itemsWasted, itemsDonated) {
      const totalItems = itemsSaved + itemsWasted + itemsDonated;
      if (totalItems === 0) return 0;
      
      //score components:
      // - 60% based on items saved/used
      // - 30% based on items donated
      // - 10% penalty for items wasted
      const savedScore = (itemsSaved / totalItems) * 60;
      const donatedScore = (itemsDonated / totalItems) * 30;
      const wastePenalty = (itemsWasted / totalItems) * 10;
      
      return Math.max(0, Math.min(100, Math.round(savedScore + donatedScore - wastePenalty)));
    },

    //calculate CO2 saved based on items saved and donated
    //average: 1 item saved/donated = ~0.5 kg CO2 prevented
    calculateCO2Saved(itemsSaved, itemsDonated) {
      const CO2_PER_ITEM = 0.5; // kg CO2 per item
      return ((itemsSaved + itemsDonated) * CO2_PER_ITEM).toFixed(1);
    },

    //estimate money saved based on items consumed
    calculateMoneySaved(itemsSaved) {
      const AVG_ITEM_VALUE = 3; // SGD per item
      return (itemsSaved * AVG_ITEM_VALUE).toFixed(2);
    },

    async fetchExpiringIngredients(householdId) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);
        threeDaysFromNow.setHours(23, 59, 59, 999);

        //get all ingredients for this household to filter batches
        const { data: householdIngredients, error: ingredientError } = await supabase
          .from("ingredients")
          .select("id")
          .eq("household_id", householdId);

        if (ingredientError) {
          console.error("Error fetching household ingredients", ingredientError);
          return;
        }

        if (!householdIngredients || householdIngredients.length === 0) {
          console.log("No ingredients found for household");
          this.expiryNotifications = { urgent: [], warning: [] };
          return;
        }

        //extract ingredient IDs
        const ingredientIds = householdIngredients.map(ing => ing.id);

        //fetch expiring batches for these ingredients
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
          .in("ingredient_id", ingredientIds)
          .lte("expiry_date", threeDaysFromNow.toISOString().split('T')[0])
          .gte("expiry_date", today.toISOString().split('T')[0]);

        if (error) throw error;

        const urgent = [];
        const warning = [];

        if (batches && batches.length > 0) {
          for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const daysUntil = this.getDaysUntilExpiry(batch.expiry_date);

            const item = {
              id: batch.id,
              batchId: batch.id,
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
        }

        this.expiryNotifications = {
          urgent: urgent.sort((a, b) => a.daysUntil - b.daysUntil),
          warning: warning.sort((a, b) => a.daysUntil - b.daysUntil)
        };
      } 
      catch (error) {
        console.error("Error fetching expiring ingredients:", error.message);
      }
    },

    async fetchMonthlyMetrics(householdId) {
      try {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        console.log("Fetching metrics for household:", householdId);
        console.log("Date range:", firstDayOfMonth, "to", lastDayOfMonth);

        // Get items donated with standardized quantities
        const { data: donations, error: donationsError } = await supabase
            .from("donation_submissions")
            .select("Item_Quan, Unit")
            .eq("household_id", householdId)
            .eq("Claimed", true);

        if (donationsError) {
          console.error("Donations error:", donationsError);
          throw donationsError;
        }

        let itemsDonated = 0;
        if (donations && donations.length > 0) {
          for (let i = 0; i < donations.length; i++) {
            const donation = donations[i];
            itemsDonated += this.standardizeQuantity(donation.Item_Quan, donation.Unit);
          }
        }
        console.log("Items donated (standardized):", itemsDonated);

        //get all ingredients for this household
        const { data: householdIngredients, error: ingredientsError } = await supabase
          .from("ingredients")
          .select("id, unit")
          .eq("household_id", householdId);

        if (ingredientsError) {
          console.error("Ingredients error:", ingredientsError);
        }

        let ingredientIds = [];
        let ingredientUnits = {};
        if (householdIngredients && householdIngredients.length > 0) {
          for (let i = 0; i < householdIngredients.length; i++) {
            ingredientIds.push(householdIngredients[i].id);
            ingredientUnits[householdIngredients[i].id] = householdIngredients[i].unit;
          }
        }
        console.log("Ingredient IDs:", ingredientIds);

        let itemsUsed = 0;
        if (ingredientIds.length > 0) {
          //get items consumed this month with quantities
          const { data: consumptions, error: consumptionsError } = await supabase
            .from("consumption_logs")
            .select("ingredient_id, quantity_used")
            .in("ingredient_id", ingredientIds)
            .gte("consumed_date", firstDayOfMonth.toISOString())
            .lte("consumed_date", lastDayOfMonth.toISOString());

          if (consumptionsError) {
            console.error("Consumptions error:", consumptionsError);
          } else if (consumptions && consumptions.length > 0) {
            for (let i = 0; i < consumptions.length; i++) {
              const consumption = consumptions[i];
              const unit = ingredientUnits[consumption.ingredient_id];
              itemsUsed += this.standardizeQuantity(consumption.quantity_used, unit);
            }
          }
          console.log("Items used (standardized):", itemsUsed);
        }

        //get expired items (count from batches)
        const itemsWasted = await this.countExpiredBatches(ingredientIds, ingredientUnits);
        console.log("Items wasted (standardized):", itemsWasted);

        //get current inventory count from active batches
        let currentInventory = 0;
        if (ingredientIds.length > 0) {
          const { data: activeBatches, error: inventoryError } = await supabase
            .from("ingredient_batches")
            .select("ingredient_id, quantity")
            .in("ingredient_id", ingredientIds)
            .eq("status", "active");

          if (inventoryError) {
            console.error("Inventory error:", inventoryError);
          } else if (activeBatches && activeBatches.length > 0) {
            for (let i = 0; i < activeBatches.length; i++) {
              const batch = activeBatches[i];
              const unit = ingredientUnits[batch.ingredient_id];
              currentInventory += this.standardizeQuantity(batch.quantity, unit);
            }
          }
          console.log("Current inventory (standardized):", currentInventory);
        }

        //calculate percentages based on formulas
        //expired % = expired / (current inventory + expired)
        const totalWithExpired = currentInventory + itemsWasted;
        let expiredPercent = 0
        if (totalWithExpired > 0) {
          const ratio = (itemsWasted/totalWithExpired)*100
          expiredPercent = Math.ceil(ratio)
        }
        expiredPercent = Math.min(expiredPercent, 100)

        //used/donated % = (used + donated) / (current inventory + used + donated)
        const usedAndDonated = itemsUsed + itemsDonated;
        const totalWithUsedDonated = currentInventory + usedAndDonated;
        const usedDonatedPercent = totalWithUsedDonated > 0 
          ? Math.round((usedAndDonated / totalWithUsedDonated) * 100) 
          : 0;
        console.log("Expired %:", expiredPercent);
        console.log("Used/Donated %:", usedDonatedPercent);

        //calculate metrics
        const itemsSaved = itemsUsed;
        const co2Saved = this.calculateCO2Saved(itemsSaved, itemsDonated);
        const moneySaved = this.calculateMoneySaved(itemsSaved);
        const sustainabilityScore = this.calculateSustainabilityScore(
          itemsSaved, 
          itemsWasted, 
          itemsDonated
        );

        //update data
        this.summary = {
          score: sustainabilityScore,
          co2Saved: `${co2Saved} kg`,
          itemsSaved: Math.round(itemsSaved),
        };

        this.impact = {
          co2Prevented: parseFloat(co2Saved),
          trees: (parseFloat(co2Saved) / 8.8).toFixed(1),
        };

        this.savings = {
          valueSaved: `${moneySaved}`,
          itemsDonated: Math.round(itemsDonated),
        };

        this.wastage = {
          expiredPercent: expiredPercent,
          usedPercent: usedDonatedPercent,
        };

        //update tips based on metrics
        if (this.wastage.expiredPercent > 20) {
          this.tips = [
            this.allTips[1], 
            this.allTips[3], 
          ];
        } else if (this.impact.co2Prevented > 10) {
          this.tips = [
            this.allTips[4], 
            this.allTips[7], 
          ];
        } else if (itemsDonated > 5) {
          this.tips = [
            this.allTips[12], 
            this.allTips[4], 
          ];
        } else if (this.wastage.expiredPercent < 5 && itemsUsed > 10) {
          this.tips = [
            this.allTips[5], 
            this.allTips[9], 
          ];
        } else {
          //random tips for neutral performance
          const randomIndex = Math.floor(Math.random() * this.allTips.length);
          const secondIndex = (randomIndex + Math.floor(Math.random() * (this.allTips.length - 1)) + 1) % this.allTips.length;
          this.tips = [
            this.allTips[randomIndex],
            this.allTips[secondIndex],
          ];
        }
      } 
      catch (error) {
        console.error("Error fetching monthly metrics:", error.message);
      }
    },

    async countExpiredBatches(ingredientIds, ingredientUnits) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!ingredientIds || ingredientIds.length === 0) {
          console.log("No ingredient IDs provided for expired batch count");
          return 0;
        }

        console.log("Counting expired batches for ingredient IDs:", ingredientIds);

        //get batches that have expired  
        const { data: expiredBatches, error } = await supabase
          .from("ingredient_batches")
          .select("ingredient_id, quantity, expiry_date, status")
          .in("ingredient_id", ingredientIds)
          .lt("expiry_date", today.toISOString().split('T')[0]);

        if (error) {
          console.error("Error fetching expired batches:", error);
          return 0;
        }

        console.log("Expired batches found:", expiredBatches ? expiredBatches.length : 0);

        //alculate standardized count from all expired batches
        let expiredCount = 0;
        if (expiredBatches && expiredBatches.length > 0) {
          for (let i = 0; i < expiredBatches.length; i++) {
            const batch = expiredBatches[i];
            const unit = ingredientUnits[batch.ingredient_id];
            const standardizedQty = this.standardizeQuantity(batch.quantity, unit);
            expiredCount += standardizedQty;
            console.log(`Batch ${i}: ${batch.quantity} ${unit} = ${standardizedQty} items (status: ${batch.status})`);
          }
        }

        console.log("Total expired count (standardized):", expiredCount);
        return expiredCount;
      } catch (error) {
        console.error("Error in countExpiredBatches:", error.message);
        return 0;
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
        await this.fetchMonthlyMetrics(householdId);
      } 
      catch (error) {
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
        <b>{{ summary.itemsSaved }}</b> items.
      </p>
    </header>

    <!-- main grid -->
    <section class="container-fluid px-0 mt-4">
      <div class="row g-3">
        <!-- Environmental Impact -->
        <div class="col-12 col-lg-6">
          <section class="card fade-in h-100">
            <h3>Environmental Impact</h3>
            <div class="circle">
              <div class="circle-text">{{ impact.co2Prevented }} kg CO₂</div>
            </div>
            <p class="muted text-center">≈ {{ impact.trees }} trees saved</p>
          </section>
        </div>

        <!-- wastage overview -->
        <div class="col-12 col-lg-6">
          <section class="card fade-in h-100">
            <h3>Wastage Overview</h3>

            <!-- used/donated -->
            <div class="metric-block">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="metric-label">Used & Donated</span>
                <span class="used metric-value">{{ wastage.usedPercent }}%</span>
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
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="metric-label">Expired</span>
                <span class="expired metric-value">{{ wastage.expiredPercent }}%</span>
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
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="notification-title">⚠️ Expiring Soon</span>
                <span class="notification-count" v-if="totalExpiringItems > 0">
                  {{ totalExpiringItems }}
                </span>
              </div>

              <div v-if="totalExpiringItems === 0" class="no-expiry">
                <span class="checkmark">✓</span>
                <span>No items expiring soon</span>
              </div>

              <div v-else class="row g-2">
                <div 
                  v-if="expiryNotifications.urgent.length > 0" 
                  :class="expiryNotifications.warning.length > 0 ? 'col-12 col-md-6' : 'col-12'"
                >
                  <div class="section-label urgent-label">
                    🔴 Today/Tomorrow: {{ urgent }}
                  </div>
                  <div class="notification-scroll-container">
                    <div class="notification-items">
                      <div 
                        v-for="item in expiryNotifications.urgent" 
                        :key="item.id"
                        class="notification-item urgent-item"
                      >
                        <div class="d-flex justify-content-between align-items-center gap-2">
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

                <div 
                  v-if="expiryNotifications.warning.length > 0" 
                  :class="expiryNotifications.urgent.length > 0 ? 'col-12 col-md-6' : 'col-12'"
                >
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
                        <div class="d-flex justify-content-between align-items-center gap-2">
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
        </div>

        <!-- cost savings -->
        <div class="col-12 col-lg-6">
          <section class="card fade-in h-100">
            <h3>Cost Savings</h3>
            
            <div class="text-center mb-4">
              <div class="savings-amount">
                ${{ savings.valueSaved }}
              </div>
              <div class="hint-text">saved</div>
            </div>
            
            <div class="d-flex flex-column gap-3">
              <div class="summary-row amber-row">
                <div class="label-group">
                  <span>Items Donated</span>
                </div>
                <span class="value amber-text">{{ savings.itemsDonated }}</span>
              </div>

              <div class="summary-row green-row">
                <div class="label-group">
                  <span>Items Used</span>
                </div>
                <span class="value green-text">{{ summary.itemsSaved }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- tips -->
        <div class="col-12 col-lg-6">
          <section class="card fade-in h-100">
            <h3>Tips</h3>
            <div class="tip">
              <span class="bulb">💡</span>
              <p class="mb-0">{{ tips[0] }}</p>
            </div>
          </section>
        </div>
      </div>
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

.metric-label {
  font-size: 14px;
  font-weight: 600;
  color: #4b5563;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
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

.fade-in {
  animation: fadeUp 0.7s ease both;
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
</style>
