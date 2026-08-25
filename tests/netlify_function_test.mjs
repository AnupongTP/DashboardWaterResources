import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TMP = path.join(ROOT, 'tests', '.tmp-netlify-function-test');
await fs.rm(TMP, { recursive: true, force: true });
await fs.mkdir(TMP, { recursive: true });

const mockPrelude = `
const __stores = globalThis.__TEST_BLOB_STORES || (globalThis.__TEST_BLOB_STORES = new Map());
let __etagCounter = globalThis.__TEST_ETAG_COUNTER || 0;
function getStore(name) {
  if (!__stores.has(name)) __stores.set(name, new Map());
  const map = __stores.get(name);
  return {
    async getMetadata(key) {
      const e = map.get(key);
      return e ? { etag: e.etag, metadata: structuredClone(e.metadata) } : null;
    },
    async getWithMetadata(key, options={}) {
      const e = map.get(key);
      if (!e) return null;
      if (options.etag && options.etag === e.etag) {
        return { data: null, etag: e.etag, metadata: structuredClone(e.metadata) };
      }
      return { data: structuredClone(e.data), etag: e.etag, metadata: structuredClone(e.metadata) };
    },
    async setJSON(key, value, options={}) {
      __etagCounter += 1;
      globalThis.__TEST_ETAG_COUNTER = __etagCounter;
      const etag = '"mock-' + __etagCounter + '"';
      map.set(key, { data: structuredClone(value), metadata: structuredClone(options.metadata || {}), etag });
    }
  };
}
`;

let storeSrc = await fs.readFile(path.join(ROOT, 'netlify', 'lib', 'water-store.mjs'), 'utf8');
storeSrc = storeSrc.replace("import { getStore } from '@netlify/blobs';", mockPrelude);
await fs.writeFile(path.join(TMP, 'water-store.mjs'), storeSrc, 'utf8');

for (const name of ['waterresources-sync.mjs', 'waterresources-version.mjs', 'waterresources.mjs']) {
  let src = await fs.readFile(path.join(ROOT, 'netlify', 'functions', name), 'utf8');
  src = src.replace("../lib/water-store.mjs", "./water-store.mjs");
  await fs.writeFile(path.join(TMP, name), src, 'utf8');
}

const storeMod = await import(pathToFileURL(path.join(TMP, 'water-store.mjs')).href + '?x=1');
const syncFn = (await import(pathToFileURL(path.join(TMP, 'waterresources-sync.mjs')).href + '?x=1')).default;
const versionFn = (await import(pathToFileURL(path.join(TMP, 'waterresources-version.mjs')).href + '?x=1')).default;
const dataFn = (await import(pathToFileURL(path.join(TMP, 'waterresources.mjs')).href + '?x=1')).default;

const SECRET = '0123456789abcdefghijklmnopqrstuvwxyz';
const MASTER_TAMBONS = [
  'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง',
  'เจริญราษฎร์','แม่ปืม','แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย',
  'สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน','จำป่าหวาย','บ้านถ้ำ','แม่อิง','สันโค้ง','ดงเจน'
];
process.env.WATER_SYNC_SECRET = SECRET;
const tests = [];
function ok(name, extra={}) { tests.push({ test:name, ok:true, ...extra }); }

function sample(id, tambon, moo=1, extra={}) {
  return {
    id, dt:'2026-08-25 01:00', lat:19.1, lng:99.9, name:'test-'+id,
    owner:'owner', phone:null, type:'ฝาย', width:1, length:2, depth:3,
    depthnet:2, tambon, village:'v', moo, problem:'ใช้งานได้', imglink:null,
    volume:12, note:null, status:'ตรวจสอบแล้ว', ...extra
  };
}

// 1 unauthorized
let req = new Request('https://example.net/api/waterresources/sync', {
  method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({records:[]})
});
let res = await syncFn(req);
assert.equal(res.status, 401);
ok('unauthorized_sync_401');

// 2 wrong content type
req = new Request('https://example.net/api/waterresources/sync', {
  method:'POST', headers:{authorization:'Bearer '+SECRET, 'content-type':'text/plain'}, body:'{}'
});
res = await syncFn(req);
assert.equal(res.status, 415);
ok('sync_rejects_non_json');

