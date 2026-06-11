
/* =============================================
   한복체크인 — ABSOLUTE STABLE SYSTEM
   (NO LOOP / NO DOUBLE INIT / SAFE ARCHITECTURE)
============================================= */

(function () {
  /* ─────────────────────────────
     GUARD (핵심: 1회 실행 보장)
  ───────────────────────────── */
  if (window.__HANBOK_APP__) return;
  window.__HANBOK_APP__ = true;

  console.log('APP BOOT');

  /* ─────────────────────────────
     CONFIG
  ───────────────────────────── */
  const CONFIG = {
    OPENSHEET_URL:
      'https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답',
    _geoCache: {}
  };

  /* ─────────────────────────────
     STATE
  ───────────────────────────── */
  let map;
  let markers = [];
  let data = [];

  /* ─────────────────────────────
     INIT MAP (LEAFLET ONLY)
  ───────────────────────────── */
  function initMap() {
    map = L.map('map', {
      center: [36, 127],
      zoom: 2.5,
      worldCopyJump: true
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; CARTO'
      }
    ).addTo(map);
  }

  /* ─────────────────────────────
     GEOCODE (SAFE)
  ───────────────────────────── */
  async function geocode(q) {
    if (!q) return null;
    if (CONFIG._geoCache[q]) return CONFIG._geoCache[q];

    try {
      const url =
        'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        encodeURIComponent(q) +
        `.json?access_token=YOUR_MAPBOX_TOKEN&limit=1`;

      const res = await fetch(url);
      const json = await res.json();

      const c = json.features?.[0]?.geometry?.coordinates;
      if (!c) return null;

      const latlng = [c[1], c[0]];
      CONFIG._geoCache[q] = latlng;

      return latlng;
    } catch {
      return null;
    }
  }

  /* ─────────────────────────────
     LOAD DATA (NO LOOP RISK)
  ───────────────────────────── */
  async function loadData() {
    console.log('LOAD START');

    const res = await fetch(CONFIG.OPENSHEET_URL);
    const rows = await res.json();

    data = rows
      .map((r, i) => ({
        id: i,
        name: r['닉네임'] || '익명',
        location: r['체크인 장소명'] || '',
        city: r['체크인한 도시'] || '',
        country: r['체크인한 국가'] || ''
      }))
      .filter(d => d.location);

    await geocodeAll();

    render();
  }

  /* ─────────────────────────────
     GEOCODE BATCH (SAFE LOOP)
  ───────────────────────────── */
  async function geocodeAll() {
    for (const d of data) {
      const q = [d.location, d.city, d.country].filter(Boolean).join(',');
      d.coords = await geocode(q);
    }
  }

  /* ─────────────────────────────
     RENDER MARKERS (SINGLE SOURCE)
  ───────────────────────────── */
  function render() {
    console.log('RENDER MAP');

    // cleanup old markers
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    const valid = data.filter((d) => d.coords);

    valid.forEach((d) => {
      const m = L.circleMarker(d.coords, {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#D4402A',
        fillOpacity: 0.9
      }).addTo(map);

      m.bindPopup(`
        <b>${d.name}</b><br/>
        📍 ${d.location}<br/>
        🌏 ${d.country}
      `);

      markers.push(m);
    });

    if (valid.length) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), {
        padding: [40, 40]
      });
    }

    console.log('RENDER DONE');
  }

  /* ─────────────────────────────
     BOOT (ONLY ONCE)
  ───────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM READY');

    initMap();
    loadData();
  });
})();
