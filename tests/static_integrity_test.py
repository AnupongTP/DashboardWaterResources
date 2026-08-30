#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import tomllib

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
index = (SITE / 'index.html').read_text(encoding='utf-8')
area = (SITE / 'assets' / 'area-responsibility.js').read_text(encoding='utf-8')
combo = (SITE / 'assets' / 'tambon-combobox.js').read_text(encoding='utf-8')
runtime = (SITE / 'assets' / 'runtime-config.js').read_text(encoding='utf-8')
maeka_adapter = (SITE / 'assets' / 'maeka-data-adapter.js').read_text(encoding='utf-8')
maeka_app = (SITE / 'assets' / 'maeka-app.js').read_text(encoding='utf-8')
maeka = (SITE / 'maeka.html').read_text(encoding='utf-8')
loader = (SITE / 'assets' / 'water-data-loader.js').read_text(encoding='utf-8')
store = (ROOT / 'netlify' / 'lib' / 'water-store.mjs').read_text(encoding='utf-8')
gas = (ROOT / 'google-apps-script' / 'WaterResourcesDashboardSync.gs').read_text(encoding='utf-8')
bootstrap = json.loads((SITE / 'data' / 'waterresources.initial.json').read_text(encoding='utf-8'))
meta = json.loads((SITE / 'data' / 'waterresources.initial.meta.json').read_text(encoding='utf-8'))
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
build_info = json.loads((ROOT / 'docs' / 'BUILD_INFO.json').read_text(encoding='utf-8'))
mapping_contract = json.loads((ROOT / 'docs' / 'AUTHORITY_MAPPING_CONTRACT.json').read_text(encoding='utf-8'))
policy_contract = json.loads((ROOT / 'docs' / 'LOCALAUTHORITY_POLICY_CONTRACT.json').read_text(encoding='utf-8'))

MASTER_TAMBONS = [
    'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง',
    'เจริญราษฎร์','แม่ปืม','แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย',
    'สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน','จำป่าหวาย','บ้านถ้ำ','แม่อิง','สันโค้ง','ดงเจน'
]
AUTHORITIES = [
    'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
    'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
]

assert len(MASTER_TAMBONS) == 29 and len(set(MASTER_TAMBONS)) == 29
assert len(bootstrap) == 1158
assert meta['recordCount'] == 1158
assert meta['lastId'] == 1164
assert package['version'] == '1.4.7'
assert package['dependencies']['@netlify/blobs'] == '11.0.1'
assert build_info['version'] == '1.4.7'
assert build_info['status'] == 'candidate'
assert build_info['productionReady'] is False
assert build_info['rulesetVersion'] == '2026-08-27.2'
assert build_info['policyVersion'] == 'KebNamComplete-LocalAuthority-v1.2'
assert policy_contract['version'] == 'KebNamComplete-LocalAuthority-v1.2'

for marker in [
    'id="efAuthority"', 'id="efTambon"', 'id="efTambonListbox"', 'id="efTambonError"',
    'id="fAuthority"', 'id="fTambon"', 'id="fTambonListbox"', 'id="fMoo"', 'id="fVillage"',
    'id="dfAuthority"', 'id="dfTambon"', 'id="dfTambonListbox"',
    './assets/runtime-config.js', './assets/water-data-loader.js', './assets/area-responsibility.js', './assets/tambon-combobox.js',
    'ACTIVE_AUTHORITIES', 'AREA.activeAuthorities(RAW)', 'authorityDisplay', 'TambonCombobox',
    'AREA.validConfiguredMoos(state.authority,state.tambon)', 'AREA.authorityTambonScopeText(state.authority,tambon)',
    'tambon-combobox-option-scope', '__AUTHORITY_RESOLUTION_STATS__',
    'table-scroll-hint', 'mobile-tab-hint', 'pivot-scroll-hint',
    'MOBILE RESPONSIVE AUDIT v1.4.6'
]:
    assert marker in index, f'missing index marker: {marker}'

# User-facing unresolved/warning bucket must stay removed.
for forbidden_ui in ['ต้องยืนยันเขต อปท.', '⚠️ ต้องยืนยันเขต', '__UNRESOLVED__', 'authority-filter-note']:
    assert forbidden_ui not in index, f'forbidden unresolved UI marker remains: {forbidden_ui}'

