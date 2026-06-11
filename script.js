/* =============================================
   한복체크인 — FINAL STABLE VERSION (NO LOOP)
   ============================================= */

const CONFIG = {
  OPENSHEET_URL: 'https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답',
  MAPBOX_TOKEN: 'YOUR_MAPBOX_TOKEN',
  _geoCache: {}
};

let allData = [];
let mbMap = null;
let mapReady = false;

/* ─────────────────────────────
   MAP INIT (ONLY ONCE SAFE)
──────────────────────────── */
function initMap() {
  mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

  mbMap = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [127, 36],
    zoom: 2.5,
    attributionControl: false
  });

  mbMap.on('load', () => {
    mapReady = true;
    tryRender();
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
   BATCH GEOCODE (NO BLOCK)
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
   MAP RENDER (ONLY WHEN READY)
──────────────────────────── */
function renderMap() {
  if (!mapReady) return;

  const valid = allData.filter(d => d.coords);

  if (!mbMap.getSource('checkins')) {
    mbMap.addSource('checkins', {
      type: 'geojson',
      data: toGeoJSON(valid)
    });

    mbMap.addLayer({
      id: 'pins',
      type: 'circle',
      source: 'checkins',
      paint: {
        'circle-radius': 7,
        'circle-color': '#D4402A'
      }
    });

  } else {
    mbMap.getSource('checkins').setData(toGeoJSON(valid));
  }

  if (valid.length) {
    const lngs = valid.map(d => d.coords[0]);
    const lats = valid.map(d => d.coords[1]);

    mbMap.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)],
       [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, duration: 600 }
    );
  }
}

/* ─────────────────────────────
   SAFE RENDER TRIGGER
──────────────────────────── */
function tryRender() {
  if (mapReady && allData.length) {
    renderMap();
  }
}

/* ─────────────────────────────
   LOAD DATA (STRICT ORDER)
──────────────────────────── */
async function loadData() {
  try {
    const res = await fetch(CONFIG.OPENSHEET_URL);
    const rows = await res.json();

    allData = rows.map((r, i) => ({
      _id: String(i),
      name: r['닉네임'] || '',
      location: r['체크인 장소명'] || '',
      city: r['체크인한 도시'] || '',
      country: r['체크인한 국가'] || '',
      instaUrl: r['인스타 게시물 URL'] || '',
      coords: null
    })).filter(d => d.location);

    await geocodeBatch(allData);

    tryRender();

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
