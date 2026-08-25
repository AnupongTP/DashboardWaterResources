import assert from 'node:assert/strict';

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

assert.equal(A.RULESET_VERSION, '2026-08-25.2');
assert.deepEqual(A.TAMBON_ORDER, MASTER_TAMBONS);
assert.deepEqual(A.OLD_TAMBONS, ORIGINAL_18);
assert.deepEqual(A.NEW_TAMBONS, AUTHORITY_11);
assert.equal(new Set(A.TAMBON_ORDER).size, 29);

assert.equal(A.canonicalTambon('บ้านปิน'), 'บ้านปิน');
// legacy compatibility only; canonical/display name remains บ้านปิน
assert.equal(A.canonicalTambon('บ้านปิ่น'), 'บ้านปิน');
assert.equal(A.canonicalTambon('เทศบาลเมืองพะเยา'), 'เทศบาลเมือง');

assert.deepEqual(A.AUTHORITY_ORDER, [
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
]);

assert.deepEqual(A.tambonsForAuthority('ทม.ดอกคำใต้'), ['สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม']);
assert.deepEqual(A.tambonsForAuthority('อบต.คือเวียง'), ['คือเวียง']);
assert.deepEqual(A.tambonsForAuthority('อบต.บ้านปิน'), ['บ้านปิน']);
assert.deepEqual(A.tambonsForAuthority('อบต.ดอกคำใต้'), ['ดอกคำใต้']);
assert.deepEqual(A.tambonsForAuthority('อบต.จำป่าหวาย'), ['จำป่าหวาย']);
assert.deepEqual(A.tambonsForAuthority('ทต.บ้านถ้ำ'), ['บ้านถ้ำ']);
assert.deepEqual(A.tambonsForAuthority('อบต.ดอนศรีชุม'), ['ดอนศรีชุม']);
assert.deepEqual(A.tambonsForAuthority('อบต.แม่อิง'), ['แม่อิง']);
assert.deepEqual(A.tambonsForAuthority('ทต.ดงเจน'), ['แม่อิง','ดงเจน']);
assert.deepEqual(A.tambonsForAuthority('อบต.สันโค้ง'), ['สันโค้ง']);

assert.deepEqual(A.configuredMoos('ทม.ดอกคำใต้', 'ดอกคำใต้'), [1,2,7]);
assert.deepEqual(A.ambiguousMoos('ทม.ดอกคำใต้', 'ดอกคำใต้'), [1,2]);
assert.deepEqual(A.configuredMoos('ทม.ดอกคำใต้', 'ดอนศรีชุม'), [1,5,7,8,9,10]);
assert.deepEqual(A.ambiguousMoos('ทม.ดอกคำใต้', 'ดอนศรีชุม'), [8,9]);
assert.deepEqual(A.configuredMoos('อบต.ดอกคำใต้', 'ดอกคำใต้'), [1,2,3,4,5,6,8,9,10]);
assert.deepEqual(A.ambiguousMoos('อบต.ดอกคำใต้', 'ดอกคำใต้'), [1,2]);
assert.deepEqual(A.configuredMoos('อบต.ดอนศรีชุม', 'ดอนศรีชุม'), [2,3,4,6,8,9]);
assert.deepEqual(A.ambiguousMoos('อบต.ดอนศรีชุม', 'ดอนศรีชุม'), [8,9]);
assert.deepEqual(A.configuredMoos('อบต.แม่อิง', 'แม่อิง'), [4,5,6,8]);
assert.deepEqual(A.configuredMoos('ทต.ดงเจน', 'แม่อิง'), [1,2,3,7]);
assert.deepEqual(A.configuredMoos('ทต.ดงเจน', 'ดงเจน'), [1,2,3,4,5,8,9,10,11,12,13,16]);

const dongJenNames = {
  1:'บ้านกว๊านกลาง',2:'บ้านสันป่าสัก',3:'บ้านกว๊านใต้',4:'บ้านกว๊านเหนือ',5:'บ้านเจน',
  8:'บ้านเจน',9:'บ้านสันป่ากอก',10:'บ้านเชียงหมัน',11:'บ้านสันป่าสัก',12:'บ้านกว๊านใต้ร่วมใจ',
  13:'บ้านกว๊านสันติสุข',16:'บ้านเจน'
};
for (const [moo, village] of Object.entries(dongJenNames)) {
  assert.equal(A.configuredVillageForMoo('ทต.ดงเจน','ดงเจน',Number(moo)), village);
}

