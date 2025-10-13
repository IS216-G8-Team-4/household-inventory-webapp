<script setup>
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import inventoryData from '@/assets/inventory.json'

    const router = useRouter();

    // ref() - Vue.js function that creates a reactive reference
    const name = ref('');
    const category = ref('');
    const unit = ref('');
    const quantity = ref(0);
    const expiryDate = ref('');

    function saveIngredient() {
        const existing = inventoryData.ingredients.find(
            item => item.name.toLowerCase() === name.value.toLowerCase()
        )

        if (!existing) {
            // Create a new ingredient
            const newId = inventoryData.ingredients.length + 1;
            inventoryData.ingredients.push({
                id: newId,
                name: name.value,
                category: category.value,
                unit: unit.value,
                batches: [{ quantity: Number(quantity.value), expiryDate: expiryDate.value }]
            })
        } else {
            // Update existing ingredient
            const sameBatch = existing.batches.find(batch => batch.expiryDate === expiryDate.value)
            if (sameBatch) {
                // Increase qty of the same batch
                sameBatch.quantity += Number(quantity.value);
            } else {
                // Add a new batch to the ingredient
                existing.batches.push({ quantity: Number(quantity.value), expiryDate: expiryDate.value });
            }
        }

        // (Simulated update)
        alert('Ingredient added or updated! \n(Note: Locally only. JSON file not rewritten in frontend)')
        router.push('/Inventory')
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
            <input v-model="unit" placeholder="kg" required />

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
