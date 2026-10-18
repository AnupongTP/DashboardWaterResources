const DATA = Array.isArray(window.__AUTHORITY_DATA__) ? window.__AUTHORITY_DATA__ : [];
const AUTHORITY = window.__AUTHORITY_CONTEXT__;
const AREA = window.AreaResponsibility;
const DEFAULT_CENTER = [19.17, 99.9]; // Phayao overview when no scoped record has coordinates.
const placeKey = (tambon, value) => `${tambon}\u001f${value}`;
const villageKey = (record) => placeKey(record.tambon, record.village);
const mooKey = (record) => placeKey(record.tambon, record.moo);
const multipleTambons = AUTHORITY.tambons.length > 1;

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

let state = { tambon:'all', moo:'all', village:'all', type:null, problem:null, status:null,
  kpiFocus:null, selectedId:null, focusId:null, search:'' };

const ALL_TYPES = [...new Set(DATA.map(d=>d.type))];
const ALL_STATUSES = [...new Set(DATA.map(d=>getUsageStatus(d)))];
const ALL_VILLAGES = [...new Set(DATA.filter(d=>d.village).map(villageKey))].sort((a,b)=>a.localeCompare(b,'th'));
const villageLabel = key => {
  const [tambon, village] = key.split('\u001f');
  return multipleTambons ? `ต.${tambon} บ้าน${village}` : `บ้าน${village}`;
};

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
    if(r.village && !layerState.villages.has(villageKey(r))) return false;
    if(!getProblemTags(r).some(t=>layerState.problems.has(t))) return false;
    return true;
  });
}

function filtered(){
  return DATA.filter(d => {
    const matchTambon = state.tambon==='all' || d.tambon===state.tambon;
    const matchMoo = state.moo==='all' || mooKey(d)===state.moo;
    const matchVillage = state.village==='all' || villageKey(d)===state.village;
    const matchType = (!state.type || d.type===state.type);
    const matchProb = (!state.problem || (d.problem||'').split(',').map(s=>s.trim()).includes(state.problem));
    const matchStatus = (!state.status || getUsageStatus(d)===state.status);

    const text = (d.name + ' ' + d.village + ' ' + d.type + ' ' + d.tambon).toLowerCase();
    const matchSearch = (!state.search || text.includes(state.search.toLowerCase()));

    return matchTambon && matchMoo && matchVillage && matchType && matchProb && matchStatus && matchSearch;
  });
}

function focusedRows(){
  if(state.focusId!=null){
    const r = DATA.find(d=>d.id===state.focusId);
    return r ? [r] : filtered();
  }
  return filtered();
}

