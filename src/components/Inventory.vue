<script setup>
  import { ref, onMounted, watch, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import axios from 'axios'
  import { supabase } from '@/lib/supabase.js' // @ = src directory. @/lib/ = src/lib/)

  // Reactive data
  const router = useRouter()
  const householdId = ref(null)
  const inventory = ref([])
  const session = ref(null)

  // UI states
  const sortBy = ref('alphabetical')
  const sortLabel = computed(() => sortBy.value === 'expiry' ? 'Expiring Soon' : 'Alphabetical (A–Z)')
  const searchQuery = ref('')
  const showExpiredOnly = ref(false) // Toggle to show only expired items

  // Filter 
  const selectedCategories = ref([]) // Which categories are checked
  const availableCategories = computed(() => {
    // Extract unique categories from current inventory
    const all = inventory.value.map(i => i.category).filter(Boolean)
    return [...new Set(all)].sort()
  })
  
  // Computed: Filter + Sort + Search combined
  const filteredInventory = computed(() => {
    let list = [...inventory.value]

    // Show only expired items if toggled
    if (showExpiredOnly.value) {
      list = list.filter(item => 
        item.batches.some(batch => new Date(batch.expiryDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0))
      )
    }

    // Apply search filter
    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.trim().toLowerCase()
      list = list.filter(item => item.name.toLowerCase().includes(q))
    }

    // Apply category filter
    if (selectedCategories.value.length > 0) {
      list = list.filter(item => selectedCategories.value.includes(item.category))
    }

    // APPLY BATCH SORTING FOR EACH INGREDIENT
    list.forEach(ingredient => {
      // Sort the batches array for the current ingredient by expiryDate
      ingredient.batches.sort((a, b) => {
        const dateA = new Date(a.expiryDate)
        const dateB = new Date(b.expiryDate)
        
        // Handle null/empty dates by putting them at the end
        if (!a.expiryDate) return 1
        if (!b.expiryDate) return -1
        
        return dateA - dateB // Ascending sort (earliest date first)
      })
    })

    // Apply sorting
    if (sortBy.value === 'alphabetical') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy.value === 'expiry') {
      list.sort((a, b) => {
        const earliestA = Math.min(...a.batches.map(b => new Date(b.expiryDate)))
        const earliestB = Math.min(...b.batches.map(b => new Date(b.expiryDate)))
        return earliestA - earliestB
      })
    }
    return list
  })

  // Change sorting method
  function setSort(type) {
    sortBy.value = type
  }

  // Fetch current session (get user ID)
  async function fetchSession() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
          console.error('Error fetching session:', error)
          return
      }
      session.value = data.session
  }

  // Fetch householdId based on logged-in user
  async function fetchHouseholdId() {
      if (!session.value) return

      const userId = session.value.user.id
      const { data: households, error } = await supabase
          .from('households')
          .select('id')
          .eq('created_by', userId)
          .limit(1)

      if (error) {
          console.error('Error fetching household:', error)
          return
      }

      if (households.length > 0) {
          householdId.value = households[0].id
      } else {
          console.warn('No household found for user.')
      }
  }

  // Fetch ingredients and batches
  async function fetchInventory() {
    if (!householdId.value) return

    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId.value)

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError)
      return
    }

    const enrichedIngredients = await Promise.all(
      ingredientsData.map(async (ingredient) => {
        const { data: batchesData, error: batchesError } = await supabase
          .from('ingredient_batches')
          .select('*')
          .eq('ingredient_id', ingredient.id)

        if (batchesError) {
          console.error(`Error fetching batches for ${ingredient.name}:`, batchesError)
          return { ...ingredient, batches: [] }
        }

        const batches = batchesData
          .filter(batch=> batch.quantity>0)
          .map(batch => ({
            id: batch.id,
            quantity: batch.quantity,
            expiryDate: batch.expiry_date
          }))

        return { ...ingredient, batches }
      })
    )

    inventory.value = enrichedIngredients.filter(i=>i.batches.length>0)
    // console.log('Inventory fetched:', inventory.value) // Console Log: Fetched Ingredients with Batches
  }

  // Navigation Functions
  function goToCreate() {
    router.push('/Inventory/Create');
  }

  function goToEdit(itemId, batchId) {
    router.push({
      path: `/Inventory/Edit`,
      query: { id: itemId, batch: batchId }
    })
  }

  function goToDonate(item, batch) {
    router.push({
      path: '/SubmitDonation',
      query: {
        name: item.name,
        category: item.category,
        unit: item.unit,
        quantity: batch.quantity,
        itemId: item.id,
        batchId: batch.id,
        expiry: batch.expiryDate
      }
    })
  }


  // Calculate days until expiry
  function timeUntilExpiry(expiryDateStr) { 
    // .setHours(0, 0, 0, 0) = Normalize both dates to midnight local time (The start of the day in local time zone)
    const today = new Date().setHours(0, 0, 0, 0)
    const expiryDate = new Date(expiryDateStr).setHours(0, 0, 0, 0)

    if (isNaN(expiryDate)) return 'Invalid date'

    const diffMs = expiryDate - today // Calculate the time remaining in milliseconds
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) // Convert to days

    if (diffDays < 0) return 'Expired'
    if (diffDays === 0) return 'Today'
    return `${diffDays} day${diffDays > 1 ? 's' : ''} left`
  }

  // Load sequence
  onMounted(async () => {
    await fetchSession()
    await fetchHouseholdId()
    await fetchInventory()
  })

  // Auto refresh inventory when householdId changes
  watch(householdId, (newVal) => {
    if (newVal) fetchInventory()
  })
