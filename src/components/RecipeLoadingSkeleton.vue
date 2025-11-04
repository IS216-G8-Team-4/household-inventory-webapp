<template>
  <div class="recipe-loading-container">
    <div class="cooking-animation">
      <svg viewBox="0 0 200 200" class="cooking-pot-svg" style="overflow: visible;">
        <!-- Steam particles -->
        <g class="steam-group">
          <path 
            class="steam-particle steam-1" 
            d="M80,60 Q75,45 70,30" 
            fill="none" 
            stroke="#a8d5ba" 
            stroke-width="3" 
            stroke-linecap="round"
          />
          <path 
            class="steam-particle steam-2" 
            d="M100,60 Q100,40 100,25" 
            fill="none" 
            stroke="#a8d5ba" 
            stroke-width="3.5" 
            stroke-linecap="round"
          />
          <path 
            class="steam-particle steam-3" 
            d="M120,60 Q125,45 130,30" 
            fill="none" 
            stroke="#a8d5ba" 
            stroke-width="3" 
            stroke-linecap="round"
          />
        </g>
        
        <!-- Pot lid -->
        <g class="pot-lid">
          <ellipse cx="100" cy="65" rx="45" ry="8" fill="#5a9168" />
          <circle cx="100" cy="58" r="6" fill="#4a7a56" />
          <ellipse cx="100" cy="56" rx="4" ry="2" fill="#6aa577" />
        </g>
        
        <!-- Pot body -->
        <g class="pot-body">
          <path 
            d="M60,70 L60,130 Q60,145 75,145 L125,145 Q140,145 140,130 L140,70 Z" 
            fill="#5a9168"
          />
          <ellipse cx="100" cy="70" rx="40" ry="8" fill="#6aa577" />
          
          <!-- Pot handles -->
          <path 
            d="M55,85 Q45,85 45,95 Q45,105 55,105" 
            fill="none" 
            stroke="#4a7a56" 
            stroke-width="4"
            stroke-linecap="round"
          />
          <path 
            d="M145,85 Q155,85 155,95 Q155,105 145,105" 
            fill="none" 
            stroke="#4a7a56" 
            stroke-width="4"
            stroke-linecap="round"
          />
        </g>
        
        <!-- Pot shine -->
        <ellipse cx="85" cy="100" rx="8" ry="15" fill="#7ab889" opacity="0.3" />
      </svg>
      
      <p class="loading-text">{{ currentMessage }}</p>
    </div>

    <!-- Skeleton cards remain the same -->
    <div class="skeleton-grid">
      <div 
        v-for="n in skeletonCount" 
        :key="n" 
        class="skeleton-card"
        :style="{ animationDelay: `${n * 0.1}s` }"
      >
        <div class="skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-footer">
            <div class="skeleton-badge"></div>
            <div class="skeleton-badge"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RecipeLoadingSkeleton',
  props: {
    skeletonCount: {
      type: Number,
      default: 6
    }
  },
  data() {
    return {
      currentMessage: 'Finding delicious recipes...',
      messages: [
        'Finding delicious recipes...',
        'Matching ingredients...',
        'Checking pantry items...',
        'Preparing suggestions...'
      ],
      messageIndex: 0,
      messageInterval: null
    }
  },
  mounted() {
    this.rotateMessages();
    // Force animation restart
    this.$nextTick(() => {
      const svg = this.$el.querySelector('.cooking-pot-svg');
      if (svg) {
        svg.style.animation = 'none';
        setTimeout(() => {
          svg.style.animation = '';
        }, 10);
      }
    });
  },
  beforeUnmount() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
  },
  methods: {
    rotateMessages() {
      this.messageInterval = setInterval(() => {
        this.messageIndex = (this.messageIndex + 1) % this.messages.length;
        this.currentMessage = this.messages[this.messageIndex];
      }, 2500);
    }
  }
}
</script>

<style>
/* UNSCOPED animations - critical for SVG */
@keyframes lidBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes steamRise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }
  20% {
    opacity: 0.8;
  }
  50% {
    opacity: 0.6;
    transform: translateY(-25px) scale(1.3);
  }
  100% {
    opacity: 0;
    transform: translateY(-50px) scale(1.6);
  }
}

.pot-lid {
  animation: lidBounce 1.5s ease-in-out infinite !important;
  transform-origin: center;
  transform-box: fill-box;
}

.steam-particle {
  animation: steamRise 3s ease-in-out infinite !important;
  transform-origin: center;
  transform-box: fill-box;
}

.steam-1 { animation-delay: 0s !important; }
.steam-2 { animation-delay: 0.6s !important; }
.steam-3 { animation-delay: 1.2s !important; }
</style>

<style scoped>
/* Rest of scoped styles */
.recipe-loading-container {
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
}

.cooking-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.cooking-pot-svg {
  width: 150px;
  height: 150px;
}

.loading-text {
  font-size: 1.1rem;
  color: #5a9168;
  font-weight: 500;
  animation: textFade 0.5s ease-in-out;
  margin: 0;
}

@keyframes textFade {
  0% {
    opacity: 0;
    transform: translateY(-5px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Skeleton styles remain the same */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  width: 100%;
  max-width: 1200px;
}

.skeleton-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.skeleton-image {
  width: 100%;
  height: 180px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-title {
  height: 24px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  border-radius: 4px;
  width: 70%;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  border-radius: 4px;
  width: 100%;
}

.skeleton-line.short {
  width: 60%;
}

.skeleton-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.skeleton-badge {
  height: 24px;
  width: 80px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  border-radius: 12px;
}

@media (max-width: 768px) {
  .skeleton-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }
  
  .cooking-pot-svg {
    width: 120px;
    height: 120px;
  }
}
</style>