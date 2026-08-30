const DATA = Array.isArray(window.__MAEKA_DATA__) ? window.__MAEKA_DATA__ : [];

const TYPE_COLORS = {
  'ฝาย':'#0e7490',
  'บ่อบาดาล':'#b45309',
  'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)':'#7c3aed',
  'อ่างเก็บน้ำ':'#1d4ed8',
  'ประตูน้ำ':'#be185d',
  'สถานีสูบน้ำไฟฟ้า':'#15803d',
};
// สัญลักษณ์ในหมุดแผนที่ตามประเภทแหล่งน้ำ — เลือกให้สื่อความหมายตรงตัวที่สุด
const TYPE_ICONS = {
  'ฝาย':'🚧',                              // โครงสร้างกั้นขวางลำน้ำ
  'บ่อบาดาล':'🕳️',                        // บ่อ/รูเจาะน้ำใต้ดิน
  'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)':'⛲',        // แหล่งน้ำที่มนุษย์สร้างขึ้น
  'อ่างเก็บน้ำ':'🏞️',                      // แหล่งน้ำขนาดใหญ่/ภูมิทัศน์
  'ประตูน้ำ':'🚪',                          // ประตู
  'สถานีสูบน้ำไฟฟ้า':'⚡',                  // ใช้ไฟฟ้าสูบน้ำ
};
function iconFor(t){ return TYPE_ICONS[t] || '💧'; }
function problemBadge(r){
  const tags = (r.problem||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(tags.includes('ชำรุด')) return { icon:'🔧', cls:'broken' };
  if(tags.some(t=>t && t!=='ใช้งานได้')) return { icon:'⚠️', cls:'warn' };
  return null;
}
function colorFor(t){ return TYPE_COLORS[t] || '#0a5fb4'; }
// สถานะการใช้งาน คำนวณจากรายการปัญหา (problem): ชำรุด > ใช้งานได้ > อื่นๆถือว่าใช้งานไม่ได้/มีข้อจำกัด
function getUsageStatus(r){
  const tags = (r.problem||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(tags.includes('ชำรุด')) return 'ชำรุด';
  if(tags.includes('ใช้งานได้')) return 'ใช้งานได้';
  return 'ใช้งานไม่ได้';
}
const STATUS_COLORS = {'ใช้งานได้':'#27ae60','ใช้งานไม่ได้':'#f0a63c','ชำรุด':'#dc2626'};
const PROB_COLORS = {'ชำรุด':'#dc2626'};
const PROB_PALETTE = ['#27ae60','#f0a63c','#0a5fb4','#7c5cd6','#12a3a3','#5b7787','#3757c9'];
function probColor(p,i){ return PROB_COLORS[p] || PROB_PALETTE[i % PROB_PALETTE.length]; }

// กลุ่มสถานะที่ใช้เฉพาะใน "ชั้นข้อมูล" บนแผนที่ — รวม "ใช้งานไม่ได้" กับ "ชำรุด" เป็นกลุ่มเดียว
// เพื่อให้ตัวกรองเหลือ 2 กลุ่มที่ตัดสินใจง่าย ไม่กระทบตัวกรองหลัก/ตารางที่ยังแยก 3 สถานะตามเดิม
function getLayerStatusGroup(r){
  const s = getUsageStatus(r);
  return s==='ใช้งานได้' ? 'ใช้งานได้' : 'ใช้งานไม่ได้/ชำรุด';
}
const LAYER_STATUS_GROUPS = ['ใช้งานได้','ใช้งานไม่ได้/ชำรุด'];
const STATUS_GROUP_COLORS = {'ใช้งานได้':'#27ae60','ใช้งานไม่ได้/ชำรุด':'#dc2626'};

// รายการ "ปัญหาที่พบเจอ" สำหรับตัวกรองชั้นข้อมูล — ดึงจากแท็ก problem จริงทั้งหมด (ไม่รวม "ใช้งานได้")
// จุดที่ไม่มีแท็กปัญหาอื่นเลยจะถูกจัดเข้ากลุ่ม "ไม่มีปัญหา"
function getProblemTags(r){
  const tags = (r.problem||'').split(',').map(s=>s.trim()).filter(t=>t && t!=='ใช้งานได้');
  return tags.length ? tags : ['ไม่มีปัญหา'];
}
const ALL_PROBLEMS = [...new Set(DATA.flatMap(getProblemTags))];
function problemLayerColor(p){ return p==='ไม่มีปัญหา' ? '#27ae60' : probColor(p, ALL_PROBLEMS.indexOf(p)); }

let state = { moo:'all', type:null, problem:null, status:null, kpiFocus:null, selectedId:null, focusId:null, search:'' };

const ALL_TYPES = [...new Set(DATA.map(d=>d.type))];
const ALL_STATUSES = [...new Set(DATA.map(d=>getUsageStatus(d)))];
const ALL_VILLAGES = [...new Set(DATA.map(d=>d.village))].sort((a,b)=>a.localeCompare(b,'th'));

// สถานะของ "ชั้นข้อมูล" บนแผนที่ — เป็นตัวกรองเสริมเฉพาะแผนที่ แยกจากตัวกรองหลักด้านบน
// checkbox ย่อยแต่ละอันมีผลทันทีเสมอ (ไม่ต้องกดเปิด "ชั้นข้อมูลหลัก" ก่อน)
let layerState = {
  types:new Set(ALL_TYPES), statuses:new Set(LAYER_STATUS_GROUPS), villages:new Set(ALL_VILLAGES),
  problems:new Set(ALL_PROBLEMS)
};

function mapVisibleRows(rows){
  return rows.filter(r=>{
    if(!layerState.types.has(r.type)) return false;
    if(!layerState.statuses.has(getLayerStatusGroup(r))) return false;
    if(!layerState.villages.has(r.village)) return false;
    if(!getProblemTags(r).some(t=>layerState.problems.has(t))) return false;
    return true;
  });
}

function filtered(){
  return DATA.filter(d => {
    const matchMoo = (state.moo==='all' || String(d.moo)===String(state.moo));
    const matchType = (!state.type || d.type===state.type);
    const matchProb = (!state.problem || (d.problem||'').split(',').map(s=>s.trim()).includes(state.problem));
    const matchStatus = (!state.status || getUsageStatus(d)===state.status);

    const text = (d.name + ' ' + d.village + ' ' + d.type).toLowerCase();
    const matchSearch = (!state.search || text.includes(state.search.toLowerCase()));

    return matchMoo && matchType && matchProb && matchStatus && matchSearch;
  });
}

function focusedRows(){
  if(state.focusId!=null){
    const r = DATA.find(d=>d.id===state.focusId);
    return r ? [r] : filtered();
  }
  return filtered();
}

const TAMBON_TOTAL_MOO = 18; // ตำบลแม่กามีทั้งหมด 18 หมู่ตามทะเบียนราชการ (ข้อมูลสำรวจอาจยังไม่ครบทุกหมู่)

// รายชื่อหมู่บ้านทางการของตำบลแม่กา อ.เมืองพะเยา จ.พะเยา (อ้างอิงข้อมูลประชากรและครัวเรือน)
const OFFICIAL_VILLAGE_BY_MOO = {
  1:'บ้านหม้อแกงทอง', 2:'บ้านห้วยเคียน', 3:'บ้านแม่กาหลวง', 4:'บ้านโทกหวาก',
  5:'บ้านแม่ต๋ำบุญโยง', 6:'บ้านแม่กาไร่', 7:'บ้านบัว', 8:'บ้านแม่ต๋ำบุญโยง',
  9:'บ้านแม่ต๋ำบุญโยง', 10:'บ้านแม่กาท่าข้าม', 11:'บ้านแม่ต๋ำบุญโยง', 12:'บ้านแม่กาหัวทุ่ง',
  13:'บ้านหนองแก้ว', 14:'บ้านแม่กาไร่เดียว', 15:'บ้านเกษตรสุข', 16:'บ้านแม่กาห้วยเคียน',
  17:'บ้านแม่กาโทกหวาก', 18:'บ้านแม่กาน้อย'
};

function initFilters(){
  const elMoo = document.getElementById('fMoo');
  for(let m=1; m<=TAMBON_TOTAL_MOO; m++){
    const hasData = DATA.some(d=>d.moo===m);
    const officialName = OFFICIAL_VILLAGE_BY_MOO[m] || '';
    const o = document.createElement('option');
    o.value = m;
    o.textContent = hasData ? `หมู่ที่ ${m} ${officialName}` : `หมู่ที่ ${m} ${officialName} (ยังไม่มีข้อมูลสำรวจ)`;
    if(!hasData) o.classList.add('opt-nodata');
    elMoo.appendChild(o);
  }
  elMoo.addEventListener('change', e=>{ state.moo = e.target.value; exitFocusSilent(); renderAll(); });

  const types = [...new Set(DATA.map(d=>d.type))];
  const elType = document.getElementById('fType');
  types.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; elType.appendChild(o); });
  elType.addEventListener('change', e=>{ state.type = e.target.value==='all' ? null : e.target.value; exitFocusSilent(); renderAll(); });

  document.getElementById('fStatus').addEventListener('change', e=>{ state.status = e.target.value==='all' ? null : e.target.value; exitFocusSilent(); renderAll(); });

  document.getElementById('probFilterClear').addEventListener('click', ()=>{ state.problem=null; exitFocusSilent(); renderAll(); });

  document.getElementById('txtSearch').addEventListener('input', e => {
    state.search = e.target.value;
    exitFocusSilent();
    renderAll();
  });

  initKPIClicks();
  initLayerPanel();
}

