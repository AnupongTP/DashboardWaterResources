import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
export const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = process.env.DISTRICT_TEST_BASE || 'http://localhost:8888';
export const ACTIVE = 'https://dashboard-waterresources1.netlify.app';
export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
export const VIEWPORTS = [[1440,900],[768,1024],[412,915],[390,844],[360,800]];
export const DISTRICTS = [
  ['เมืองพะเยา','mueang-phayao'],['แม่ใจ','mae-chai'],
  ['ดอกคำใต้','dok-kham-tai'],['ภูกามยาว','phu-kam-yao']
];

export function record(id, tambon, overrides = {}) {
  return {id, name:`RECORD-${id}`, tambon, moo:1, village:'ทดสอบ',
    type:'ฝาย', problem:'ใช้งานได้', width:3, length:4, depth:10, depthnet:10,
    volume:100, lat:19.15+(id%10)*.002, lng:99.8+(id%7)*.002,
    owner:'ผู้ดูแลทดสอบ', localAuthority:null, ...overrides};
}

// Independent expected scope, deliberately not generated with the production resolver.
const TAMBONS = [
  ['เมืองพะเยา',['แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง','แม่ปืม','บ้านใหม่']],
  ['แม่ใจ',['เจริญราษฎร์','แม่สุก','ป่าแฝก','บ้านเหล่า','แม่ใจ','ศรีถ้อย']],
  ['ดอกคำใต้',['สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน','จำป่าหวาย','บ้านถ้ำ','สันโค้ง']],
  ['ภูกามยาว',['แม่อิง','ดงเจน']]
];
export const EXPECTED = Object.fromEntries(DISTRICTS.map(([district])=>[district,[]]));
export const SCOPE_DATA = [];
let id=1000;
for(const [district,tambons] of TAMBONS) for(const tambon of tambons){
  SCOPE_DATA.push(record(++id,tambon)); EXPECTED[district].push(id);
}
const EXTRA = [
  ['ดอกคำใต้',record(2001,'ดอกคำใต้',{localAuthority:null,moo:1})],
  ['ดอกคำใต้',record(2002,'ดอกคำใต้',{localAuthority:'อบต.แม่อิง',moo:1})],
  ['ดอกคำใต้',record(2003,'สว่างอารมณ์',{localAuthority:null,moo:null,lat:null,lng:null})],
  ['ดอกคำใต้',record(2004,'บ้านปิ่น',{localAuthority:null})],
  ['ดอกคำใต้',record(2005,'ดอกคำใต้',{localAuthority:'ทม.ดอกคำใต้',moo:1})],
  ['ดอกคำใต้',record(2006,'ดอกคำใต้',{localAuthority:'อบต.ดอกคำใต้',moo:1})],
  ['เมืองพะเยา',record(2007,'เทศบาลเมืองพะเยา',{localAuthority:null})],
  [null,record(2999,'ตำบลนอกขอบเขต',{owner:'เทศบาลตำบลแม่กา',lat:19.17,lng:99.9})]
];
for(const [district,row] of EXTRA){SCOPE_DATA.push(row);if(district)EXPECTED[district].push(row.id);}

export const PARITY_DATA = [
  record(9101,'ดอกคำใต้',{name:'DOK-STRUCTURE',localAuthority:'ทม.ดอกคำใต้',problem:'ชำรุด,น้ำเน่าเสีย,น้ำมีสี',depthnet:5,imglink:'https://drive.google.com/uc?export=view&id=districtFixtureImage123456789'}),
  record(9102,'ดอกคำใต้',{name:'DOK-WEED',localAuthority:'ทม.ดอกคำใต้',type:'บ่อบาดาล',problem:'วัชพืชปกคลุม',volume:200,depth:4,depthnet:4}),
  record(9103,'ดอกคำใต้',{name:'DOK-WATER',localAuthority:'ทม.ดอกคำใต้',type:'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)',problem:'น้ำมีสี',volume:300,depth:5,depthnet:5}),
  record(9104,'ดอกคำใต้',{name:'DOK-NO-COORD',localAuthority:'ทม.ดอกคำใต้',lat:null,lng:null,width:null,length:null,depth:0,depthnet:null,volume:0}),
  record(9105,'ดอกคำใต้',{name:'DOK-STRUCTURE2',localAuthority:'ทม.ดอกคำใต้',problem:'ชำรุด',volume:400,depth:3,depthnet:3}),
  record(9106,'ดอกคำใต้',{name:'DOK-DEPTH2',localAuthority:'ทม.ดอกคำใต้',type:'บ่อบาดาล',volume:50,depth:8,depthnet:6})
];
// Identical coordinates exercise actual MarkerCluster spiderfying.
PARITY_DATA[1].lat=PARITY_DATA[0].lat; PARITY_DATA[1].lng=PARITY_DATA[0].lng;

