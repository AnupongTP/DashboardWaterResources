#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'site/index.html'
s=P.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    c=s.count(old)
    if c!=1:
        raise SystemExit(f'PATCH ERROR {label}: expected 1 anchor, got {c}')
    s=s.replace(old,new,1)

one(".kpi-detail.open{padding:14px 18px;max-height:900px;opacity:1;overflow-y:auto;}\n.kpi-detail-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}",
".kpi-detail.open{padding:14px 18px;max-height:none;opacity:1;overflow:visible;}\n.kpi-detail-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}\n.kpi-detail-rows{min-height:0;}\n.kpi-detail-rows.is-expanded{max-height:460px;overflow-y:auto;overscroll-behavior:contain;padding-right:4px;}\n.kpi-detail-toggle{display:block;width:100%;margin-top:8px;border:1px solid #bbdefb;background:#f4f9ff;color:#0d47a1;border-radius:7px;padding:6px 10px;font-family:'Sarabun',sans-serif;font-size:11px;font-weight:800;cursor:pointer;}\n.kpi-detail-toggle:hover,.kpi-detail-toggle:focus{background:#e3f2fd;outline:none;}", 'kpi css')
one(".exec-hero{display:flex;flex-wrap:wrap;gap:16px;align-items:stretch;}", ".exec-hero{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;}", 'hero align')
one(".exec-hero-cards .kpi-detail{flex:1;min-height:0;}", ".exec-hero-cards .kpi-detail{flex:none;min-height:0;}", 'kpi flex')

one("window.__openKpiKey = 'total';\nfunction toggleKpiDetail(key){",
"window.__openKpiKey = 'total';\nwindow.__showAllTambonKpi = false;\nfunction resetKpiTambonExpansion(){ window.__showAllTambonKpi = false; }\nfunction toggleKpiTambonList(event){\n  if(event) event.stopPropagation();\n  window.__showAllTambonKpi = !window.__showAllTambonKpi;\n  runBuildExec();\n}\nwindow.toggleKpiTambonList = toggleKpiTambonList;\nfunction toggleKpiDetail(key){", 'toggle state')
one("function setCrossFilter(key, val) {\n  if (crossFilter[key] === val) crossFilter[key] = null; // toggle off\n  else crossFilter[key] = val;\n  updateCrossFilterBar();\n  runBuildExec();\n}",
"function setCrossFilter(key, val) {\n  if (crossFilter[key] === val) crossFilter[key] = null; // toggle off\n  else crossFilter[key] = val;\n  if(key==='tambon') resetKpiTambonExpansion();\n  updateCrossFilterBar();\n  runBuildExec();\n}", 'cross filter reset')
one("    onChange:function(value){ execFilter.tambon=value; crossFilter={type:null,tambon:null,problem:null}; updateCrossFilterBar(); runBuildExec(); }",
"    onChange:function(value){ execFilter.tambon=value; resetKpiTambonExpansion(); crossFilter={type:null,tambon:null,problem:null}; updateCrossFilterBar(); runBuildExec(); }", 'exec tambon')
one("  efD.addEventListener('change',function(e){ execFilter.district=e.target.value;execFilter.authority='';execFilter.tambon='';refreshExecAuthorities();refreshExecTambons();crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec(); });",
"  efD.addEventListener('change',function(e){ execFilter.district=e.target.value;execFilter.authority='';execFilter.tambon='';resetKpiTambonExpansion();refreshExecAuthorities();refreshExecTambons();crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec(); });", 'exec district')
one("  efA.addEventListener('change',function(e){ execFilter.authority=e.target.value;execFilter.tambon='';refreshExecTambons();crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec(); });",
"  efA.addEventListener('change',function(e){ execFilter.authority=e.target.value;execFilter.tambon='';resetKpiTambonExpansion();refreshExecTambons();crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec(); });", 'exec authority')
one("  document.getElementById('efReset').addEventListener('click',function(){ execFilter={district:'',authority:'',tambon:'',type:''};crossFilter={type:null,tambon:null,problem:null};efD.value='';efTy.value='';refreshExecAuthorities();refreshExecTambons();updateCrossFilterBar();runBuildExec(); });",
"  document.getElementById('efReset').addEventListener('click',function(){ execFilter={district:'',authority:'',tambon:'',type:''};resetKpiTambonExpansion();crossFilter={type:null,tambon:null,problem:null};efD.value='';efTy.value='';refreshExecAuthorities();refreshExecTambons();updateCrossFilterBar();runBuildExec(); });", 'exec reset')

