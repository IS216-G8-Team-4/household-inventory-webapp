<script setup>
    import { useRouter } from 'vue-router'
    // Imports contents from inventory.json. @ (src directory. @/assets/ = src/assests/)
    import inventoryData from '@/assets/inventory.json'

    const router = useRouter()
    function goToCreate() {
        router.push('/Inventory/Create');
    }
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
</style>

<template>
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

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const myDonations = ref([])

onMounted(async () => {
  const res = await axios.get('http://localhost:3000/api/mydonations?user_id=1')
  myDonations.value = res.data
})
</script>

