import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window = {};
await import('../site/assets/area-responsibility.js');
const A = globalThis.window.AreaResponsibility;
assert.ok(A, 'AreaResponsibility was not exported');

const MASTER_TAMBONS = [
  'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง',
  'เจริญราษฎร์','แม่ปืม','แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย',
  'สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน','จำป่าหวาย','บ้านถ้ำ','แม่อิง','สันโค้ง','ดงเจน'
];
const ORIGINAL_18 = MASTER_TAMBONS.slice(0, 18);
const AUTHORITY_11 = MASTER_TAMBONS.slice(18);
const AUTHORITIES = [
  'ทม.พะเยา','ทต.แม่กา','อบต.แม่นาเรือ','อบต.แม่ใส','อบต.บ้านตุ่น','ทต.บ้านสาง',
  'ทต.สันป่าม่วง','ทต.บ้านต๋อม','ทต.บ้านต๊ำ','ทต.ท่าจำปี','ทต.แม่ปืม','ทต.บ้านใหม่',
  'ทต.แม่ใจ','ทต.รวมใจพัฒนา','ทต.ศรีถ้อย','อบต.แม่สุก','ทต.ป่าแฝก','ทต.บ้านเหล่า','ทต.เจริญราษฎร์',
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.สันโค้ง','อบต.แม่อิง','ทต.ดงเจน'
];

assert.equal(A.RULESET_VERSION, '2026-09-02.1');
assert.equal(A.POLICY_VERSION, 'KebNamComplete-LocalAuthority-v1.2');
assert.deepEqual(A.TAMBON_ORDER, MASTER_TAMBONS);
assert.deepEqual(A.OLD_TAMBONS, ORIGINAL_18);
assert.deepEqual(A.NEW_TAMBONS, AUTHORITY_11);
assert.deepEqual(A.AUTHORITY_ORDER, AUTHORITIES);
assert.equal(new Set(A.TAMBON_ORDER).size, 29);

assert.equal(A.canonicalTambon('บ้านปิน'), 'บ้านปิน');
assert.equal(A.canonicalTambon('บ้านปิ่น'), 'บ้านปิน');
assert.equal(A.canonicalTambon('เทศบาลเมืองพะเยา'), 'เทศบาลเมือง');
assert.equal(A.normalizeAuthority(' ทม.ดอกคำใต้ '), 'ทม.ดอกคำใต้');
assert.equal(A.normalizeAuthority('อบต.ที่ไม่มีใน Master'), null);

assert.deepEqual(A.tambonsForAuthority('ทม.ดอกคำใต้'), ['สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม']);
assert.deepEqual(A.tambonsForAuthority('ทต.ดงเจน'), ['แม่อิง','ดงเจน']);
assert.deepEqual(A.tambonsForAuthority(''), MASTER_TAMBONS);

// Exact mapping contract must remain byte-for-byte semantically equal to the validated form master.
const mappingContract = JSON.parse(
  fs.readFileSync(new URL('../docs/AUTHORITY_MAPPING_CONTRACT.json', import.meta.url), 'utf8')
);
let contractCombinationCount = 0;
for (const [tambon, rule] of Object.entries(mappingContract)) {
  if (Array.isArray(rule.all)) {
    assert.deepEqual(A.authorityOptionsFor(tambon, 1), rule.all, `${tambon}|all`);
    contractCombinationCount += 1;
  }
  for (const [moo, expected] of Object.entries(rule.moos || {})) {
    assert.deepEqual(A.authorityOptionsFor(tambon, Number(moo)), expected, `${tambon}|${moo}`);
    contractCombinationCount += 1;
  }
}
assert.equal(contractCombinationCount, 47);

// SELECT mode: exact mapping has multiple options and must not suggest one silently.
for (const [tambon, moo, expected] of [
  ['ดอกคำใต้',1,['ทม.ดอกคำใต้','อบต.ดอกคำใต้']],
  ['ดอกคำใต้',2,['ทม.ดอกคำใต้','อบต.ดอกคำใต้']],
  ['ดอนศรีชุม',8,['ทม.ดอกคำใต้','อบต.ดอนศรีชุม']],
  ['ดอนศรีชุม',9,['ทม.ดอกคำใต้','อบต.ดอนศรีชุม']]
]) {
  assert.equal(A.authorityModeFor(tambon, moo), 'SELECT');
  assert.equal(A.recommendedAuthorityFor(tambon, moo), null);
  assert.deepEqual(A.validAuthoritiesFor(tambon, moo), expected);
}

