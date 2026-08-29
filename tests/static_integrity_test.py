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
assert package['version'] == '1.4.3'
assert package['dependencies']['@netlify/blobs'] == '11.0.1'
assert build_info['version'] == '1.4.3'
assert build_info['status'] == 'candidate'
assert build_info['productionReady'] is False
assert build_info['rulesetVersion'] == '2026-08-27.2'
assert build_info['policyVersion'] == 'KebNamComplete-LocalAuthority-v1.2'
assert policy_contract['version'] == 'KebNamComplete-LocalAuthority-v1.2'

for marker in [
    'id="efAuthority"', 'id="efTambon"', 'id="efTambonListbox"', 'id="efTambonError"',
    'id="fAuthority"', 'id="fTambon"', 'id="fTambonListbox"', 'id="fMoo"', 'id="fVillage"',
    'id="dfAuthority"', 'id="dfTambon"', 'id="dfTambonListbox"',
    '/assets/water-data-loader.js', '/assets/area-responsibility.js', '/assets/tambon-combobox.js',
    'ACTIVE_AUTHORITIES', 'AREA.activeAuthorities(RAW)', 'authorityDisplay', 'TambonCombobox',
    'AREA.validConfiguredMoos(state.authority,state.tambon)', 'AREA.authorityTambonScopeText(state.authority,tambon)',
    'tambon-combobox-option-scope', '__AUTHORITY_RESOLUTION_STATS__'
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

# Production HTML copies at root must be byte-identical to published /site copies.
assert (ROOT/'index.html').read_bytes() == (SITE/'index.html').read_bytes()
assert (ROOT/'maeka.html').read_bytes() == (SITE/'maeka.html').read_bytes()

# Components intentionally outside this Dashboard authority change remain byte-identical to validated v1.3.1.
expected_maeka = 'd992edcb7d182e2cbc48132fb5ea9f47fa794c0795b027e065749fb3d101be56'
expected_loader = 'd83358e58220637aa07b104cd33f09b630d7fb4a804dde88b21fda93a16f42b4'
assert hashlib.sha256((SITE/'maeka.html').read_bytes()).hexdigest() == expected_maeka
assert hashlib.sha256((SITE/'assets'/'water-data-loader.js').read_bytes()).hexdigest() == expected_loader

print('static_integrity_test: PASS')
