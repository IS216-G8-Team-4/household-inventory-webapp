<!-- src/components/Donation.vue -->
<script setup>
import { ref, reactive, onMounted, watch } from 'vue'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

/* State */
const mapEl = ref(null)
const status = ref('')
const isError = ref(false)
const addr = ref('')
const radiusKm = ref(8)
const placesList = reactive([])

/* Google objects */
let map, places, geocoder, info, origin = null
let originMarker = null
let markers = []
let dirService = null
let dirRenderer = null

/* Status helper */
function setStatus(msg = '', error = false) {
  status.value = msg
  isError.value = !!error
  if (msg) console.log('[status]', msg)
}

/* Load Maps */
function loadGoogle() {
  return new Promise((resolve, reject) => {
    if (!API_KEY) return reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
    if (window.google?.maps) return resolve()
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places,geometry`
    s.async = true; s.defer = true
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

/* Init map */
function initMap() {
  const sg = { lat: 1.3521, lng: 103.8198 }
  map = new google.maps.Map(mapEl.value, { center: sg, zoom: 12 })
  places = new google.maps.places.PlacesService(map)
  geocoder = new google.maps.Geocoder()
  info = new google.maps.InfoWindow()

  // Directions
  dirService = new google.maps.DirectionsService()
  dirRenderer = new google.maps.DirectionsRenderer({ map })

  map.addListener('click', (e) => setOrigin(e.latLng, 'Dropped pin'))
  geolocate()
}

/* My location */
function geolocate() {
  if (!navigator.geolocation) {
    setStatus('Geolocation not supported. Type an address.', true)
    return
  }
  setStatus('Getting your location…')
  navigator.geolocation.getCurrentPosition(
    (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'My location'),
    () => setStatus('Location denied. Type an address or click the map.', true),
    { enableHighAccuracy: true, timeout: 8000 }
  )
}

/* Geocode address */
function geocodeAddress() {
  const q = (addr.value || '').trim()
  if (!q) return setStatus('Type an address first.', true)
  setStatus('Finding address…')
  geocoder.geocode({ address: q }, (res, code) => {
    if (code === 'OK' && res?.length) {
      const r = res[0]
      setOrigin(r.geometry.location, r.formatted_address || q)
    } else {
      setStatus('Could not find that address.', true)
    }
  })
}

/* Set origin then search */
function setOrigin(latLngOrObj, label = 'Origin') {
  const loc = latLngOrObj instanceof google.maps.LatLng
    ? latLngOrObj
    : new google.maps.LatLng(latLngOrObj)
  origin = loc
  map.setCenter(loc)
  map.setZoom(14)
  if (originMarker) originMarker.setMap(null)
  originMarker = new google.maps.Marker({
    map, position: loc, title: label,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8 }
  })
  searchNearby()
}

/* Simple filters */
const INCLUDE_WORDS = [
  'food bank','food donation','donate food','food drop-off','food drive',
  'community fridge','people\'s fridge','food pantry','pantry@',
  'soup kitchen','free meals','food rations','food distribution',
  'food rescue','willing hearts','food from the heart','the food bank singapore'
]
const EXCLUDE_WORDS = [
  'hawker','food centre','food center','kopitiam','foodcourt','coffeeshop','market',
  'restaurant','cafe','bakery','bar','bistro','stall','canteen','bubble tea',
  'supermarket','fairprice','ntuc','cold storage','sheng siong','giant','7-eleven','7 eleven','mall','plaza',
  'blood','plasma','donor','red cross','hospital','pharmacy','clinic','dentist'
]

function looksDonation(place) {
  const name = (place.name || '').toLowerCase()
  const a = (place.vicinity || place.formatted_address || '').toLowerCase()
  const hasInclude = INCLUDE_WORDS.some(w => name.includes(w))
  const hasExclude = EXCLUDE_WORDS.some(w => name.includes(w) || a.includes(w))
  return hasInclude && !hasExclude
}

/* Search */
async function searchNearby() {
  if (!origin) return setStatus('Set your location first.', true)
  clearMarkers()
  placesList.splice(0)

  const radiusMeters = Math.max(1, radiusKm.value) * 1000
  setStatus(`Searching within ${radiusKm.value} km…`)

  const KEYWORDS = [
    'food bank','food donation','donate food',
    'community fridge','food pantry','soup kitchen','free meals',
    'Willing Hearts','Food from the Heart','The Food Bank Singapore','Pantry@'
  ]

  const all = []
  for (const kw of KEYWORDS) {
    const batch = await nearbySearch({ location: origin, radius: radiusMeters, keyword: kw })
    all.push(...batch)
  }
  if (!all.length) return setStatus('No nearby results. Try a different distance or address.', true)

  const unique = dedupe(all).map(p => ({
    ...p,
    distance: google.maps.geometry.spherical.computeDistanceBetween(origin, p.geometry.location)
  }))

  const filtered = unique
    .filter(p => p.distance <= radiusMeters)
    .filter(looksDonation)
    .sort((a,b) => a.distance - b.distance)

  if (!filtered.length) {
    return setStatus('Found places, but filtered out non-donation results (hawkers, blood banks, etc.).', true)
  }

  filtered.forEach((p, i) => addMarker(p, i + 1))
  placesList.push(...filtered)
  fitBounds(filtered)
  setStatus(`Found ${filtered.length} donation spots.`)
}

/* Places helper */
function nearbySearch(req) {
  return new Promise(resolve => {
    places.nearbySearch(req, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) resolve(results)
      else resolve([])
    })
  })
}
// removign duplicate places
function dedupe(arr) {
  const seen = {}
  const out = []
  for (const p of arr) {
    const id = p.place_id || (p.name + (p.vicinity || ''))
    if (!seen[id]) { seen[id] = 1; out.push(p) }
  }
  return out
}

/* Markers + info */
function addMarker(place, idx) {
  const m = new google.maps.Marker({ map, position: place.geometry.location, label: String(idx) })
  m.addListener('click', () => openInfo(place, m))
  markers.push(m)
}
function openInfo(place, marker) {
  const nameText = place.name || '(Place)'
  const addrText = place.vicinity || place.formatted_address || ''
  const ll = place.geometry.location
  const ratingText = place.rating
    ? ` • ⭐ ${place.rating} (${place.user_ratings_total || 0})`
    : ''
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${ll.lat()},${ll.lng()}`

  // build DOM nodes
  const container = document.createElement('div')
  container.className = 'small'

  const strong = document.createElement('strong')
  strong.textContent = nameText
  container.appendChild(strong)

  const addr = document.createElement('div')
  addr.textContent = addrText + ratingText
  container.appendChild(addr)

  const linkWrap = document.createElement('div')
  linkWrap.className = 'mt-2'

  const link = document.createElement('a')
  link.href = dir
  link.target = '_blank'
  link.textContent = 'Open in Google Maps'
  linkWrap.appendChild(link)

  container.appendChild(linkWrap)

  info.setContent(container)
  info.open(map, marker)
}

function fitBounds(list) {
  const b = new google.maps.LatLngBounds(origin)
  list.forEach(p => b.extend(p.geometry.location))
  map.fitBounds(b, 64)
}
function clearMarkers() {
  markers.forEach(m => m.setMap(null))
  markers = []
  dirRenderer?.set('directions', null)
}

/* Auto re-search when distance changes */
watch(radiusKm, () => { if (origin) searchNearby() })

/* Mount */
onMounted(async () => {
  try { await loadGoogle(); initMap() }
  catch (e) { console.error(e); setStatus(e.message || String(e), true) }
})

/* Show directions to a result i */
function showDirections(i) {
  if (!origin) return setStatus('Set your location first.', true)
  const p = placesList[i]
  if (!p) return
  dirRenderer?.set('directions', null)
  const d = p.geometry.location
  window.open(
    `https://www.google.com/maps/dir/?api=1&origin=${origin.lat()},${origin.lng()}&destination=${d.lat()},${d.lng()}`,
    '_blank'
  )
  setStatus('Directions opened in new tab', false)
}
</script>

<template>
  <div class="container-fluid p-0">
    <div class="row g-0">
      <!-- Sidebar -->
      <aside class="col-12 col-lg-4 border-end bg-white p-3">
        <h1 class="h4 mb-3">Donation</h1>

        <!-- Status -->
        <div v-if="status" :class="['alert', 'alert-success', 'py-2']">
          <strong class="me-2">Status:</strong> {{ status }}
        </div>

        <!-- Address input -->
        <div class="mb-2 text-muted small">Or type an address:</div>
        <div class="input-group mb-3">
          <input v-model="addr" class="form-control" placeholder="e.g. 1 Fusionopolis Pl, Singapore" />
          <button class="btn btn-primary h-100" @click="geocodeAddress()">Set</button>
        </div>

        <!-- Range -->
        <div class="mb-1 text-muted small">Search distance (km)</div>
        <div class="d-flex align-items-center gap-3 mb-3">
          <input type="range" min="1" max="20" step="1" v-model.number="radiusKm" class="form-range m-0" />
          <span class="badge text-bg-primary ">{{ radiusKm }} km</span>
        </div>

        <!-- Results -->
        <div class="mb-2 text-muted small">Nearby donation points</div>
        <div class="d-flex flex-column gap-2">
          <div v-for="(p, i) in placesList" :key="p.place_id || i" class="card">
            <div class="card-body">
              <div class="d-flex align-items-start">
                <div class="fw-semibold m-0">{{ i + 1 }}.  </div>
                <div class="flex-grow-1">
                  <div class="fw-semibold">{{ p.name || '(Place)' }}</div>
                  <div class="text-muted small">{{ p.vicinity || p.formatted_address || '' }}</div>
                </div>
              </div>
              <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
                <span class="badge text-bg-secondary">Average Distance≈ {{ (p.distance / 1000).toFixed(2) }} km</span>
                <span v-if="p.rating" class="badge text-bg-light">⭐ {{ p.rating }} ({{ p.user_ratings_total || 0 }})</span>
                <button class="btn btn-success btn-sm ms-auto" @click="showDirections(i)">Show directions</button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Map -->
      <main class="col-12 col-lg-8">
        <div ref="mapEl" class="w-100" style="height: calc(100vh - 0px); min-height: 400px;"></div>
      </main>
    </div>
  </div>
</template>