export async function installMocks(context, {data=SCOPE_DATA, host=BASE, baseline=false,
  flags={}, calls=[], imageMode='success'}={}) {
  const vendor=process.env.DISTRICT_VENDOR_DIR;
  if(!vendor)throw new Error('DISTRICT_VENDOR_DIR must contain the pinned project browser libraries');
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url());
    if(['cdnjs.cloudflare.com','unpkg.com'].includes(url.hostname)){
      const asset=path.join(vendor,path.basename(url.pathname));
      if(fs.existsSync(asset))return route.fulfill({status:200,contentType:asset.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(asset)});
      return route.abort();
    }
    if([ACTIVE,host].includes(url.origin) && /^\/api\/waterresources(?:\/version)?$/.test(url.pathname)){
      calls.push({url:req.url(),method:req.method(),kind:'api'});
      const version=url.pathname.endsWith('/version');
      if(flags[version?'failVersion':'failData'])return route.abort();
      return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({
        success:true,initialized:true,version:'"district-fixture-v1"',count:flags.count??data.length,...(version?{}:{data})
      })});
    }
    if(url.hostname==='abacus.jasoncameron.dev'){
      calls.push({url:req.url(),method:req.method(),kind:'counter'});
      return route.fulfill({status:flags.failCounter?503:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({value:url.pathname.endsWith('/total-views')?246:url.pathname.endsWith('/country-TH')?12:0})});
    }
    if(url.hostname==='ipwho.is')return route.fulfill({contentType:'application/json',body:'{"success":true,"country_code":"TH"}'});
    if(['lh3.googleusercontent.com','drive.google.com'].includes(url.hostname)){
      calls.push({url:req.url(),method:req.method(),kind:'image'});
      const success=imageMode==='success'||(imageMode==='thumbnail'&&url.pathname==='/thumbnail');
      return route.fulfill({status:success?200:403,contentType:success?'image/png':'text/html',body:success?PNG:Buffer.from('<html>denied</html>')});
    }
    if(url.hostname==='server.arcgisonline.com')return route.fulfill({contentType:'image/png',body:PNG});
    if(url.origin===host){
      if(!baseline && host===BASE)return route.continue();
      const relative=/^\/(authority|district)\//.test(url.pathname)?'authority.html':url.pathname.replace(/^\//,'');
      const candidate=baseline&&process.env.DISTRICT_BASELINE_DIR?path.join(process.env.DISTRICT_BASELINE_DIR,'site',relative):'';
      const asset=candidate&&fs.existsSync(candidate)?candidate:path.join(ROOT,'site',relative);
      if(!asset.startsWith(path.join(ROOT,'site')) && !baseline)return route.abort();
      if(fs.existsSync(asset)&&fs.statSync(asset).isFile())return route.fulfill({contentType:asset.endsWith('.html')?'text/html':'application/javascript',body:fs.readFileSync(asset)});
      return route.fulfill({status:404,body:'Not found'});
    }
    // Unmocked fonts, data services, images and counters never reach the network.
    return route.abort();
  });
}

export async function ready(page,slug,count,kind='district'){
  await page.waitForFunction(([slug,count,kind])=>{
    const meta=kind==='district'?window.__DISTRICT_PAGE__:window.__AUTHORITY_PAGE__;
    return meta?.slug===slug&&meta.count===count&&document.body.classList.contains('authority-ready')&&Number(document.querySelector('#statCount')?.textContent)===count;
  },[slug,count,kind]);
}
export async function ids(page){return page.locator('#tblBody tr[data-id]').evaluateAll(rows=>rows.map(row=>Number(row.dataset.id)));}
export async function snapshot(page){return page.evaluate(()=>({
  kpis:['statCount','statTypes','statBroken','statVol','statAvgVol'].map(id=>document.getElementById(id).textContent),
  ids:[...document.querySelectorAll('#tblBody tr[data-id]')].map(r=>Number(r.dataset.id)),
  charts:[chartType,chartVol,chartProb].map(c=>({labels:[...c.data.labels],values:[...c.data.datasets[0].data]}))
}));}
