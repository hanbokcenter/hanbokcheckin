/* =============================================
   한복체크인 — CLEAN REBUILD v3 (STABLE)
   ============================================= */

/* ─────────────────────────────
   CONFIG
──────────────────────────── */
const CONFIG = {
  OPENSHEET_URL: 'https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답',
  MAPBOX_TOKEN: 'YOUR_MAPBOX_TOKEN',
  _geoCache: {}
};

/* ─────────────────────────────
   STATE (CRITICAL)
──────────────────────────── */
let allData = [];
let map = null;
let mapInitialized = false;

/* ─────────────────────────────
   INIT MAP (GUARDED)
──────────────────────────── */
function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [127, 36],
    zoom: 2.5,
    attributionControl: false
  });

  map.on('load', () => {
    console.log('MAP LOADED');
  });
}

/* ─────────────────────────────
   SAFE GEOCODE
──────────────────────────── */
async function geocode(location, city, country) {
  const q = [location, city, country].filter(Boolean).join(',');
  if (!q) return null;
  if (CONFIG._geoCache[q]) return CONFIG._geoCache[q];

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      encodeURIComponent(q) +
      `.json?access_token=${CONFIG.MAPBOX_TOKEN}&limit=1`;

    const res = await fetch(url);
    const data = await res.json();

    const coords = data.features?.[0]?.geometry?.coordinates || null;
    CONFIG._geoCache[q] = coords;
    return coords;

  } catch {
    return null;
  }
}

/* ─────────────────────────────
   BATCH GEOCODE (NON BLOCKING)
──────────────────────────── */
async function geocodeBatch(items) {
  for (const item of items) {
    item.coords = await geocode(item.location, item.city, item.country);
  }
}

/* ─────────────────────────────
   GEOJSON
──────────────────────────── */
function toGeoJSON(data) {
  return {
    type: 'FeatureCollection',
    features: data
      .filter(d => d.coords)
      .map(d => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: d.coords
        },
        properties: d
      }))
  };
}

/* ─────────────────────────────
   MAP RENDER (SINGLE SOURCE OF TRUTH)
──────────────────────────── */
function renderMap() {
  if (!map || !map.isStyleLoaded()) return;

  const valid = allData.filter(d => d.coords);

  // SOURCE
  if (!map.getSource('checkins')) {
    map.addSource('checkins', {
      type: 'geojson',
      data: toGeoJSON(valid)
    });

    map.addLayer({
      id: 'pins',
      type: 'circle',
      source: 'checkins',
      paint: {
        'circle-radius': 7,
        'circle-color': '#D4402A',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2
      }
    });
  } else {
    map.getSource('checkins').setData(toGeoJSON(valid));
  }

  // FIT
  if (valid.length > 0) {
    const lngs = valid.map(d => d.coords[0]);
    const lats = valid.map(d => d.coords[1]);

    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)],
       [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, duration: 600 }
    );
  }
}

/* ─────────────────────────────
   LOAD DATA (SAFE FLOW)
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
        instaUrl: r['인스타 게시물 URL'] || '',
        coords: null
      }))
      .filter(d => d.location);

    // 1. 먼저 geocode
    await geocodeBatch(allData);

    // 2. map render (무조건 안전하게)
    waitForMap();

  } catch (e) {
    console.error('LOAD ERROR', e);
  }
}

/* ─────────────────────────────
   MAP WAIT LOOP (CRITICAL FIX)
──────────────────────────── */
function waitForMap() {
  const check = () => {
    if (map && map.isStyleLoaded()) {
      renderMap();
    } else {
      requestAnimationFrame(check);
    }
  };
  check();
}

/* ─────────────────────────────
   INIT
──────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadData();
});
