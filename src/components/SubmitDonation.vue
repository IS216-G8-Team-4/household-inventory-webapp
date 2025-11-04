<script setup>
  import { ref, onMounted , watch} from 'vue'
  import { createClient } from '@supabase/supabase-js'
  import { useRoute, useRouter } from 'vue-router'
  


  // connection to supabase
  const SUPABASE_URL = 'https://mtaoplgrwgihghbdzquk.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10YW9wbGdyd2dpaGdoYmR6cXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MTA4NDUsImV4cCI6MjA3NTk4Njg0NX0.qPysjEkDHhy0o6AkyE54tzOELuOZLuLR_G5wKE8ek-w'
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const route = useRoute()
  const router = useRouter()
  const householdId = ref(null)
  const session = ref(null)
  const inventory = ref([])
  const selectedItem = ref(null)
  const toasts = ref([])
  let nextId = 1


  // hold input data from donation form 
  const form = ref({
    item_name: '',
    description: '',
    quantity: 1,
    address: '',
    unit_number: '',
    postal_code: '',
    expiry_date: '',
    category: '',
    unit: ''
  })


  // variables 
  const donations = ref([])
  const isLoadingPins = ref(false)
  const isSubmitting = ref(false)
  const alertMsg = ref('')
  const alertType = ref('success') 


  // google maps key
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  const mapEl = ref(null)
  let map = null
  let geocoder = null
  let info = null
  let markers = []

  // loads google map
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

    // create map instance
  function initMap(center = { lat: 1.3521, lng: 103.8198 }) {
    map = new google.maps.Map(mapEl.value, { center, zoom: 12, mapTypeControl: false })
    geocoder = new google.maps.Geocoder() // convert address into latitude and longitude
    info = new google.maps.InfoWindow() //shows popups when clicking pins 
  }

  function clearMarkers() {
    markers.forEach(m => m.setMap(null))
    markers = []
  }

    // takes donation address and makes it map coordinates 
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

  // donation marker 
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

  async function fetchSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Error fetching session:', error)
      return
    }
    session.value = data.session
  }

  async function fetchHouseholdId() {
    if (!session.value) return

    const userId = session.value.user.id
    const { data: households, error } = await supabase
      .from('households')
      .select('id')
      .eq('created_by', userId)
      .limit(1)

    if (error) {
      console.error('Error fetching household:', error)
      return
    }

    if (households.length > 0) {
      householdId.value = households[0].id
    } else {
      console.warn('No household found for user.')
    }
  }

  // fetch donation from supabase
  const fetchDonations = async () => {
    const { data, error } = await supabase
      .from('donation_submissions')
      .select('id, Item_Name, Item_Desc, Item_Quan, Address, Unit_Number, Postal_Code, household_id, Expiry_Date, Category, Unit')
      .eq('Claimed', false)
      .order('id', { ascending: false })
    if (error) console.error(error)
    donations.value = data || []
  }

  async function fetchInventoryForDonation() {
    if (!householdId.value) return

    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId.value)

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError)
      return
    }

    const enrichedIngredients = await Promise.all(
      ingredientsData.map(async (ingredient) => {
        const { data: batchesData, error: batchesError } = await supabase
          .from('ingredient_batches')
          .select('*')
          .eq('ingredient_id', ingredient.id)

        if (batchesError) return { ...ingredient, batches: [] }

        return {
          ...ingredient,
          batches: batchesData.filter(batch => batch.quantity > 0)
        }
      })
    )

    inventory.value = enrichedIngredients.filter(i => i.batches.length > 0)
  }

  // Watch the item selection
  watch(() => form.value.item_name, (newName) => {
    const item = inventory.value.find(i => i.name === newName)
    if (item) {
      selectedItem.value = item
      form.value.category = item.category
      form.value.unit = item.unit
      form.value.expiry_date = ''
      form.value.quantity = 1
    } else {
      selectedItem.value = null
      form.value.category = ''
      form.value.unit = ''
      form.value.expiry_date = ''
      form.value.quantity = 1
    }
  })

  watch(() => form.value.expiry_date, (newExpiry) => {
    if (selectedItem.value && newExpiry) {
      const batch = selectedItem.value.batches.find(b => b.expiry_date === newExpiry)
      if (batch) {
        form.value.quantity = batch.quantity
      } else {
        form.value.quantity = 1
      }
    }
  })


  async function renderPins() {
    if (!map) initMap()
    clearMarkers() //clear old pins
    isLoadingPins.value = true
    for (const d of donations.value) {
      const loc = await geocodeByAddress(d) // geocode donation address
      if (loc) pinDonation(d, loc) //adds new marker for each donation 
    }
    isLoadingPins.value = false
  }
  // creating alert box with design
  function notify(msg, opts = {}) {
  const type = String(opts.type ?? 'info').trim().toLowerCase()
  const id = nextId++
  toasts.value.push({
    id,
    msg,
    title: opts.title ?? (type === 'success' ? 'Success' : 'Notice'),
    type,
    isSuccess: type === 'success'
  })
}

