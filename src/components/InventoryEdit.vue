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

</style>
