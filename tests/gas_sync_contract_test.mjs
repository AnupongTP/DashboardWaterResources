import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../google-apps-script/WaterResourcesDashboardSync.gs', import.meta.url), 'utf8');

const HEADERS_24 = [
  'ID','DateTime','XY','EndXY','Distance','WaterName','WaterOwner','MobilePhone','WaterType',
  'Width','Length','Depth','DepthNet','Tambon','VillageName','Moo','Problem','Image','LinkImage',
  'Volumn','Note','Status','LineUserId','LineDisplayName'
];

function makeRow(headers, patch={}) {
  const base = {
    ID: 1, DateTime: '2026-08-27 10:00', XY: '19.123,99.456', EndXY: '', Distance: 0,
    WaterName: 'จุดทดสอบ', WaterOwner: 'เจ้าของ', MobilePhone: '0812345678', WaterType: 'ฝาย',
    Width: 1, Length: 2, Depth: 3, DepthNet: 2, Tambon: 'ดอกคำใต้', VillageName: 'บ้านทดสอบ', Moo: 3,
    Problem: 'ใช้งานได้', Image: '', LinkImage: 'https://example.test/img', Volumn: 12, Note: '', Status: 'ตรวจสอบแล้ว',
    LineUserId: 'U1', LineDisplayName: 'Tester', LocalAuthority: null,
    ...patch
  };
  return headers.map(h => base[h] ?? '');
}

function runSnapshot(headers, rows) {
  const readColumnCounts = [];
  const values = [headers, ...rows];
  const sheet = {
    getLastRow: () => values.length,
    getLastColumn: () => headers.length,
    getRange: (r, c, nr, nc) => {
      readColumnCounts.push(nc);
      return {
        getValues: () => values.slice(r-1, r-1+nr).map(row => row.slice(c-1, c-1+nc))
      };
    }
  };
  const context = {
    console,
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet })
    },
    Utilities: {
      formatDate: () => { throw new Error('formatDate should not be needed for string DateTime fixture'); },
      getUuid: () => 'uuid'
    },
    LockService: {}, PropertiesService: {}, UrlFetchApp: {}, ScriptApp: {}, Logger: {log(){}},
    Set, Map, Object, Array, String, Number, Math, JSON, Date, RegExp, Error, isFinite
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'WaterResourcesDashboardSync.gs' });
  const result = context.buildDashboardWaterResourcesSnapshot_();
  return { result: JSON.parse(JSON.stringify(result)), readColumnCounts };
}

// Legacy 24-column sheet remains supported and produces explicit null LocalAuthority.
let r = runSnapshot(HEADERS_24, [makeRow(HEADERS_24)]);
assert.equal(r.result.length, 1);
assert.equal(r.result[0].tambon, 'ดอกคำใต้');
assert.equal(r.result[0].moo, 3);
assert.equal(r.result[0].localAuthority, null);
assert.deepEqual(r.readColumnCounts, [24,22]);

// 25th LocalAuthority is read and preserved exactly for browser-side policy validation.
const headers25 = [...HEADERS_24, 'LocalAuthority'];
r = runSnapshot(headers25, [
  makeRow(headers25, {ID:2, LocalAuthority:'ทม.ดอกคำใต้'}),
  makeRow(headers25, {ID:3, LocalAuthority:'อปท.ปลอม'}),
  makeRow(headers25, {ID:4, LocalAuthority:''})
]);
assert.equal(r.result.length, 3);
assert.equal(r.result.find(x=>x.id===2).localAuthority, 'ทม.ดอกคำใต้');
assert.equal(r.result.find(x=>x.id===3).localAuthority, 'อปท.ปลอม');
assert.equal(r.result.find(x=>x.id===4).localAuthority, null);
assert.deepEqual(r.readColumnCounts, [25,25]);

// Canonical tambon aliases remain snapshot-only normalization.
r = runSnapshot(headers25, [
  makeRow(headers25, {ID:5, Tambon:'บ้านปิ่น', LocalAuthority:'อบต.บ้านปิน'}),
  makeRow(headers25, {ID:6, Tambon:'เทศบาลเมืองพะเยา'})
]);
assert.equal(r.result.find(x=>x.id===5).tambon, 'บ้านปิน');
assert.equal(r.result.find(x=>x.id===6).tambon, 'เทศบาลเมือง');

// Header-driven read: an unrelated trailing column must not be carried into the dataset contract.
const headers26 = [...headers25, 'UnrelatedTrailingColumn'];
r = runSnapshot(headers26, [makeRow(headers26, {ID:7, LocalAuthority:'อบต.ดอกคำใต้'})]);
assert.deepEqual(r.readColumnCounts, [26,25]);
assert.equal(r.result[0].localAuthority, 'อบต.ดอกคำใต้');
assert.equal(Object.prototype.hasOwnProperty.call(r.result[0], 'UnrelatedTrailingColumn'), false);

console.log('gas_sync_contract_test: PASS');