// SUGGEST mode: exact value is recommendation, but another authority from the same tambon is a valid explicit override.
assert.equal(A.authorityModeFor('ดอกคำใต้',3), 'SUGGEST');
assert.equal(A.recommendedAuthorityFor('ดอกคำใต้',3), 'อบต.ดอกคำใต้');
assert.deepEqual(A.validAuthoritiesFor('ดอกคำใต้',3), ['อบต.ดอกคำใต้','ทม.ดอกคำใต้']);
assert.equal(A.recommendedAuthorityFor('ดอกคำใต้',7), 'ทม.ดอกคำใต้');
assert.deepEqual(A.validAuthoritiesFor('ดอกคำใต้',7), ['ทม.ดอกคำใต้','อบต.ดอกคำใต้']);
assert.equal(A.recommendedAuthorityFor('ดอนศรีชุม',4), 'อบต.ดอนศรีชุม');
assert.deepEqual(A.validAuthoritiesFor('ดอนศรีชุม',4), ['อบต.ดอนศรีชุม','ทม.ดอกคำใต้']);
assert.equal(A.recommendedAuthorityFor('แม่อิง',2), 'ทต.ดงเจน');
assert.deepEqual(A.validAuthoritiesFor('แม่อิง',2), ['ทต.ดงเจน','อบต.แม่อิง']);
assert.equal(A.recommendedAuthorityFor('แม่อิง',5), 'อบต.แม่อิง');
assert.deepEqual(A.validAuthoritiesFor('แม่อิง',5), ['อบต.แม่อิง','ทต.ดงเจน']);

// Full-tambon rules have only one authority, so there is nothing to override to.
assert.deepEqual(A.validAuthoritiesFor('คือเวียง',1), ['อบต.คือเวียง']);
assert.deepEqual(A.validAuthoritiesFor('บ้านปิน',1), ['อบต.บ้านปิน']);

// TAMBON_ONLY: no exact mapping => explicit LocalAuthority is not accepted.
assert.equal(A.authorityModeFor('ดงเจน',6), 'TAMBON_ONLY');
assert.deepEqual(A.authorityOptionsFor('ดงเจน',6), []);
assert.deepEqual(A.validAuthoritiesFor('ดงเจน',6), []);
assert.equal(A.authorityModeFor('แม่กา',1), 'SUGGEST');
assert.deepEqual(A.authorityOptionsFor('แม่กา',1), ['ทต.แม่กา']);

