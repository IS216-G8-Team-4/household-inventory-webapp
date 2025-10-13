<!-- src/components/Donation.vue -->
<script setup>
import { onMounted, ref, reactive } from 'vue'

/* Read your Google Maps key from Vite env. */
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const mapEl = ref(null)
let map, youMarker

// Load the Google Maps JS ONCE
let gmapsPromise
function loadGoogleMapsOnce(key) {
  if (window.google?.maps) return Promise.resolve()
  if (gmapsPromise) return gmapsPromise
  gmapsPromise = new Promise((resolve, reject) => {
    if (!key) return reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
    const id = 'gmaps-js'
    if (document.getElementById(id)) return resolve()
    const s = document.createElement('script')
    s.id = id
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&region=SG`
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(s)
  })
  return gmapsPromise
}
//draws the map with user's coordinate if manage to get
function init(center) {
  map = new google.maps.Map(mapEl.value, {
    center, zoom: 15, streetViewControl: false
  })
  youMarker = new google.maps.Marker({ map, position: center, title: 'You are here' })
}

//get users location coordinate and pass to init()
function locate() {
  const sg = { lat: 1.3521, lng: 103.8198 } // fallback: SG
  if (!navigator.geolocation) return init(sg)
  navigator.geolocation.getCurrentPosition(
    p => init({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => init(sg),
    { enableHighAccuracy: true, timeout: 8000 }
  )
}

onMounted(async () => {
  await loadGoogleMapsOnce(API_KEY)
  locate()
})
</script>

<template>
  <div class="page">
    <aside class="sidebar">
      <h1>Donation</h1>


      <!-- later on to search for food nearby -->
      <div class="row">
        <button @click="geolocate(false)">Use my location</button>
        <!-- <span :class="['hint', { danger: statusIsError }]">{{ status }}</span> -->
      </div>

      <div class="hint">Or type an address:</div>
      <div class="row">
        <input v-model="addr" placeholder="e.g. 1 Fusionopolis Pl, Singapore" />
        <button @click="geocodeAddress">Set</button>
      </div>

      <div>
      <!-- loop through all the nearby food places and display them -->

        <div v-for="(p, i) in placesList" :key="p.place_id || i" class="card">
          <div><strong>{{ i + 1 }}. {{ p.name || '(Place)' }}</strong></div>
          <div class="hint">{{ p.vicinity || p.formatted_address || '' }}</div>
          <div class="row rowsm">
            <span class="pill" v-if="p.distance">≈ {{ (p.distance / 1000).toFixed(2) }} km</span>
            <span v-if="p.rating" class="pill">Rating {{ p.rating }} ({{ p.user_ratings_total || 0 }})</span>
            <button @click="focusMarker(i)">Show on map</button>
          </div>
        </div>
      </div>


    </aside>

    <main ref="mapEl" class="map"></main>
  </div>
</template>

<style scoped>
:root { --muted:#6b7280; --border:#e5e7eb; --danger:#b91c1c; }
html,body,:host { height: 100%; }
.page{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 0px)}
.sidebar{padding:14px;border-right:1px solid var(--border);overflow:auto}
.sidebar h1{margin:0 0 10px;font-size:1.25rem}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}
.rowsm{margin-top:6px}
.hint{color:var(--muted);font-size:.85rem}
.hint.small{font-size:.75rem;margin-top:6px}
.danger{color:var(--danger)}
.map{height:100%;min-height:400px}
.card{border:1px solid var(--border);border-radius:10px;padding:10px;margin:8px 0}
.pill{display:inline-block;border:1px solid var(--border);border-radius:999px;padding:2px 8px;font-size:.8rem}
input,button{padding:8px 10px;border:1px solid var(--border);border-radius:8px}
button{cursor:pointer}
@media (max-width:900px){.page{grid-template-columns:1fr}.map{height:60vh}}
</style>


<template>
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
