
<script setup>
import { ref, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mtaoplgrwgihghbdzquk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10YW9wbGdyd2dpaGdoYmR6cXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MTA4NDUsImV4cCI6MjA3NTk4Njg0NX0.qPysjEkDHhy0o6AkyE54tzOELuOZLuLR_G5wKE8ek-w'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const form = ref({
  item_name: '',
  description: '',
  quantity: 1,
  address: '',
  unit_number: '',
  postal_code: ''
})

const donations = ref([])
const location = ref({ lat: null, lng: null })

const handleImageUpload = (e) => {
  form.value.image = e.target.files[0]
}

onMounted(async () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      location.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      await fetchDonations()
    })
  } else {
    await fetchDonations()
  }
})

const fetchDonations = async () => {
  const { data, error } = await supabase.from('donation_submissions').select('*').order('id', { ascending: false })
  if (error) console.error(error)
  donations.value = data || []
}

const submitDonation = async () => {
  try {
    let image_url = null

    if (form.value.image) {
      const file = form.value.image
      const fileName = `${Date.now()}-${file.name}`
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('donation-images')
        .upload(fileName, file)

      if (storageError) throw storageError

      const { data: publicUrl } = supabase
        .storage
        .from('donation-images')
        .getPublicUrl(fileName)
      image_url = publicUrl.publicUrl
    }

    const { error } = await supabase.from('donation_submissions').insert([
    {
      Item_Name: form.value.item_name,
      Item_Desc: form.value.description,
      Item_Quan: form.value.quantity,
      Address: form.value.address,        
      Unit_Number: form.value.unit_number,    
      Postal_Code: form.value.postal_code     
    }
  ])

    if (error) throw error

    alert('✅ Donation submitted successfully!')
    form.value = { item_name: '', description: '', quantity: 1, image: null }
    await fetchDonations()
  } catch (err) {
    console.error('Error submitting donation:', err.message)
    alert('❌ Failed to submit donation.')
  }
}

const requestDonation = async (id) => {
  alert(`Request sent for donation ID ${id}!`)
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

       <div class="mb-3">
        <label class="form-label">Address</label>
        <input v-model="form.address" type="text" class="form-control" required />
      </div>

      <div class="mb-3">
        <label class="form-label">Unit Number</label>
        <input v-model="form.unit_number" type="text" class="form-control" required />
      </div>

      <div class="mb-3">
        <label class="form-label">Postal Code</label>
        <input v-model="form.postal_code" type="text" class="form-control" required />
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
          <p class="text-muted">Address: {{ donation.address }}, {{ donation.unit_number }}, {{ donation.postal_code }}</p>
          <button class="btn btn-outline-primary btn-sm" @click="requestDonation(donation.id)">Request</button>
        </div>
      </div>
    </div>
  </div>
</template>
</script>
