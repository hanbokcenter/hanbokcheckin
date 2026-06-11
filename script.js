/* =============================================
   한복체크인 — script.js
   opensheet → Mapbox Geocoding → 지도 핀
   =============================================

   ┌─────────────────────────────────────────────┐
   │  🔧  여기만 수정하세요                        │
   └─────────────────────────────────────────────┘

   OPENSHEET_URL : opensheet로 만든 구글 시트 JSON 주소
   MAPBOX_TOKEN  : Mapbox 액세스 토큰
   FORM_URL      : 구글 폼 공유 링크

   ┌─────────────────────────────────────────────┐
   │  📋  현재 구글 시트 컬럼 (실제 헤더 기준)      │
   └─────────────────────────────────────────────┘
   타임스탬프                       ← 폼 자동 입력
   닉네임                           ← 폼 질문 1
   인스타그램 ID                    ← 폼 질문 2
   체크인 장소명                    ← 폼 질문 3  (geocoding 사용)
   체크인한 도시                    ← 폼 질문 4  (geocoding 정확도)
   체크인한 국가                    ← 폼 질문 5  (geocoding 정확도 + 국기)
   체크인 한줄소개 🫡               ← 폼 질문 6
   인스타 게시물 URL  ← 폼 질문 7
*/

const CONFIG = {
  OPENSHEET_URL: 'https://opensheet.elk.sh/168jH8wNnXTdCa8kHaBl0QXnga33Divzo1U4Q-eg5VBQ/응답',

  MAPBOX_TOKEN: 'pk.eyJ1IjoiaGFuYm9rY2VudGVyIiwiYSI6ImNtcTZjbmUxbDAzbHozMnBrczh6dGV5YzQifQ.b0hpmMQUslTf_3esWSQ52Q',

  FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSc3ZvvZKY-e9ibFgXxXhpd39Fvysix1nMwLA8xWuBY5Dg74aw/viewform?usp=dialog',

  ITEMS_PER_PAGE: 20,

  _geoCache: {}
};
/* ─────────────────────────────────────────────
   국가명 → 국기 이모지
   국가코드 없이 국가 이름만으로 변환합니다
   ───────────────────────────────────────────── */
const COUNTRY_FLAG_MAP = {
  // 한국어 국가명
  '대한민국': '🇰🇷', '한국': '🇰🇷',
  '미국': '🇺🇸', '미합중국': '🇺🇸',
  '일본': '🇯🇵',
  '중국': '🇨🇳', '중화인민공화국': '🇨🇳',
  '프랑스': '🇫🇷',
  '영국': '🇬🇧', '영국(UK)': '🇬🇧',
  '독일': '🇩🇪',
  '호주': '🇦🇺', '오스트레일리아': '🇦🇺',
  '캐나다': '🇨🇦',
  '이탈리아': '🇮🇹',
  '스페인': '🇪🇸',
  '포르투갈': '🇵🇹',
  '네덜란드': '🇳🇱',
  '벨기에': '🇧🇪',
  '스위스': '🇨🇭',
  '오스트리아': '🇦🇹',
  '스웨덴': '🇸🇪',
  '노르웨이': '🇳🇴',
  '덴마크': '🇩🇰',
  '핀란드': '🇫🇮',
  '폴란드': '🇵🇱',
  '체코': '🇨🇿',
  '헝가리': '🇭🇺',
  '러시아': '🇷🇺',
  '우크라이나': '🇺🇦',
  '태국': '🇹🇭',
  '베트남': '🇻🇳',
  '싱가포르': '🇸🇬',
  '말레이시아': '🇲🇾',
  '인도네시아': '🇮🇩',
  '필리핀': '🇵🇭',
  '인도': '🇮🇳',
  '터키': '🇹🇷', '튀르키예': '🇹🇷',
  '이집트': '🇪🇬',
  '남아프리카공화국': '🇿🇦', '남아공': '🇿🇦',
  '브라질': '🇧🇷',
  '아르헨티나': '🇦🇷',
  '멕시코': '🇲🇽',
  '뉴질랜드': '🇳🇿',
  '대만': '🇹🇼',
  '홍콩': '🇭🇰',
  // 영문 국가명도 지원
  'Korea': '🇰🇷', 'South Korea': '🇰🇷',
  'USA': '🇺🇸', 'United States': '🇺🇸', 'US': '🇺🇸',
  'Japan': '🇯🇵',
  'China': '🇨🇳',
  'France': '🇫🇷',
  'UK': '🇬🇧', 'United Kingdom': '🇬🇧',
  'Germany': '🇩🇪',
  'Australia': '🇦🇺',
  'Canada': '🇨🇦',
  'Italy': '🇮🇹',
  'Spain': '🇪🇸',
  'Netherlands': '🇳🇱',
  'Switzerland': '🇨🇭',
  'Sweden': '🇸🇪',
  'Thailand': '🇹🇭',
  'Vietnam': '🇻🇳',
  'Singapore': '🇸🇬',
  'Taiwan': '🇹🇼',
  'Hong Kong': '🇭🇰',
};

