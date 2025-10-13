<script setup>

</script>

<script>
    export default { 
        data() {
            return {
                
            }
        }
    }
</script>

<template>   

    <h1>Donation Page</h1>
   

  <div class="container mt-4">
    <h2 class="mb-3">Community Food Sharing</h2>

    <!-- Donation Form -->
    <form @submit.prevent="submitDonation" class="mb-4 border p-3 rounded shadow-sm bg-light">
      <h5>Share Food</h5>
      <div class="mb-3">
        <label class="form-label">Item Name</label>
        <input v-model="form.item_name" type="text" class="form-control" required />
      </div>

      <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-control" rows="2" required></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label">Quantity</label>
        <input v-model.number="form.quantity" type="number" min="1" class="form-control" required />
      </div>

      <div class="mb-3">
        <label class="form-label">Image</label>
        <input type="file" class="form-control" @change="handleImageUpload" />
      </div>

      <button class="btn btn-success w-100">Submit Donation</button>
    </form>

    <!-- Nearby Donations -->
    <div>
      <h5>Available Donations Nearby</h5>
      <div v-if="donations.length === 0" class="text-muted">No donations yet.</div>

      <div v-for="donation in donations" :key="donation.id" class="card mb-3">
        <img v-if="donation.image_url" :src="donation.image_url" class="card-img-top" alt="donation" />
        <div class="card-body">
          <h5 class="card-title">{{ donation.item_name }}</h5>
          <p class="card-text">{{ donation.description }}</p>
          <p class="text-muted">Qty: {{ donation.quantity }}</p>
          <button class="btn btn-outline-primary btn-sm" @click="requestDonation(donation.id)">Request</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const form = ref({
  item_name: '',
  description: '',
  quantity: 1,
  image: null
})

const donations = ref([])
const location = ref({ lat: null, lng: null })

const handleImageUpload = e => {
  form.value.image = e.target.files[0]
}

onMounted(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      location.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      fetchNearby()
    })
  } else {
    fetchNearby()
  }
})

const fetchNearby = async () => {
  try {
    const { lat, lng } = location.value
    const res = await axios.get(`http://localhost:3000/api/donations/nearby?lat=${lat}&lng=${lng}`)
    donations.value = res.data
  } catch (err) {
    console.error(err)
  }
}

const submitDonation = async () => {
  const fd = new FormData()
  fd.append('item_name', form.value.item_name)
  fd.append('description', form.value.description)
  fd.append('quantity', form.value.quantity)
  fd.append('lat', location.value.lat)
  fd.append('lng', location.value.lng)
  if (form.value.image) fd.append('image', form.value.image)

  await axios.post('http://localhost:3000/api/donations', fd)
  form.value = { item_name: '', description: '', quantity: 1, image: null }
  fetchNearby()
}

const requestDonation = async id => {
  await axios.post(`http://localhost:3000/api/donations/${id}/request`, { user_id: 1 })
  alert('Request sent!')
}
</script>