// Resolved examples
assert.equal(A.resolveAuthority({tambon:'สว่างอารมณ์',moo:99}).authority, 'ทม.ดอกคำใต้');
assert.equal(A.resolveAuthority({tambon:'บุญเกิด',moo:1}).authority, 'ทม.ดอกคำใต้');
assert.equal(A.resolveAuthority({tambon:'ดอกคำใต้',moo:7}).authority, 'ทม.ดอกคำใต้');
assert.equal(A.resolveAuthority({tambon:'ดอกคำใต้',moo:5}).authority, 'อบต.ดอกคำใต้');
assert.equal(A.resolveAuthority({tambon:'คือเวียง',moo:1}).authority, 'อบต.คือเวียง');
assert.equal(A.resolveAuthority({tambon:'บ้านปิน',moo:1}).authority, 'อบต.บ้านปิน');
assert.equal(A.resolveAuthority({tambon:'จำป่าหวาย',moo:1}).authority, 'อบต.จำป่าหวาย');
assert.equal(A.resolveAuthority({tambon:'บ้านถ้ำ',moo:1}).authority, 'ทต.บ้านถ้ำ');
assert.equal(A.resolveAuthority({tambon:'ดอนศรีชุม',moo:4}).authority, 'อบต.ดอนศรีชุม');
assert.equal(A.resolveAuthority({tambon:'แม่อิง',moo:5}).authority, 'อบต.แม่อิง');
assert.equal(A.resolveAuthority({tambon:'แม่อิง',moo:2}).authority, 'ทต.ดงเจน');
assert.equal(A.resolveAuthority({tambon:'ดงเจน',moo:16}).authority, 'ทต.ดงเจน');
assert.equal(A.resolveAuthority({tambon:'สันโค้ง',moo:1}).authority, 'อบต.สันโค้ง');

// The eight re-added original CONFIG tambons are in the Dashboard master list but intentionally have no authority rule from this brief.
for (const tb of ['เจริญราษฎร์','แม่ปืม','แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย']) {
  const x = A.resolveAuthority({tambon:tb,moo:1});
  assert.equal(x.authority, null, tb);
  assert.equal(x.confidence, 'out-of-brief', tb);
  assert.deepEqual(x.candidates, [], tb);
}

// Ambiguous/partial must never be guessed from WaterOwner
let r = A.resolveAuthority({tambon:'ดอกคำใต้',moo:1,owner:'เทศบาลเมืองดอกคำใต้'});
assert.equal(r.authority, null);
assert.equal(r.confidence, 'ambiguous');
assert.deepEqual(new Set(r.candidates), new Set(['ทม.ดอกคำใต้','อบต.ดอกคำใต้']));

r = A.resolveAuthority({tambon:'ดอนศรีชุม',moo:8,owner:'อบต.ดอนศรีชุม'});
assert.equal(r.authority, null);
assert.equal(r.confidence, 'ambiguous');
assert.deepEqual(new Set(r.candidates), new Set(['ทม.ดอกคำใต้','อบต.ดอนศรีชุม']));

r = A.resolveAuthority({tambon:'ดงเจน',moo:6});
assert.equal(r.authority, null);
assert.equal(r.confidence, 'unresolved');
assert.deepEqual(r.candidates, ['ทต.ดงเจน']);

const ambiguous = A.decorateRecord({tambon:'ดอกคำใต้',moo:1,owner:'อบต.ดอกคำใต้'});
assert.equal(ambiguous.localAuthority, null);
assert.equal(A.recordMatchesAuthority(ambiguous, A.UNRESOLVED_VALUE), true);

for (const tb of ORIGINAL_18) {
  const oldScope = A.decorateRecord({tambon:tb,moo:1});
  assert.equal(oldScope.localAuthority, null);
  assert.equal(oldScope.authorityConfidence, 'out-of-brief');
  assert.equal(A.recordMatchesAuthority(oldScope, A.UNRESOLVED_VALUE), false);
}

console.log('area_responsibility_test: PASS');
