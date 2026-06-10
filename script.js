
/* =============================================
   한복체크인 — PRODUCTION SAFE VERSION
   (NO STYLE MANIPULATION / NO LAYER TOUCHING)
   ============================================= */

/* ─────────────────────────────────────────────
   CONFIG
──────────────────────────────────────────── */
const CONFIG = {
  OPENSHEET_URL: 'https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답',

  MAPBOX_TOKEN: 'YOUR_MAPBOX_TOKEN',

  FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSc3ZvvZKY-e9ibFgXxXhpd39Fvysix1nMwLA8xWuBY5Dg74aw/viewform?usp=dialog',

  ITEMS_PER_PAGE: 20,
  _geoCache: {}
};

/* ─────────────────────────────────────────────
   STATE
──────────────────────────────────────────── */
let allData = [];
let currentPage = 1;
let mbMap = null;

/* ─────────────────────────────────────────────
   MAP INIT (NO STYLE MANIPULATION)
──────────────────────────────────────────── */
function initMap() {
  mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

  mbMap = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [127, 36],
    zoom: 2.5,
    attributionControl: false
  });

  mbMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
}

/* ─────────────────────────────────────────────
   SAFE GEOCODE (CACHE + FAIL SAFE)
──────────────────────────────────────────── */
async function geocode(location, city, country) {
  const query = [location, city, country].filter(Boolean).join(', ');
  if (!query) return null;
  if (CONFIG._geoCache[query]) return CONFIG._geoCache[query];

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      encodeURIComponent(query) +
      `.json?access_token=${CONFIG.MAPBOX_TOKEN}&limit=1&language=ko`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates || null;

    CONFIG._geoCache[query] = coords;
    return coords;

  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────
   GEOCODE BATCH (STABLE)
──────────────────────────────────────────── */
async function geocodeBatch(items, batchSize = 5) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async item => {
        try {
          item.coords = await geocode(item.location, item.city, item.country);
        } catch {
          item.coords = null;
        }
      })
    );

    await new Promise(r => setTimeout(r, 150));
  }
}

/* ─────────────────────────────────────────────
   GEOJSON
──────────────────────────────────────────── */
function toGeoJSON(data) {
  return {
    type: 'FeatureCollection',
    features: data.map(d => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: d.coords
      },
      properties: {
        _id: d._id,
        name: d.name,
        instaId: d.instaId,
        location: d.location,
        city: d.city,
        country: d.country,
        note: d.note,
        instaUrl: d.instaUrl,
        date: d.date
      }
    }))
  };
}

/* ─────────────────────────────────────────────
   MAP RENDER (SAFE ONLY)
──────────────────────────────────────────── */
function addPinsToMap(data) {
  if (!mbMap || !mbMap.isStyleLoaded()) return;

  const valid = data.filter(d => d.coords);

  if (!mbMap.getSource('checkins')) {
    mbMap.addSource('checkins', {
      type: 'geojson',
      data: toGeoJSON(valid),
      cluster: true,
      clusterRadius: 40
    });

    mbMap.addLayer({
      id: 'pins',
      type: 'circle',
      source: 'checkins',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 7,
        'circle-color': '#D4402A',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2
      }
    });

    mbMap.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'checkins',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': 18,
        'circle-color': '#4A90D9'
      }
    });

  } else {
    mbMap.getSource('checkins').setData(toGeoJSON(valid));
  }

  if (valid.length > 0) {
    const lngs = valid.map(d => d.coords[0]);
    const lats = valid.map(d => d.coords[1]);

    mbMap.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      ],
      { padding: 80, duration: 800 }
    );
  }
}

/* ─────────────────────────────────────────────
   DATA LOAD
──────────────────────────────────────────── */
async function loadData() {
  let rows;

  try {
    const res = await fetch(CONFIG.OPENSHEET_URL);
    rows = await res.json();
  } catch (err) {
    console.error('DATA LOAD FAILED', err);
    return;
  }

  const parsed = rows
    .map((r, i) => ({
      _id: String(i),
      name: r['닉네임'] || '익명',
      instaId: r['인스타그램 ID'] || '',
      location: r['체크인 장소명'] || '',
      city: r['체크인한 도시'] || '',
      country: r['체크인한 국가'] || '',
      note: r['체크인 한줄소개 🫡'] || '',
      instaUrl: r['인스타 게시물 URL'] || '',
      date: r['타임스탬프'] || '',
      coords: null
    }))
    .filter(d => d.location);

  allData = parsed;

  await geocodeBatch(allData);

  const render = () => addPinsToMap(allData);

  if (mbMap.isStyleLoaded()) {
    render();
  } else {
    mbMap.once('load', render);
  }
}

/* ─────────────────────────────────────────────
   INIT
──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadData();
});