// Legacy helpers are kept, while v1.2 cascading helper reflects every authority users can validly confirm.
assert.deepEqual(A.autoConfiguredMoos('อบต.แม่อิง', 'แม่อิง'), [4,5,6,8]);
assert.deepEqual(A.validConfiguredMoos('อบต.แม่อิง', 'แม่อิง'), [1,2,3,4,5,6,7,8]);
assert.deepEqual(A.validConfiguredMoos('ทต.ดงเจน', 'แม่อิง'), [1,2,3,4,5,6,7,8]);
assert.deepEqual(A.validConfiguredMoos('ทม.ดอกคำใต้', 'ดอกคำใต้'), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(A.validConfiguredMoos('อบต.ดอกคำใต้', 'ดอกคำใต้'), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(A.validConfiguredMoos('ทม.ดอกคำใต้', 'ดอนศรีชุม'), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(A.validConfiguredMoos('อบต.ดอนศรีชุม', 'ดอนศรีชุม'), [1,2,3,4,5,6,7,8,9,10]);

const dongJenNames = {
  1:'บ้านกว๊านกลาง',2:'บ้านสันป่าสัก',3:'บ้านกว๊านใต้',4:'บ้านกว๊านเหนือ',5:'บ้านเจน',
  8:'บ้านเจน',9:'บ้านสันป่ากอก',10:'บ้านเชียงหมัน',11:'บ้านสันป่าสัก',12:'บ้านกว๊านใต้ร่วมใจ',
  13:'บ้านกว๊านสันติสุข',16:'บ้านเจน'
};
for (const [moo, village] of Object.entries(dongJenNames)) {
  assert.equal(A.configuredVillageForMoo('ทต.ดงเจน','ดงเจน',Number(moo)), village);
}

// Backward-compatible legacy fallback for records that predate LocalAuthority.
let r = A.resolveAuthority({tambon:'ดอกคำใต้',moo:7});
assert.equal(r.authority, 'ทม.ดอกคำใต้');
assert.equal(r.confidence, 'legacy-inferred');
assert.equal(r.source, 'tambon-moo-legacy-fallback');
assert.equal(r.suggestedAuthority, 'ทม.ดอกคำใต้');
r = A.resolveAuthority({tambon:'ดอกคำใต้',moo:5});
assert.equal(r.authority, 'อบต.ดอกคำใต้');
assert.equal(r.confidence, 'legacy-inferred');
r = A.resolveAuthority({tambon:'ดอนศรีชุม',moo:4});
assert.equal(r.authority, 'อบต.ดอนศรีชุม');
r = A.resolveAuthority({tambon:'แม่อิง',moo:2});
assert.equal(r.authority, 'ทต.ดงเจน');
r = A.resolveAuthority({tambon:'แม่อิง',moo:5});
assert.equal(r.authority, 'อบต.แม่อิง');

// Ambiguous old records are never guessed, even when WaterOwner looks authoritative.
r = A.resolveAuthority({tambon:'ดอกคำใต้',moo:1,owner:'เทศบาลเมืองดอกคำใต้'});
assert.equal(r.authority, null);
assert.equal(r.confidence, 'ambiguous');
assert.deepEqual(r.candidates, ['ทม.ดอกคำใต้','อบต.ดอกคำใต้']);
r = A.resolveAuthority({tambon:'ดอนศรีชุม',moo:8,owner:'อบต.ดอนศรีชุม'});
assert.equal(r.authority, null);
assert.equal(r.confidence, 'ambiguous');

// Explicit SELECT values are accepted only from exact options.
r = A.resolveAuthority({tambon:'ดอกคำใต้',moo:1,localAuthority:'ทม.ดอกคำใต้'});
assert.equal(r.authority, 'ทม.ดอกคำใต้');
assert.equal(r.confidence, 'explicit-field');
r = A.resolveAuthority({tambon:'ดอกคำใต้',moo:1,localAuthority:'อบต.ดอกคำใต้'});
assert.equal(r.authority, 'อบต.ดอกคำใต้');
r = A.resolveAuthority({tambon:'ดอนศรีชุม',moo:8,localAuthority:'อบต.ดอนศรีชุม'});
assert.equal(r.authority, 'อบต.ดอนศรีชุม');

// v1.2 explicit override: exact recommendation may be changed to another authority in the same tambon master.
for (const test of [
  {tambon:'ดอกคำใต้',moo:3,localAuthority:'ทม.ดอกคำใต้',expected:'ทม.ดอกคำใต้'},
  {tambon:'ดอกคำใต้',moo:7,localAuthority:'อบต.ดอกคำใต้',expected:'อบต.ดอกคำใต้'},
  {tambon:'ดอนศรีชุม',moo:4,localAuthority:'ทม.ดอกคำใต้',expected:'ทม.ดอกคำใต้'},
  {tambon:'แม่อิง',moo:2,localAuthority:'อบต.แม่อิง',expected:'อบต.แม่อิง'},
  {tambon:'แม่อิง',moo:5,localAuthority:'ทต.ดงเจน',expected:'ทต.ดงเจน'}
]) {
  r = A.resolveAuthority(test);
  assert.equal(r.authority, test.expected, JSON.stringify(test));
  assert.equal(r.confidence, 'explicit-override', JSON.stringify(test));
  assert.equal(r.source, 'local-authority-field');
  assert.equal(r.overridden, true);
}

// Invalid explicit values must never contaminate authority counts.
for (const test of [
  {tambon:'ดอกคำใต้',moo:3,localAuthority:'อบต.แม่อิง'},       // cross-tambon
  {tambon:'ดอกคำใต้',moo:1,localAuthority:'อบต.แม่อิง'},       // SELECT outside exact options
  {tambon:'ดงเจน',moo:6,localAuthority:'ทต.ดงเจน'},             // no exact mapping => TAMBON_ONLY
  {tambon:'ดอกคำใต้',moo:1,localAuthority:'อปท.ปลอม'}           // unknown master name
]) {
  r = A.resolveAuthority(test);
  assert.equal(r.authority, null, JSON.stringify(test));
  assert.equal(r.confidence, 'invalid-explicit', JSON.stringify(test));
}

// Re-decoration preserves raw stored value and never turns legacy fallback into an explicit field.
const legacy = A.decorateRecord({tambon:'แม่อิง',moo:2});
assert.equal(legacy.localAuthorityRaw, null);
assert.equal(legacy.localAuthority, 'ทต.ดงเจน');
assert.equal(legacy.resolvedLocalAuthority, 'ทต.ดงเจน');
assert.equal(legacy.authorityConfidence, 'legacy-inferred');
A.decorateRecord(legacy);
assert.equal(legacy.localAuthorityRaw, null);
assert.equal(legacy.authorityConfidence, 'legacy-inferred');

const override = A.decorateRecord({tambon:'ดอกคำใต้',moo:3,localAuthority:'ทม.ดอกคำใต้'});
assert.equal(override.localAuthorityRaw, 'ทม.ดอกคำใต้');
assert.equal(override.localAuthority, 'ทม.ดอกคำใต้');
assert.equal(override.resolvedLocalAuthority, 'ทม.ดอกคำใต้');
assert.equal(override.recommendedAuthority, 'อบต.ดอกคำใต้');
assert.equal(override.authorityConfidence, 'explicit-override');
assert.equal(override.authorityOverridden, true);
A.decorateRecord(override);
assert.equal(override.localAuthorityRaw, 'ทม.ดอกคำใต้');
assert.equal(override.authorityConfidence, 'explicit-override');

// Phase 2 master: whole-tambon authorities are inferred for legacy rows; split areas remain ambiguous.
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
assert.deepEqual(A.authorityOptionsFor('ศรีถ้อย',5), ['ทต.ศรีถ้อย']);

// Active authority list is based on the full resolved dataset, including explicit overrides and legacy fallback.
const sample = A.decorateRecords([
  {id:1,tambon:'ดอกคำใต้',moo:7},                                      // legacy -> ทม.
  {id:2,tambon:'ดอกคำใต้',moo:5},                                      // legacy -> อบต.ดอกคำใต้
  {id:3,tambon:'แม่อิง',moo:2},                                         // legacy -> ทต.ดงเจน
  {id:4,tambon:'ดอกคำใต้',moo:1},                                      // ambiguous -> none
  {id:5,tambon:'ดอกคำใต้',moo:1,localAuthority:'อบต.ดอกคำใต้'},       // explicit SELECT
  {id:6,tambon:'ดอกคำใต้',moo:3,localAuthority:'ทม.ดอกคำใต้'},        // explicit override
  {id:7,tambon:'คือเวียง',moo:1,localAuthority:'อบต.แม่อิง'},           // invalid cross-tambon
  {id:8,tambon:'ดงเจน',moo:6,localAuthority:'ทต.ดงเจน'}                 // invalid TAMBON_ONLY
]);
const counts = A.authorityCounts(sample);
assert.equal(counts['ทม.ดอกคำใต้'], 2);
assert.equal(counts['อบต.ดอกคำใต้'], 2);
assert.equal(counts['ทต.ดงเจน'], 1);
assert.equal(counts['อบต.คือเวียง'], 0);
assert.deepEqual(A.activeAuthorities(sample), ['ทม.ดอกคำใต้','อบต.ดอกคำใต้','ทต.ดงเจน']);

// Every record resolves to at most one authority, preventing double-counting.
for (const item of sample) {
  const matched = AUTHORITIES.filter((authority) => A.recordMatchesAuthority(item, authority));
  assert.ok(matched.length <= 1, `double count for id ${item.id}: ${matched}`);
}

const stats = A.resolutionStats(sample);
assert.equal(stats.total, sample.length);
assert.equal(stats.explicitOverride, 1);
assert.equal(stats.legacyInferred, 3);
assert.equal(stats.ambiguous, 1);
assert.equal(stats.invalidExplicit, 2);


// Authority-aware Tambon dropdown scope labels are display-only. Full-tambon coverage stays visually clean; partial scopes show moo details.
assert.equal(A.authorityTambonScopeText('ทม.ดอกคำใต้','สว่างอารมณ์'), '');
assert.equal(A.authorityTambonScopeText('ทม.ดอกคำใต้','บุญเกิด'), '');
assert.equal(A.authorityTambonScopeText('ทม.ดอกคำใต้','ดอกคำใต้'), 'ม.1, 2, 7');
assert.equal(A.authorityTambonScopeText('ทม.ดอกคำใต้','ดอนศรีชุม'), 'ม.1, 5, 7, 10 ทั้งหมู่ · ม.8, 9 บางพื้นที่');
assert.equal(A.authorityTambonScopeText('อบต.ดอนศรีชุม','ดอนศรีชุม'), 'ม.2, 3, 4, 6 ทั้งหมู่ · ม.8, 9 บางพื้นที่');
assert.equal(A.authorityTambonScopeText('ทต.ดงเจน','แม่อิง'), 'ม.1, 2, 3, 7');
assert.equal(A.authorityTambonScopeText('', 'ดอกคำใต้'), '');

console.log('area_responsibility_test: PASS');