function initKPIClicks(){
  document.querySelectorAll('.kpi[data-kpi]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const key = el.dataset.kpi;
      if(key==='count'){
        state.moo='all'; state.type=null; state.problem=null; state.status=null; state.search='';
        document.getElementById('txtSearch').value='';
        state.kpiFocus = null;
      } else if(key==='broken'){
        state.status = (state.status==='ชำรุด') ? null : 'ชำรุด';
        state.kpiFocus = (state.kpiFocus==='broken') ? null : 'broken';
      } else {
        // types / vol / avg: no hard filter, just toggle the analysis panel
        state.kpiFocus = (state.kpiFocus===key) ? null : key;
      }
      exitFocusSilent();
      renderAll();
    });
  });
}

function syncToolbar(){
  document.getElementById('fMoo').value = state.moo;
  document.getElementById('fType').value = state.type || 'all';
  document.getElementById('fStatus').value = state.status || 'all';
  const note = document.getElementById('probFilterNote');
  if(state.problem){
    note.style.display = 'flex';
    document.getElementById('probFilterLabel').textContent = state.problem;
  } else {
    note.style.display = 'none';
  }
  document.querySelectorAll('.kpi[data-kpi]').forEach(el=>{
    const key = el.dataset.kpi;
    let isActive = false;
    if(key==='broken') isActive = state.status==='ชำรุด';
    else isActive = state.kpiFocus===key;
    el.classList.toggle('active', isActive);
  });
}

let chartType, chartVol, chartProb, map, markersLayer, markerRefs={};

function initCharts(){
  chartType = new Chart(document.getElementById('chartType'), {
    type:'doughnut',
    data:{ labels:[], datasets:[{ data:[], backgroundColor:[], borderWidth:2, borderColor:'#fff' }] },
    options:{
      plugins:{legend:{display:false}}, cutout:'62%', maintainAspectRatio:false,
      onClick:(evt,els)=>{
        if(!els.length) return;
        const label = chartType.data.labels[els[0].index];
        state.type = (state.type===label) ? null : label;
        exitFocusSilent();
        renderAll();
      },
      onHover:(evt,els)=>{ evt.native.target.style.cursor = els.length? 'pointer':'default'; }
    }
  });
  chartVol = new Chart(document.getElementById('chartVol'), {
    type:'bar',
    data:{ labels:[], datasets:[{ data:[], backgroundColor:[], borderRadius:6, maxBarThickness:28 }] },
    options:{
      plugins:{legend:{display:false}}, maintainAspectRatio:false,
      scales:{ x:{ticks:{font:{size:9},maxRotation:30},grid:{display:false}}, y:{ticks:{font:{size:9}},grid:{color:'#eef2f2'}} },
      onClick:(evt,els)=>{
        if(!els.length) return;
        const label = chartVol.data.labels[els[0].index];
        state.type = (state.type===label) ? null : label;
        exitFocusSilent();
        renderAll();
      },
      onHover:(evt,els)=>{ evt.native.target.style.cursor = els.length? 'pointer':'default'; }
    }
  });
  chartProb = new Chart(document.getElementById('chartProb'), {
    type:'doughnut',
    data:{ labels:[], datasets:[{ data:[], backgroundColor:[], borderWidth:2, borderColor:'#fff' }] },
    options:{
      plugins:{legend:{display:false}}, cutout:'62%', maintainAspectRatio:false,
      onClick:(evt,els)=>{
        if(!els.length) return;
        const label = chartProb.data.labels[els[0].index];
        state.problem = (state.problem===label) ? null : label;
        exitFocusSilent();
        renderAll();
      },
      onHover:(evt,els)=>{ evt.native.target.style.cursor = els.length? 'pointer':'default'; }
    }
  });

  map = L.map('mapbox', {scrollWheelZoom:false}).setView([19.06,99.94],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18, attribution:'&copy; OpenStreetMap'}).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  initMapFullscreenControl();
}

// ปุ่มขยาย/ย่อแผนที่เต็มจอ ต่อจากปุ่มลบ (−) ในแถบควบคุมซูม — เป็นกล่องแยกต่างหาก เว้นระยะห่างอัตโนมัติตามสไตล์ปกติของ Leaflet
// ใช้ CSS (position:fixed) แทน Fullscreen API ของเบราว์เซอร์ เพราะ requestFullscreen() ใช้ไม่ได้เมื่อไฟล์ถูกแสดงผลอยู่ใน iframe ที่ไม่ได้อนุญาต allow="fullscreen" (เช่น หน้าพรีวิวไฟล์บางแบบ) ทำให้กดแล้วไม่มีอะไรเกิดขึ้น
function initMapFullscreenControl(){
  const FullscreenControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function(){
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const link = L.DomUtil.create('a', 'map-fullscreen-btn', container);
      link.href = '#';
      link.title = 'ขยายแผนที่เต็มจอ';
      link.setAttribute('role', 'button');
      link.setAttribute('aria-label', 'ขยายแผนที่เต็มจอ');
      link.innerHTML = '⛶';
      L.DomEvent.disableClickPropagation(link);
      L.DomEvent.on(link, 'click', e=>{
        L.DomEvent.stop(e);
        toggleMapFullscreen(link);
      });
      return container;
    }
  });
  map.addControl(new FullscreenControl());

  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && getMapFullscreenTarget().classList.contains('pseudo-fullscreen')){
      toggleMapFullscreen();
    }
  });
}

function getMapFullscreenTarget(){
  return document.getElementById('mapbox').closest('.card');
}

