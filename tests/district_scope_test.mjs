import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
for(const name of ['area-responsibility','authority-routes','maeka-data-adapter','authority-data-adapter','district-routes','district-data-adapter']){
  vm.runInNewContext(fs.readFileSync(new URL(`../site/assets/${name}.js`,import.meta.url),'utf8'),context);
}
const {AreaResponsibility:area,DistrictRoutes:routes,DistrictDataAdapter:adapter,AuthorityDataAdapter:authority}=context.window;
assert.equal(routes.masterIsValid,true);
assert.equal(routes.entries.length,4);
const allTambons=routes.entries.flatMap(e=>Array.from(area.DISTRICT_TAMBONS[e.district]));
assert.equal(allTambons.length,29);assert.equal(new Set(allTambons).size,29);
for(const entry of routes.entries){
  for(const suffix of ['', '/'])assert.equal(routes.resolve(`/district/${entry.slug}${suffix}`,'https:').district,entry.district);
}
for(const route of ['/district','/district/','/district/unknown/','/district/MAE-CHAI/','/district/mae-chai/extra'])assert.equal(routes.resolve(route,'https:').kind,'invalid');
assert.equal(routes.resolve('/authority/tt-mae-ka/','https:').kind,'root');
assert.equal(routes.resolve('/district/mae-chai/','file:').kind,'root');
const base={name:'test',moo:1,type:'ฝาย',width:3,length:4,depth:10,depthnet:5,volume:100,lat:19,lng:99,problem:'ชำรุด'};
const records=[
  {...base,id:1,tambon:'ดอกคำใต้',localAuthority:null},
  {...base,id:2,tambon:'ดอกคำใต้',localAuthority:'อบต.แม่อิง'},
  {...base,id:3,tambon:'สว่างอารมณ์',moo:null,localAuthority:null,lat:null,lng:null},
  {...base,id:4,tambon:'บ้านปิ่น',lat:100,lng:200},
  {...base,id:5,tambon:'แม่ใจ',localAuthority:null},
  {...base,id:6,tambon:'ไม่ทราบ',owner:'ทม.ดอกคำใต้'},
  {...base,id:7,tambon:'ดอกคำใต้',localAuthority:'ทม.ดอกคำใต้'},
  {...base,id:8,tambon:'ดอกคำใต้',localAuthority:'อบต.ดอกคำใต้'}
];
const original=JSON.stringify(records),result=adapter.fromWaterRecords(records,'ดอกคำใต้').records;
assert.equal(JSON.stringify(records),original,'district conversion must not mutate the loaded dataset');
assert.deepEqual(Array.from(result,r=>r.id),[1,2,3,4,7,8]);
assert.equal(result.find(r=>r.id===4).tambon,'บ้านปิน');
for(const id of [3,4]){assert.equal(result.find(r=>r.id===id).lat,null);assert.equal(result.find(r=>r.id===id).lng,null);}
assert.equal(adapter.fromWaterRecords(records,'ภูกามยาว').records.length,0);
assert.throws(()=>adapter.fromWaterRecords(records,'unknown'));
const authorityRow=authority.fromWaterRecords(JSON.parse(original),'ทม.ดอกคำใต้').records.find(r=>r.id===7);
const districtRow=result.find(r=>r.id===7);
for(const field of ['depth','depthNet','volumn','volumeKnown','lat','lng','problem','image'])assert.equal(districtRow[field],authorityRow[field],field);
console.log('PASS district registry, 29 canonical tambons, strict paths, independent scope IDs, unresolved inclusion, aliases, coordinate handling, no mutation, conversion parity');
