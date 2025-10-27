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

            alert('Ingredient saved successfully!')
            router.push('/Inventory')
        } catch (error) {
            console.error('Error saving ingredient:', error)
            alert('Failed to save ingredient. See console for details.')
        }
    }
</script>

<template>   
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

</style>
