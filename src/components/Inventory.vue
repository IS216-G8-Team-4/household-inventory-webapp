<script setup>
    import { ref, onMounted, watch } from 'vue'
    import { useRouter } from 'vue-router'
    import axios from 'axios'
    import { supabase } from '@/lib/supabase.js' // @ = src directory. @/lib/ = src/lib/)

    // Reactive data
    const router = useRouter()
    const householdId = ref(null)
    const inventory = ref([])
    const myDonations = ref([])
    const session = ref(null)

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
    <div class="inventory">
        <div class="header">
            <h1>Inventory Page</h1>
            <button class="create-btn" @click="goToCreate">+ Create Ingredient</button>
        </div>

        <div v-for="item in inventory" :key="item.id" class="ingredient-card">
            <h2>{{ item.name }}</h2>
            <p><strong>Category:</strong> {{ item.category }}</p>
            <p><strong>Unit:</strong> {{ item.unit }}</p>

            <table>
                <thead>
                    <tr>
                        <th>Quantity</th>
                        <th>Expiry Date</th>
                        <th>Expires In</th>
                        <th class="edit-header"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="batch in item.batches" :key="batch.id">
                        <td>{{ batch.quantity }}</td>
                        <td>{{ batch.expiryDate }}</td>
                        <td>{{ timeUntilExpiry(batch.expiryDate) }}</td>
                        <td class="edit-cell">
                            <button class="edit-btn" @click="goToEdit(item.id, batch.id)">Edit</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="container mt-4">
        <h3>My Donations</h3>
        <div v-if="myDonations.length === 0" class="text-muted">No items donated yet.</div>

        <div v-for="item in myDonations" :key="item.id" class="card mb-3">
            <div class="card-body">
                <h5>{{ item.item_name }}</h5>
                <p>{{ item.description }}</p>
                <p>Qty: {{ item.quantity }}</p>
                <p>Status: <strong>{{ item.status }}</strong></p>
            </div>
        </div>
  </div>
   
</template>

<style scope>
    a {
        margin: 5px;
        display: block;
    }

    .inventory {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }

    .ingredient-card {
        background: #f9f9f9;
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .create-btn {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
    }

    .create-btn:hover {
        background-color: #0056b3;
    }

    th.edit-header, 
    td.edit-cell {
        width: 1%;              /* Shrinks as much as possible */
        white-space: nowrap;    /* Prevent button from wrapping */
        padding: 4px 8px;       /* Reduce padding */
        text-align: right;
    }

    .edit-btn {
        background-color: #28a745;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
    }

    .edit-btn:hover {
        background-color: #218838;
    }
</style>