# Authority dropdowns are driven from full-dataset active authorities, not all configured authorities.
assert "ACTIVE_AUTHORITIES.forEach" in index
assert "fillSelect($('#fAuthority'),ACTIVE_AUTHORITIES" in index
assert "fillSelect(dfa,ACTIVE_AUTHORITIES" in index
assert "const ACTIVE_AUTHORITIES=AREA.activeAuthorities(RAW);" in index

# Tambon filters remain strict allow-list combobox inputs.
for element_id in ['efTambon','fTambon','dfTambon']:
    assert f'<select id="{element_id}"' not in index, f'{element_id} must not be a select'
    assert f'id="{element_id}"' in index
assert 'role", "combobox"' in combo or "setAttribute('role', 'combobox')" in combo
assert 'กรุณาเลือกตำบลจากรายการที่กำหนด' in combo
assert 'ไม่พบตำบลในรายการที่กำหนด' in combo
assert 'itemMeta' in combo
assert 'option.dataset.scope = meta' in combo
assert "if (rule.full) return ''" in area and 'ทั้งหมู่' in area and 'บางพื้นที่' in area

for tb in MASTER_TAMBONS:
    assert tb in area, f'missing area tambon {tb}'
    assert tb in store, f'missing store tambon {tb}'
    assert tb in gas, f'missing GAS tambon {tb}'

for authority in AUTHORITIES:
    assert authority in area, f'missing area authority {authority}'
    assert authority in store, f'missing Netlify authority allow-list {authority}'

# v1.2 resolver contract: exact mapping, suggestion policy, explicit same-tambon override,
# legacy fallback, and no WaterOwner inference.
for marker in [
    "const POLICY_VERSION = 'KebNamComplete-LocalAuthority-v1.2'",
    'recommendedAuthorityFor', 'validAuthoritiesFor', 'authorityModeFor',
    'explicitAuthorityValidation', 'validConfiguredMoos', 'authorityTambonScopeText',
    "confidence: checked.overridden ? 'explicit-override' : 'explicit-field'",
    "confidence: 'legacy-inferred'", "source: 'tambon-moo-legacy-fallback'",
    "confidence: 'invalid-explicit'", 'activeAuthorities', 'authorityCounts', 'resolutionStats'
]:
    assert marker in area, f'missing v1.2 resolver marker: {marker}'
assert 'record && record.owner' not in area

# Mapping contract remains 47 exact combinations; policy contract documents how exact values are interpreted.
combos = 0
for rule in mapping_contract.values():
    if isinstance(rule.get('all'), list):
        combos += 1
    combos += len(rule.get('moos', {}))
assert combos == 47
assert policy_contract['modes']['SELECT']['exactOptions'] == 'more-than-one'
assert policy_contract['modes']['SUGGEST']['exactOptions'] == 'exactly-one'
assert policy_contract['modes']['TAMBON_ONLY']['exactOptions'] == 'none'

# Netlify must preserve raw LocalAuthority rather than silently converting invalid explicit input to null.
# Browser validation must be able to distinguish invalid explicit values from legacy blank records.
assert 'normalizeAuthorityField' in store
assert 'localAuthority: normalizeAuthorityField(input.localAuthority)' in store
assert 'Do NOT silently coerce an unknown value to null' in store

# GAS sync is integration-ready and backward-compatible: LocalAuthority is optional and read-only.
assert "headerIndex.LocalAuthority === undefined" in gas
assert "localAuthority:" in gas
assert "getRange(1, 1, 1, physicalLastColumn)" in gas
assert "Math.min(sheet.getLastColumn(), 24)" not in gas
for forbidden in ['.setValue(', '.setValues(', '.appendRow(', '.deleteRow(', '.clear(', '.clearContent(']:
    assert forbidden not in gas, f'Sync helper must not write Sheet data: {forbidden}'

# Canonical spelling is บ้านปิน. Legacy spelling is compatibility-only and never user-facing.
assert "'อบต.บ้านปิน'" in area
assert "'บ้านปิน'" in area
assert "['บ้านปิ่น', 'บ้านปิน']" in area
assert "['บ้านปิ่น','บ้านปิน']" in store
assert "if (text === 'บ้านปิ่น') return 'บ้านปิน';" in gas
assert 'บ้านปิ่น' not in index, 'legacy spelling must never appear in user-facing index.html'
assert 'function getDamagedData(){let b=RAW.filter(isDamaged);' in index, 'damaged tab must use independent filters'