function countryToFlag(countryName) {
  if (!countryName) return '🌐';
  // 정확히 일치하는 경우
  if (COUNTRY_FLAG_MAP[countryName]) return COUNTRY_FLAG_MAP[countryName];
  // 부분 일치 (예: "한국 (Korea)" 같은 입력 처리)
  const lower = countryName.toLowerCase();
  for (const [key, flag] of Object.entries(COUNTRY_FLAG_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return flag;
    }
  }
  return '🌐';
}

/* ─────────────────────────────────────────────
   Mapbox Geocoding API
   장소명 + 도시 + 국가 → [경도, 위도]
   ───────────────────────────────────────────── */
async function geocode(location, city, country) {
  const query = [location, city, country].filter(Boolean).join(', ');
  if (!query) return null;
  if (CONFIG._geoCache[query]) return CONFIG._geoCache[query];

  try {
    const url =
      'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
      encodeURIComponent(query) + '.json' +
      '?access_token=' + CONFIG.MAPBOX_TOKEN +
      '&limit=1&language=ko';

    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates; // [lng, lat]
    if (!coords) return null;

    CONFIG._geoCache[query] = coords;
    return coords;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────
   구글 폼 타임스탬프 파서
   "2026. 6. 10 오후 2:34:00" → Date
   "6/10/2026 14:34:00"       → Date
   "2026-06-10"               → Date
   ───────────────────────────────────────────── */
function parseTimestamp(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // 한국어 폼: "2026. 6. 10 오후 2:34:00"
  const kr = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
  if (kr) {
    let [, yr, mo, dy, ampm, hr, mn] = kr;
    hr = parseInt(hr, 10);
    if (ampm === '오후' && hr !== 12) hr += 12;
    if (ampm === '오전' && hr === 12) hr = 0;
    return new Date(+yr, +mo - 1, +dy, hr, +mn);
  }

  // 영어 폼: "6/10/2026 14:34:00"
  const sl = s.match(/(\d{1,4})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/);
  if (sl) {
    let [, a, b, c, hr, mn] = sl;
    const yr = +a > 31 ? +a : +c;
    const mo = +a > 31 ? +b : +a;
    const dy = +a > 31 ? +c : +b;
    return new Date(yr, mo - 1, dy, +hr, +mn);
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function formatDate(raw) {
  const d = parseTimestamp(raw);
  if (!d) return '';
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function isToday(raw) {
  const d = parseTimestamp(raw);
  if (!d) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth()    === n.getMonth()    &&
         d.getDate()     === n.getDate();
}

/* ─────────────────────────────────────────────
   HTML 이스케이프
   ───────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────
   전역 상태
   ───────────────────────────────────────────── */
let allData     = [];
let currentPage = 1;
let mbMap       = null;

/* ─────────────────────────────────────────────
   Mapbox 지도 초기화
   ───────────────────────────────────────────── */
function initMap() {
  mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
  mbMap = new mapboxgl.Map({
    container:          'map',
    style:              'mapbox://styles/hanbokcenter/cmq8s5msx004301sm9zmd7sh3',
    center:             [127, 36],
    zoom:               2.5,
    scrollZoom:         true,
    attributionControl: false,
  });
  mbMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
  mbMap.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
}

/* ─────────────────────────────────────────────
   GeoJSON 변환
   ───────────────────────────────────────────── */
function toGeoJSON(data) {
  return {
    type: 'FeatureCollection',
    features: data.map(d => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: d.coords },
      properties: {
        _id:       d._id,
        name:      d.name,
        instaId:   d.instaId,
        location:  d.location,
        city:      d.city,
        country:   d.country,
        note:      d.note,
        instaUrl:  d.instaUrl,
        date:      d.date,
      },
    })),
  };
}

/* ─────────────────────────────────────────────
   지도에 핀 추가 / 업데이트
   ───────────────────────────────────────────── */
function addPinsToMap(data) {
   console.log('PIN DATA:', data);
console.log('PIN COUNT:', data.length);
  const valid = data.filter(d => d.coords);

  // 소스가 이미 있으면 데이터만 교체
  if (mbMap.getSource('checkins')) {
    mbMap.getSource('checkins').setData(toGeoJSON(valid));
    return;
  }

  // 처음 등록
  mbMap.addSource('checkins', {
    type:           'geojson',
    data:           toGeoJSON(valid),
    cluster:        true,
    clusterMaxZoom: 9,
    clusterRadius:  44,
  });

  // 클러스터 원
  mbMap.addLayer({
    id: 'clusters', type: 'circle', source: 'checkins',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'],
        '#D4402A', 5, '#E8C96A', 15, '#4A90D9'],
      'circle-radius':       ['step', ['get', 'point_count'], 18, 5, 24, 15, 32],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,.2)',
    },
  });

  // 클러스터 숫자
  mbMap.addLayer({
    id: 'cluster-count', type: 'symbol', source: 'checkins',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font':  ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size':  12,
    },
    paint: { 'text-color': '#fff' },
  });

  // 핀 글로우
  mbMap.addLayer({
    id: 'pin-glow', type: 'circle', source: 'checkins',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color':   '#D4402A',
      'circle-radius':  16,
      'circle-opacity': 0.12,
    },
  });

  // 핀 본체
  mbMap.addLayer({
    id: 'pins', type: 'circle', source: 'checkins',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color':        '#D4402A',
      'circle-radius':       8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#E8C96A',
      'circle-opacity':      0.95,
    },
  });

  // 클러스터 클릭 → 줌인
  mbMap.on('click', 'clusters', e => {
    const f  = mbMap.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
    const id = f.properties.cluster_id;
    mbMap.getSource('checkins').getClusterExpansionZoom(id, (err, zoom) => {
      if (!err) mbMap.easeTo({ center: f.geometry.coordinates, zoom });
    });
  });

  // 핀 클릭 → 팝업
  mbMap.on('click', 'pins', e => {
    const p      = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    // 경도 보정 (지구 반대편 래핑 방지)
    while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
      coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
    }
    openPopup(coords, p);
  });

  // 커서
  ['clusters', 'pins'].forEach(layer => {
    mbMap.on('mouseenter', layer, () => { mbMap.getCanvas().style.cursor = 'pointer'; });
    mbMap.on('mouseleave', layer, () => { mbMap.getCanvas().style.cursor = ''; });
  });

  // 전체 핀 보이도록 뷰 조정
  if (valid.length > 0) {
    const lngs = valid.map(d => d.coords[0]);
    const lats = valid.map(d => d.coords[1]);
    mbMap.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)],
       [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, maxZoom: 7, duration: 1000 }
    );
  }
}

