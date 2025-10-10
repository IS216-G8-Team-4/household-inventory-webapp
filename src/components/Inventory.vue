<script setup>
    // Imports contents from inventory.json. @ (src directory. @/assets/ = src/assests/)
    import inventoryData from '@/assets/inventory.json'
</script>

<script>
    export default { 
        data() {
            return {
                inventory: inventoryData.ingredients
            }
        }
    }
</script>

<template>   
    <div class="inventory">
        <h1>Inventory Page</h1>

        <div v-for="item in inventory" :key="item.id" class="ingredient-card">
            <h2>{{ item.name }}</h2>
            <p><strong>Category:</strong> {{ item.category }}</p>
            <p><strong>Unit:</strong> {{ item.unit }}</p>

            <table>
                <thead>
                <tr>
                    <th>Quantity</th>
                    <th>Expiry Date</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="batch in item.batches" :key="batch.batchId">
                    <td>{{ batch.quantity }}</td>
                    <td>{{ batch.expiryDate }}</td>
                </tr>
                </tbody>
            </table>
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

    th, td {
        border: 1px solid #ccc;
        padding: 8px;
        text-align: left;
    }

    th {
        background: #eee;
    }
</style>
