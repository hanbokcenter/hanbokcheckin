
/* =============================================
   HANBOK CHECK-IN — CLEAN SYSTEM
   NO LOOP / NO FRAMEWORK / NO RECALL
============================================= */

(() => {

  /* ─────────────────────────────
     HARD GUARD (중복 실행 차단)
  ───────────────────────────── */
  if (window.__APP__) return;
  window.__APP__ = true;

  console.log("APP START");

  /* ─────────────────────────────
     CONFIG
  ───────────────────────────── */
  const URL =
    "https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답";

  let map;
  let markers = [];

  /* ─────────────────────────────
     INIT MAP (ONE TIME ONLY)
  ───────────────────────────── */
  function initMap() {
    map = L.map("map", {
      center: [36, 127],
      zoom: 2.5
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; CARTO" }
    ).addTo(map);
  }

  /* ─────────────────────────────
     FETCH DATA (NO LOOP POSSIBLE)
  ───────────────────────────── */
  async function fetchData() {
    const res = await fetch(URL);
    const rows = await res.json();

    return rows
      .map((r, i) => ({
        id: i,
        name: r["닉네임"] || "익명",
        location: r["체크인 장소명"] || "",
        country: r["체크인한 국가"] || "",
      }))
      .filter(d => d.location);
  }

  /* ─────────────────────────────
     SIMPLE GEO (NO CACHE COMPLEXITY)
  ───────────────────────────── */
  async function geocode(q) {
    const url =
      "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
      encodeURIComponent(q) +
      ".json?access_token=YOUR_MAPBOX_TOKEN&limit=1";

    const res = await fetch(url);
    const json = await res.json();

    const c = json.features?.[0]?.geometry?.coordinates;
    if (!c) return null;

    return [c[1], c[0]];
  }

  /* ─────────────────────────────
     RENDER (CLEAN REPLACE ONLY)
  ───────────────────────────── */
  function render(data) {

    // remove old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const bounds = [];

    data.forEach(d => {
      if (!d.coords) return;

      const m = L.circleMarker(d.coords, {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#D4402A",
        fillOpacity: 0.9
      }).addTo(map);

      m.bindPopup(`
        <b>${d.name}</b><br/>
        📍 ${d.location}<br/>
        🌏 ${d.country}
      `);

      markers.push(m);
      bounds.push(d.coords);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /* ─────────────────────────────
     MAIN FLOW (STRICT LINEAR)
  ───────────────────────────── */
  async function main() {

    initMap();

    const data = await fetchData();

    // geocode sequential (NO LOOP SIDE EFFECT)
    for (const d of data) {
      d.coords = await geocode(d.location + "," + d.country);
    }

    render(data);

    document.getElementById("loading").style.display = "none";
  }

  /* ─────────────────────────────
     BOOT (ONLY ONCE EVER)
  ───────────────────────────── */
  document.addEventListener("DOMContentLoaded", main);

})();