/* ─────────────────────────────────────────────
   팝업 생성 (핀 클릭 & 카드 클릭 공용)
   ───────────────────────────────────────────── */
function openPopup(coords, p) {
  const flag     = countryToFlag(p.country);
  const date     = formatDate(p.date);
  const instaIdHtml = p.instaId
    ? `<div class="popup-insta-id">@${esc(p.instaId)}</div>`
    : '';
  const instaBtn = p.instaUrl
    ? `<a class="popup-insta" href="${esc(p.instaUrl)}"
          target="_blank" rel="noopener">인스타그램에서 보기 ↗</a>`
    : '';

  new mapboxgl.Popup({ offset: 16, maxWidth: '270px' })
    .setLngLat(coords)
    .setHTML(`
      <div class="popup-loc">📍 ${esc(p.location)}</div>
      <div class="popup-name">👘 ${esc(p.name)}</div>
      ${instaIdHtml}
      ${p.note ? `<div class="popup-note">${esc(p.note)}</div>` : ''}
      <div class="popup-flag">${flag} ${esc(p.country)} · ${date}</div>
      ${instaBtn}
    `)
    .addTo(mbMap);
}

/* ─────────────────────────────────────────────
   피드 카드 렌더링
   ───────────────────────────────────────────── */
function buildCard(d) {
  const flag  = countryToFlag(d.country);
  const date  = formatDate(d.date);
  const isNew = isToday(d.date);

  return `
   <div class="feed-card"
     onclick="openInstagram('${esc(d.instaUrl)}','${esc(d._id)}')">

   

      <div class="fc-flag">${flag}</div>
      <div class="fc-body">
        <div class="fc-loc">📍 ${esc(d.location)}</div>
        <div class="fc-name">
          ${esc(d.name)}
          ${d.instaId ? `<span class="fc-insta-id">@${esc(d.instaId)}</span>` : ''}
        </div>
        ${d.note ? `<div class="fc-note">${esc(d.note)}</div>` : ''}
        <div class="fc-meta">
          <span class="fc-date">${date}</span>
          <span class="fc-tag">#한복체크인</span>
          ${isNew ? '<span class="fc-new">오늘</span>' : ''}
        </div>
      </div>
    </div>`;
}

