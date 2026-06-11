/* =============================================
   한복체크인 — LEAFLET VERSION (STABLE)
   ============================================= */
<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>


/* ─────────────────────────────
   CONFIG
──────────────────────────── */
const CONFIG = {
  OPENSHEET_URL: 'https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답',
  _geoCache: {}
};

/* ─────────────────────────────
   STATE
──────────────────────────── */
let allData = [];
let map = null;
let markersLayer = null;

/* ─────────────────────────────
   INIT MAP (LEAFLET)
──────────────────────────── */
function initMap() {
  map = L.map('map', {
    center: [36, 127],
    zoom: 2.5,
    worldCopyJump: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

/* ─────────────────────────────
   GEOCODE (MAPBOX API 유지)
──────────────────────────── */
async function geocode(location, city, country) {
  const q = [location, city, country].filter(Boolean).join(',');
  if (!q) return null;
  if (CONFIG._geoCache[q]) return CONFIG._geoCache[q];

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      encodeURIComponent(q) +
      `.json?access_token=YOUR_MAPBOX_TOKEN&limit=1`;

    const res = await fetch(url);
    const data = await res.json();

    const coords = data.features?.[0]?.geometry?.coordinates || null;

    if (coords) {
      // Leaflet uses [lat, lng]
      const converted = [coords[1], coords[0]];
      CONFIG._geoCache[q] = converted;
      return converted;
    }

    return null;

  } catch {
    return null;
  }
}

/* ─────────────────────────────
   BATCH GEOCODE
──────────────────────────── */
async function geocodeBatch(items) {
  for (const item of items) {
    item.coords = await geocode(item.location, item.city, item.country);
  }
}

/* ─────────────────────────────
   RENDER MARKERS
──────────────────────────── */
function renderMarkers() {
  if (!map) return;

  markersLayer.clearLayers();

  const valid = allData.filter(d => d.coords);

  valid.forEach(d => {
    const marker = L.circleMarker(d.coords, {
      radius: 6,
      color: '#fff',
      weight: 2,
      fillColor: '#D4402A',
      fillOpacity: 0.9
    });

    marker.addTo(markersLayer);

    marker.bindPopup(`
      <div style="font-family:sans-serif">
        <b>📍 ${d.location}</b><br/>
        👘 ${d.name}<br/>
        🌏 ${d.country || ''}<br/>
      </div>
    `);

    marker.on('click', () => {
      map.setView(d.coords, 6, { animate: true });
    });
  });

  // auto fit
  if (valid.length > 0) {
    const group = L.featureGroup(
      valid.map(d => L.circleMarker(d.coords))
    );
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }
}

/* ─────────────────────────────
   LOAD DATA
──────────────────────────── */
async function loadData() {
  try {
    const res = await fetch(CONFIG.OPENSHEET_URL);
    const rows = await res.json();

    allData = rows
      .map((r, i) => ({
        _id: String(i),
        name: r['닉네임'] || '익명',
        location: r['체크인 장소명'] || '',
        city: r['체크인한 도시'] || '',
        country: r['체크인한 국가'] || '',
        coords: null
      }))
      .filter(d => d.location);

    await geocodeBatch(allData);

    renderMarkers();

  } catch (e) {
    console.error('LOAD FAILED', e);
  }
}

/* ─────────────────────────────
   INIT
──────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadData();
});
