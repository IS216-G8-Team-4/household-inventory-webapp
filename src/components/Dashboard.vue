<script setup>
import { ref, onMounted } from "vue";
import { createClient } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

// --- Reactive states ---
const summary = ref({
  score: 0,
  co2Saved: "0 kg",
  itemsSaved: 0,
});
const impact = ref({
  co2Prevented: 0,
  trees: 0,
});
const savings = ref({
  valueSaved: "$0.00",
  itemsDonated: 0,
});
const wastage = ref({
  expiredPercent: 0,
  usedPercent: 0,
});
const tips = ref([
  "Plan meals around items expiring soon to keep wastage low.",
]);

// --- Helper function ---
const calcPercent = (wasted, saved) => {
  const total = (wasted ?? 0) + (saved ?? 0);
  return total === 0 ? 0 : Math.round((wasted / total) * 100);
};

// --- Fetch dashboard data ---
const fetchDashboardData = async () => {
  try {
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
  

    // Find household
    const { data: household, error: householdErr } = await supabase
      .from("households")
      .select("id")
      .eq("created_by", userId)
      .maybeSingle();

    if (householdErr || !household) return;
    const householdId = household.id;
  
    // Fetch most recent sustainability metrics
    const { data: metrics, error: metricsErr } = await supabase
      .from("sustainability_metrics")
      .select("*")
      // .eq("household_id", householdId)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(householdId)
    console.log(metrics)
    if (metricsErr) console.error(metricsErr);

    if (metrics) {
      summary.value = {
        score: metrics.sustainability_score ?? 0,
        co2Saved: `${metrics.co2_saved_kg?.toFixed(1) ?? 0} kg`,
        itemsSaved: metrics.items_saved ?? 0,
      };

      impact.value = {
        co2Prevented: metrics.co2_saved_kg ?? 0,
        trees: (metrics.co2_saved_kg / 8.8).toFixed(1), // ~1 tree offsets ~8.8 kg CO₂
      };

      savings.value = {
        valueSaved: `$${(metrics.money_saved_sgd ?? 0).toFixed(2)}`,
        itemsDonated: metrics.items_donated ?? 0,
      };

      wastage.value = {
        expiredPercent: calcPercent(metrics.items_wasted, metrics.items_saved),
        usedPercent: 100 - calcPercent(metrics.items_wasted, metrics.items_saved),
      };
    }

    // Dynamic eco tips
    if (wastage.value.expiredPercent > 20) {
      tips.value = [
        "Check your pantry twice a week to cut down on food waste!",
      ];
    } else if (impact.value.co2Prevented > 10) {
      tips.value = [
        "Amazing! Keep donating to boost your CO₂ savings further 🌿",
      ];
    }
  } catch (error) {
    console.error("Error loading dashboard:", error.message);
  }
};

// --- Placeholder for future feature ---
const openUsedVsWasted = () => {
  alert("Coming soon: Interactive 'Used vs Wasted' chart!");
};

// --- Lifecycle ---
onMounted(fetchDashboardData);
</script>

<template>
  <main class="dashboard">
    <!-- 🌱 Sustainability Score -->
    <header class="card score-card fade-in">
      <h2>🌿 Sustainability Score: <strong>{{ summary.score }}</strong></h2>
      <p class="muted">
        You saved <b>{{ summary.co2Saved }}</b> CO₂ and
        <b>{{ summary.itemsSaved }}</b> items this month.
      </p>
    </header>

    <!-- 🌍 Main Grid -->
    <section class="grid">
      <!-- Environmental Impact -->
      <section class="card fade-in">
        <h3>🌍 Environmental Impact</h3>
        <div class="circle">
          <div class="circle-text">{{ impact.co2Prevented }} kg CO₂</div>
        </div>
        <p class="muted">≈ {{ impact.trees }} trees saved</p>
      </section>

      <!-- Cost Savings -->
      <section class="card fade-in">
        <h3>💰 Cost Savings</h3>
        <ul class="list">
          <li><b>{{ savings.valueSaved }}</b> saved this month</li>
          <li>{{ savings.itemsDonated }} items donated</li>
        </ul>
      </section>

      <!-- Wastage Overview -->
      <section class="card fade-in">
        <h3>♻️ Wastage Overview</h3>
        <div class="bar">
          <div class="bar-used" :style="{ width: wastage.usedPercent + '%' }"></div>
        </div>
        <ul class="list">
          <li>Expired: {{ wastage.expiredPercent }}%</li>
          <li>Used / Donated: {{ wastage.usedPercent }}%</li>
        </ul>
        <button class="btn" @click="openUsedVsWasted">View Details</button>
      </section>

      <!-- Consumption Pattern -->
      <section class="card fade-in">
        <h3>📊 Consumption Pattern</h3>
        <div class="radar-placeholder">Chart coming soon</div>
        <div class="tip">
          <span class="bulb">💡</span>
          <p>{{ tips[0] }}</p>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
/* 🌿 Dashboard Container */
.dashboard {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  font-family: "Inter", system-ui, sans-serif;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f8f6 100%);
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

/* 🌿 Grid Layout */
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

/* 🌿 Cards */
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

/* 🌱 Header */
.score-card {
  text-align: center;
  background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
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

/* 🌍 Environmental Impact Circle */
.circle {
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

/* ♻️ Progress Bar */
.bar {
  background: #f1f5f9;
  border-radius: 8px;
  height: 12px;
  overflow: hidden;
  margin-bottom: 10px;
}

.bar-used {
  background: linear-gradient(90deg, #81c784, #4caf50);
  height: 100%;
  border-radius: 8px;
  transition: width 1s cubic-bezier(0.25, 1, 0.5, 1);
}

/* 💡 Tip Section */
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

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.bulb {
  font-size: 1.3rem;
}

/* 💰 Buttons */
.btn {
  padding: 10px 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border: none;
  cursor: pointer;
  font-weight: 500;
  color: #2e7d32;
  transition: all 0.3s ease;
}

.btn:hover {
  background: linear-gradient(135deg, #a5d6a7, #81c784);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(129, 199, 132, 0.3);
}

/* 📊 Placeholder for Chart */
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

@keyframes pulseBorder {
  0%, 100% { border-color: #d1d5db; }
  50% { border-color: #81c784; }
}

/* 🌈 Animations */
.fade-in {
  animation: fadeUp 0.7s ease both;
}
</style>