with (ROOT / 'netlify.toml').open('rb') as f:
    config = tomllib.load(f)
assert config['build']['publish'] == 'site'
assert config['functions']['directory'] == 'netlify/functions'

# v1.4.7 root files are deliberate zero-command launchers into the published /site copies.
root_index = (ROOT/'index.html').read_text(encoding='utf-8')
root_maeka = (ROOT/'maeka.html').read_text(encoding='utf-8')
assert "./site/index.html" in root_index and 'window.location.replace' in root_index
assert "./site/maeka.html" in root_maeka and 'window.location.replace' in root_maeka

# File mode: one centralized production origin, read-only remote API, local JS bootstrap fallback.
assert "DEFAULT_PRODUCTION_ORIGIN = 'https://dashboard-waterresources-phayao-test.netlify.app'" in runtime
assert "forcedMode || (isFile ? 'file'" in runtime and 'apiUrl' in runtime
for marker in [
    "runtime.mode === 'file' ? 'production-api-file' : 'netlify-blob-api'",
    "runtime.mode === 'file' ? 'static-bootstrap-file' : 'static-bootstrap'",
    'BOOTSTRAP_SCRIPT_URL', 'remoteOrigin', "mode: runtime.mode === 'file' ? 'cors' : 'same-origin'",
    'FILE_BRIDGE_ENDPOINT', 'getRemoteDatasetViaFileBridge', "source: 'production-script-bridge-file'"
]:
    assert marker in loader, f'missing file-mode loader marker: {marker}'
bootstrap_js = (SITE/'data'/'waterresources.initial.js').read_text(encoding='utf-8')
assert bootstrap_js.startswith('window.__WATER_BOOTSTRAP_DATA__ = ') and len(bootstrap) == 1158

# Mae Ka page now consumes the same WaterData dataset and adapts only ตำบลแม่กา.
for marker in ['./assets/runtime-config.js','./assets/water-data-loader.js','./assets/maeka-data-adapter.js','./assets/maeka-app.js']:
    assert marker in maeka or marker in maeka_app, f'missing Mae Ka file-mode marker: {marker}'
assert 'window.WaterData.load()' in maeka
assert "String(record.tambon || '').trim() === 'แม่กา'" in maeka_adapter
assert 'record.depthnet' in maeka_adapter and 'record.imglink' in maeka_adapter and 'record.volume' in maeka_adapter
assert 'const DATA = Array.isArray(window.__MAEKA_DATA__) ? window.__MAEKA_DATA__ : [];' in maeka_app
assert 'const DATA = [{' not in maeka, 'Mae Ka HTML must not keep a frozen embedded dataset'

# CORS is intentionally opened only on JSON read endpoints. A separate GET-only script bridge supports file:// without CORS; sync stays closed.
read_fn = (ROOT/'netlify'/'functions'/'waterresources.mjs').read_text(encoding='utf-8')
version_fn = (ROOT/'netlify'/'functions'/'waterresources-version.mjs').read_text(encoding='utf-8')
sync_fn = (ROOT/'netlify'/'functions'/'waterresources-sync.mjs').read_text(encoding='utf-8')
bridge_fn = (ROOT/'netlify'/'functions'/'waterresources-file-bridge.mjs').read_text(encoding='utf-8')
for text in [read_fn, version_fn]:
    assert "'Access-Control-Allow-Origin': '*'" in text
    assert "request.method === 'OPTIONS'" in text
    assert 'Access-Control-Expose-Headers' in text
assert 'Access-Control-Allow-Origin' not in sync_fn
assert "request.method !== 'POST'" in sync_fn and 'isAuthorizedSyncRequest' in sync_fn
assert 'CALLBACK_RE' in bridge_fn and "request.method !== 'GET' && request.method !== 'HEAD'" in bridge_fn
assert 'application/javascript' in bridge_fn and 'isAuthorizedSyncRequest' not in bridge_fn
assert '/api/waterresources/file-bridge' in (ROOT/'netlify.toml').read_text(encoding='utf-8')

print('static_integrity_test: PASS')