// close the toast notification
function dismiss(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

  const submitDonation = async () => {
    try {
      isSubmitting.value = true

      // --- Validation ---
      if (!form.value.address?.trim()) {
      notify('Please enter your address before submitting your donation.', { type:'danger', title:'Address required' })

        isSubmitting.value = false
        return
      }

      if (!form.value.expiry_date?.trim()) {
        notify('Please enter an expiry date before submitting your donation.', { type:'danger', title:'Expiry date required' })
        isSubmitting.value = false
        return
      }

      if (!form.value.category) {
        notify('Please select a category.', { type:'danger', title:'Category required' })

        isSubmitting.value = false
        return
      }

      if (!form.value.unit) {
        notify('Please select a unit for the food.', { type:'danger', title:'Unit required' })
        isSubmitting.value = false
        return
      }

      // Check if quantity exceeds available amount ---
      if (selectedItem.value && form.value.expiry_date) {
        const batch = selectedItem.value.batches.find(
          (b) => b.expiry_date === form.value.expiry_date
        )
        if (batch && form.value.quantity > batch.quantity) {
          notify(
          `You only have ${batch.quantity} ${form.value.unit} of ${form.value.item_name} available in your inventory. Please enter a smaller amount.`,
          { type:'warning', title:'Quantity exceeds available' }
        )
          isSubmitting.value = false
          return
        }
      }

      // --- Insert donation into Supabase ---
      const { error: insertError } = await supabase.from('donation_submissions').insert([{
        household_id: householdId.value,
        Item_Name: form.value.item_name,
        Item_Desc: form.value.description,
        Item_Quan: form.value.quantity,
        Address: form.value.address,
        Unit_Number: form.value.unit_number,
        Postal_Code: form.value.postal_code,
        Expiry_Date: form.value.expiry_date,
        Category: form.value.category,
        Unit: form.value.unit,
        Claimed: false
      }])
      if (insertError) throw insertError

      // --- Update batch quantity if donation comes from inventory ---
      if (selectedItem.value && form.value.expiry_date) {
        const batch = selectedItem.value.batches.find(b => b.expiry_date === form.value.expiry_date)
        if (batch) {
          const donatedQty = Number(form.value.quantity)
          const remaining = batch.quantity - donatedQty

          if (remaining <= 0) {
            // Delete batch if fully donated
            await supabase.from('ingredient_batches').delete().eq('id', batch.id)
          } else {
            // Otherwise update batch quantity
            await supabase.from('ingredient_batches').update({ quantity: remaining }).eq('id', batch.id)
          }
        }
      }

      // --- Reset form ---
      form.value = {
        item_name: '',
        description: '',
        quantity: 1,
        category: '',
        unit: '',
        address: '',
        unit_number: '',
        postal_code: '',
        expiry_date: ''
      }
      selectedItem.value = null

      // --- Refresh inventory and donations ---
      await fetchInventoryForDonation()
      await fetchDonations()
      await renderPins()



    } catch (err) {
      console.error('Error submitting donation:', err?.message || err)
    } finally {
      isSubmitting.value = false
    }
  }



  // when page first loads
  onMounted(async () => {
    try {
      await fetchSession()
      await fetchHouseholdId()
      await fetchInventoryForDonation()
      await loadGoogle()
      initMap()                            
      await fetchDonations()               
      await renderPins()
      
      const name = route.query.name
      const quan = route.query.quantity
      const expiry = route.query.expiry
      const category = route.query.category  
      const unit = route.query.unit         

      if (name) form.value.item_name = name
      if (quan) form.value.quantity = Number(quan)
      if (expiry) form.value.expiry_date = expiry
      if (category) form.value.category = category
      if (unit) form.value.unit = unit

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


  const requestDonation = async (donationId) => {
    try {
      // Find the donation details
      const donationIndex = donations.value.findIndex(d => d.id === donationId)
      const donation = donations.value.find(d => d.id === donationId)

      //  Add ingredient (if not already exists)
      const { data: existingIngredient } = await supabase
        .from('ingredients')
        .select('*')
        .eq('household_id', householdId.value)
        .eq('name', donation.Item_Name)
        .eq('unit', donation.Unit)
        .limit(1)
        .maybeSingle()

      let ingredientId

      if (existingIngredient) {
        ingredientId = existingIngredient.id
      } else {
        const { data: newIngredient, error: ingredientError } = await supabase
          .from('ingredients')
          .insert([{
            household_id: householdId.value,
            name: donation.Item_Name,
            category: donation.Category,
            unit: donation.Unit
          }])
          .select()
          .maybeSingle()


        if (ingredientError) throw ingredientError
        ingredientId = newIngredient.id
      }

      //Check if batch with same expiry exists
      const { data: existingBatch, error: batchError } = await supabase
        .from('ingredient_batches')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .eq('expiry_date', donation.Expiry_Date)
        .limit(1)
        .maybeSingle()


      if (batchError && !existingBatch) {
        throw batchError
      }

      if (existingBatch) {
        // Update quantity
        const { error: updateError } = await supabase
          .from('ingredient_batches')
          .update({ quantity: existingBatch.quantity + donation.Item_Quan })
          .eq('id', existingBatch.id)
        if (updateError) throw updateError
      } else {
        // Insert new batch
        const { error: insertError } = await supabase
          .from('ingredient_batches')
          .insert([{
            ingredient_id: ingredientId,
            quantity: donation.Item_Quan,
            expiry_date: donation.Expiry_Date
          }])
        if (insertError) {throw insertError}
      }
      // Mark donation as claimed
      const { error: claimError } = await supabase
        .from('donation_submissions')
        .update({ Claimed: true })
        .eq('id', donationId)

      if (claimError) throw claimError

      donations.value.splice(donationIndex, 1)

      notify(`Donation '${donation.Item_Name}' added to your inventory!`, { type:'success', title:'Success' })



    } catch (err) {
      console.error(err)
    }
  }
</script>

<template>
<!-- toast -->
<div class="position-fixed top-50 start-50 translate-middle p-3" style="z-index:1080; width:min(92vw,460px)">
  <transition-group name="toast">
    <div v-for="t in toasts" :key="t.id"
      class="d-flex align-items-start shadow-lg rounded-4 mb-2 p-3 bg-white">
      
      <!-- Icon circle with conditional styling -->
   <div class="rounded-circle d-flex align-items-center justify-content-center"
     :class="((t.type || '').toLowerCase() === 'success') ? 'bg-success' : 'bg-danger'"
     style="width:36px;height:36px;flex-shrink:0;">
  <span v-if="((t.type || '').toLowerCase() === 'success')"
        class="text-white fw-bold toast-glyph">✓</span>
  <span v-else
        class="text-white fw-bold toast-glyph">×</span>

      </div>
      <div class="flex-grow-1 pe-2">
        <strong class="d-block mb-1">{{ t.title }}</strong>
        <div>{{ t.msg }}</div>
      </div>
      <button class="btn btn-sm btn-link text-secondary text-decoration-none"
              @click="dismiss(t.id)" aria-label="Close">✕</button>
    </div>
  </transition-group>
</div>

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
                <select v-model="form.item_name" class="form-select" required>
                  <option disabled value="">Select item</option>
                  <option v-for="item in inventory" :key="item.id" :value="item.name">
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea v-model="form.description" class="form-control" rows="2" required></textarea>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Category</label>
                <select v-model="form.category" class="form-select" required>
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
                <label class="form-label">Unit</label>
                <select v-model="form.unit" class="form-select" required>
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

              <div class="mb-3" v-if="selectedItem && selectedItem.batches.length > 0">
                <label class="form-label">Select Batch (Expiry Date)</label>
                <select v-model="form.expiry_date" class="form-select" required>
                  <option disabled value="">Select batch</option>
                  <option v-for="batch in selectedItem.batches" :key="batch.id" :value="batch.expiry_date">
                    {{ batch.expiry_date }} 
                  </option>
                </select>
              </div>

              <div v-else class="mb-3">
                <label class="form-label">Expiry Date</label>
                <input v-model="form.expiry_date" type="date" class="form-control" required />
              </div>

              <div class="mb-3">
                <label class="form-label">Quantity</label>
                <input 
                  v-model.number="form.quantity" 
                  type="number" 
                  :min="1" 
                  :max="selectedItem && form.expiry_date ? (selectedItem.batches.find(b => b.expiry_date === form.expiry_date)?.quantity || 1) : 1000" 
                  class="form-control" 
                  required 
                />
                <div class="form-text" v-if="selectedItem && form.expiry_date">
                  Max available: {{ selectedItem.batches.find(b => b.expiry_date === form.expiry_date)?.quantity || 1 }}
                </div>
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
                <div class="card-text text-muted small">
                  <div>Category: {{ donation.Category }}</div>
                  <div>Unit: {{ donation.Unit }}</div>
                  <div>Quantity: {{ donation.Item_Quan }}</div>
                  <div>Expiry: {{ donation.Expiry_Date }}</div>
                  <div v-if="donation.Address || donation.Unit_Number || donation.Postal_Code">
                    Address: 
                    <span v-if="donation.Address">{{ donation.Address }}</span>
                    <span v-if="donation.Unit_Number">, {{ donation.Unit_Number }}</span>
                    <span v-if="donation.Postal_Code">, {{ donation.Postal_Code }}</span>
                  </div>
                </div>
                <button class="btn btn-outline-primary btn-sm" @click="requestDonation(donation.id)">Request</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div> 
  </div>
</template>


    