function initFilters(){
  const elTambon = document.getElementById('fTambon');
  const elMoo = document.getElementById('fMoo');
  const elVillage = document.getElementById('fVillage');
  if(multipleTambons){
    elTambon.hidden = false;
    AUTHORITY.tambons.forEach(tambon=>elTambon.add(new Option(`ตำบล${tambon}`,tambon)));
  }
  function refreshPlaceOptions(){
    const scope = DATA.filter(d=>state.tambon==='all'||d.tambon===state.tambon);
    const moos = [...new Map(scope.filter(d=>d.moo!=null)
      .map(d=>[mooKey(d),d])).values()].sort((a,b)=>
      a.tambon.localeCompare(b.tambon,'th') || a.moo-b.moo);
    elMoo.replaceChildren(new Option('หมู่ที่ : ทั้งหมด','all'));
    moos.forEach(d=>elMoo.add(new Option(
      multipleTambons ? `ต.${d.tambon} หมู่ที่ ${d.moo}` : `หมู่ที่ ${d.moo}`,
      mooKey(d))));
    const villages = [...new Set(scope.filter(d=>d.village).map(villageKey))]
      .sort((a,b)=>a.localeCompare(b,'th'));
    elVillage.replaceChildren(new Option('หมู่บ้าน : ทั้งหมด','all'));
    villages.forEach(key=>elVillage.add(new Option(villageLabel(key),key)));
  }
  refreshPlaceOptions();
  window.refreshAuthorityPlaceOptions=refreshPlaceOptions;
  elTambon.addEventListener('change',e=>{state.tambon=e.target.value;state.moo='all';state.village='all';
    refreshPlaceOptions();exitFocusSilent();renderAll();});
  elMoo.addEventListener('change', e=>{ state.moo = e.target.value; exitFocusSilent(); renderAll(); });
  elVillage.addEventListener('change', e=>{ state.village=e.target.value;exitFocusSilent();renderAll(); });

  const types = [...new Set(DATA.map(d=>d.type))];
  const elType = document.getElementById('fType');
  types.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; elType.appendChild(o); });
  elType.addEventListener('change', e=>{ state.type = e.target.value==='all' ? null : e.target.value; exitFocusSilent(); renderAll(); });

  document.getElementById('fStatus').addEventListener('change', e=>{ state.status = e.target.value==='all' ? null : e.target.value; exitFocusSilent(); renderAll(); });
  const elProblem=document.getElementById('fProblem');
  ALL_PROBLEMS.filter(problem=>problem!=='ไม่มีปัญหา').forEach(problem=>
    elProblem.add(new Option(problem,problem)));
  elProblem.addEventListener('change',e=>{state.problem=e.target.value==='all'?null:e.target.value;
    exitFocusSilent();renderAll();});

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
        state.tambon='all';state.moo='all';state.village='all';
        state.type=null; state.problem=null; state.status=null; state.search='';
        document.getElementById('fTambon').value='all';
        document.getElementById('fMoo').value='all';
        document.getElementById('fVillage').value='all';
        window.refreshAuthorityPlaceOptions();
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
  document.getElementById('fTambon').value = state.tambon;
  document.getElementById('fMoo').value = state.moo;
  document.getElementById('fVillage').value = state.village;
  document.getElementById('fType').value = state.type || 'all';
  document.getElementById('fStatus').value = state.status || 'all';
  document.getElementById('fProblem').value = state.problem || 'all';
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

 map = L.map('mapbox', {scrollWheelZoom:false}).setView(DEFAULT_CENTER,9);
// พื้นหลังภาพถ่ายดาวเทียมจริง (Esri World Imagery — ฟรี ไม่ต้องขอ API key)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18, attribution:'Tiles &copy; Esri'}).addTo(map);
// เลเยอร์ชื่อสถานที่/เส้นถนนซ้อนทับ ให้ยังอ่านชื่อหมู่บ้าน/ถนนได้เหมือนเดิม
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:18, attribution:''}).addTo(map);
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

