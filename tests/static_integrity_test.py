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
store = (ROOT / 'netlify' / 'lib' / 'water-store.mjs').read_text(encoding='utf-8')
gas = (ROOT / 'google-apps-script' / 'WaterResourcesDashboardSync.gs').read_text(encoding='utf-8')
bootstrap = json.loads((SITE / 'data' / 'waterresources.initial.json').read_text(encoding='utf-8'))
meta = json.loads((SITE / 'data' / 'waterresources.initial.meta.json').read_text(encoding='utf-8'))

MASTER_TAMBONS = [
    'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง',
    'เจริญราษฎร์','แม่ปืม','แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย',
    'สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน','จำป่าหวาย','บ้านถ้ำ','แม่อิง','สันโค้ง','ดงเจน'
]

assert len(MASTER_TAMBONS) == 29 and len(set(MASTER_TAMBONS)) == 29
assert len(bootstrap) == 1158
assert meta['recordCount'] == 1158
assert meta['lastId'] == 1164

for marker in [
    'id="efAuthority"', 'id="efTambon"', 'id="efTambonListbox"', 'id="efTambonError"',
    'id="fAuthority"', 'id="fTambon"', 'id="fTambonListbox"', 'id="fMoo"', 'id="fVillage"',
    'id="dfAuthority"', 'id="dfTambon"', 'id="dfTambonListbox"',
    '/assets/water-data-loader.js', '/assets/area-responsibility.js', '/assets/tambon-combobox.js',
    'localAuthority', 'authorityDisplay', 'TambonCombobox'
]:
    assert marker in index, f'missing index marker: {marker}'

# Tambon filters must no longer be selects. They are allow-list-only combobox inputs.
for element_id in ['efTambon','fTambon','dfTambon']:
    assert f'<select id="{element_id}"' not in index, f'{element_id} must not be a select'
    assert f'id="{element_id}"' in index
assert 'role", "combobox"' in combo or "setAttribute('role', 'combobox')" in combo
assert 'กรุณาเลือกตำบลจากรายการที่กำหนด' in combo
assert 'ไม่พบตำบลในรายการที่กำหนด' in combo

for tb in MASTER_TAMBONS:
    assert tb in area, f'missing area tambon {tb}'
    assert tb in store, f'missing store tambon {tb}'
    assert tb in gas, f'missing GAS tambon {tb}'

for authority in ['ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย','ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง']:
    assert authority in area, f'missing authority {authority}'

# Canonical spelling is บ้านปิน. บ้านปิ่น may exist only in explicit legacy-input compatibility code/comments.
assert "'อบต.บ้านปิน'" in area
assert "'บ้านปิน'" in area
assert "['บ้านปิ่น', 'บ้านปิน']" in area
assert "['บ้านปิ่น','บ้านปิน']" in store
assert "if (text === 'บ้านปิ่น') return 'บ้านปิน';" in gas
assert 'บ้านปิ่น' not in index, 'legacy spelling must never appear in user-facing index.html'
assert 'function getDamagedData(){let b=RAW.filter(isDamaged);' in index, 'damaged tab must use its own filters, not detail-view getFiltered() state'

with (ROOT / 'netlify.toml').open('rb') as f:
    config = tomllib.load(f)
assert config['build']['publish'] == 'site'
assert config['functions']['directory'] == 'netlify/functions'

# Sync helper may READ Sheet only; it must never write Sheet cells.
for forbidden in ['.setValue(', '.setValues(', '.appendRow(', '.deleteRow(', '.clear(', '.clearContent(']:
    assert forbidden not in gas, f'Sync helper must not write Sheet data: {forbidden}'

# Production HTML copies at root must be byte-identical to published /site copies.
assert (ROOT/'index.html').read_bytes() == (SITE/'index.html').read_bytes()
assert (ROOT/'maeka.html').read_bytes() == (SITE/'maeka.html').read_bytes()

# maeka.html and data loader remain byte-identical to the validated cache build.
expected_maeka = 'd992edcb7d182e2cbc48132fb5ea9f47fa794c0795b027e065749fb3d101be56'
expected_loader = 'd83358e58220637aa07b104cd33f09b630d7fb4a804dde88b21fda93a16f42b4'
assert hashlib.sha256((SITE/'maeka.html').read_bytes()).hexdigest() == expected_maeka
assert hashlib.sha256((SITE/'assets'/'water-data-loader.js').read_bytes()).hexdigest() == expected_loader

print('static_integrity_test: PASS')
