#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'site' / 'index.html'
WATER_STORE = ROOT / 'netlify' / 'lib' / 'water-store.mjs'
AREA_TEST = ROOT / 'tests' / 'area_responsibility_test.mjs'


def fail(msg: str) -> None:
    raise SystemExit(f'PATCH ERROR: {msg}')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f'{label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        fail(f'{label}: expected 1 regex match, found {count}')
    return out


def main() -> None:
    if not INDEX.exists():
        fail(f'missing {INDEX}')
    text = INDEX.read_text(encoding='utf-8')

    for token in ['id="efAuthority"', 'id="fAuthority"', 'id="dfAuthority"', 'const AREA = window.AreaResponsibility;', 'var execFilter  = { authority:']:
        if token not in text:
            fail(f'baseline token not found: {token}')

    text = text.replace('อปท./เทศบาล', 'อบต./เทศบาล')
    text = text.replace('อปท. หรือเทศบาล', 'อบต. หรือเทศบาล')

    text = replace_once(text,
        '<span class="ef-label">🔍 กรองข้อมูล:</span>\n    <select id="efAuthority"',
        '<span class="ef-label">🔍 กรองข้อมูล:</span>\n    <select id="efDistrict" aria-label="อำเภอ"><option value="">ทุกอำเภอ</option></select>\n    <select id="efAuthority"',
        'executive district select')
    text = replace_once(text,
        '<div class="f-group"><label>อบต./เทศบาล</label><select id="fAuthority"><option value="">ทั้งหมด</option></select></div>',
        '<div class="f-group"><label>อำเภอ</label><select id="fDistrict"><option value="">ทั้งหมด</option></select></div>\n        <div class="f-group"><label>อบต./เทศบาล</label><select id="fAuthority"><option value="">ทั้งหมด</option></select></div>',
        'detail district select')
    text = replace_once(text,
        '<div class="df-group"><label>อบต./เทศบาล</label><select id="dfAuthority"><option value="">ทุก อบต./เทศบาล</option></select></div>',
        '<div class="df-group"><label>อำเภอ</label><select id="dfDistrict"><option value="">ทุกอำเภอ</option></select></div>\n            <div class="df-group"><label>อบต./เทศบาล</label><select id="dfAuthority"><option value="">ทุก อบต./เทศบาล</option></select></div>',
        'damaged district select')

    text = replace_once(text,
        "const TAMBONS_ORDER=AREA.TAMBON_ORDER.slice();\nconst AVAILABLE_TAMBONS=TAMBONS_ORDER.filter(tb=>RAW.some(r=>r.tambon===tb));\nconst AUTHORITY_ORDER=AREA.AUTHORITY_ORDER.slice();",
        "const TAMBONS_ORDER=AREA.TAMBON_ORDER.slice();\nconst DISTRICT_ORDER=AREA.DISTRICT_ORDER.slice();\nconst AVAILABLE_TAMBONS=TAMBONS_ORDER.filter(tb=>RAW.some(r=>r.tambon===tb));\nconst AUTHORITY_ORDER=AREA.AUTHORITY_ORDER.slice();",
        'district constants')

    old_scope = '''var execFilter  = { authority: '', tambon: '', type: '' };
var crossFilter = { type: null, tambon: null, problem: null };
// ตัวกรองฝั่งหน้า "ข้อมูลรายละเอียด" (แถบด้านข้าง) — อปท. → ตำบล → หมู่ → หมู่บ้าน
let state={authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};

function matchesAuthority(r, authority){ return AREA.recordMatchesAuthority(r, authority); }
function authorityTambonScope(authority){
  if(!authority) return TAMBONS_ORDER.slice();
  return AREA.tambonsForAuthority(authority);
}
function availableTambonsForExec(){
  const scope=execFilter.authority?authorityTambonScope(execFilter.authority):AVAILABLE_TAMBONS;
  return scope.filter(tb=>RAW.some(r=>r.tambon===tb && matchesAuthority(r,execFilter.authority)));
}

function getExecData() {
  return RAW.filter(function(r) {
    if (execFilter.authority && !matchesAuthority(r, execFilter.authority)) return false;
    if (execFilter.tambon && r.tambon !== execFilter.tambon) return false;
    if (execFilter.type   && r.type   !== execFilter.type)   return false;
    if (crossFilter.type    && r.type    !== crossFilter.type)    return false;
    if (crossFilter.tambon  && r.tambon  !== crossFilter.tambon)  return false;
    if (crossFilter.problem && !(r.problem && r.problem.includes(crossFilter.problem))) return false;
    return true;
  });
}'''
    new_scope = '''var execFilter  = { district: '', authority: '', tambon: '', type: '' };
var crossFilter = { type: null, tambon: null, problem: null };
// ตัวกรองฝั่งหน้า "ข้อมูลรายละเอียด" (แถบด้านข้าง) — อำเภอ → อบต./เทศบาล → ตำบล → หมู่ → หมู่บ้าน
let state={district:'',authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};

function matchesDistrict(r, district){ return AREA.recordMatchesDistrict(r, district); }
function matchesAuthority(r, authority){ return AREA.recordMatchesAuthority(r, authority); }
function districtTambonScope(district){ return district ? AREA.tambonsForDistrict(district) : TAMBONS_ORDER.slice(); }
function authorityTambonScope(authority,district){
  var items=authority ? AREA.tambonsForAuthority(authority) : TAMBONS_ORDER.slice();
  if(district){ var allowed=new Set(AREA.tambonsForDistrict(district)); items=items.filter(function(tb){return allowed.has(tb);}); }
  return items;
}
function authorityScope(district){ return district ? AREA.authoritiesForDistrict(district) : AUTHORITY_ORDER.slice(); }
function recordMatchesAreaScope(r,district,authority){
  if(district && !matchesDistrict(r,district)) return false;
  if(authority && !matchesAuthority(r,authority)) return false;
  return true;
}
function availableTambonsForExec(){
  const scope=authorityTambonScope(execFilter.authority,execFilter.district);
  return scope.filter(tb=>RAW.some(r=>r.tambon===tb && recordMatchesAreaScope(r,execFilter.district,execFilter.authority)));
}

function getExecData() {
  return RAW.filter(function(r) {
    if (execFilter.district && !matchesDistrict(r, execFilter.district)) return false;
    if (execFilter.authority && !matchesAuthority(r, execFilter.authority)) return false;
    if (execFilter.tambon && r.tambon !== execFilter.tambon) return false;
    if (execFilter.type   && r.type   !== execFilter.type)   return false;
    if (crossFilter.type    && r.type    !== crossFilter.type)    return false;
    if (crossFilter.tambon  && r.tambon  !== crossFilter.tambon)  return false;
    if (crossFilter.problem && !(r.problem && r.problem.includes(crossFilter.problem))) return false;
    return true;
  });
}'''
    text = replace_once(text, old_scope, new_scope, 'shared district state and scope')

    exec_setup = r'''function setupExecFilters\(\) \{.*?\n\}\nsetupExecFilters\(\);'''
    exec_repl = '''function setupExecFilters() {
  var types=[...new Set(RAW.map(function(r){return r.type;}).filter(Boolean))].sort(function(a,b){return a.localeCompare(b,'th');});
  var efD=document.getElementById('efDistrict');
  var efA=document.getElementById('efAuthority');
  var efTy=document.getElementById('efType');
  DISTRICT_ORDER.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent='อำเภอ'+v;efD.appendChild(o);});
  types.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;efTy.appendChild(o);});

  var efTambonCombo=TAMBON_UI.create({
    input:'#efTambon',listbox:'#efTambonListbox',clearButton:'#efTambonClear',errorElement:'#efTambonError',
    items:TAMBONS_ORDER,
    itemMeta:function(tambon){return AREA.authorityTambonScopeText(execFilter.authority,tambon);},
    onChange:function(value){ execFilter.tambon=value; crossFilter={type:null,tambon:null,problem:null}; updateCrossFilterBar(); runBuildExec(); }
  });
  function refreshExecAuthorities(){
    var cur=execFilter.authority, items=authorityScope(execFilter.district);
    efA.innerHTML='<option value="">ทุก อบต./เทศบาล</option>';
    items.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=AREA.authorityOptionLabel(v);efA.appendChild(o);});
    if(cur && !items.includes(cur)) execFilter.authority=''; efA.value=execFilter.authority;
  }
  function refreshExecTambons(){
    var cur=execFilter.tambon, items=authorityTambonScope(execFilter.authority,execFilter.district);
    if(cur && !items.includes(cur)) execFilter.tambon='';
    efTambonCombo.setItems(items,{silent:true}); efTambonCombo.setValue(execFilter.tambon,{silent:true});
  }
  refreshExecAuthorities(); refreshExecTambons();
  efD.addEventListener('change',function(e){ execFilter.district=e.target.value;execFilter.authority='';execFilter.tambon='';refreshExecAuthorities();refreshExecTambons();crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec(); });
  efA.addEventListener('change',function(e){ execFilter.authority=e.target.value;execFilter.tambon='';refreshExecTambons();crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec(); });
  efTy.addEventListener('change',function(e){execFilter.type=e.target.value;crossFilter={type:null,tambon:null,problem:null};updateCrossFilterBar();runBuildExec();});
  document.getElementById('efReset').addEventListener('click',function(){ execFilter={district:'',authority:'',tambon:'',type:''};crossFilter={type:null,tambon:null,problem:null};efD.value='';efTy.value='';refreshExecAuthorities();refreshExecTambons();updateCrossFilterBar();runBuildExec(); });
}
setupExecFilters();'''
    text = regex_once(text, exec_setup, exec_repl, 'executive filter setup', re.S)

    text = replace_once(text,
        "  var RISK_BASE = RAW.filter(function(r) {\n    if (execFilter.authority && !matchesAuthority(r,execFilter.authority)) return false;",
        "  var RISK_BASE = RAW.filter(function(r) {\n    if (execFilter.district && !matchesDistrict(r,execFilter.district)) return false;\n    if (execFilter.authority && !matchesAuthority(r,execFilter.authority)) return false;",
        'risk base district filter')
    text = replace_once(text,
        "const fKey=[execFilter.authority,execFilter.tambon,execFilter.type,crossFilter.tambon,crossFilter.type,crossFilter.problem||'',tbKey,typeKey,statusKey,problemKey,mapState.sizeByVolume,mapState.photoRing].join('|');",
        "const fKey=[execFilter.district,execFilter.authority,execFilter.tambon,execFilter.type,crossFilter.tambon,crossFilter.type,crossFilter.problem||'',tbKey,typeKey,statusKey,problemKey,mapState.sizeByVolume,mapState.photoRing].join('|');",
        'map filter key district')
    text = replace_once(text,
        "var isFiltered = execFilter.authority||execFilter.tambon||execFilter.type||crossFilter.type||crossFilter.tambon||crossFilter.problem;",
        "var isFiltered = execFilter.district||execFilter.authority||execFilter.tambon||execFilter.type||crossFilter.type||crossFilter.tambon||crossFilter.problem;",
        'executive filtered status district')

    text = replace_once(text,
        "fillSelect($('#fAuthority'),ACTIVE_AUTHORITIES,v=>AREA.authorityOptionLabel(v));\nfillSelect($('#fType'),types);",
        "fillSelect($('#fDistrict'),DISTRICT_ORDER,v=>'อำเภอ'+v);\nfillSelect($('#fType'),types);\n\nfunction refreshDetailAuthorities(){\n  const sel=$('#fAuthority');const cur=state.authority;const items=authorityScope(state.district);\n  resetSelect(sel,'ทั้งหมด');fillSelect(sel,items,v=>AREA.authorityOptionLabel(v));\n  if(cur&&items.includes(cur)){sel.value=cur;}else{sel.value='';state.authority='';}\n}\nrefreshDetailAuthorities();",
        'detail authority cascade setup')
    text = replace_once(text, "  const items=authorityTambonScope(state.authority);", "  const items=authorityTambonScope(state.authority,state.district);", 'detail tambon district scope')
    text = replace_once(text,
        "  let pool=RAW;\n  if(state.authority)pool=pool.filter(r=>matchesAuthority(r,state.authority));",
        "  let pool=RAW;\n  if(state.district)pool=pool.filter(r=>matchesDistrict(r,state.district));\n  if(state.authority)pool=pool.filter(r=>matchesAuthority(r,state.authority));",
        'detail village district pool')
    text = replace_once(text, "refreshTambonOptions();refreshMooOptions();refreshVillageOptions();", "refreshDetailAuthorities();refreshTambonOptions();refreshMooOptions();refreshVillageOptions();", 'detail initial refresh')
    text = replace_once(text,
        "$('#fAuthority').addEventListener('change',e=>{state.authority=e.target.value;state.tambon='';state.moo='';state.village='';refreshTambonOptions();refreshMooOptions();refreshVillageOptions();render();runBuildExec();});",
        "$('#fDistrict').addEventListener('change',e=>{state.district=e.target.value;state.authority='';state.tambon='';state.moo='';state.village='';refreshDetailAuthorities();refreshTambonOptions();refreshMooOptions();refreshVillageOptions();render();runBuildExec();});\n$('#fAuthority').addEventListener('change',e=>{state.authority=e.target.value;state.tambon='';state.moo='';state.village='';refreshTambonOptions();refreshMooOptions();refreshVillageOptions();render();runBuildExec();});",
        'detail district change event')
    text = replace_once(text,
        "  state={authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};\n  $('#fAuthority').value='';$('#fType').value='';$('#searchBox').value='';",
        "  state={district:'',authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};\n  $('#fDistrict').value='';$('#fType').value='';$('#searchBox').value='';",
        'detail reset state')
    text = replace_once(text, "  refreshTambonOptions();refreshMooOptions();refreshVillageOptions();render();runBuildExec();\n});", "  refreshDetailAuthorities();refreshTambonOptions();refreshMooOptions();refreshVillageOptions();render();runBuildExec();\n});", 'detail reset cascade')
    text = replace_once(text,
        "  return RAW.filter(r=>{\n    if(state.authority&&!matchesAuthority(r,state.authority))return false;",
        "  return RAW.filter(r=>{\n    if(state.district&&!matchesDistrict(r,state.district))return false;\n    if(state.authority&&!matchesAuthority(r,state.authority))return false;",
        'detail getFiltered district')
    text = replace_once(text,
        "  if(state.authority)parts.push(`อปท.: <b>${AREA.authorityOptionLabel(state.authority)}</b>`);",
        "  if(state.district)parts.push(`อำเภอ: <b>${state.district}</b>`);\n  if(state.authority)parts.push(`อบต./เทศบาล: <b>${AREA.authorityOptionLabel(state.authority)}</b>`);",
        'pivot filter note terminology/district')

    text = replace_once(text,
        "let dfState={authority:'',tambon:'',type:'',problem:null};\nfunction getDamagedData(){let b=RAW.filter(isDamaged);if(dfState.authority)b=b.filter(r=>matchesAuthority(r,dfState.authority));if(dfState.tambon)b=b.filter(r=>r.tambon===dfState.tambon);if(dfState.type)b=b.filter(r=>r.type===dfState.type);if(dfState.problem)b=b.filter(r=>r.problem&&r.problem.includes(dfState.problem));return b;}",
        "let dfState={district:'',authority:'',tambon:'',type:'',problem:null};\nfunction getDamagedData(){let b=RAW.filter(isDamaged);if(dfState.district)b=b.filter(r=>matchesDistrict(r,dfState.district));if(dfState.authority)b=b.filter(r=>matchesAuthority(r,dfState.authority));if(dfState.tambon)b=b.filter(r=>r.tambon===dfState.tambon);if(dfState.type)b=b.filter(r=>r.type===dfState.type);if(dfState.problem)b=b.filter(r=>r.problem&&r.problem.includes(dfState.problem));return b;}",
        'damaged state district')
    text = replace_once(text, "const fKey=[dfState.authority,dfState.tambon,dfState.type,dfState.problem||''].join('|');", "const fKey=[dfState.district,dfState.authority,dfState.tambon,dfState.type,dfState.problem||''].join('|');", 'damaged map filter key district')

    damaged_setup = r'''\(function setupDamagedFilters\(\)\{.*?\n\}\)\(\)'''
    damaged_repl = '''(function setupDamagedFilters(){
  const dfd=$('#dfDistrict'),dfa=$('#dfAuthority'),dfty=$('#dfType');
  fillSelect(dfd,DISTRICT_ORDER,v=>'อำเภอ'+v);
  uniqueSorted(RAW.filter(isDamaged).map(r=>r.type)).forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;dfty.appendChild(o);});
  const damagedTambonCombo=TAMBON_UI.create({ input:'#dfTambon',listbox:'#dfTambonListbox',clearButton:'#dfTambonClear',errorElement:'#dfTambonError',items:TAMBONS_ORDER,itemMeta:tambon=>AREA.authorityTambonScopeText(dfState.authority,tambon),onChange:value=>{dfState.tambon=value;renderDamagedTab();} });
  function refreshDamagedAuthorities(){ const cur=dfState.authority,items=authorityScope(dfState.district);resetSelect(dfa,'ทุก อบต./เทศบาล');fillSelect(dfa,items,v=>AREA.authorityOptionLabel(v));if(cur&&items.includes(cur)){dfa.value=cur;}else{dfa.value='';dfState.authority='';} }
  function refreshDamagedTambons(){ const cur=dfState.tambon,items=authorityTambonScope(dfState.authority,dfState.district);if(cur&&!items.includes(cur))dfState.tambon='';damagedTambonCombo.setItems(items,{silent:true});damagedTambonCombo.setValue(dfState.tambon,{silent:true}); }
  refreshDamagedAuthorities();refreshDamagedTambons();
  const chips=$('#dfProblemChips');
  DAMAGE_PROBLEM_TAGS.forEach(tag=>{const c=document.createElement('div');c.className='df-chip';c.textContent=tag;c.onclick=()=>{dfState.problem=(dfState.problem===tag)?null:tag;document.querySelectorAll('.df-chip').forEach(x=>x.classList.remove('active'));if(dfState.problem)c.classList.add('active');renderDamagedTab();};chips.appendChild(c);});
  dfd.addEventListener('change',e=>{dfState.district=e.target.value;dfState.authority='';dfState.tambon='';refreshDamagedAuthorities();refreshDamagedTambons();renderDamagedTab();});
  dfa.addEventListener('change',e=>{dfState.authority=e.target.value;dfState.tambon='';refreshDamagedTambons();renderDamagedTab();});
  dfty.addEventListener('change',e=>{dfState.type=e.target.value;renderDamagedTab();});
  $('#dfReset').addEventListener('click',()=>{dfState={district:'',authority:'',tambon:'',type:'',problem:null};dfd.value='';dfty.value='';refreshDamagedAuthorities();refreshDamagedTambons();document.querySelectorAll('.df-chip').forEach(x=>x.classList.remove('active'));renderDamagedTab();});
})()'''
    text = regex_once(text, damaged_setup, damaged_repl, 'damaged filter setup', re.S)
    text = replace_once(text, "  const pivotBase=state.authority?RAW.filter(r=>matchesAuthority(r,state.authority)):RAW;", "  const pivotBase=RAW.filter(r=>(!state.district||matchesDistrict(r,state.district))&&(!state.authority||matchesAuthority(r,state.authority)));", 'pivot base district')

    for token in ['id="efDistrict"','id="fDistrict"','id="dfDistrict"',"var execFilter  = { district: '', authority: '', tambon: '', type: '' };", "let state={district:'',authority:'',tambon:'',moo:'',type:'',village:'',q:'',problem:null};", "let dfState={district:'',authority:'',tambon:'',type:'',problem:null};"]:
        if text.count(token) != 1: fail(f'post-patch sanity {token!r}: expected 1, found {text.count(token)}')
    if 'อปท./เทศบาล' in text or 'อปท. หรือเทศบาล' in text: fail('old filter terminology still exists')
    INDEX.write_text(text, encoding='utf-8', newline='\n')

    if not WATER_STORE.exists(): fail(f'missing {WATER_STORE}')
    store = WATER_STORE.read_text(encoding='utf-8')
    old_authorities = """export const ALLOWED_AUTHORITIES = new Set([
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
]);"""
    new_authorities = """export const ALLOWED_AUTHORITIES = new Set([
  'ทม.พะเยา','ทต.แม่กา','อบต.แม่นาเรือ','อบต.แม่ใส','อบต.บ้านตุ่น','ทต.บ้านสาง',
  'ทต.สันป่าม่วง','ทต.บ้านต๋อม','ทต.บ้านต๊ำ','ทต.ท่าจำปี','ทต.แม่ปืม','ทต.บ้านใหม่',
  'ทต.แม่ใจ','ทต.รวมใจพัฒนา','ทต.ศรีถ้อย','อบต.แม่สุก','ทต.ป่าแฝก','ทต.บ้านเหล่า','ทต.เจริญราษฎร์',
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
]);"""
    store = replace_once(store, old_authorities, new_authorities, 'backend authority allowlist')
    WATER_STORE.write_text(store, encoding='utf-8', newline='\n')

    if not AREA_TEST.exists(): fail(f'missing {AREA_TEST}')
    test = AREA_TEST.read_text(encoding='utf-8')
    old_auth_test = """const AUTHORITIES = [
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
];"""
    new_auth_test = """const AUTHORITIES = [
  'ทม.พะเยา','ทต.แม่กา','อบต.แม่นาเรือ','อบต.แม่ใส','อบต.บ้านตุ่น','ทต.บ้านสาง',
  'ทต.สันป่าม่วง','ทต.บ้านต๋อม','ทต.บ้านต๊ำ','ทต.ท่าจำปี','ทต.แม่ปืม','ทต.บ้านใหม่',
  'ทต.แม่ใจ','ทต.รวมใจพัฒนา','ทต.ศรีถ้อย','อบต.แม่สุก','ทต.ป่าแฝก','ทต.บ้านเหล่า','ทต.เจริญราษฎร์',
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
];"""
    test = replace_once(test, old_auth_test, new_auth_test, 'legacy test authority list')
    test = replace_once(test, "assert.equal(A.RULESET_VERSION, '2026-08-27.2');", "assert.equal(A.RULESET_VERSION, '2026-09-02.1');", 'legacy test ruleset version')
    test = replace_once(test, "assert.equal(A.authorityModeFor('แม่กา',1), 'TAMBON_ONLY');", "assert.equal(A.authorityModeFor('แม่กา',1), 'SUGGEST');\nassert.deepEqual(A.authorityOptionsFor('แม่กา',1), ['ทต.แม่กา']);", 'legacy test phase2 mae ka mode')
    old_out = """// Out-of-brief tambons remain normal Tambon data and receive no invented authority.
for (const tb of ORIGINAL_18) {
  const item = A.decorateRecord({tambon:tb,moo:1});
  assert.equal(item.localAuthority, null, tb);
  assert.equal(item.authorityConfidence, 'out-of-brief', tb);
}"""
    new_out = """// Phase 2 master: whole-tambon authorities are inferred for legacy rows; split areas remain ambiguous.
const PHASE2_WHOLE = {
  'แม่กา':'ทต.แม่กา','แม่นาเรือ':'อบต.แม่นาเรือ','แม่ใส':'อบต.แม่ใส','บ้านตุ่น':'อบต.บ้านตุ่น',
  'บ้านสาง':'ทต.บ้านสาง','สันป่าม่วง':'ทต.สันป่าม่วง','บ้านต๋อม':'ทต.บ้านต๋อม','บ้านต๊ำ':'ทต.บ้านต๊ำ',
  'ท่าจำปี':'ทต.ท่าจำปี','เทศบาลเมือง':'ทม.พะเยา','แม่ปืม':'ทต.แม่ปืม','บ้านใหม่':'ทต.บ้านใหม่',
  'เจริญราษฎร์':'ทต.เจริญราษฎร์','แม่สุก':'อบต.แม่สุก','ป่าแฝก':'ทต.ป่าแฝก','บ้านเหล่า':'ทต.บ้านเหล่า'
};
for (const [tb, expected] of Object.entries(PHASE2_WHOLE)) {
  const item = A.decorateRecord({tambon:tb,moo:1});
  assert.equal(item.localAuthority, expected, tb);
  assert.equal(item.authorityConfidence, 'legacy-inferred', tb);
}
assert.deepEqual(A.authorityOptionsFor('แม่ใจ',1), ['ทต.แม่ใจ','ทต.รวมใจพัฒนา']);
assert.deepEqual(A.authorityOptionsFor('แม่ใจ',2), ['ทต.แม่ใจ']);
assert.deepEqual(A.authorityOptionsFor('แม่ใจ',4), ['ทต.รวมใจพัฒนา']);
assert.deepEqual(A.authorityOptionsFor('ศรีถ้อย',4), ['ทต.แม่ใจ','ทต.ศรีถ้อย']);
assert.deepEqual(A.authorityOptionsFor('ศรีถ้อย',5), ['ทต.ศรีถ้อย']);"""
    test = replace_once(test, old_out, new_out, 'legacy test phase2 mapping block')
    AREA_TEST.write_text(test, encoding='utf-8', newline='\n')

    print('PATCH OK:', INDEX)
    print('PATCH OK:', WATER_STORE)
    print('PATCH OK:', AREA_TEST)


if __name__ == '__main__':
    main()
