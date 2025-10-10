<script>
export default {
  name: "SustainabilityDashboard",

  data() {
    return {
      summary: {
        score: 82,
        co2Saved: "14.2 kg",
        itemsSaved: 9,
      },
      impact: {
        co2Prevented: 12.6,
        trees: 1.5,
      },
      savings: {
        valueSaved: "$18.40",
        itemsDonated: 6,
      },
      wastage: {
        expiredPercent: 8,
        usedPercent: 92,
      },
      tips: [
        "Plan meals around items expiring soon to keep wastage low.",
      ],
    };
  },

  methods: {
    openUsedVsWasted() {
      alert("Open 'Used vs Wasted' details here.");
    },
  },
};
</script>

<template>
  <main class="dashboard">
    <!-- Top summary -->
    <header class="card score-card">
      <h2>Your Sustainability Score: {{ summary.score }}</h2>
      <p>
        Great job! You saved {{ summary.co2Saved }} CO₂ and
        {{ summary.itemsSaved }} items this month.
      </p>
    </header>

    <!-- Main grid -->
    <section class="grid">
      <!-- Environmental Impact -->
      <section class="card">
        <h3>Environmental Impact</h3>
        <div class="circle">
          <div class="circle-text">
            {{ impact.co2Prevented }} kg CO₂
          </div>
        </div>
        <p class="muted">
          Equivalent to planting {{ impact.trees }} trees
        </p>
      </section>

      <!-- Cost Savings -->
      <section class="card">
        <h3>Cost Savings</h3>
        <ul class="list">
          <li>{{ savings.valueSaved }} saved via donations</li>
          <li>{{ savings.itemsDonated }} items donated</li>
        </ul>
      </section>

      <!-- Wastage Overview -->
      <section class="card">
        <h3>Wastage Overview</h3>
        <ul class="list">
          <li>Expired before use: {{ wastage.expiredPercent }}%</li>
          <li>Used or donated: {{ wastage.usedPercent }}%</li>
        </ul>
        <button class="btn" @click="openUsedVsWasted">
          Used vs Wasted
        </button>
      </section>

      <!-- Consumption Pattern -->
      <section class="card">
        <h3>Consumption Pattern</h3>
        <div class="radar-placeholder">Radar Chart Placeholder</div>
        <div class="tip">
          <span class="bulb">💡</span>
          <p>{{ tips[0] }}</p>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
/* --- Layout basics --- */
.dashboard {
  padding: 16px;
  max-width: 1100px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
  margin-top: 16px;
}

/* 2 columns on larger screens */
@media (min-width: 800px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* --- Cards --- */
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.score-card {
  text-align: center;
}

/* --- Text styling --- */
h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
h3 {
  margin: 0 0 12px;
  font-size: 18px;
}
.muted {
  color: #6b7280;
  margin-top: 8px;
}

/* --- Circle placeholder --- */
.circle {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  display: grid;
  place-items: center;
  margin: 8px 0;
}
.circle-text {
  text-align: center;
  font-weight: 600;
}

/* --- Radar chart placeholder --- */
.radar-placeholder {
  border: 2px dashed #e5e7eb;
  height: 180px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  margin-bottom: 12px;
}

/* --- Tip box --- */
.tip {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
}
.bulb {
  font-size: 18px;
}

/* --- Lists and buttons --- */
.list {
  padding-left: 18px;
  margin: 0 0 12px;
}
.btn {
  display: inline-block;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  border-radius: 8px;
  cursor: pointer;
}
.btn:hover {
  background: #e5e7eb;
}
</style>