function driveFileId(url){ const match=String(url||'').match(/[?&]id=([a-zA-Z0-9_-]+)/);return match?match[1]:null; }
const failedImages=new Set(), preferredImageUrls=new Map(), imageRetryStage=new Map();
function safeDriveLink(value){
  try{const url=new URL(String(value));return url.protocol==='https:'&&url.hostname==='drive.google.com'?url.href:'';}
  catch(_){return '';}
}
function escapeAttr(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function authorityImageLoaded(image,id){
  if(!image.naturalWidth)return;
  failedImages.delete(id);preferredImageUrls.set(id,image.src);
  if(image.nextElementSibling)image.nextElementSibling.style.display='none';
}
function authorityImageError(image,id){
  failedImages.add(id);preferredImageUrls.delete(id);
  document.querySelectorAll(`img[data-drive-id="${id}"]`).forEach(other=>{
    other.removeAttribute('src');other.style.display='none';
    const fallback=other.nextElementSibling;
    if(fallback){fallback.style.display='flex';const retry=fallback.querySelector('button');
      if(retry)retry.hidden=(imageRetryStage.get(id)||0)>=2;}
  });
}
function authorityImageRetry(button,id){
  const fallback=button.parentElement,image=fallback&&fallback.previousElementSibling;
  const stage=imageRetryStage.get(id)||0;
  if(!image||image.tagName!=='IMG'||stage>=2)return;
  const urls=[`https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://drive.google.com/uc?export=view&id=${id}`];
  imageRetryStage.set(id,stage+1);image.style.display='block';fallback.style.display='none';image.src=urls[stage];
}
function driveImgTag(imageUrl,cls,altText){
  const id=driveFileId(imageUrl), original=safeDriveLink(imageUrl);
  const failed=!id||failedImages.has(id);
  const link=original?`<a href="${escapeAttr(original)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">เปิดไฟล์ต้นฉบับ</a>`:'';
  const retry=id&&(imageRetryStage.get(id)||0)<2?`<button type="button" onclick="event.stopPropagation();authorityImageRetry(this,'${id}')">ลองแหล่งภาพสำรอง</button>`:'';
  const fallback=`<span class="authority-image-fallback" style="display:${failed?'flex':'none'};">ไม่สามารถแสดงภาพ${retry}${link}</span>`;
  if(!id)return fallback;
  const src=failed?'':(preferredImageUrls.get(id)||`https://lh3.googleusercontent.com/d/${id}=w1000`);
  return `<img class="${escapeAttr(cls)}" ${src?`src="${src}"`:''} alt="${escapeAttr(altText)}" data-drive-id="${id}" data-original="${escapeAttr(original)}" style="${failed?'display:none;':''}" loading="lazy" referrerpolicy="no-referrer" onload="authorityImageLoaded(this,'${id}')" onerror="authorityImageError(this,'${id}')" onclick="openImageModal(this.currentSrc||this.src,this.alt,this.dataset.original)">${fallback}`;
}
function openImageModal(src,caption,original){
  if(!src)return;
  const image=document.getElementById('imgModalImg'),failure=document.getElementById('imgModalFailure');
  image.referrerPolicy='no-referrer';
  failure.hidden=true;failure.style.display='none';image.style.display='block';
  image.onerror=()=>{image.style.display='none';failure.hidden=false;failure.style.display='flex';};
  image.src=src;
  failure.innerHTML=`ไม่สามารถแสดงภาพขยายได้${safeDriveLink(original)?`<a href="${escapeAttr(original)}" target="_blank" rel="noopener">เปิดไฟล์ต้นฉบับ</a>`:''}`;
  document.getElementById('imgModalCaption').textContent=caption||'';
  document.getElementById('imgModalBg').classList.add('open');
}
function closeImageModal(){
  document.getElementById('imgModalBg').classList.remove('open');
  const image=document.getElementById('imgModalImg');image.onerror=null;image.src='';
}

// Leaflet reparses string popup content on every open. Keep the same DOM node so
// reopening or rebuilding map markers cannot restart a failed Google request.
const popupContentById=new Map();
function popupContentFor(record){
  if(popupContentById.has(record.id))return popupContentById.get(record.id);
  const wrapper=document.createElement('div');
  wrapper.innerHTML=buildPopupHTML(record);
  const content=wrapper.firstElementChild;
  popupContentById.set(record.id,content);
  return content;
}

function getSafeVolume(r) {
  if(!r.volumeKnown) return 0;
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

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function placeLabel(record){
  const parts=[record.tambon ? `ต.${record.tambon}` : '',
    record.moo != null ? `หมู่ ${record.moo}` : '',
    record.village ? `บ้าน${record.village}` : ''].filter(Boolean);
  return parts.join(' · ') || 'ไม่มีข้อมูลพื้นที่ย่อย';
}
function recordedProblems(record){
  return (record.problem||'').split(',').map(tag=>tag.trim())
    .filter(tag=>tag && tag!=='ใช้งานได้');
}
function updateDSSPanel() {
  const board=document.getElementById('dssBoard');
  const content=document.getElementById('dssContent');
  const title=document.getElementById('dssTitleText');
  const reset=document.getElementById('dssResetBtn');
  const focused=state.focusId==null ? null : DATA.find(row=>row.id===state.focusId);
  reset.style.display=focused?'inline-block':'none';
  if(focused){
    const tags=recordedProblems(focused);
    title.textContent=`🔮 ข้อมูลเพื่อพิจารณาเฉพาะจุด: ${focused.name}`;
    board.style.borderLeftColor=tags.length?'var(--amber)':'var(--emerald)';
    const facts=[`<li><b>${escapeHtml(focused.name)}</b> — ${escapeHtml(placeLabel(focused))}</li>`,
      `<li>ปัญหาที่บันทึก: ${tags.length?tags.map(escapeHtml).join(', '):'ไม่มีแท็กปัญหาในข้อมูลสำรวจ'}</li>`];
    if(focused.depth>0 && focused.depthNet>0 && focused.depthNet<focused.depth){
      facts.push(`<li>ความลึกปัจจุบันที่บันทึก ${focused.depthNet} ม. ต่ำกว่าค่าความลึกเดิม ${focused.depth} ม. (${(focused.depth-focused.depthNet).toFixed(1)} ม.); ข้อมูลนี้ยังไม่ระบุสาเหตุ</li>`);
    }
    facts.push(`<li>ปริมาตร: ${focused.volumeKnown?getSafeVolume(focused).toLocaleString('th-TH',{maximumFractionDigits:1})+' ลบ.ม. (บันทึกหรือคำนวณจากมิติที่มี)':'ไม่มีข้อมูลเพียงพอสำหรับคำนวณ'}</li>`);
    const advice=[];
    if(tags.includes('ชำรุด')) advice.push('<li>ตรวจสภาพหน้างานและให้ผู้เชี่ยวชาญประเมินความเร่งด่วนก่อนกำหนดวิธีซ่อม</li>');
    if(tags.some(tag=>tag==='น้ำเน่าเสีย'||tag==='น้ำมีสี')) advice.push('<li>ตรวจสอบและเก็บตัวอย่างน้ำตามวิธีมาตรฐานก่อนสรุปคุณภาพน้ำหรือมาตรการแก้ไข</li>');
    if(tags.includes('วัชพืชปกคลุม')) advice.push('<li>สำรวจขอบเขตวัชพืชและผลต่อการใช้งานจริงก่อนวางแผนจัดการ</li>');
    if(!advice.length) advice.push('<li>ตรวจสอบข้อมูลสำรวจและสภาพพื้นที่อีกครั้งก่อนตัดสินใจดำเนินงาน</li>');
    content.innerHTML=`<div class="dss-grid"><div class="dss-block"><div class="dss-block-title">📊 ข้อมูลที่บันทึกไว้</div><ul class="dss-list">${facts.join('')}</ul></div><div class="dss-block"><div class="dss-block-title" style="color:var(--channel);">🛠️ แนวทางตรวจสอบเบื้องต้น</div><ul class="dss-list">${advice.join('')}</ul></div></div><p class="dss-empty">ข้อเสนอเป็นแนวทางเบื้องต้นจากข้อมูลสำรวจ ไม่ใช่ผลวินิจฉัยทางวิศวกรรมหรือผลตรวจคุณภาพน้ำ</p>`;
    return;
  }
  const rows=filtered();
  title.textContent=`🔮 สารสนเทศและข้อแนะนำเบื้องต้นในเขตรับผิดชอบของ${AUTHORITY.fullName}`;
  board.style.borderLeftColor='var(--channel)';
  if(!rows.length){content.innerHTML='<div class="dss-empty">ไม่มีรายการที่ตรงกับตัวกรองในเขตรับผิดชอบนี้</div>';return;}
  const counts=new Map();
  rows.forEach(row=>recordedProblems(row).forEach(tag=>counts.set(tag,(counts.get(tag)||0)+1)));
  const facts=[`<li>มีรายการตามตัวกรอง ${rows.length} แห่ง ในพื้นที่รับผิดชอบของ${escapeHtml(AUTHORITY.fullName)}</li>`];
  for(const [tag,count] of counts) facts.push(`<li>รายงาน “${escapeHtml(tag)}” ${count} แห่ง (หนึ่งแห่งอาจมีหลายแท็ก)</li>`);
  if(!counts.size) facts.push('<li>ไม่มีแท็กปัญหาในรายการที่เลือก ไม่ใช่การยืนยันว่าไม่มีปัญหาในพื้นที่</li>');
  const unknown=rows.filter(row=>!row.volumeKnown).length;
  if(unknown) facts.push(`<li>${unknown} แห่งไม่มีข้อมูลเพียงพอสำหรับคำนวณปริมาตร</li>`);
  content.innerHTML=`<div class="dss-grid"><div class="dss-block"><div class="dss-block-title">📊 ภาพรวมจากข้อมูลสำรวจ</div><ul class="dss-list">${facts.join('')}</ul></div><div class="dss-block"><div class="dss-block-title" style="color:var(--channel);">🛠️ ขั้นตอนที่แนะนำ</div><ul class="dss-list"><li>ตรวจความครบถ้วนของรายการและพื้นที่รับผิดชอบก่อนจัดลำดับงาน</li><li>ตรวจยืนยันสภาพจริงของจุดที่มีรายงานปัญหา แล้วให้หน่วยงานที่เกี่ยวข้องกำหนดมาตรการ</li></ul></div></div><p class="dss-empty">ข้อมูลสำรวจไม่ใช่ผลตรวจยืนยันสภาพโครงสร้างหรือคุณภาพน้ำ</p>`;
}

function renderAll(){
  syncToolbar();
  const mapRows = mapVisibleRows(filtered());

  markersLayer.clearLayers(); markerRefs = {};
  const bounds = [];
  mapRows.forEach(r=>{
    if(r.lat==null||r.lng==null) return;
    const icon = makeIcon(r, state.focusId===r.id);
    const m = L.marker([r.lat,r.lng], {icon}).bindPopup(()=>popupContentFor(r), {maxWidth:275, minWidth:255, autoPan:true, keepInView:true});
    m.on('click', ()=>{ setFocus(r.id); });
    m.addTo(markersLayer);
    markerRefs[r.id]=m;
    bounds.push([r.lat,r.lng]);
  });
  
  if(bounds.length && !state.focusId) {
    map.fitBounds(bounds,{padding:[30,30]});
  } else if(!bounds.length && !state.focusId) {
    map.setView(DEFAULT_CENTER,9);
  }

  renderPanels(focusedRows());
}

function renderPanels(rows){
  document.getElementById('statCount').textContent = rows.length;
  document.getElementById('statTypes').textContent = new Set(rows.map(r=>r.type)).size;
  document.getElementById('statBroken').textContent = rows.filter(r=>(r.problem||'').includes('ชำรุด')).length;
  
  const knownVolumeRows = rows.filter(r=>r.volumeKnown);
  const totalVol = knownVolumeRows.reduce((s,r)=>s+getSafeVolume(r),0);
  document.getElementById('statVol').textContent = knownVolumeRows.length ? fmtNum(totalVol) : '-';
  document.getElementById('statAvgVol').textContent = knownVolumeRows.length ? fmtNum(totalVol/knownVolumeRows.length) : '-';
  document.getElementById('statAvgHint').textContent =
    `คำนวณจาก ${knownVolumeRows.length} ใน ${rows.length} แห่งที่มีข้อมูลปริมาตร`;

  const typeCount = {}; rows.forEach(r=>{ typeCount[r.type]=(typeCount[r.type]||0)+1; });
  const tLabels = Object.keys(typeCount);
  chartType.data.labels = tLabels;
  chartType.data.datasets[0].data = tLabels.map(t=>typeCount[t]);
  chartType.data.datasets[0].backgroundColor = tLabels.map(t=> state.type && state.type!==t ? '#dde6e6' : colorFor(t));
  chartType.update();
  
  document.getElementById('legType').innerHTML = tLabels.map(t=>{
    const active = state.type===t;
    return `<span class="${active?'active':''}" data-t="${escapeAttr(t)}"><i style="background:${colorFor(t)}"></i>${escapeHtml(t)}</span>`;
  }).join('');
  [...document.getElementById('legType').children].forEach(el=>{
    el.addEventListener('click', ()=>{ const t=el.dataset.t; state.type = state.type===t?null:t; exitFocusSilent(); renderAll(); });
  });

  const volByType = {}; knownVolumeRows.forEach(r=>{
    volByType[r.type]=(volByType[r.type]||0)+getSafeVolume(r);
  });
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
    return `<span class="${active?'active':''}" data-p="${escapeAttr(p)}"><i style="background:${probColor(p,i)}"></i>${escapeHtml(p)} (${Math.round(probCount[p]/totalTags*100)}%)</span>`;
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
  const box=document.getElementById('kpiInsight');
  if(!rows.length){
    box.innerHTML=`<div class="ki-title">💡 คำอธิบาย</div>${noDataMessage()} หรือคลิกการ์ด “แหล่งน้ำที่พบ” เพื่อล้างตัวกรอง`;
    return;
  }
  const known=rows.filter(row=>row.volumeKnown);
  const total=known.reduce((sum,row)=>sum+getSafeVolume(row),0);
  const typeCount=new Map();
  rows.forEach(row=>typeCount.set(row.type,(typeCount.get(row.type)||0)+1));
  let title='💡 คำอธิบาย', body='คลิกการ์ดเพื่อดูที่มาของตัวเลขหรือกรองข้อมูลในเขตรับผิดชอบนี้';
  if(state.kpiFocus==='types'){
    title='💡 ประเภทแหล่งน้ำ';
    body=`พบ ${typeCount.size} ประเภทใน ${rows.length} รายการตามตัวกรอง: `+
      [...typeCount].map(([type,count])=>`${escapeHtml(type)} ${count} แห่ง`).join(', ');
  } else if(state.kpiFocus==='broken'){
    const broken=rows.filter(row=>getUsageStatus(row)==='ชำรุด');
    title='🚨 รายการที่รายงานว่าชำรุด';
    body=`พบ ${broken.length} แห่งจากข้อมูลสำรวจ ควรตรวจสภาพจริงก่อนกำหนดความเร่งด่วนและวิธีดำเนินการ`;
  } else if(state.kpiFocus==='vol'){
    title='💡 ปริมาตรที่มีข้อมูล';
    body=`รวม ${fmtNum(total)} ลบ.ม. จาก ${known.length} ใน ${rows.length} แห่งที่มีค่าบันทึกหรือมีมิติพอให้คำนวณ รายการที่ไม่มีข้อมูลไม่ถูกนับเป็นปริมาตรศูนย์`;
  } else if(state.kpiFocus==='avg'){
    title='💡 ปริมาตรเฉลี่ยต่อแหล่งที่มีข้อมูล';
    body=known.length ? `${fmtNum(total)} ÷ ${known.length} = ${fmtNum(total/known.length)} ลบ.ม./แห่ง; ไม่รวม ${rows.length-known.length} แห่งที่ไม่มีข้อมูลเพียงพอ` :
      'ไม่มีรายการที่มีข้อมูลเพียงพอสำหรับคำนวณค่าเฉลี่ย';
  }
  box.innerHTML=`<div class="ki-title">${title}</div>${body}`;
}

function renderMapLegendStatic(){
  const typeHtml = `<span><b>ประเภท:</b></span>` + ALL_TYPES.map(t=>`<span><i style="background:${colorFor(t)}"></i>${iconFor(t)} ${escapeHtml(t)}</span>`).join('');
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
  buildLayerList('lpVillageList', ALL_VILLAGES, layerState.villages, ()=>'#5b7787', null, villageLabel);

  document.getElementById('lpTypeAll').addEventListener('click', ()=>{ layerState.types=new Set(ALL_TYPES); buildLayerList('lpTypeList', ALL_TYPES, layerState.types, colorFor, 'lpTypeOn'); renderAll(); });
  document.getElementById('lpTypeNone').addEventListener('click', ()=>{ layerState.types=new Set(); buildLayerList('lpTypeList', ALL_TYPES, layerState.types, colorFor, 'lpTypeOn'); renderAll(); });
  document.getElementById('lpStatusAll').addEventListener('click', ()=>{ layerState.statuses=new Set(LAYER_STATUS_GROUPS); buildLayerList('lpStatusList', LAYER_STATUS_GROUPS, layerState.statuses, t=>STATUS_GROUP_COLORS[t]||'#999', 'lpStatusOn'); renderAll(); });
  document.getElementById('lpStatusNone').addEventListener('click', ()=>{ layerState.statuses=new Set(); buildLayerList('lpStatusList', LAYER_STATUS_GROUPS, layerState.statuses, t=>STATUS_GROUP_COLORS[t]||'#999', 'lpStatusOn'); renderAll(); });
  document.getElementById('lpProblemAll').addEventListener('click', ()=>{ layerState.problems=new Set(ALL_PROBLEMS); buildLayerList('lpProblemList', ALL_PROBLEMS, layerState.problems, problemLayerColor, 'lpProblemOn'); renderAll(); });
  document.getElementById('lpProblemNone').addEventListener('click', ()=>{ layerState.problems=new Set(); buildLayerList('lpProblemList', ALL_PROBLEMS, layerState.problems, problemLayerColor, 'lpProblemOn'); renderAll(); });
  document.getElementById('lpVillageAll').addEventListener('click', ()=>{ layerState.villages=new Set(ALL_VILLAGES); buildLayerList('lpVillageList', ALL_VILLAGES, layerState.villages, ()=>'#5b7787', null, villageLabel); renderAll(); });
  document.getElementById('lpVillageNone').addEventListener('click', ()=>{ layerState.villages=new Set(); buildLayerList('lpVillageList', ALL_VILLAGES, layerState.villages, ()=>'#5b7787', null, villageLabel); renderAll(); });

  renderMapLegendStatic();
}

function syncMasterCheckbox(masterId, selectedSet, allItems){
  const master = document.getElementById(masterId);
  if(!master) return;
  if(selectedSet.size===0){ master.checked=false; master.indeterminate=false; }
  else if(selectedSet.size===allItems.length){ master.checked=true; master.indeterminate=false; }
  else { master.checked=false; master.indeterminate=true; }
}

function buildLayerList(elId, items, selectedSet, colorFn, masterId, labelFn=(value)=>value){
  const el = document.getElementById(elId);
  el.innerHTML = items.map(v=>{
    const checked = selectedSet.has(v) ? 'checked' : '';
    return `<label class="lp-item"><input type="checkbox" data-v="${escapeAttr(v)}" ${checked}><span class="lp-dot" style="background:${colorFn(v)}"></span>${escapeHtml(labelFn(v))}</label>`;
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
  if(rec && rec.lat!=null && rec.lng!=null){
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
    .map(p=>`<span class="pp-tag ${p==='ชำรุด'?'bad':''}">${escapeHtml(p)}</span>`).join('');
  const navUrl = r.lat!=null && r.lng!=null ?
    `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}` : '';
  const fileId = driveFileId(r.image);
  const imgHtml = fileId ? `<div class="pp-imgwrap">${driveImgTag(r.image, 'pp-img', r.name)}</div>` : '';
  
  return `
  <div class="pp">
    ${imgHtml}
    <div class="pp-title">${escapeHtml(r.name)}</div>
    <div class="pp-row"><span>ประเภท</span><b>${escapeHtml(r.type)}</b></div>
    <div class="pp-row"><span>ตำแหน่ง</span><b>${escapeHtml(placeLabel(r))}</b></div>
    <div class="pp-row"><span>ขนาด (ก×ย×ล)</span><b>${r.width||0}×${r.length||0}×${r.depth||0} ม.</b></div>
    <div class="pp-row"><span>ความลึกปัจจุบัน</span><b>${r.depthNet||0} ม. (เดิม ${r.depth||0} ม.)</b></div>
    <div class="pp-row"><span>ปริมาตรน้ำสุทธิ</span><b>${r.volumeKnown?getSafeVolume(r).toLocaleString()+' ลบ.ม.':'ไม่มีข้อมูลเพียงพอ'}</b></div>
    <div class="pp-row"><span>เจ้าของ/ผู้ดูแล</span><b>${escapeHtml(r.owner||'-')}</b></div>
    ${r.note && r.note!=='ไม่มี' ? `<div class="pp-row"><span>หมายเหตุ</span><b>${escapeHtml(r.note)}</b></div>` : ''}
    <div class="pp-probs">${probs}</div>
    ${navUrl?`<a class="pp-nav" href="${navUrl}" target="_blank" rel="noopener">🧭 เปิดระบบนำทางไปยังจุดนี้</a>`:''}
  </div>`;
}

function noDataMessage(){
  return DATA.length ? '📭 ไม่พบแหล่งน้ำที่ตรงกับตัวกรองที่เลือกไว้ ลองปรับตัวกรองใหม่' :
    '📭 ยังไม่มีรายการสำรวจที่ยืนยันว่าอยู่ในเขตรับผิดชอบนี้';
}

function renderTable(rows){
  if(!rows.length){
    document.getElementById('tblBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:22px 10px;color:var(--sub);font-style:italic;">${noDataMessage()}</td></tr>`;
    document.getElementById('tblCount').textContent = '0 รายการ';
    return;
  }
  document.getElementById('tblBody').innerHTML = rows.map(r=>{
    const probs = (r.problem||'').split(',').map(s=>s.trim()).filter(Boolean).map(p=>`<span class="tag ${p==='ชำรุด'?'bad':''}">${escapeHtml(p)}</span>`).join('');
    return `<tr data-id="${r.id}"><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(placeLabel(r))}</td><td>${r.volumeKnown?getSafeVolume(r).toLocaleString('th-TH',{maximumFractionDigits:1}):'—'}</td><td>${r.moo??'—'}</td><td>${probs}</td></tr>`;
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
    return `<span><i style="background:${colors[i]}"></i>${escapeHtml(l)}${pct}</span>`;
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

document.body.classList.add('authority-ready');