old="""    rows = rows.filter(function(r){return r.tn>0;}).sort(function(a,b){return b.val-a.val;});
    var maxV = Math.max.apply(null, rows.map(function(r){return r.val;}).concat([1]));
    var barColor = barColors[openKpi]||'#1565c0';
    var cfKey = openKpi==='types' ? 'type' : (openKpi==='problemcount' ? 'problem' : 'tambon');
    var footNote = openKpi==='types' ? '👆 คลิกแถบประเภทเพื่อกรองข้อมูลทั้งหน้าเฉพาะประเภทนั้น'
      : openKpi==='problemcount' ? '👆 คลิกแถบปัญหาเพื่อกรองข้อมูลทั้งหน้าเฉพาะปัญหานั้น'
      : '👆 คลิกแถบตำบลเพื่อกรองข้อมูลทั้งหน้าเฉพาะตำบลนั้น';
    var bodyHtml = rows.map(function(r){
      var pct=(r.val/maxV*100).toFixed(1);
      var isSel = crossFilter[cfKey]===r.key;
      return '<div class=\"bar-row'+(isSel?' bar-row-selected':'')+'\" onclick=\"event.stopPropagation();setCrossFilter(\\''+cfKey+'\\',\\''+r.key+'\\')\">'
        +'<div class=\"lbl\" title=\"'+r.key+'\">'+r.key+'</div>'
        +'<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:'+pct+'%;background:'+barColor+';\"></div></div>'
        +'<div class=\"bar-val\" style=\"width:auto;color:'+barColor+';\">'+r.sub+'</div>'
        +'</div>';
    }).join('') || '<div style=\"color:#9ab;font-size:12px;padding:8px 0;\">ไม่พบข้อมูล</div>';
    el.innerHTML = '<div class=\"kpi-detail-head\"><div class=\"kpi-detail-title\">📊 '+titles[openKpi]+'</div>'
      +'<button class=\"kpi-detail-close\" onclick=\"event.stopPropagation();toggleKpiDetail(\\''+openKpi+'\\')\">✕ ปิด</button></div>'
      +bodyHtml
      +'<div style=\"font-size:10.5px;color:#8a9aa0;margin-top:8px;\">'+footNote+'</div>';
"""
new="""    rows = rows.filter(function(r){return r.tn>0;}).sort(function(a,b){return b.val-a.val;});
    var maxV = Math.max.apply(null, rows.map(function(r){return r.val;}).concat([1]));
    var barColor = barColors[openKpi]||'#1565c0';
    var cfKey = openKpi==='types' ? 'type' : (openKpi==='problemcount' ? 'problem' : 'tambon');
    var footNote = openKpi==='types' ? '👆 คลิกแถบประเภทเพื่อกรองข้อมูลทั้งหน้าเฉพาะประเภทนั้น'
      : openKpi==='problemcount' ? '👆 คลิกแถบปัญหาเพื่อกรองข้อมูลทั้งหน้าเฉพาะปัญหานั้น'
      : '👆 คลิกแถบตำบลเพื่อกรองข้อมูลทั้งหน้าเฉพาะตำบลนั้น';
    var isTambonBreakdown = openKpi!=='types' && openKpi!=='problemcount';
    var hasGeographicScope = !!(execFilter.district || execFilter.authority || execFilter.tambon || crossFilter.tambon);
    var canCollapseTambons = isTambonBreakdown && !hasGeographicScope && rows.length>10;
    var showAllTambons = canCollapseTambons && !!window.__showAllTambonKpi;
    var visibleRows = canCollapseTambons && !showAllTambons ? rows.slice(0,10) : rows;
    var bodyHtml = visibleRows.map(function(r){
      var pct=(r.val/maxV*100).toFixed(1);
      var isSel = crossFilter[cfKey]===r.key;
      return '<div class=\"bar-row'+(isSel?' bar-row-selected':'')+'\" onclick=\"event.stopPropagation();setCrossFilter(\\''+cfKey+'\\',\\''+r.key+'\\')\">'
        +'<div class=\"lbl\" title=\"'+r.key+'\">'+r.key+'</div>'
        +'<div class=\"bar-track\"><div class=\"bar-fill\" style=\"width:'+pct+'%;background:'+barColor+';\"></div></div>'
        +'<div class=\"bar-val\" style=\"width:auto;color:'+barColor+';\">'+r.sub+'</div>'
        +'</div>';
    }).join('') || '<div style=\"color:#9ab;font-size:12px;padding:8px 0;\">ไม่พบข้อมูล</div>';
    var toggleHtml = canCollapseTambons
      ? '<button type=\"button\" class=\"kpi-detail-toggle\" onclick=\"toggleKpiTambonList(event)\">'+(showAllTambons?'ย่อเหลือ 10 อันดับ ▲':'ดูทั้งหมด '+rows.length+' ตำบล ▼')+'</button>'
      : '';
    el.innerHTML = '<div class=\"kpi-detail-head\"><div class=\"kpi-detail-title\">📊 '+titles[openKpi]+'</div>'
      +'<button class=\"kpi-detail-close\" onclick=\"event.stopPropagation();toggleKpiDetail(\\''+openKpi+'\\')\">✕ ปิด</button></div>'
      +'<div class=\"kpi-detail-rows'+(showAllTambons?' is-expanded':'')+'\">'+bodyHtml+'</div>'
      +toggleHtml
      +'<div style=\"font-size:10.5px;color:#8a9aa0;margin-top:8px;\">'+footNote+'</div>';
"""
one(old,new,'top10 render')

