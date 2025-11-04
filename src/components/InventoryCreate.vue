<script setup>
    import { ref, onMounted} from 'vue'
    import { useRouter } from 'vue-router'
    import { supabase } from '@/lib/supabase.js'

    const router = useRouter();

    // Reactive data
    // ref() - Vue.js function that creates a reactive reference
    const householdId = ref(null)
    const name = ref('');
    const category = ref('');
    const unit = ref('');
    const quantity = ref(0);
    const expiryDate = ref('');

    // **SUCCESS NOTIFICATION DATA**
    const showSuccessNotification = ref(false)
    const successMessage = ref('')
    const routingAction = ref(null)
    let successTimer = null

    // **NOTIFICATION METHODS**
    function showSuccessMessage(message, callback = null) {
        successMessage.value = message
        showSuccessNotification.value = true

        // Store the callback function
        routingAction.value = callback
        
        if (successTimer) {
            clearTimeout(successTimer)
        }
        
        // Auto-dismiss after 3 seconds (3000ms)
        successTimer = setTimeout(() => {
            showSuccessNotification.value = false
            successTimer = null
            
        // Execute callback after dismissal
        if (routingAction.value) {
            routingAction.value() // Execute routing
            routingAction.value = null // Clear action after execution
        }
        }, 3000)
    }

    function dismissSuccessNotification() {
        showSuccessNotification.value = false
        
        // If the user manually dismissed the alert, clear the timer
        if (successTimer) {
            clearTimeout(successTimer)
            successTimer = null
        }
        
        // Manually trigger the routing action immediately**
        if (routingAction.value) {
            routingAction.value() // Execute routing immediately
            routingAction.value = null // Clear action
        }
    }

    onMounted(async () => {
        // Fetch the authenticated user's Household ID
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            const userId = session.user.id

            // Fetch household_id linked to this user
            const { data, error } = await supabase
            .from('households')
            .select('id')
            .eq('created_by', userId)
            .single()

            if (error) {
            console.error('Error fetching household ID:', error)
            alert('Unable to fetch your household information. Please try again.')
            return
            }

            householdId.value = data.id
            // console.log('Fetched Household ID:', householdId.value) // Console Log: Household ID
        } else {
            alert('You must be logged in to create ingredients.')
            router.push('/login')
        }
    })

    async function saveIngredient() {
        try {
            // Check if ingredient exists for the household
            const { data: existingIngredients, error: fetchError } = await supabase
                .from('ingredients')
                .select('*')
                .eq('household_id', householdId.value)
                .eq('name', name.value)

            if (fetchError) throw fetchError

            let ingredientId

            if (existingIngredients.length === 0) {
                // Insert new ingredient
                const { data: newIngredient, error: insertError } = await supabase
                    .from('ingredients')
                    .insert([{
                        household_id: householdId.value,
                        name: name.value,
                        category: category.value,
                        unit: unit.value
                    }])
                    .select() // returns the inserted row

                if (insertError) throw insertError
                ingredientId = newIngredient[0].id
            } else {
                ingredientId = existingIngredients[0].id
            }

            // Check if batch with same expiry date exists
            const { data: existingBatches, error: batchError } = await supabase
                .from('ingredient_batches')
                .select('*')
                .eq('ingredient_id', ingredientId)
                .eq('expiry_date', expiryDate.value)

            if (batchError) throw batchError

            if (existingBatches.length === 0) {
                // Insert new batch
                const { error: batchInsertError } = await supabase
                    .from('ingredient_batches')
                    .insert([{
                        ingredient_id: ingredientId,
                        quantity: quantity.value,
                        expiry_date: expiryDate.value
                    }])
                if (batchInsertError) throw batchInsertError
            } else {
                // Update existing batch quantity
                const { error: batchUpdateError } = await supabase
                    .from('ingredient_batches')
                    .update({
                        quantity: existingBatches[0].quantity + Number(quantity.value)
                    })
                    .eq('id', existingBatches[0].id)

                if (batchUpdateError) throw batchUpdateError
            }

            // SUCCESS NOTIFICATION & DELAYED REDIRECTION
            showSuccessMessage(`'${name.value}' added to inventory!`, () => {
                router.push('/Inventory')
            })
        } catch (error) {
            console.error('Error saving ingredient:', error)
            alert('Failed to save ingredient. See console for details.')
        }
    }