function toggleMapFullscreen(link){
  const el = getMapFullscreenTarget();
  const isFs = el.classList.toggle('pseudo-fullscreen');
  document.body.classList.toggle('map-fs-lock', isFs);

  const btn = link || document.querySelector('.map-fullscreen-btn');
  if(btn){
    btn.innerHTML = isFs ? '⤡' : '⛶';
    btn.title = isFs ? 'ย่อแผนที่กลับปกติ' : 'ขยายแผนที่เต็มจอ';
  }
  setTimeout(()=>{ if(map) map.invalidateSize(); }, 200);
}

function fmtNum(n){
  if(n==null || isNaN(n)) return '0';
  if(n>=1e6) return (n/1e6).toFixed(1)+'M'; 
  if(n>=1e3) return (n/1e3).toFixed(1)+'K'; 
  return Math.round(n*10)/10; 
}

function driveFileId(url){ const m = (url||'').match(/id=([\w-]+)/); return m ? m[1] : null; }
function driveCandidates(id){
  return [
    `https://lh3.googleusercontent.com/d/${id}=w1000`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://drive.google.com/uc?export=view&id=${id}`
  ];
}
const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='300' height='200' fill='%23eef4f4'/><text x='50%25' y='50%25' font-size='13' fill='%235b7787' text-anchor='middle' dy='.3em'>ไม่พบรูปภาพประกอบ</text></svg>";
function handleImgFallback(imgEl){
  const idx = Number(imgEl.dataset.attempt || 0);
  const list = JSON.parse(imgEl.dataset.candidates || '[]');
  if(idx < list.length - 1){
    imgEl.dataset.attempt = idx + 1;
    imgEl.src = list[idx + 1];
  } else {
    imgEl.onerror = null;
    imgEl.src = PLACEHOLDER_IMG;
  }
}
function escapeAttr(s){ return String(s||'').replace(/'/g,"&apos;").replace(/"/g,"&quot;"); }
function driveImgTag(imageUrl, cls, altText){
  const id = driveFileId(imageUrl);
  if(!id) return `<img class="${cls}" src="${PLACEHOLDER_IMG}" alt="${altText}">`;
  const cands = driveCandidates(id);
  const safeAlt = escapeAttr(altText);
  return `<img class="${cls}" src="${cands[0]}" alt="${safeAlt}" data-attempt="0" data-candidates='${JSON.stringify(cands).replace(/'/g,"&apos;")}' onerror="handleImgFallback(this)" onclick="openImageModal(this.currentSrc || this.src, '${safeAlt}')">`;
}

function openImageModal(src, caption){
  if(!src || src.indexOf('data:image/svg') === 0) return;
  document.getElementById('imgModalImg').src = src;
  document.getElementById('imgModalCaption').textContent = caption || '';
  document.getElementById('imgModalBg').classList.add('open');
}
function closeImageModal(){
  document.getElementById('imgModalBg').classList.remove('open');
  document.getElementById('imgModalImg').src = '';
}

function getSafeVolume(r) {
  if(r.volumn && r.volumn > 0) return r.volumn;
  const w = r.width || 0;
  const l = r.length || 0;
  const d = r.depthNet || r.depth || 0;
  
  if(r.type === 'บ่อบาดาล') {
    const radius = w / 2;
    return Math.PI * Math.pow(radius, 2) * d;
  }
  return w * l * d;
}

function updateDSSPanel() {
  const dssBoard = document.getElementById('dssBoard');
  const dssContent = document.getElementById('dssContent');
  const dssTitleText = document.getElementById('dssTitleText');
  const dssResetBtn = document.getElementById('dssResetBtn');

  if (state.focusId != null) {
    const r = DATA.find(x => x.id === state.focusId);
    if (!r) return;

    dssTitleText.innerHTML = `🔮 ผลการประเมิน DSS เฉพาะจุด: <b>${r.name}</b>`;
    dssResetBtn.style.display = 'inline-block';

    const problems = (r.problem || '').split(',').map(s => s.trim()).filter(Boolean);
    let analysisItems = [];
    let adviceItems = [];
    let hasIssues = false;

    if (r.depth > 0 && r.depthNet < r.depth) {
      const lossPct = Math.round((1 - (r.depthNet / r.depth)) * 100);
      if (lossPct > 0) {
        hasIssues = true;
        analysisItems.push(`<li>⚠️ <b>ความจุลดลง ${lossPct}%:</b> เกิดตะกอนทับถมก้นแหล่งน้ำทำให้ตื้นเขินกว่าสเปกออกแบบเดิม</li>`);
        adviceItems.push(`<li>เสนอโครงการขุดลอก (Dredging) ด่วน เพื่อคืนความจุเต็มประสิทธิภาพรับหน้าน้ำ</li>`);
      }
    }

    problems.forEach(prob => {
      if (prob === 'ชำรุด') {
        hasIssues = true;
        analysisItems.push(`<li>🚨 <b>โครงสร้างเสียหาย:</b> ตัวฝาย/ประตูน้ำเกิดรอยร้าว ทรุดตัว เสี่ยงต่อการพังถาวรเมื่อน้ำหลาก</li>`);
        adviceItems.push(`<li><b>[เร่งด่วนที่สุด]</b> ส่งวิศวกรท้องถิ่นสแกนรอยร้าวและเทคอนกรีตเสริมโครงสร้างทันทีก่อนฤดูฝน</li>`);
      }
      if (prob === 'วัชพืชปกคลุม') {
        hasIssues = true;
        const area = (r.width || 0) * (r.length || 0);
        const areaText = area > 0 ? ` (พื้นที่ราว ${area.toLocaleString()} ตร.ม.)` : '';
        analysisItems.push(`<li>🌿 <b>วัชพืชหนาแน่น${areaText}:</b> เร่งน้ำระเหยตัว/คายน้ำไวกว่าปกติ 1.5 - 2 เท่า และกีดขวางทางน้ำไหล</li>`);
        adviceItems.push(`<li>ประสานงานกลุ่มผู้ใช้น้ำชุมชนจัดกิจกรรมตักลอกวัชพืชเปิดหน้าผิวน้ำโล่ง และนำไปทำปุ๋ยอินทรีย์</li>`);
      }
      if (prob === 'น้ำเน่าเสีย' || prob === 'น้ำมีสี') {
        hasIssues = true;
        analysisItems.push(`<li>💧 <b>วิกฤตคุณภาพน้ำ:</b> คุณภาพน้ำเสื่อมโทรม หมักหมม หรือเปลี่ยนสี ไม่ผ่านมาตรฐานอุปโภค</li>`);
        adviceItems.push(`<li>ตรวจสอบการระบายน้ำเสียต้นน้ำ และนำกังหันน้ำ/น้ำหมัก EM ลงช่วยบำบัดฟื้นฟูเบื้องต้น</li>`);
      }
    });

    if (!hasIssues) {
      analysisItems.push(`<li>✅ โครงสร้าง ระบบตะกอน และทางกายภาพสมบูรณ์ดี</li>`);
      adviceItems.push(`<li>รักษามาตรฐานการจัดการ และเฝ้าระวังภัยพิบัติตามรอบวงปีปกติ</li>`);
      dssBoard.style.borderLeftColor = 'var(--emerald)';
    } else {
      dssBoard.style.borderLeftColor = problems.includes('ชำรุด') || problems.includes('น้ำเน่าเสีย') ? 'var(--danger)' : 'var(--amber)';
    }

    dssContent.innerHTML = `
      <div class="dss-grid">
        <div class="dss-block">
          <div class="dss-block-title">📊 ปัญหาและผลกระทบทางกายภาพ</div>
          <ul class="dss-list">${analysisItems.join('')}</ul>
        </div>
        <div class="dss-block">
          <div class="dss-block-title" style="color:var(--channel);">🛠️ มาตรการแก้ไขสเปกเฉพาะจุด</div>
          <ul class="dss-list">${adviceItems.join('')}</ul>
        </div>
      </div>
    `;

  } else {
    const currentRows = filtered();
    dssTitleText.innerHTML = `🔮 สารสนเทศวิเคราะห์ผลกระทบและข้อแนะนำ (สรุปภาพรวมพื้นที่ตามตัวกรอง)`;
    dssResetBtn.style.display = 'none';
    dssBoard.style.borderLeftColor = 'var(--channel)';

    if (!currentRows.length) {
      dssContent.innerHTML = `<div class="dss-empty">ไม่มีข้อมูลแหล่งน้ำให้ประมวลผลระบบแนะนำ</div>`;
      return;
    }

    let totalSiltLossCount = 0;
    let weedCoveredCount = 0;
    let structuralBrokenCount = 0;
    let waterPollutedCount = 0;

    currentRows.forEach(r => {
      if (r.depth > 0 && r.depthNet < r.depth) totalSiltLossCount++;
      const probs = (r.problem || '');
      if (probs.includes('วัชพืชปกคลุม')) weedCoveredCount++;
      if (probs.includes('ชำรุด')) structuralBrokenCount++;
      if (probs.includes('น้ำเน่าเสีย') || probs.includes('น้ำมีสี')) waterPollutedCount++;
    });

    let overallAnalysis = [];
    let overallAdvice = [];

    if (structuralBrokenCount > 0) {
      overallAnalysis.push(`<li>พบจุดเสียหายเชิงโครงสร้าง/ชำรุดวิกฤต <b>${structuralBrokenCount} จุด</b> ในกลุ่มที่เลือก</li>`);
      overallAdvice.push(`<li><b>[ยุทธศาสตร์เร่งด่วน]</b> โยกงบประมาณซ่อมแซมเร่งด่วนเพื่อป้องกันฝายและประตูน้ำพังเสียหายในหน้าน้ำหลาก</li>`);
    }
    if (totalSiltLossCount > 0) {
      overallAnalysis.push(`<li>เกิดปัญหาตื้นเขินจากตะกอนสะสมสะสมก้นแหล่งน้ำรวม <b>${totalSiltLossCount} แห่ง</b> (สูญเสียพื้นที่รวมคาดการณ์ 28 แห่ง)</li>`);
      overallAdvice.push(`<li>จัดลำดับความสำคัญ (Prioritization) แหล่งน้ำตื้นเขินเพื่อจัดคิวรถแบคโฮเข้าลอกตะกอนดินคืนความจุ</li>`);
    }
    if (weedCoveredCount > 0) {
      overallAnalysis.push(`<li>มีวัชพืชหนาแน่นเร่งอัตราสูญเสียน้ำจากการระเหยรวม <b>${weedCoveredCount} จุด</b></li>`);
      overallAdvice.push(`<li>จัดแผนรณรงค์สัปดาห์สิ่งแวดล้อมท้องถิ่น ปล่อยเครื่องจักรและแรงงานตักลอกผักตบชวา</li>`);
    }
    if (waterPollutedCount > 0) {
      overallAnalysis.push(`<li>พบปัญหาเสื่อมโทรมด้านคุณภาพน้ำเน่าเสีย/เปลี่ยนสี <b>${waterPollutedCount} แห่ง</b></li>`);
      overallAdvice.push(`<li>สแกนตรวจสอบพื้นที่อุตสาหกรรม/เกษตรเคมีต้นน้ำ เพื่อคุมเข้มการปล่อยน้ำทิ้งลงสู่แหล่งน้ำสาธารณะ</li>`);
    }

    if (overallAnalysis.length === 0) {
      overallAnalysis.push(`<li>กลุ่มแหล่งน้ำคัดกรองทั้งหมดอยู่ในเกณฑ์สมบูรณ์ พร้อมรับมือฤดูแล้ง/น้ำหลาก</li>`);
      overallAdvice.push(`<li>ดำเนินแผนบำรุงรักษาเชิงป้องกัน (Preventive Maintenance) รักษาระดับความลึกตามแผนประจำปี</li>`);
    }

    dssContent.innerHTML = `
      <div class="dss-grid">
        <div class="dss-block">
          <div class="dss-block-title">📊 ปัญหาผลกระทบที่ตรวจพบรวมในเขตคัดกรอง</div>
          <ul class="dss-list">${overallAnalysis.join('')}</ul>
        </div>
        <div class="dss-block">
          <div class="dss-block-title" style="color:var(--channel);">🛠️ ข้อแนะนำยุทธศาสตร์การบริหารงบประมาณ</div>
          <ul class="dss-list">${overallAdvice.join('')}</ul>
        </div>
      </div>
    `;
  }
}

function renderAll(){
  syncToolbar();
  const mapRows = mapVisibleRows(filtered());

  markersLayer.clearLayers(); markerRefs = {};
  const bounds = [];
  mapRows.forEach(r=>{
    if(r.lat==null||r.lng==null) return;
    const icon = makeIcon(r, state.focusId===r.id);
    const m = L.marker([r.lat,r.lng], {icon}).bindPopup(buildPopupHTML(r), {maxWidth:275, minWidth:255, autoPan:true, keepInView:true});
    m.on('click', ()=>{ setFocus(r.id); });
    m.addTo(markersLayer);
    markerRefs[r.id]=m;
    bounds.push([r.lat,r.lng]);
  });
  
  if(bounds.length && !state.focusId) {
    map.fitBounds(bounds,{padding:[30,30]});
  } else if(!bounds.length && !state.focusId) {
    map.setView([19.06,99.94],12);
  }

  renderPanels(focusedRows());
}

function renderPanels(rows){
  document.getElementById('statCount').textContent = rows.length;
  document.getElementById('statTypes').textContent = new Set(rows.map(r=>r.type)).size;
  document.getElementById('statBroken').textContent = rows.filter(r=>(r.problem||'').includes('ชำรุด')).length;
  
  const totalVol = rows.reduce((s,r)=>s+getSafeVolume(r),0);
  document.getElementById('statVol').textContent = fmtNum(totalVol);
  document.getElementById('statAvgVol').textContent = rows.length ? fmtNum(totalVol/rows.length) : '-';

  const typeCount = {}; rows.forEach(r=>{ typeCount[r.type]=(typeCount[r.type]||0)+1; });
  const tLabels = Object.keys(typeCount);
  chartType.data.labels = tLabels;
  chartType.data.datasets[0].data = tLabels.map(t=>typeCount[t]);
  chartType.data.datasets[0].backgroundColor = tLabels.map(t=> state.type && state.type!==t ? '#dde6e6' : colorFor(t));
  chartType.update();
  
  document.getElementById('legType').innerHTML = tLabels.map(t=>{
    const active = state.type===t;
    return `<span class="${active?'active':''}" data-t="${t}"><i style="background:${colorFor(t)}"></i>${t}</span>`;
  }).join('');
  [...document.getElementById('legType').children].forEach(el=>{
    el.addEventListener('click', ()=>{ const t=el.dataset.t; state.type = state.type===t?null:t; exitFocusSilent(); renderAll(); });
  });

  const volByType = {}; rows.forEach(r=>{ volByType[r.type]=(volByType[r.type]||0)+getSafeVolume(r); });
  const vLabels = Object.keys(volByType);
  chartVol.data.labels = vLabels;
  chartVol.data.datasets[0].data = vLabels.map(t=>volByType[t]);
  chartVol.data.datasets[0].backgroundColor = vLabels.map(t=> state.type && state.type!==t ? '#dde6e6' : colorFor(t));
  chartVol.update();

  const probCount = {};
  rows.forEach(r=>{ (r.problem||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>{ probCount[p]=(probCount[p]||0)+1; }); });
  const pLabels = Object.keys(probCount);
  chartProb.data.labels = pLabels;
  chartProb.data.datasets[0].data = pLabels.map(p=>probCount[p]);
  chartProb.data.datasets[0].backgroundColor = pLabels.map((p,i)=> state.problem && state.problem!==p ? '#dde6e6' : probColor(p,i));
  chartProb.update();
  const totalTags = pLabels.reduce((s,p)=>s+probCount[p],0) || 1;
  document.getElementById('legProb').innerHTML = pLabels.map((p,i)=>{
    const active = state.problem===p;
    return `<span class="${active?'active':''}" data-p="${p}"><i style="background:${probColor(p,i)}"></i>${p} (${Math.round(probCount[p]/totalTags*100)}%)</span>`;
  }).join('');
  [...document.getElementById('legProb').children].forEach(el=>{
    el.addEventListener('click', ()=>{ const p=el.dataset.p; state.problem = state.problem===p?null:p; exitFocusSilent(); renderAll(); });
  });

  renderTable(rows);
  if(state.focusId) highlightTableRow(state.focusId);

  updateDSSPanel();
  renderKpiInsight(rows);
}

function renderKpiInsight(rows){
  const box = document.getElementById('kpiInsight');
  if(!rows.length){
    box.innerHTML = `<div class="ki-title">💡 คำอธิบาย</div>${noDataMessage()} หรือคลิกการ์ด "แหล่งน้ำที่พบ" เพื่อล้างตัวกรองทั้งหมด`;
    return;
  }
  const key = state.kpiFocus;
  let title = '💡 คำอธิบาย';
  let body = 'คลิกที่การ์ดด้านบนเพื่อดูการวิเคราะห์เชิงลึกของตัวเลขแต่ละตัว หรือกรองข้อมูลทั้งหน้าตามการ์ดนั้น';

  if(key==='types'){
    const typeCount = {};
    rows.forEach(r=>{ typeCount[r.type]=(typeCount[r.type]||0)+1; });
    const sorted = Object.entries(typeCount).sort((a,b)=>b[1]-a[1]);
    const top = sorted[0];
    title = '💡 ประเภทแหล่งน้ำที่พบ คืออะไร';
    body = `นับจำนวน "ประเภท" ของแหล่งน้ำที่แตกต่างกันในกลุ่มที่กรองอยู่ (ตำบลแม่กามีทั้งหมด 6 ประเภท: ฝาย, บ่อบาดาล, สระน้ำ/บ่อน้ำ, อ่างเก็บน้ำ, ประตูน้ำ, สถานีสูบน้ำไฟฟ้า) ขณะนี้พบ <b>${sorted.length} ประเภท</b> จากทั้งหมด รายละเอียด: ` +
      sorted.map(([t,c])=>`<b>${t}</b> ${c} จุด (${Math.round(c/rows.length*100)}%)`).join(', ') +
      `. ประเภทที่มีมากที่สุดคือ <b>${top[0]}</b> ซึ่งอาจสะท้อนรูปแบบแหล่งน้ำหลักของพื้นที่นี้ ใช้ประกอบวางแผนงบซ่อมบำรุงตามประเภทโครงสร้าง`;
  } else if(key==='broken'){
    const broken = rows.filter(r=>getUsageStatus(r)==='ชำรุด');
    title = '🚨 จุดชำรุดเสียหาย';
    if(broken.length){
      body = `พบ <b>${broken.length} จุด</b> ที่มีแท็กปัญหา "ชำรุด" ได้แก่ ` + broken.map(r=>`<b>${r.name}</b> (หมู่ ${r.moo} บ้าน${r.village})`).join(', ') +
        `. จุดเหล่านี้ควรได้รับการซ่อมแซมเร่งด่วนก่อนฤดูน้ำหลากเพื่อลดความเสี่ยงโครงสร้างพังเสียหาย (กดการ์ดนี้ซ้ำเพื่อยกเลิกตัวกรอง)`;
    } else {
      body = 'ไม่พบจุดที่มีแท็กปัญหา "ชำรุด" ในกลุ่มข้อมูลที่กรองอยู่ขณะนี้';
    }
  } else if(key==='vol'){
    const volByType = {};
    rows.forEach(r=>{ volByType[r.type]=(volByType[r.type]||0)+getSafeVolume(r); });
    const totalVol = rows.reduce((s,r)=>s+getSafeVolume(r),0);
    const sorted = Object.entries(volByType).sort((a,b)=>b[1]-a[1]);
    const top = sorted[0];
    title = '💡 ความจุรวม มาจากไหน';
    body = `เป็นผลรวมปริมาตรน้ำสุทธิ (ลบ.ม.) ของทุกจุดในกลุ่มที่กรองอยู่ คำนวณจากปริมาตรที่บันทึกไว้จริง หรือประมาณจาก กว้าง×ยาว×ความลึกปัจจุบัน หากไม่มีข้อมูล ประเภทที่ถือครองความจุมากที่สุดคือ <b>${top[0]}</b> ด้วย ${top[1].toLocaleString('th-TH',{maximumFractionDigits:0})} ลบ.ม. หรือคิดเป็น <b>${Math.round(top[1]/totalVol*100)}%</b> ของความจุรวมทั้งหมด — ตัวเลขนี้ช่วยชี้เป้าว่าแหล่งน้ำประเภทใดควรได้รับการดูแลรักษาความจุเป็นพิเศษ`;
  } else if(key==='avg'){
    const totalVol = rows.reduce((s,r)=>s+getSafeVolume(r),0);
    const avg = totalVol/rows.length;
    const above = rows.filter(r=>getSafeVolume(r)>avg).length;
    title = '💡 ค่าเฉลี่ยต่อแหล่ง คำนวณอย่างไร';
    body = `คำนวณจาก ความจุรวม ÷ จำนวนแหล่งน้ำที่กรองอยู่ (${fmtNum(totalVol)} ÷ ${rows.length} = ${fmtNum(avg)} ลบ.ม./แหล่ง) ค่าเฉลี่ยนี้อาจถูกดึงสูงขึ้นจากแหล่งน้ำขนาดใหญ่ไม่กี่แห่ง เช่น อ่างเก็บน้ำ — มี <b>${above} จุด</b> ที่มีปริมาตรมากกว่าค่าเฉลี่ย จากทั้งหมด ${rows.length} จุด จึงควรดูค่ามัธยฐานหรือกระจายตามประเภทประกอบด้วยเมื่อใช้ตัดสินใจ`;
  }

  box.innerHTML = `<div class="ki-title">${title}</div>${body}`;
}

function renderMapLegendStatic(){
  const typeHtml = `<span><b>ประเภท:</b></span>` + ALL_TYPES.map(t=>`<span><i style="background:${colorFor(t)}"></i>${iconFor(t)} ${t}</span>`).join('');
  const statusHtml = `<span><b>สถานะ:</b></span>` + ALL_STATUSES.map(s=>`<span><i style="background:${STATUS_COLORS[s]||'#999'}"></i>${s}</span>`).join('') +
    `<span><b>สัญลักษณ์เตือน:</b></span><span>🔧 ชำรุด</span><span>⚠️ พบปัญหาอื่น</span>`;
  document.getElementById('mapLegendStatic').innerHTML = typeHtml + statusHtml;
}

function initLayerPanel(){
  const btn = document.getElementById('layerBtn');
  const panel = document.getElementById('layerPanel');
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    panel.classList.toggle('open');
    btn.classList.toggle('open');
  });
  document.addEventListener('click', (e)=>{
    if(!panel.contains(e.target) && e.target!==btn){ panel.classList.remove('open'); btn.classList.remove('open'); }
  });
  panel.addEventListener('click', e=>e.stopPropagation());

  // checkbox หัวข้อ "ประเภทแหล่งน้ำ" / "สถานะการใช้งาน" / "ตัวกรองปัญหาที่พบเจอ" ใช้เป็นปุ่มลัด "เลือกทั้งหมด/ยกเลิกทั้งหมด" ของกลุ่มนั้น
  // (ค่าที่กรองจริงมาจาก checkbox ย่อยแต่ละอันเสมอ ไม่ต้องรอเปิดหัวข้อก่อน)
  document.getElementById('lpTypeOn').addEventListener('change', e=>{
    layerState.types = e.target.checked ? new Set(ALL_TYPES) : new Set();
    buildLayerList('lpTypeList', ALL_TYPES, layerState.types, colorFor, 'lpTypeOn');
    renderAll();
  });
  document.getElementById('lpStatusOn').addEventListener('change', e=>{
    layerState.statuses = e.target.checked ? new Set(LAYER_STATUS_GROUPS) : new Set();
    buildLayerList('lpStatusList', LAYER_STATUS_GROUPS, layerState.statuses, t=>STATUS_GROUP_COLORS[t]||'#999', 'lpStatusOn');
    renderAll();
  });
  document.getElementById('lpProblemOn').addEventListener('change', e=>{
    layerState.problems = e.target.checked ? new Set(ALL_PROBLEMS) : new Set();
    buildLayerList('lpProblemList', ALL_PROBLEMS, layerState.problems, problemLayerColor, 'lpProblemOn');
    renderAll();
  });

  buildLayerList('lpTypeList', ALL_TYPES, layerState.types, colorFor, 'lpTypeOn');
  buildLayerList('lpStatusList', LAYER_STATUS_GROUPS, layerState.statuses, t=>STATUS_GROUP_COLORS[t]||'#999', 'lpStatusOn');
  buildLayerList('lpProblemList', ALL_PROBLEMS, layerState.problems, problemLayerColor, 'lpProblemOn');
  buildLayerList('lpVillageList', ALL_VILLAGES, layerState.villages, ()=>'#5b7787');

  document.getElementById('lpTypeAll').addEventListener('click', ()=>{ layerState.types=new Set(ALL_TYPES); buildLayerList('lpTypeList', ALL_TYPES, layerState.types, colorFor, 'lpTypeOn'); renderAll(); });
  document.getElementById('lpTypeNone').addEventListener('click', ()=>{ layerState.types=new Set(); buildLayerList('lpTypeList', ALL_TYPES, layerState.types, colorFor, 'lpTypeOn'); renderAll(); });
  document.getElementById('lpStatusAll').addEventListener('click', ()=>{ layerState.statuses=new Set(LAYER_STATUS_GROUPS); buildLayerList('lpStatusList', LAYER_STATUS_GROUPS, layerState.statuses, t=>STATUS_GROUP_COLORS[t]||'#999', 'lpStatusOn'); renderAll(); });
  document.getElementById('lpStatusNone').addEventListener('click', ()=>{ layerState.statuses=new Set(); buildLayerList('lpStatusList', LAYER_STATUS_GROUPS, layerState.statuses, t=>STATUS_GROUP_COLORS[t]||'#999', 'lpStatusOn'); renderAll(); });
  document.getElementById('lpProblemAll').addEventListener('click', ()=>{ layerState.problems=new Set(ALL_PROBLEMS); buildLayerList('lpProblemList', ALL_PROBLEMS, layerState.problems, problemLayerColor, 'lpProblemOn'); renderAll(); });
  document.getElementById('lpProblemNone').addEventListener('click', ()=>{ layerState.problems=new Set(); buildLayerList('lpProblemList', ALL_PROBLEMS, layerState.problems, problemLayerColor, 'lpProblemOn'); renderAll(); });
  document.getElementById('lpVillageAll').addEventListener('click', ()=>{ layerState.villages=new Set(ALL_VILLAGES); buildLayerList('lpVillageList', ALL_VILLAGES, layerState.villages, ()=>'#5b7787'); renderAll(); });
  document.getElementById('lpVillageNone').addEventListener('click', ()=>{ layerState.villages=new Set(); buildLayerList('lpVillageList', ALL_VILLAGES, layerState.villages, ()=>'#5b7787'); renderAll(); });

  renderMapLegendStatic();
}

