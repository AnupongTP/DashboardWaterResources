import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../site/assets/area-responsibility.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'area-responsibility.js' });
const A = context.window.AreaResponsibility;
assert.ok(A, 'AreaResponsibility must exist');

assert.deepEqual(Array.from(A.DISTRICT_ORDER), ['เมืองพะเยา','แม่ใจ','ดอกคำใต้','ภูกามยาว']);
assert.equal(A.districtForTambon('แม่กา'), 'เมืองพะเยา');
assert.equal(A.districtForTambon('บ้านใหม่'), 'เมืองพะเยา');
assert.equal(A.districtForTambon('ศรีถ้อย'), 'แม่ใจ');
assert.equal(A.districtForTambon('แม่อิง'), 'ภูกามยาว');
assert.equal(A.districtForTambon('สันโค้ง'), 'ดอกคำใต้');
assert.equal(new Set(Object.values(A.DISTRICT_TAMBONS).flat()).size, 29);
assert.deepEqual(new Set(Object.values(A.DISTRICT_TAMBONS).flat()), new Set(A.TAMBON_ORDER));

const whole = {
  'แม่กา':'ทต.แม่กา','แม่นาเรือ':'อบต.แม่นาเรือ','แม่ใส':'อบต.แม่ใส','บ้านตุ่น':'อบต.บ้านตุ่น',
  'บ้านสาง':'ทต.บ้านสาง','สันป่าม่วง':'ทต.สันป่าม่วง','บ้านต๋อม':'ทต.บ้านต๋อม','บ้านต๊ำ':'ทต.บ้านต๊ำ',
  'ท่าจำปี':'ทต.ท่าจำปี','เทศบาลเมือง':'ทม.พะเยา','แม่ปืม':'ทต.แม่ปืม','บ้านใหม่':'ทต.บ้านใหม่',
  'เจริญราษฎร์':'ทต.เจริญราษฎร์','แม่สุก':'อบต.แม่สุก','ป่าแฝก':'ทต.ป่าแฝก','บ้านเหล่า':'ทต.บ้านเหล่า'
};
for (const [tambon, authority] of Object.entries(whole)) {
  assert.deepEqual(Array.from(A.authorityOptionsFor(tambon, 1)), [authority], `${tambon} should map to ${authority}`);
  assert.equal(A.resolveAuthority({tambon, moo: 1, localAuthority: null}).authority, authority);
}

assert.deepEqual(Array.from(A.authorityOptionsFor('แม่ใจ',2)), ['ทต.แม่ใจ']);
assert.deepEqual(Array.from(A.authorityOptionsFor('แม่ใจ',4)), ['ทต.รวมใจพัฒนา']);
assert.deepEqual(Array.from(A.authorityOptionsFor('แม่ใจ',1)), ['ทต.แม่ใจ','ทต.รวมใจพัฒนา']);
assert.equal(A.resolveAuthority({tambon:'แม่ใจ',moo:1}).authority, null);
assert.equal(A.resolveAuthority({tambon:'แม่ใจ',moo:1}).confidence, 'ambiguous');
assert.equal(A.resolveAuthority({tambon:'แม่ใจ',moo:1,localAuthority:'ทต.แม่ใจ'}).authority, 'ทต.แม่ใจ');
assert.equal(A.resolveAuthority({tambon:'แม่ใจ',moo:1,localAuthority:'ทต.รวมใจพัฒนา'}).authority, 'ทต.รวมใจพัฒนา');

assert.deepEqual(Array.from(A.authorityOptionsFor('ศรีถ้อย',2)), ['ทต.แม่ใจ']);
assert.deepEqual(Array.from(A.authorityOptionsFor('ศรีถ้อย',5)), ['ทต.ศรีถ้อย']);
assert.deepEqual(Array.from(A.authorityOptionsFor('ศรีถ้อย',4)), ['ทต.แม่ใจ','ทต.ศรีถ้อย']);
assert.equal(A.resolveAuthority({tambon:'ศรีถ้อย',moo:4}).authority, null);

assert.deepEqual(Array.from(A.authorityOptionsFor('แม่อิง',1)), ['ทต.ดงเจน']);
assert.deepEqual(Array.from(A.authorityOptionsFor('แม่อิง',4)), ['อบต.แม่อิง']);

// Regression: original Dok Kham Tai boundary rules.
assert.deepEqual(Array.from(A.authorityOptionsFor('ดอกคำใต้',1)), ['ทม.ดอกคำใต้','อบต.ดอกคำใต้']);
assert.equal(A.resolveAuthority({tambon:'ดอกคำใต้',moo:1}).authority, null);
assert.deepEqual(Array.from(A.authorityOptionsFor('ดอกคำใต้',7)), ['ทม.ดอกคำใต้']);
assert.deepEqual(Array.from(A.authorityOptionsFor('ดอนศรีชุม',8)), ['ทม.ดอกคำใต้','อบต.ดอนศรีชุม']);
assert.deepEqual(Array.from(A.authorityOptionsFor('บ้านปิน',9)), ['อบต.บ้านปิน']);

const mueangAuthorities = Array.from(A.authoritiesForDistrict('เมืองพะเยา'));
for (const expected of ['ทม.พะเยา','ทต.แม่กา','อบต.แม่นาเรือ','อบต.แม่ใส','อบต.บ้านตุ่น','ทต.บ้านใหม่']) assert.ok(mueangAuthorities.includes(expected), `เมืองพะเยา missing ${expected}`);
const maechaiAuthorities = Array.from(A.authoritiesForDistrict('แม่ใจ'));
for (const expected of ['ทต.แม่ใจ','ทต.รวมใจพัฒนา','ทต.ศรีถ้อย','อบต.แม่สุก','ทต.ป่าแฝก','ทต.บ้านเหล่า','ทต.เจริญราษฎร์']) assert.ok(maechaiAuthorities.includes(expected), `แม่ใจ missing ${expected}`);

const decorated = A.decorateRecord({id:1,tambon:'แม่กา',moo:2,localAuthority:null});
assert.equal(decorated.district, 'เมืองพะเยา');
assert.equal(decorated.resolvedLocalAuthority, 'ทต.แม่กา');
assert.ok(A.recordMatchesDistrict(decorated,'เมืองพะเยา'));
assert.ok(!A.recordMatchesDistrict(decorated,'แม่ใจ'));
assert.ok(A.recordMatchesAuthority(decorated,'ทต.แม่กา'));

assert.equal(A.authorityTambonScopeText('ทต.แม่ใจ','แม่ใจ'), 'ม.2, 3, 10 ทั้งหมู่ · ม.1, 5 บางพื้นที่');
assert.equal(A.authorityTambonScopeText('ทต.ศรีถ้อย','ศรีถ้อย'), 'ม.5, 6, 8, 9, 10, 12, 13 ทั้งหมู่ · ม.1, 4, 7, 11 บางพื้นที่');
assert.equal(A.authorityTambonScopeText('ทต.แม่กา','แม่กา'), '');

console.log('PASS phase2_area_responsibility_test');
