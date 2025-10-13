<script setup>
    import { ref } from 'vue'
    import { useRoute, useRouter } from 'vue-router'
    import inventoryData from '@/assets/inventory.json'

    const route = useRoute();
    const router = useRouter();

    // Get parameters from URL
    const id = parseInt(route.query.id)
    const batchIndex = parseInt(route.query.batch)

    // Find the ingredient and batch
    const ingredient = inventoryData.ingredients.find(item => item.id === id)
    const batch = ingredient ? ingredient.batches[batchIndex] : null

    // Use refs for reactive form fields
    // ref() - Vue.js function that creates a reactive reference
    const name = ref(ingredient?.name || '')
    const category = ref(ingredient?.category || '')
    const unit = ref(ingredient?.unit || '')
    const quantity = ref(batch?.quantity || 0)
    const expiryDate = ref(batch?.expiryDate || '')

    function saveChanges() {
        if (!ingredient || !batch) return

        // Update the in-memory data (currently not persistent)
        batch.quantity = quantity.value
        batch.expiryDate = expiryDate.value

        alert('Batch updated successfully! \n(Note: Locally only. JSON file not rewritten in frontend)')
        router.push('/Inventory')
    }

    function deleteBatch() {
        if (!ingredient || batchIndex === undefined) return

        // Confirm before deleting
        const confirmDelete = confirm(
            `Are you sure you want to delete this batch of ${ingredient.name} (Expiry: ${batch.expiryDate})?`
        )
        if (!confirmDelete) return

        // Remove the batch from ingredient's batches
        ingredient.batches.splice(batchIndex, 1)

        // If ingredient has no batches left, remove it from inventoryData.ingredients
        if (ingredient.batches.length === 0) {
            const ingredientIndex = inventoryData.ingredients.findIndex(item => item.id === ingredient.id)
            if (ingredientIndex !== -1) {
                inventoryData.ingredients.splice(ingredientIndex, 1)
            }
        }

        alert('Batch deleted successfully! \n(Note: Locally only. JSON file not rewritten in frontend)')
        router.push('/Inventory')
    }
</script>

<template>   
    <div class="edit-page">
        <h1>Edit Ingredient Batch</h1>

        <div v-if="ingredient">
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