function syncMasterCheckbox(masterId, selectedSet, allItems){
  const master = document.getElementById(masterId);
  if(!master) return;
  if(selectedSet.size===0){ master.checked=false; master.indeterminate=false; }
  else if(selectedSet.size===allItems.length){ master.checked=true; master.indeterminate=false; }
  else { master.checked=false; master.indeterminate=true; }
}

function buildLayerList(elId, items, selectedSet, colorFn, masterId){
  const el = document.getElementById(elId);
  el.innerHTML = items.map(v=>{
    const checked = selectedSet.has(v) ? 'checked' : '';
    return `<label class="lp-item"><input type="checkbox" data-v="${escapeAttr(v)}" ${checked}><span class="lp-dot" style="background:${colorFn(v)}"></span>${v}</label>`;
  }).join('');
  [...el.querySelectorAll('input[type=checkbox]')].forEach(cb=>{
    cb.addEventListener('change', e=>{
      const v = e.target.dataset.v;
      if(e.target.checked) selectedSet.add(v); else selectedSet.delete(v);
      if(masterId) syncMasterCheckbox(masterId, selectedSet, items);
      renderAll();
    });
  });
  if(masterId) syncMasterCheckbox(masterId, selectedSet, items);
}

function makeIcon(r, isSel){
  const size = isSel?28:22;
  const glyphSize = Math.max(8, Math.round(size*0.46));
  const badge = problemBadge(r);
  const badgeHtml = badge ? `<span class="dvicon-badge ${badge.cls}">${badge.icon}</span>` : '';
  return L.divIcon({
    className:'', html:`<div class="dvicon-wrap"><div class="dvicon ${isSel?'sel':''}" style="background:${colorFor(r.type)};width:${size}px;height:${size}px;"><span class="dvicon-glyph" style="font-size:${glyphSize}px;">${iconFor(r.type)}</span></div>${badgeHtml}</div>`,
    iconSize:[size, size]
  });
}