</script>

<template>
    <transition name="slide-down">
        <div 
            v-if="showSuccessNotification" 
            class="success-notification-top" 
            role="alert" 
            aria-live="polite" 
            aria-atomic="true"
        >
            <div class="success-notification-card">
                <div class="success-notification-content">
                    <div class="success-icon-wrapper">
                        <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <p class="success-message-text">{{ successMessage }}</p>
                    <button 
                        class="success-dismiss-btn" 
                        @click="dismissSuccessNotification" 
                        aria-label="Dismiss notification"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="6" y1="6" x2="18" y2="18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </transition>   

    <div class="container mt-5">
        <h1 class="mb-4 text-center">Create New Ingredient</h1>
        <form @submit.prevent="saveIngredient" class="mx-auto" style="max-width: 500px;">
            <div class="mb-3">
                <label for="name" class="form-label">Name</label>
                <input id="name" v-model="name" type="text" placeholder="Rice" class="form-control" required />
            </div>

            <div class="mb-3">
                <label for="category" class="form-label">Category</label>
                <select id="category" v-model="category" class="form-select" required>
                    <option disabled value="">Select category</option>
                    <option>Grains & Pasta</option>
                    <option>Dairy & Eggs</option>
                    <option>Meat & Seafood</option>
                    <option>Fruits & Vegetables</option>
                    <option>Condiments & Seasonings</option>
                    <option>Canned & Frozen Food</option>
                    <option>Beverages</option>
                    <option>Snacks & Confectionery</option>
                    <option>Baking & Cooking Essentials</option>
                    <option>Others / Miscellaneous</option>
                </select>
            </div>

            <div class="mb-3">
                <label for="unit" class="form-label">Unit</label>
                <select id="unit" v-model="unit" class="form-select" required>
                    <option disabled value="">Select unit</option>
                    <optgroup label="Weight">
                        <option>kg</option>
                        <option>g</option>
                    </optgroup>
                    <optgroup label="Volume">
                        <option>L</option>
                        <option>ml</option>
                    </optgroup>
                    <optgroup label="Count / Pieces">
                        <option>pcs</option>
                        <option>pack</option>
                    </optgroup>
                </select>
            </div>

            <div class="mb-3">
                <label for="quantity" class="form-label">Quantity</label>
                <input id="quantity" v-model="quantity" type="number" placeholder="1" class="form-control" required />
            </div>

            <div class="mb-3">
                <label for="expiryDate" class="form-label">Expiry Date</label>
                <input id="expiryDate" v-model="expiryDate" type="date" class="form-control" required />
            </div>

            <button type="submit" class="btn btn-primary w-100">Save</button>
        </form>
    </div>
</template>

<style scope>
    /* ===== SUCCESS NOTIFICATION (TOP CENTER) STYLES ===== */
    .success-notification-top {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2001; /* Ensure it's above other elements */
        max-width: 500px;
        width: calc(100% - 40px);
    }

    .success-notification-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        padding: 15px 20px;
        display: flex;
        align-items: center;
        gap: 15px;
        border-left: 5px solid #4CAF50; /* Green border for success */
    }

    .success-notification-content {
        display: flex;
        align-items: center;
        flex-grow: 1;
    }

    .success-icon-wrapper {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        background: #4CAF50;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
    }

    .success-icon {
        width: 20px;
        height: 20px;
        color: white;
        stroke-width: 2.5;
    }

    .success-message-text {
        flex-grow: 1;
        color: #333;
        font-weight: 500;
        margin: 0;
        line-height: 1.3;
    }

    .success-dismiss-btn {
        flex-shrink: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: #999;
        padding: 5px;
        border-radius: 4px;
        transition: color 0.2s, background 0.2s;
    }

    .success-dismiss-btn:hover {
        color: #555;
        background: #f0f0f0;
    }

    .success-dismiss-btn svg {
        width: 20px;
        height: 20px;
        stroke-width: 2.5;
    }

    /* ===== TRANSITION STYLES (slide-down) ===== */
    .slide-down-enter-active,
    .slide-down-leave-active {
        transition: all 0.5s cubic-bezier(0.25, 0.8, 0.5, 1);
    }

    .slide-down-enter-from,
    .slide-down-leave-to {
        opacity: 0;
        transform: translateY(-100%) translateX(-50%);
    }
</style>
