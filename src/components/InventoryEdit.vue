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

            alert('Batch updated successfully!')
            router.push('/Inventory')
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
    <div class="edit-page">
        <h1>Edit Ingredient Batch</h1>

        <div v-if="ingredientExists">
            <p><strong>Ingredient:</strong> {{ name }}</p>
            <p><strong>Category:</strong> {{ category }}</p>
            <p><strong>Unit:</strong> {{ unit }}</p>

            <form @submit.prevent="saveChanges">
                <div class="form-group">
                    <label>Quantity:</label>
                    <input type="number" v-model="quantity" required />
                </div>

                <div class="form-group">
                    <label>Expiry Date:</label>
                    <input type="date" v-model="expiryDate" required />
                </div>

                <div class="button-group">
                    <div class="left-buttons">
                        <button type="submit" class="save-btn">Save Changes</button>
                        <button type="button" class="cancel-btn" @click="router.push('/Inventory')">Cancel</button>
                    </div>
                    <div class="right-buttons">
                        <button type="button" class="delete-btn" @click="deleteBatch">Delete Batch</button>
                    </div>
                </div>
            </form>
        </div>

        <div v-else>
            <p>Ingredient not found.</p>
        </div>
    </div>
</template>

<style scope>
    .edit-page {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
    }

    .form-group {
        margin-bottom: 15px;
    }

    label {
        display: block;
        font-weight: bold;
        margin-bottom: 5px;
    }

    input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 6px;
    }

    .button-group {
        display: flex;                  /* Put buttons in a row */
        justify-content: space-between; /* Push left & right buttons apart */
        align-items: center;
        margin-top: 20px;               /* Space above buttons */
    }

    .left-buttons,
    .right-buttons {
    display: flex;
    gap: 10px;                          /* Spacing between buttons in each side */
    }

    /* Save button */
    .save-btn {
        background-color: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        margin-right: 10px;
    }

    .save-btn:hover {
        background-color: #218838;
    }

    /* Cancel button */
    .cancel-btn {
        background-color: #6c757d;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
    }

    .cancel-btn:hover {
        background-color: #5a6268;
    }

    /* Delete button */
    .delete-btn {
        background-color: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
    }

    .delete-btn:hover {
        background-color: #c82333;
    }
</style>