function setFocus(id){
  const prevId = state.focusId;
  state.focusId = id;
  if(prevId!=null && prevId!==id && markerRefs[prevId]){
    const rprev = DATA.find(x=>x.id===prevId);
    if(rprev) markerRefs[prevId].setIcon(makeIcon(rprev, false));
  }
  if(markerRefs[id]){
    const rsel = DATA.find(x=>x.id===id);
    if(rsel) markerRefs[id].setIcon(makeIcon(rsel, true));
  }
  const rec = DATA.find(x=>x.id===id);
  if(rec && rec.lat!=null){
    map.flyTo([rec.lat, rec.lng], Math.max(map.getZoom(), 15), {duration:.5});
  }
  highlightTableRow(id);
  renderPanels(focusedRows());
}

function exitFocusSilent(){
  if(state.focusId!=null && markerRefs[state.focusId]){
    const rprev = DATA.find(x=>x.id===state.focusId);
    if(rprev) markerRefs[state.focusId].setIcon(makeIcon(rprev, false));
  }
  state.focusId = null;
}

function exitFocus(){
  exitFocusSilent();
  [...document.getElementById('tblBody').children].forEach(tr=>tr.classList.remove('selected'));
  renderPanels(focusedRows());
}

function buildPopupHTML(r){
  const probs = (r.problem||'').split(',').map(s=>s.trim()).filter(Boolean)
    .map(p=>`<span class="pp-tag ${p==='ชำรุด'?'bad':''}">${p}</span>`).join('');
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
  const fileId = driveFileId(r.image);
  const imgHtml = fileId ? `<div class="pp-imgwrap">${driveImgTag(r.image, 'pp-img', r.name)}</div>` : '';
  
  return `
  <div class="pp">
    ${imgHtml}
    <div class="pp-title">${r.name}</div>
    <div class="pp-row"><span>ประเภท</span><b>${r.type}</b></div>
    <div class="pp-row"><span>ตำแหน่ง</span><b>หมู่ ${r.moo} บ้าน${r.village}</b></div>
    <div class="pp-row"><span>ขนาด (ก×ย×ล)</span><b>${r.width||0}×${r.length||0}×${r.depth||0} ม.</b></div>
    <div class="pp-row"><span>ความลึกปัจจุบัน</span><b>${r.depthNet||0} ม. (เดิม ${r.depth||0} ม.)</b></div>
    <div class="pp-row"><span>ปริมาตรน้ำสุทธิ</span><b>${getSafeVolume(r).toLocaleString()} ลบ.ม.</b></div>
    <div class="pp-row"><span>เจ้าของ/ผู้ดูแล</span><b>${r.owner||'-'}</b></div>
    ${r.note && r.note!=='ไม่มี' ? `<div class="pp-row"><span>หมายเหตุ</span><b>${r.note}</b></div>` : ''}
    <div class="pp-probs">${probs}</div>
    <a class="pp-nav" href="${navUrl}" target="_blank" rel="noopener">🧭 เปิดระบบนำทางไปยังจุดนี้</a>
  </div>`;
}