old_reset="""$('#resetBtn').addEventListener('click',()=>{
  state={district:'',authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};
  $('#fDistrict').value='';$('#fType').value='';$('#searchBox').value='';
  document.querySelectorAll('#problemChips .chip').forEach(x=>x.classList.remove('active'));
  refreshDetailAuthorities();refreshTambonOptions();refreshMooOptions();refreshVillageOptions();render();runBuildExec();
});"""
new_reset="""function resetDetailFilters(){
  state={district:'',authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};
  $('#fDistrict').value='';$('#fType').value='';$('#searchBox').value='';
  document.querySelectorAll('#problemChips .chip').forEach(x=>x.classList.remove('active'));
  crossFilter.tambon=null;
  refreshDetailAuthorities();refreshTambonOptions();refreshMooOptions();refreshVillageOptions();
  updateCrossFilterBar();render();runBuildExec();
}
$('#resetBtn').addEventListener('click',resetDetailFilters);"""
one(old_reset,new_reset,'central reset')
one("function pvClearAll(){\n  state.type='';state.tambon='';state.moo='';state.village='';\n  pvApplyState();\n}", "function pvClearAll(){\n  resetDetailFilters();\n}", 'pivot clear')

s=s.replace("/* ===== EXEC HERO: KPI CARDS (LEFT) + MAP & CHARTS (RIGHT) =====\n   align-items:stretch — คอลัมน์ซ้าย/ขวาสูงเท่ากันเสมอ (เท่ากับคอลัมน์ที่สูงกว่า) แต่ป้องกันช่องว่างด้วยการให้\n   \"ส่วนที่ยืดหยุ่นได้\" ของแต่ละฝั่งเป็นคนกินพื้นที่ส่วนเกิน แทนที่จะปล่อยว่างเปล่า: ฝั่งซ้ายให้กล่องรายละเอียด (kpi-detail)\n   ยืด/หดตามพื้นที่จริง ฝั่งขวาให้ตัวแผนที่ยืดสูงขึ้นแทน (แผนที่ใหญ่ขึ้นก็ยังมีประโยชน์ ไม่ใช่พื้นที่เปล่า) */", "/* ===== EXEC HERO: KPI CARDS (LEFT) + MAP & CHARTS (RIGHT) =====\n   แต่ละคอลัมน์ใช้ความสูงตามเนื้อหาของตัวเอง เพื่อไม่ให้รายการตำบลจำนวนมากบังคับความสูงของแผนที่หรือกลับกัน */")
s=s.replace("  // ความสูงของแผนที่ตอนนี้ยืด/หดตามความสูงของคอลัมน์การ์ด (align-items:stretch) — พอสลับการ์ด/เปิดปิดรายละเอียด\n  // แล้วความสูงคอลัมน์เปลี่ยน ต้องสั่ง Leaflet คำนวณขนาดกล่องแผนที่ใหม่ ไม่งั้นจะเหลือพื้นที่เทาไม่มีไทล์แผนที่โผล่มา", "  // สลับรายละเอียดอาจเปลี่ยน layout รอบแผนที่ จึงสั่ง Leaflet คำนวณขนาดกล่องใหม่เพื่อกันไทล์ค้าง")
s=s.replace("// ปรับขนาดหน้าจอ (ย่อ/ขยายเบราว์เซอร์) ก็เปลี่ยนความสูงคอลัมน์การ์ด/แผนที่ได้เหมือนกัน (align-items:stretch) — สั่ง Leaflet คำนวณใหม่ด้วย", "// ปรับขนาดหน้าจออาจเปลี่ยน layout แผนที่ จึงสั่ง Leaflet คำนวณใหม่ด้วย")

for token in ['function resetDetailFilters()', 'function pvClearAll(){\n  resetDetailFilters();', 'window.__showAllTambonKpi = false;', 'kpi-detail-toggle']:
    if token not in s:
        raise SystemExit('PATCH ERROR post-check '+token)
P.write_text(s,encoding='utf-8',newline='\n')
print('ROUND2 PATCH OK')
