from pathlib import Path

root=Path(__file__).resolve().parents[1]
index=(root/'site/index.html').read_text(encoding='utf-8')
area=(root/'site/assets/area-responsibility.js').read_text(encoding='utf-8')
store=(root/'netlify/lib/water-store.mjs').read_text(encoding='utf-8')

for token in ['id="efDistrict"','id="fDistrict"','id="dfDistrict"']:
    assert index.count(token)==1, token
assert 'อปท./เทศบาล' not in index
assert 'อปท. หรือเทศบาล' not in index
for token in [
    "execFilter  = { district:", "state={district:", "dfState={district:",
    "AREA.recordMatchesDistrict", "AREA.authoritiesForDistrict", "AREA.tambonsForDistrict"
]: assert token in index, token
for authority in [
    'ทม.พะเยา','ทต.แม่กา','อบต.แม่นาเรือ','อบต.แม่ใส','อบต.บ้านตุ่น','ทต.บ้านสาง',
    'ทต.สันป่าม่วง','ทต.บ้านต๋อม','ทต.บ้านต๊ำ','ทต.ท่าจำปี','ทต.แม่ปืม','ทต.บ้านใหม่',
    'ทต.แม่ใจ','ทต.รวมใจพัฒนา','ทต.ศรีถ้อย','อบต.แม่สุก','ทต.ป่าแฝก','ทต.บ้านเหล่า','ทต.เจริญราษฎร์'
]:
    assert authority in area, authority
    assert authority in store, authority
assert "const RULESET_VERSION = '2026-09-02.1'" in area
print('PASS phase2_static_contract_test')