function noDataMessage(){
  if(state.moo!=='all' && DATA.filter(d=>String(d.moo)===String(state.moo)).length===0){
    const officialName = OFFICIAL_VILLAGE_BY_MOO[Number(state.moo)] || '';
    return `📭 ยังไม่มีข้อมูลสำรวจแหล่งน้ำในหมู่ที่ ${state.moo} ${officialName} — ทีมสำรวจยังไม่ได้ลงพื้นที่เก็บข้อมูลหมู่นี้`;
  }
  return '📭 ไม่พบแหล่งน้ำที่ตรงกับตัวกรองที่เลือกไว้ ลองปรับตัวกรองใหม่';
}

function renderTable(rows){
  if(!rows.length){
    document.getElementById('tblBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:22px 10px;color:var(--sub);font-style:italic;">${noDataMessage()}</td></tr>`;
    document.getElementById('tblCount').textContent = '0 รายการ';
    return;
  }
  document.getElementById('tblBody').innerHTML = rows.map(r=>{
    const probs = (r.problem||'').split(',').map(s=>s.trim()).filter(Boolean).map(p=>`<span class="tag ${p==='ชำรุด'?'bad':''}">${p}</span>`).join('');
    return `<tr data-id="${r.id}"><td>${r.type}</td><td>${r.name}</td><td>บ้าน${r.village}</td><td>${getSafeVolume(r).toLocaleString('th-TH',{maximumFractionDigits:1})}</td><td>${r.moo}</td><td>${probs}</td></tr>`;
  }).join('');
  document.getElementById('tblCount').textContent = `${rows.length} รายการ`;
  [...document.getElementById('tblBody').children].forEach(tr=>{
    tr.addEventListener('click', ()=>{
      const id = Number(tr.dataset.id);
      setFocus(id);
      if(markerRefs[id]) markerRefs[id].openPopup();
    });
  });
}

function highlightTableRow(id){
  [...document.getElementById('tblBody').children].forEach(tr=>{
    tr.classList.toggle('selected', Number(tr.dataset.id)===id);
  });
}

let modalChart = null;
const CHART_TITLES = { type:'สัดส่วนประเภทแหล่งน้ำ', vol:'ปริมาตรรวมแยกตามประเภท (ลบ.ม.)', prob:'การวิเคราะห์สภาพปัญหา' };
function sourceChartFor(key){ return key==='type' ? chartType : key==='vol' ? chartVol : chartProb; }

function openChartModal(key){
  const src = sourceChartFor(key);
  document.getElementById('chartModalTitle').textContent = CHART_TITLES[key];
  document.getElementById('chartModalBg').classList.add('open');

  if(modalChart){ modalChart.destroy(); modalChart = null; }
  const ctx = document.getElementById('chartModalCanvas');
  const isDonut = src.config.type === 'doughnut';
  modalChart = new Chart(ctx, {
    type: src.config.type,
    data: JSON.parse(JSON.stringify(src.data)),
    options: {
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      cutout: isDonut ? '58%' : undefined,
      scales: isDonut ? undefined : {
        x:{ ticks:{font:{size:11}, autoSkip:false, maxRotation:20}, grid:{display:false} },
        y:{ ticks:{font:{size:11}}, grid:{color:'#eef2f2'} }
      }
    }
  });

  const labels = src.data.labels;
  const colors = src.data.datasets[0].backgroundColor;
  const dataVals = src.data.datasets[0].data;
  const total = dataVals.reduce((a,b)=>a+b,0) || 1;
  document.getElementById('chartModalLegend').innerHTML = labels.map((l,i)=>{
    const pct = isDonut ? ` (${Math.round(dataVals[i]/total*100)}%)` : '';
    return `<span><i style="background:${colors[i]}"></i>${l}${pct}</span>`;
  }).join('');
}

function closeChartModal(){
  document.getElementById('chartModalBg').classList.remove('open');
  if(modalChart){ modalChart.destroy(); modalChart = null; }
}

document.querySelectorAll('.expand-btn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{ e.stopPropagation(); openChartModal(btn.dataset.chart); });
});
document.getElementById('chartModalClose').addEventListener('click', closeChartModal);
document.getElementById('chartModalBg').addEventListener('click', (e)=>{
  if(e.target.id === 'chartModalBg') closeChartModal();
});