// 3 authorized snapshot: all 29 approved tambons accepted; aliases normalized; out-of-scope excluded.
assert.equal(storeMod.ALLOWED_TAMBONS.size, 29);
assert.deepEqual([...storeMod.ALLOWED_TAMBONS], MASTER_TAMBONS);
const records = MASTER_TAMBONS.map((tambon, index) => sample(index + 1, tambon, index + 1));
records.push(sample(1001, 'บ้านปิ่น', '2'));
records.push(sample(1002, 'เทศบาลเมืองพะเยา', 6));
records.push(sample(1003, 'นอกขอบเขต', 1));
req = new Request('https://example.net/api/waterresources/sync', {
  method:'POST', headers:{authorization:'Bearer '+SECRET, 'content-type':'application/json'},
  body:JSON.stringify({sourceSpreadsheetId:'sheet',sourceSheetName:'WaterResources',records})
});
res = await syncFn(req);
assert.equal(res.status, 200);
let body = await res.json();
assert.equal(body.success, true);
assert.equal(body.changed, true);
assert.equal(body.count, 31); // 29 canonical + two accepted aliases; out-of-scope excluded
const v1 = body.version;
ok('authorized_sync_accepts_exact_29_tambon_scope', {version:v1,count:body.count});

let entry = await storeMod.getDatasetWithMetadata();
assert.equal(entry.data.length, 31);
for (const tambon of MASTER_TAMBONS) {
  assert.ok(entry.data.some(x=>x.tambon===tambon), 'missing normalized tambon '+tambon);
}
assert.equal(entry.data.find(x=>x.id===1001).tambon, 'บ้านปิน');
assert.equal(entry.data.find(x=>x.id===1001).moo, 2);
assert.equal(entry.data.find(x=>x.id===1002).tambon, 'เทศบาลเมือง');
assert.equal(entry.data.some(x=>x.id===1003), false);
ok('canonical_tambon_aliases_and_scope_normalization');

// 4 identical sync must not churn version
req = new Request('https://example.net/api/waterresources/sync', {
  method:'POST', headers:{authorization:'Bearer '+SECRET, 'content-type':'application/json'},
  body:JSON.stringify({records})
});
res = await syncFn(req);
body = await res.json();
assert.equal(body.changed, false);
assert.equal(body.version, v1);
ok('identical_sync_keeps_version');

// 5 change one value => new version
const changed = structuredClone(records);
changed[0].name = 'changed';
req = new Request('https://example.net/api/waterresources/sync', {
  method:'POST', headers:{authorization:'Bearer '+SECRET, 'content-type':'application/json'},
  body:JSON.stringify({records:changed})
});
res = await syncFn(req);
body = await res.json();
assert.equal(body.changed, true);
assert.notEqual(body.version, v1);
const v2 = body.version;
ok('changed_sync_changes_version', {version:v2});

// 6 version endpoint
res = await versionFn(new Request('https://example.net/api/waterresources/version'));
assert.equal(res.status, 200);
body = await res.json();
assert.equal(body.version, v2);
assert.equal(body.count, 31);
ok('version_endpoint_current');

// 7 data endpoint and 304
res = await dataFn(new Request('https://example.net/api/waterresources'));
assert.equal(res.status, 200);
body = await res.json();
assert.equal(body.version, v2);
assert.equal(body.data.length, 31);
assert.equal(res.headers.get('etag'), v2);

res = await dataFn(new Request('https://example.net/api/waterresources', {headers:{'if-none-match':v2}}));
assert.equal(res.status, 304);
assert.equal(res.headers.get('etag'), v2);
ok('dataset_endpoint_etag_and_304');

// 8 methods
res = await versionFn(new Request('https://example.net/api/waterresources/version', {method:'POST'}));
assert.equal(res.status, 405);
res = await dataFn(new Request('https://example.net/api/waterresources', {method:'POST'}));
assert.equal(res.status, 405);
ok('read_endpoints_reject_wrong_method');

await fs.writeFile(path.join(ROOT,'tests','netlify-function-results.json'), JSON.stringify({ok:true,tests},null,2), 'utf8');
await fs.rm(TMP, { recursive:true, force:true });
console.log(JSON.stringify({ok:true,tests:tests.map(t=>t.test)},null,2));
