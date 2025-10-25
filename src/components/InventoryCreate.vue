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
    <div class="create-form">
        <h1>Create New Ingredient</h1>
        <form @submit.prevent="saveIngredient">
            <label>Name:</label>
            <input v-model="name" placeholder="Rice" required />

            <label>Category:</label>
            <select v-model="category" required>
                <option disabled value="">Select category</option>
                <option>Grains & Pasta</option>
                <option>Dairy & Eggs</option>
                <option>Meat & Seafood</option>
                <option>Vegetables</option>
                <option>Fruits</option>
                <option>Condiments & Seasonings</option>
                <option>Canned & Frozen Food</option>
                <option>Beverages</option>
                <option>Snacks & Confectionery</option>
                <option>Baking & Cooking Essentials</option>
                <option>Others / Miscellaneous</option>
            </select>

            <label>Unit:</label>
            <select v-model="unit" required>
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

            <label>Quantity:</label>
            <input type="number" v-model="quantity" placeholder="1" required />

            <label>Expiry Date:</label>
            <input type="date" v-model="expiryDate" required />

            <button type="submit">Save</button>
        </form>
    </div>
</template>

<style scope>
    .create-form {
        max-width: 500px;
        margin: 0 auto;
        padding: 20px;
    }
    
    form {
        display: flex;
        flex-direction: column;
    }

    input, select {
        margin-bottom: 10px;
        padding: 6px;
    }

    button {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 6px;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }
</style>