document.getElementById('imgModalClose').addEventListener('click', closeImageModal);
document.getElementById('imgModalBg').addEventListener('click', (e)=>{
  if(e.target.id === 'imgModalBg') closeImageModal();
});

initFilters();
initCharts();
renderAll();

// ===== ตัวนับผู้เข้าชมเว็บ + แยกตามประเทศ =====
// ใช้บริการนับยอดฟรีแบบไม่ต้องสมัครสมาชิก (Abacus โดย Jason Cameron — ตรวจสอบแล้วว่ายังใช้งานได้ รองรับ CORS)
// + บริการหาประเทศจาก IP ฟรี (ipwho.is)
// หมายเหตุ: countapi.xyz ที่มักเจอในโค้ดตัวอย่างเก่าๆ ปิดตัวไปแล้ว จึงเปลี่ยนมาใช้ Abacus แทน (endpoint รูปแบบเดียวกัน: /hit และ /get)
// เป็นบริการภายนอกฟรีไม่มีสัญญาระดับการให้บริการ (SLA) หากในอนาคตบริการนี้ปิดตัว/ไม่เสถียร
// แนะนำให้เปลี่ยนไปใช้ระบบวิเคราะห์เว็บที่มีเจ้าของเป็นทางการแทน เช่น Google Analytics หรือ Cloudflare Web Analytics
initVisitorCounter();
function initVisitorCounter(){
  // เปลี่ยนชื่อ namespace นี้ได้หากต้องการแยกตัวนับเป็นหน้าใหม่ (ค่านับจะเริ่มจาก 0 ใหม่ตามชื่อ namespace ที่เปลี่ยน)
  const VC_NAMESPACE = 'pyo-water-maeka-dashboard';
  const VC_VISIT_KEY = 'pyoMaeKaVisitDate';
  // รายชื่อประเทศที่ติดตามแยกยอด (ประเทศนอกลิสต์นี้จะถูกนับรวมในกลุ่ม "อื่นๆ")
  const VC_COUNTRIES = [
    ['TH','ไทย'],['US','สหรัฐอเมริกา'],['CN','จีน'],['JP','ญี่ปุ่น'],['KR','เกาหลีใต้'],
    ['SG','สิงคโปร์'],['MY','มาเลเซีย'],['VN','เวียดนาม'],['LA','ลาว'],['MM','เมียนมา'],
    ['KH','กัมพูชา'],['PH','ฟิลิปปินส์'],['ID','อินโดนีเซีย'],['IN','อินเดีย'],['GB','สหราชอาณาจักร'],
    ['DE','เยอรมนี'],['FR','ฝรั่งเศส'],['AU','ออสเตรเลีย'],['CA','แคนาดา'],['RU','รัสเซีย'],
    ['TW','ไต้หวัน'],['HK','ฮ่องกง'],['NL','เนเธอร์แลนด์'],['AE','สหรัฐอาหรับเอมิเรตส์'],['BR','บราซิล'],
    ['OTHER','อื่นๆ'],
  ];
  function vcFlag(code){
    if(code==='OTHER') return '🌐';
    return code.replace(/./g, c=>String.fromCodePoint(127397 + c.charCodeAt(0)));
  }
  function vcUrl(action, key){ return `https://abacus.jasoncameron.dev/${action}/${VC_NAMESPACE}/${key}`; }

  const vcToggle = document.getElementById('vcToggle'), vcPanel = document.getElementById('vcPanel');

  // คำนวณตำแหน่งแผงเทียบกับปุ่มด้วย JS ทุกครั้งที่เปิด เพราะแผงใช้ position:fixed (เทียบกับหน้าจอ ไม่ใช่กล่องรอบข้าง)
  // ปุ่มอยู่ล่างสุดของหน้า จึงต้องเช็กพื้นที่ว่างด้านล่าง ถ้าไม่พอให้เปิดแผงขึ้นด้านบนปุ่มแทน
  function positionVcPanel(){
    const btnRect = vcToggle.getBoundingClientRect();
    const panelWidth = vcPanel.offsetWidth || 280;
    let left = btnRect.left + (btnRect.width/2) - (panelWidth/2);
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

    const panelMaxHeight = 360;
    const spaceBelow = window.innerHeight - btnRect.bottom - 8;
    const spaceAbove = btnRect.top - 8;
    let top;
    if(spaceBelow >= 160 || spaceBelow >= spaceAbove){
      top = btnRect.bottom + 8;
      vcPanel.style.maxHeight = Math.max(160, Math.min(panelMaxHeight, spaceBelow)) + 'px';
    } else {
      const panelHeight = Math.min(panelMaxHeight, spaceAbove, vcPanel.scrollHeight || panelMaxHeight);
      top = btnRect.top - 8 - panelHeight;
      vcPanel.style.maxHeight = Math.max(160, panelHeight) + 'px';
    }
    vcPanel.style.left = left + 'px';
    vcPanel.style.top = top + 'px';
  }

  if(vcToggle && vcPanel){
    vcToggle.addEventListener('click', (e)=>{
      e.stopPropagation();
      const willOpen = !vcPanel.classList.contains('open');
      vcPanel.classList.toggle('open', willOpen);
      vcToggle.classList.toggle('open', willOpen);
      if(willOpen) positionVcPanel();
    });
    document.addEventListener('click', e=>{
      if(!vcToggle.contains(e.target) && !vcPanel.contains(e.target)){
        vcPanel.classList.remove('open');
        vcToggle.classList.remove('open');
      }
    });
    window.addEventListener('resize', ()=>{ if(vcPanel.classList.contains('open')) positionVcPanel(); });
    window.addEventListener('scroll', ()=>{ if(vcPanel.classList.contains('open')) positionVcPanel(); }, true);
  }

  (async function(){
    const elTotal = document.getElementById('vcTotal');
    const elList = document.getElementById('vcCountryList');
    const elCount = document.getElementById('vcCountryCount');
    const elStatus = document.getElementById('vcStatus');
    try{
      // นับ 1 ครั้ง/ผู้เข้าชม/วัน (กันไม่ให้กดรีเฟรชหน้าซ้ำๆ แล้วยอดเพิ่มรัวๆ) โดยจำวันที่เข้าชมล่าสุดไว้ใน localStorage ของเบราว์เซอร์ผู้เข้าชมเอง
      const today = new Date().toISOString().slice(0,10);
      const isNewVisitToday = localStorage.getItem(VC_VISIT_KEY) !== today;
      if(isNewVisitToday){
        let countryCode = 'OTHER';
        try{
          const geoResp = await fetch('https://ipwho.is/', {cache:'no-store'});
          const geo = await geoResp.json();
          if(geo && geo.success !== false && geo.country_code && VC_COUNTRIES.some(c=>c[0]===geo.country_code)){
            countryCode = geo.country_code;
          }
        }catch(geoErr){ /* หาประเทศไม่ได้ก็ยังนับยอดรวมได้ตามปกติ จัดเข้ากลุ่ม "อื่นๆ" แทน */ }
        await fetch(vcUrl('hit','total-views'));
        await fetch(vcUrl('hit','country-'+countryCode));
        localStorage.setItem(VC_VISIT_KEY, today);
      }
      const totalResp = await fetch(vcUrl('get','total-views'));
      const totalData = await totalResp.json();
      const totalVal = (totalData && typeof totalData.value === 'number') ? totalData.value : 0;
      if(elTotal) elTotal.textContent = totalVal.toLocaleString('th-TH');

      const results = await Promise.all(VC_COUNTRIES.map(async c=>{
        try{
          const r = await fetch(vcUrl('get','country-'+c[0]));
          const d = await r.json();
          const v = (d && typeof d.value === 'number') ? d.value : 0;
          return {code:c[0], name:c[1], value:v};
        }catch(e){ return {code:c[0], name:c[1], value:0}; }
      }));
      const withData = results.filter(r=>r.value>0).sort((a,b)=>b.value-a.value);
      if(elCount) elCount.textContent = withData.length;
      if(elList){
        elList.innerHTML = withData.map(r=>`<div class="vc-country-row"><span class="vc-flag">${vcFlag(r.code)}</span><span class="vc-cname">${r.name}</span><span class="vc-cval">${r.value.toLocaleString('th-TH')}</span></div>`).join('') || '<div class="vc-empty">ยังไม่มีข้อมูล</div>';
      }
    }catch(err){
      console.warn('Visitor counter unavailable:', err);
      if(elTotal) elTotal.textContent = '—';
      if(elList) elList.innerHTML = '';
      if(elStatus){ elStatus.textContent = 'ไม่สามารถโหลดข้อมูลผู้เข้าชมได้ในขณะนี้ (ต้องเปิดผ่านเว็บที่มีอินเทอร์เน็ต)'; elStatus.style.display = 'block'; }
    }
  })();
}
