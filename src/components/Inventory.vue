<script setup>
    import { ref, onMounted, watch, computed } from 'vue'
    import { useRouter } from 'vue-router'
    import axios from 'axios'
    import { supabase } from '@/lib/supabase.js' // @ = src directory. @/lib/ = src/lib/)

    // Reactive data
    const router = useRouter()
    const householdId = ref(null)
    const inventory = ref([])
    const myDonations = ref([])
    const session = ref(null)

    // UI states
    const sortBy = ref('alphabetical')
    const sortLabel = computed(() => sortBy.value === 'expiry' ? 'Expiring Soon' : 'Alphabetical (A–Z)')
    const searchQuery = ref('') // Placeholder for upcoming feature

    // Filter 
    const selectedCategories = ref([]) // Which categories are checked
    const availableCategories = computed(() => {
    // Extract unique categories from current inventory
    const all = inventory.value.map(i => i.category).filter(Boolean)
    return [...new Set(all)].sort()
    })
    
    // Computed: Sort logic
    const sortedInventory = computed(() => {
        if (sortBy.value === 'alphabetical') {
            let list = [...inventory.value]

            // Apply category filter (if any selected)
            if (selectedCategories.value.length > 0) {
            list = list.filter(item => selectedCategories.value.includes(item.category))
            }

            // Sort logic
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
        } else if (sortBy.value === 'expiry') {
            // Sort by earliest batch expiry date
            return [...inventory.value].sort((a, b) => {
                const earliestA = Math.min(...a.batches.map(b => new Date(b.expiryDate)))
                const earliestB = Math.min(...b.batches.map(b => new Date(b.expiryDate)))
                return earliestA - earliestB
            })
        }
        return inventory.value
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

                const batches = batchesData.map(batch => ({
                    id: batch.id,
                    quantity: batch.quantity,
                    expiryDate: batch.expiry_date
                }))

                return { ...ingredient, batches }
            })
        )

        inventory.value = enrichedIngredients
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


        const res = await axios.get('http://localhost:3000/api/mydonations?user_id=1')
        myDonations.value = res.data
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
    <div class="inventory container mt-4">
        <!-- Header & Controls -->
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Inventory</h1>
            <button class="btn btn-primary" @click="goToCreate">+ Create Ingredient</button>
        </div>

        <!-- Menu Bar -->
        <div class="d-flex gap-3 mb-3 flex-wrap">
            <!-- Search (placeholder for now) -->
            <input 
                type="text" 
                class="form-control w-auto" 
                placeholder="Search ingredient..."
                v-model="searchQuery"
                style="min-width: 200px;"
            >

            <!-- Filter (placeholder for now) -->
            <div class="dropdown">
                <button 
                    class="btn btn-outline-secondary dropdown-toggle" 
                    type="button" 
                    id="filterDropdown" 
                    data-bs-toggle="dropdown" 
                    aria-expanded="false">
                    Filter by Category
                </button>
                <ul class="dropdown-menu" aria-labelledby="filterDropdown">
                    <li v-for="cat in availableCategories" :key="cat" class="px-3 py-1">
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
                    <button class="btn btn-sm btn-outline-secondary w-100" @click="selectedCategories = []">Clear Filters</button>
                    </li>
                </ul>
            </div>

            <!-- Sort Dropdown -->
            <div class="dropdown">
                <button 
                    class="btn btn-outline-secondary dropdown-toggle" 
                    type="button" 
                    id="sortDropdown" 
                    data-bs-toggle="dropdown" 
                    aria-expanded="false">
                    Sort: {{ sortLabel }}
                </button>
                <ul class="dropdown-menu" aria-labelledby="sortDropdown">
                    <li><a class="dropdown-item" href="#" @click.prevent="setSort('alphabetical')">Alphabetical (A–Z)</a></li>
                    <li><a class="dropdown-item" href="#" @click.prevent="setSort('expiry')">Expiring Soon</a></li>
                </ul>
            </div>
        </div>

        <!-- Inventory Cards -->
        <div v-for="item in sortedInventory" :key="item.id" class="card mb-3 shadow-sm">
            <div class="card-body">
                <h5 class="card-title">{{ item.name }}</h5>
                <p class="mb-1"><strong>Category:</strong> {{ item.category }}</p>
                <p class="mb-1"><strong>Unit:</strong> {{ item.unit }}</p>

                <div class="table-responsive">
                    <table class="table table-sm table-bordered mt-2">
                        <thead class="table-light">
                            <tr>
                                <th>Quantity</th>
                                <th>Expiry Date</th>
                                <th>Expires In</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="batch in item.batches" :key="batch.id">
                                <td>{{ batch.quantity }}</td>
                                <td>{{ batch.expiryDate }}</td>
                                <td>{{ timeUntilExpiry(batch.expiryDate) }}</td>
                                <td class="text-end">
                                    <button class="btn btn-success btn-sm" @click="goToEdit(item.id, batch.id)">Edit</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
   
</template>

<style scope>
    .inventory {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
    }

    th, 
    td {
        border: 1px solid #ccc;
        padding: 8px;
        text-align: left;
    }

    th {
        background: #eee;
    }

    th.edit-header, 
    td.edit-cell {
        width: 1%;              /* Shrinks as much as possible */
        white-space: nowrap;    /* Prevent button from wrapping */
        padding: 4px 8px;       /* Reduce padding */
        text-align: right;
    }

</style>
