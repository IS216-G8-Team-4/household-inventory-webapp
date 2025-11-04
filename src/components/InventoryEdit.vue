<script setup>
    import { ref, onMounted } from 'vue'
    import { useRoute, useRouter } from 'vue-router'
    import { supabase } from '@/lib/supabase.js'

    const route = useRoute();
    const router = useRouter();

    // URL Parameters
    const ingredientId = route.query.id
    const batchId = route.query.batch

    // Reactive data
    const householdId = ref(null)
    const name = ref('')
    const category = ref('')
    const unit = ref('')
    const quantity = ref(0)
    const expiryDate = ref('')
    const ingredientExists = ref(false)

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

    // Fetch session and household dynamically
    onMounted(async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.user) {
            console.error('Error fetching session:', sessionError)
            alert('You must be logged in to edit ingredients.')
            router.push('/login')
            return
        }

        const userId = session.user.id

        // Get household ID linked to user
        const { data: household, error: householdError } = await supabase
        .from('households')
        .select('id')
        .eq('created_by', userId)
        .single()

        if (householdError) {
            console.error('Error fetching household:', householdError)
            alert('Unable to fetch your household information. Please try again.')
            return
        }

        householdId.value = household.id
        console.log('Fetched Household ID:', householdId.value)

        await fetchIngredientAndBatch()
    } catch (error) {
        console.error('Error during setup:', error)
        alert('Something went wrong while loading the ingredient.')
    }
    })

    // Fetch ingredient and batch from Supabase
    async function fetchIngredientAndBatch() {
        try {
            const { data: ingredientData, error: ingredientError } = await supabase
            .from('ingredients')
            .select('*')
            .eq('id', ingredientId)
            .eq('household_id', householdId.value)
            .single()

            if (ingredientError) throw ingredientError
            if (!ingredientData) return

            name.value = ingredientData.name
            category.value = ingredientData.category
            unit.value = ingredientData.unit
            ingredientExists.value = true

            const { data: batchData, error: batchError } = await supabase
            .from('ingredient_batches')
            .select('*')
            .eq('id', batchId)
            .single()

            if (batchError) throw batchError
            if (!batchData) return

            quantity.value = batchData.quantity
            expiryDate.value = batchData.expiry_date
        } catch (error) {
            console.error('Error fetching ingredient/batch:', error)
            alert('Failed to load ingredient or batch. Check console.')
        }
    }

    async function saveChanges() {
        if (!ingredientExists.value) return

        try {
            const { error: updateError } = await supabase
                .from('ingredient_batches')
                .update({
                    quantity: Number(quantity.value),
                    expiry_date: expiryDate.value
                })
                .eq('id', batchId)

            if (updateError) throw updateError

            showSuccessMessage(`'${name.value}' batch updated successfully!`, () => {
                router.push('/Inventory')
            })
        } catch (error) {
            console.error('Error updating batch:', error)
            alert('Failed to update batch. See console for details.')
        }
    }

    async function deleteBatch() {
        try {
            const confirmDelete = confirm(`Are you sure you want to delete this batch of ${name.value} (Expiry: ${expiryDate.value})?`)
            if (!confirmDelete) return

            // Delete batch
            const { error: deleteError } = await supabase
                .from('ingredient_batches')
                .delete()
                .eq('id', batchId)

            if (deleteError) throw deleteError

            // Check if the ingredient still has any batches
            const { data: remainingBatches, error: batchCheckError } = await supabase
                .from('ingredient_batches')
                .select('*')
                .eq('ingredient_id', ingredientId)

            if (batchCheckError) throw batchCheckError

            // If no batches left, delete the ingredient
            if (!remainingBatches || remainingBatches.length === 0) {
                const { error: ingredientDeleteError } = await supabase
                    .from('ingredients')
                    .delete()
                    .eq('id', ingredientId)

                if (ingredientDeleteError) throw ingredientDeleteError
            }

            alert('Batch deleted successfully!')
            router.push('/Inventory')
        } catch (error) {
            console.error('Error deleting batch:', error)
            alert('Failed to delete batch. See console for details.')
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
        <h1 class="mb-4 text-center">Edit Ingredient Batch</h1>

        <div v-if="ingredientExists" class="mx-auto" style="max-width: 500px;">
            <p><strong>Ingredient:</strong> {{ name }}</p>
            <p><strong>Category:</strong> {{ category }}</p>
            <p><strong>Unit:</strong> {{ unit }}</p>

            <form @submit.prevent="saveChanges">
                <div class="mb-3">
                    <label for="quantity" class="form-label">Quantity</label>
                    <input id="quantity" v-model="quantity" type="number" class="form-control" required />
                </div>

                <div class="mb-3">
                    <label for="expiryDate" class="form-label">Expiry Date</label>
                    <input id="expiryDate" v-model="expiryDate" type="date" class="form-control" required />
                </div>

                <div class="d-flex justify-content-between">
                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-success">Save Changes</button>
                        <button type="button" class="btn btn-secondary" @click="router.push('/Inventory')">Cancel</button>
                    </div>
                    <button type="button" class="btn btn-danger" @click="deleteBatch">Delete Batch</button>
                </div>
            </form>
        </div>

        <div v-else class="text-center">
        <p>Ingredient not found.</p>
        </div>
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
