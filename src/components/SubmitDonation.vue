<script setup>
import { ref, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

/* ===== Supabase config ===== */
const SUPABASE_URL = 'https://mtaoplgrwgihghbdzquk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10YW9wbGdyd2dpaGdoYmR6cXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MTA4NDUsImV4cCI6MjA3NTk4Njg0NX0.qPysjEkDHhy0o6AkyE54tzOELuOZLuLR_G5wKE8ek-w'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ===== Google Maps key ===== */
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''


const form = ref({
  item_name: '',
  description: '',
  quantity: 1,
  address: '',
  unit_number: '',
  postal_code: '',
})
const donations = ref([])


const isLoadingPins = ref(false)
const isSubmitting = ref(false)
const alertMsg = ref('')
const alertType = ref('success') 

/* ===== Google Maps + Geocoding ===== */
const mapEl = ref(null)
let map = null
let geocoder = null
let info = null
let markers = []

function loadGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve()
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`
    s.async = true
    s.onerror = () => reject(new Error('Failed to load Google Maps API'))
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

function initMap(center = { lat: 1.3521, lng: 103.8198 }) {
  map = new google.maps.Map(mapEl.value, { center, zoom: 12, mapTypeControl: false })
  geocoder = new google.maps.Geocoder()
  info = new google.maps.InfoWindow()
}

function clearMarkers() {
  markers.forEach(m => m.setMap(null))
  markers = []
}

function geocodeByAddress(d) {
  return new Promise((resolve) => {
    const full = [d.Address, d.Unit_Number, d.Postal_Code, 'Singapore'].filter(Boolean).join(', ')
    geocoder.geocode({ address: full, componentRestrictions: { country: 'SG' } }, (res, status) => {
      if (status === 'OK' && res?.[0]) {
        const loc = res[0].geometry.location
        resolve({ lat: loc.lat(), lng: loc.lng() })
      } else {
        resolve(null)
      }
    })
  })
}

function pinDonation(d, latLng) {
  const marker = new google.maps.Marker({ position: latLng, map })
  marker.addListener('click', () => {
    const html = `
      <div class="small">
        <div class="fw-semibold">${d.Item_Name || 'Donation'}</div>
        ${d.Item_Desc ? `<div>${d.Item_Desc}</div>` : ''}
        ${d.Item_Quan ? `<div>Qty: ${d.Item_Quan}</div>` : ''}
        ${(d.Address || d.Unit_Number || d.Postal_Code)
          ? `<div class="text-muted">${[d.Address, d.Unit_Number, d.Postal_Code].filter(Boolean).join(', ')}</div>` : ''}
      </div>`
    info.setContent(html)
    info.open({ anchor: marker, map })
  })
  markers.push(marker)
}

/* ===== Supabase fetch & pin ===== */
const fetchDonations = async () => {
  const { data, error } = await supabase
    .from('donation_submissions')
    .select('id, Item_Name, Item_Desc, Item_Quan, Address, Unit_Number, Postal_Code')
    .order('id', { ascending: false })
  if (error) console.error(error)
  donations.value = data || []
}

async function renderPins() {
  if (!map) initMap()
  clearMarkers()
  isLoadingPins.value = true
  for (const d of donations.value) {
    const loc = await geocodeByAddress(d)
    if (loc) pinDonation(d, loc)
  }
  isLoadingPins.value = false
}

/* ===== Submit donation===== */
const submitDonation = async () => {
  try {
    isSubmitting.value = true

    const { error } = await supabase.from('donation_submissions').insert([{
      Item_Name: form.value.item_name,
      Item_Desc: form.value.description,
      Item_Quan: form.value.quantity,
      Address: form.value.address,
      Unit_Number: form.value.unit_number,
      Postal_Code: form.value.postal_code,
    }])
    if (error) throw error

    alertType.value = 'success'
    alertMsg.value = 'Donation submitted successfully!'
    form.value = { item_name: '', description: '', quantity: 1, address: '', unit_number: '', postal_code: ''}

    await fetchDonations()
    await renderPins()
  } catch (err) {
    console.error('Error submitting donation:', err?.message || err)
    alertType.value = 'danger'
    alertMsg.value = 'Failed to submit donation. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

/* ===== Lifecycle ===== */
onMounted(async () => {
  try {
    await loadGoogle()
    initMap()                            
    await fetchDonations()               
    await renderPins()                   

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      )
    }
  } catch (e) {
    console.error(e)
    alertType.value = 'danger'
    alertMsg.value = 'Map failed to load. Check VITE_GOOGLE_MAPS_API_KEY in .env'
  }
})

const requestDonation = async (id) => {
  alert(`Request sent for donation ID ${id}!`)
}
</script>

<template>
  <div class="container py-4">
    <h1 class="h3 mb-3">Community Food Sharing</h1>

    <div v-if="alertMsg" :class="['alert', `alert-${alertType}`, 'd-flex', 'align-items-center']" role="alert">
      <i class="bi" :class="alertType === 'success' ? 'bi-check-circle me-2' : 'bi-exclamation-triangle me-2'"></i>
      <div>{{ alertMsg }}</div>
    </div>

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <div class="card shadow-sm">
          <div class="card-header bg-success text-white">
            <strong>Share Food</strong>
          </div>
          <div class="card-body">
            <form @submit.prevent="submitDonation" class="needs-validation" novalidate>
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
                <label class="form-label">Address</label>
                <input v-model="form.address" type="text" class="form-control" placeholder="Street / block / estate" required />
              </div>

              <div class="mb-3">
                <label class="form-label">Unit Number</label>
                <input v-model="form.unit_number" type="text" class="form-control" placeholder="#12-345" />
              </div>

              <div class="mb-3">
                <label class="form-label">Postal Code</label>
                <input v-model="form.postal_code" type="text" class="form-control" placeholder="e.g., 123456" required />
              </div>

              <button class="btn btn-success w-100" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Submit Donation
              </button>
              <div class="form-text mt-2">
                Pins are placed by geocoding your Address + Postal Code (Singapore).
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Right: Map + List -->
      <div class="col-12 col-lg-7">
        <div class="card shadow-sm mb-3">
          <div class="card-header bg-light">
            <strong>Available Donations Nearby</strong>
          </div>
          <div class="card-body p-0">
            <div class="position-relative" style="height: 420px;">
              <div ref="mapEl" class="w-100 h-100 rounded-bottom" style="min-height: 420px;"></div>
              <div v-if="isLoadingPins" class="position-absolute top-50 start-50 translate-middle text-center">
                <div class="spinner-border" role="status"></div>
                <div class="small mt-2 text-muted">Loading pins…</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="donations.length === 0" class="text-muted">No donations yet.</div>

        <div v-for="donation in donations" :key="donation.id" class="card mb-3 shadow-sm">
          <div class="row g-0">
            <div class="col-12">
              <div class="card-body">
                <h5 class="card-title mb-1">{{ donation.Item_Name }}</h5>
                <p class="card-text mb-2">{{ donation.Item_Desc }}</p>
                <p class="card-text">
                  <small class="text-muted">
                    Qty: {{ donation.Item_Quan }}
                    <span v-if="donation.Address"> • {{ donation.Address }}</span>
                    <span v-if="donation.Unit_Number">, {{ donation.Unit_Number }}</span>
                    <span v-if="donation.Postal_Code">, {{ donation.Postal_Code }}</span>
                  </small>
                </p>
                <button class="btn btn-outline-primary btn-sm" @click="requestDonation(donation.id)">Request</button>
              </div>
            </div>
          </div>
        </div>

      </div> <!-- /col -->
    </div> <!-- /row -->
  </div>
</template>