function renderFeed() {
  const list    = document.getElementById('feedList');
  const moreBtn = document.getElementById('feedMore');
  const end     = currentPage * CONFIG.ITEMS_PER_PAGE;

  list.innerHTML = allData.slice(0, end).map(buildCard).join('');
  end < allData.length
    ? moreBtn.classList.remove('hidden')
    : moreBtn.classList.add('hidden');
}

window.loadMore = () => { currentPage++; renderFeed(); };

/* 카드 클릭 → 해당 핀으로 지도 이동 */
window.flyToPin = (id) => {
  const d = allData.find(x => x._id === id);
  if (!d?.coords) return;

  // 모바일: 패널 닫고 지도 보이게
  if (window.innerWidth < 768) {
    document.querySelector('.bottom-panel').classList.remove('open');
  }

  mbMap.flyTo({ center: d.coords, zoom: 12, duration: 800 });

  setTimeout(() => openPopup(d.coords, d), 900);
};

/* ─────────────────────────────────────────────
   국가별 통계 렌더링
   (국가코드 없이 국가명으로 집계)
   ───────────────────────────────────────────── */
function renderStats() {
  const map = {};
  allData.forEach(d => {
    const k = d.country || '기타';
    if (!map[k]) map[k] = { country: k, count: 0 };
    map[k].count++;
  });

  const sorted   = Object.values(map).sort((a, b) => b.count - a.count).slice(0, 15);
  const maxCount = sorted[0]?.count || 1;
  const medals   = [['1위', 'gold'], ['2위', 'silver'], ['3위', 'bronze']];

  document.getElementById('statsGrid').innerHTML = sorted.map((item, i) => {
    const [lbl, cls] = medals[i] || [`${i + 1}위`, ''];
    const pct        = Math.round(item.count / maxCount * 100);
    return `
      <div class="stat-row">
        <span class="sr-rank ${cls}">${lbl}</span>
        <span class="sr-flag">${countryToFlag(item.country)}</span>
        <div class="sr-info">
          <div class="sr-country">${esc(item.country)}</div>
          <div class="sr-bar-wrap">
            <div class="sr-bar" style="width:${pct}%"></div>
          </div>
        </div>
        <span class="sr-count">${item.count}건</span>
      </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   카운터 애니메이션
   ───────────────────────────────────────────── */
function animCount(el, target) {
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / 700, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ko-KR');
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ─────────────────────────────────────────────
   opensheet 데이터 읽기 + 컬럼 매핑
   ───────────────────────────────────────────── */
async function loadData() {
  let rows;
  try {
    const res = await fetch(CONFIG.OPENSHEET_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    rows = await res.json();
  } catch (err) {
    console.error('[한복체크인] 데이터 로드 실패:', err);
    document.getElementById('feedError').classList.remove('hidden');
    hideLoading();
    return;
  }

  // opensheet가 빈 배열 또는 에러 객체를 반환하는 경우 처리
  if (!Array.isArray(rows) || rows.length === 0) {
    document.getElementById('feedList').innerHTML =
      '<p style="color:var(--text-dim);text-align:center;padding:32px">아직 체크인이 없어요 👘</p>';
    hideLoading();
    return;
  }

  /* ── 실제 시트 헤더 이름에 맞춘 컬럼 매핑 ── */
  const parsed = rows
    .map((r, i) => ({
      _id:      String(i),
      date:     r['타임스탬프']                               || '',
      name:     r['닉네임']                                   || '익명',
      instaId:  r['인스타그램 ID']                            || '',
      location: r['체크인 장소명']                            || '',
      city:     r['체크인한 도시']                            || '',
      country:  r['체크인한 국가']                            || '',
      note:     r['체크인 한줄소개 🫡']                       || '',
      instaUrl: r['인스타 게시물 URL']    || '',
      coords:   null,  // geocoding 후 채워짐
    }))
    .filter(r => r.location)   // 장소명 없는 행 제외
    .sort((a, b) => {
      const da = parseTimestamp(a.date);
      const db = parseTimestamp(b.date);
      if (!da || !db) return 0;
      return db - da;  // 최신순
    });

  allData     = parsed;
  currentPage = 1;

  // 카운터: geocoding 기다리지 않고 바로 표시
  animCount(document.getElementById('totalCount'),
    allData.length);
  animCount(document.getElementById('countryCount'),
    new Set(allData.map(d => d.country).filter(Boolean)).size);

  // 피드 & 통계 즉시 표시
  renderFeed();
  renderStats();

  // 로딩 오버레이 제거
  hideLoading();

  // 지도 스타일 로드 완료 후 핀 초기화
await geocodeBatch(parsed);

if (mbMap.isStyleLoaded()) {
  addPinsToMap(allData.filter(d => d.coords));
} else {
  mbMap.once('load', () => {
    addPinsToMap(allData.filter(d => d.coords));
  });
}
}

/* Geocoding 배치 처리 */
async function geocodeBatch(items, batchSize = 5) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    await Promise.all(batch.map(async item => {
  item.coords = await geocode(item.location, item.city, item.country);

  console.log(
    'GEOCODE:',
    item.location,
    item.city,
    item.country,
    item.coords
  );
}));

console.log(
  'BEFORE ADD',
  allData.filter(d => d.coords)
);

// 배치마다 지도 핀 업데이트

//if (mbMap.isStyleLoaded()) {
  //addPinsToMap(allData.filter(d => d.coords));
//}

    // 다음 배치 전 대기 (Mapbox API rate limit 방지)
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

function hideLoading() {
  const el = document.getElementById('mapLoading');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 500);
}

/* ─────────────────────────────────────────────
   패널 인터랙션 (탭 전환 + 스와이프)
   ───────────────────────────────────────────── */
function initPanel() {
  const panel    = document.querySelector('.bottom-panel');
  const handle   = document.querySelector('.panel-handle');
  const tabs     = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  // 탭 전환
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b     => b.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      panel.classList.add('open');
    });
  });

  // 핸들 탭 → 패널 토글
  handle.addEventListener('click', () => panel.classList.toggle('open'));

  // 터치 스와이프
  let startY = 0;
  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  handle.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy < -30)     panel.classList.add('open');
    else if (dy > 30) panel.classList.remove('open');
  }, { passive: true });

  // 폼 링크
document.getElementById('formLink').href =
  'https://docs.google.com/forms/d/e/1FAIpQLSc3ZvvZKY-e9ibFgXxXhpd39Fvysix1nMwLA8xWuBY5Dg74aw/viewform?usp=dialog';
}

/* ─────────────────────────────────────────────
   헤더 "참여하기" → 참여방법 탭 열기
   ───────────────────────────────────────────── */
document.querySelector('.header-cta').addEventListener('click', e => {
  e.preventDefault();
  document.querySelectorAll('.tab-btn').forEach(b     => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="how"]').classList.add('active');
  document.getElementById('tab-how').classList.add('active');
  document.querySelector('.bottom-panel').classList.add('open');
});

/* ─────────────────────────────────────────────
   진입점
   ───────────────────────────────────────────── */
window.openInstagram = (url, id) => {
  if (url) {
    window.open(url, '_blank');
    return;
  }

  flyToPin(id);
};
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initPanel();
  loadData();
});