</script>

<script>
  export default { 
    data() {
      return {}
    }
  }
</script>

<template>
  <div class="inventory-page py-5">
    <div class="container bg-white rounded-4 shadow-lg p-4" style="max-width: 900px;">
      <!-- Header -->
      <div class="text-center mb-4">
        <h2 class="fw-bold text-success mb-1">Inventory</h2>
        <p class="text-muted mb-0">Manage your ingredients and track expiry dates</p>
      </div>

      <!-- Controls -->
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <button class="btn btn-success text-white fw-semibold shadow-sm" @click="goToCreate">
          <i class="bi bi-plus-lg me-1"></i> Create Ingredient
        </button>

        <!-- Show Expired Switch -->
        <div class="form-check form-switch mb-0">
          <input 
            class="form-check-input" 
            type="checkbox" 
            id="expiredToggle" 
            v-model="showExpiredOnly"
          >
          <label class="form-check-label fw-semibold text-success" for="expiredToggle">
            Show expired only
          </label>
        </div>
      </div>

      <!-- Search, Filter, Sort -->
      <div class="d-flex gap-3 flex-wrap align-items-center mb-4">
        <div class="flex-grow-1" style="min-width: 220px;">
          <input
            type="text"
            class="form-control shadow-sm"
            placeholder="Search ingredient..."
            v-model="searchQuery"
          >
        </div>

        <div class="dropdown">
          <button
            class="btn btn-outline-success dropdown-toggle"
            type="button"
            id="filterDropdown"
            data-bs-toggle="dropdown"
          >
            Filter by Category
          </button>
          <ul class="dropdown-menu shadow" aria-labelledby="filterDropdown">
            <li
              v-for="cat in availableCategories"
              :key="cat"
              class="dropdown-item py-1"
            >
              <div class="form-check">
                <input
                  class="form-check-input"
                  type="checkbox"
                  :value="cat"
                  v-model="selectedCategories"
                  :id="`filter-${cat}`"
                >
                <label class="form-check-label" :for="`filter-${cat}`">
                  {{ cat }}
                </label>
              </div>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li class="px-3">
              <button class="btn btn-sm btn-outline-secondary w-100" @click="selectedCategories = []">
                Clear Filters
              </button>
            </li>
          </ul>
        </div>

        <div class="dropdown">
          <button
            class="btn btn-outline-success dropdown-toggle"
            type="button"
            id="sortDropdown"
            data-bs-toggle="dropdown"
          >
            Sort: {{ sortLabel }}
          </button>
          <ul class="dropdown-menu shadow" aria-labelledby="sortDropdown">
            <li><a class="dropdown-item" href="#" @click.prevent="setSort('alphabetical')">Alphabetical (A–Z)</a></li>
            <li><a class="dropdown-item" href="#" @click.prevent="setSort('expiry')">Expiring Soon</a></li>
          </ul>
        </div>
      </div>

      <!-- Inventory Cards -->
      <div v-for="item in filteredInventory" :key="item.id" class="card border-0 shadow-sm mb-3 inventory-card">
        <div class="card-body">
          <h5 class="fw-bold text-success mb-2">{{ item.name }}</h5>
          <p class="mb-1"><strong>Category:</strong> {{ item.category }}</p>
          <p class="mb-2"><strong>Unit:</strong> {{ item.unit }}</p>

          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead class="table-light text-center">
                <tr>
                  <th style="width: 20%">Quantity</th>
                  <th style="width: 25%">Expiry Date</th>
                  <th style="width: 25%">Expires In</th>
                  <th style="width: 30%"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="batch in item.batches" :key="batch.id">
                  <!-- Quantity -->
                  <td class="text-center">{{ batch.quantity }}</td>

                  <!-- Expiry Date -->
                  <td class="text-center">{{ new Date(batch.expiryDate).toLocaleDateString() }}</td>

                  <!-- Expires In -->
                  <td 
                    class="text-center"
                    :class="{'text-danger fw-semibold': timeUntilExpiry(batch.expiryDate) === 'Expired'}"
                    style="white-space: nowrap;"
                  >
                    <i 
                      v-if="timeUntilExpiry(batch.expiryDate) === 'Expired'" 
                      class="bi bi-exclamation-circle-fill me-1 text-danger"
                    ></i>
                    {{ timeUntilExpiry(batch.expiryDate) }}
                  </td>

                  <!-- Action Buttons -->
                  <td class="text-center">
                    <button 
                      class="btn btn-outline-success btn-sm me-2"
                      @click="goToEdit(item.id, batch.id)"
                    >
                      Edit
                    </button>
                    <button 
                      class="btn btn-outline-warning btn-sm"
                      @click="goToDonate(item, batch)"
                    >
                      Donate
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredInventory.length === 0" class="text-center py-5 text-muted">
        <i class="bi bi-inbox fs-1 d-block mb-3 text-success opacity-75"></i>
        <h5>No Ingredients Found</h5>
        <p class="small mb-3">Try adjusting your filters or add new ingredients.</p>
        <button class="btn btn-success text-white" @click="goToCreate">
          Add Ingredient
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .inventory-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2f1 100%);
  }

  .inventory-card {
    transition: all 0.2s ease-in-out;
    border-radius: 16px;
  }

  .inventory-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }
</style>
