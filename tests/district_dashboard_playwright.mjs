import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,ROOT,BASE,ACTIVE,VIEWPORTS,DISTRICTS,SCOPE_DATA,EXPECTED,PARITY_DATA,
  record,installMocks,ready,ids,snapshot} from './district_browser_support.mjs';

const shots=process.env.DISTRICT_SHOTS_DIR || path.join(ROOT,'docs','district-dashboard-screenshots');
fs.mkdirSync(shots,{recursive:true});
const results=[];
const visualComparisons=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
async function context(options={}){
  const {width=1440,height=900,...mock}=options;
  const ctx=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
  const calls=[];
  await installMocks(ctx,{...mock,calls});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  return {ctx,page,calls,errors};
}
function noHits(calls){assert.equal(calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/')).length,0);}
async function reset(page){await page.locator('.kpi[data-kpi="count"]').click();}
async function finish(test,name){assert.deepEqual(test.errors,[]);noHits(test.calls);await test.ctx.close();results.push(name);console.log('PASS '+name);}
async function settle(page){
  await page.evaluate(async()=>{
    for(const chart of [chartType,chartVol,chartProb]){chart.stop();chart.options.animation=false;chart.update('none');}
    map.stop();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  await page.waitForFunction(()=>!map._animatingZoom&&!markersLayer._inZoomAnimation);
}
async function pixelDifference(page,first,second){
  return page.evaluate(async([a,b])=>{
    const load=src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.src='data:image/png;base64,'+src;});
    const [one,two]=await Promise.all([load(a),load(b)]);
    if(one.width!==two.width||one.height!==two.height)return {differentSize:true,one:[one.width,one.height],two:[two.width,two.height]};
    const canvas=document.createElement('canvas');canvas.width=one.width;canvas.height=one.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(one,0,0);const x=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(two,0,0);const y=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let different=0;for(let i=0;i<x.length;i+=4)if(Math.max(Math.abs(x[i]-y[i]),Math.abs(x[i+1]-y[i+1]),Math.abs(x[i+2]-y[i+2]))>8)different++;
    return {different,total:one.width*one.height};
  },[first.toString('base64'),second.toString('base64')]);
}

try{
  // The pages are served by the real local Netlify Dev routing server.
  for(const [district,slug] of DISTRICTS){
    const test=await context(),{page}=test;
    for(const suffix of ['', '/']){
      await page.goto(`${BASE}/district/${slug}${suffix}`);
      await ready(page,slug,EXPECTED[district].length);
      assert.ok((await page.locator('.header-brand .eyebrow').innerText()).includes(`อำเภอ${district} จังหวัดพะเยา`));
      assert.equal(await page.title(),`อำเภอ${district} | ข้อมูลแหล่งน้ำ`);
      assert.deepEqual((await ids(page)).sort((a,b)=>a-b),EXPECTED[district]);
      assert.equal(new Set(await ids(page)).size,EXPECTED[district].length);
      assert.equal(await page.evaluate(()=>window.__AUTHORITY_PAGE__ || null),null);
      assert.equal(await page.evaluate(()=>__DISTRICT_CONTEXT__.district),district);
      assert.equal(await page.evaluate(()=>__DISTRICT_CONTEXT__.tambons.length),({เมืองพะเยา:12,แม่ใจ:6,ดอกคำใต้:9,ภูกามยาว:2})[district]);
      assert.ok(!(await ids(page)).includes(2999));
      await page.reload();await ready(page,slug,EXPECTED[district].length);
    }
    if(slug==='dok-kham-tai'){
      assert.ok((await ids(page)).includes(2002),'invalid LocalAuthority must not discard district record');
      assert.ok((await ids(page)).includes(2003),'ambiguous/no coordinates record retained');
      assert.equal(await page.evaluate(()=>__SCOPED_MAP__.layer().getLayers().length),EXPECTED[district].length-1);
    }
    assert.ok(test.calls.filter(c=>c.kind==='api').every(c=>c.method==='GET'&&c.url.startsWith(ACTIVE+'/')));
    await finish(test,'scope_paths_reload_reset_'+slug);
  }

  for(const bad of ['/district','/district/','/district/no-such-district/','/district/MAE-CHAI/','/district/mae-chai/extra','/district/mae%2Dchai/']){
    const test=await context();await test.page.goto(BASE+bad);
    await test.page.locator('#districtFailure').waitFor();
    assert.ok((await test.page.title()).includes('ไม่พบอำเภอ'));
    assert.equal(await test.page.locator('#tblBody').count(),0);
    assert.equal(test.calls.filter(c=>c.kind==='api'||c.kind==='counter').length,0);
    await finish(test,'invalid_'+bad);
  }
  {
    const flags={},test=await context({flags}),{page}=test;
    await page.goto(BASE+'/district/dok-kham-tai/');await ready(page,'dok-kham-tai',EXPECTED['ดอกคำใต้'].length);
    flags.failData=true;await page.reload();await ready(page,'dok-kham-tai',EXPECTED['ดอกคำใต้'].length);
    assert.equal(await page.evaluate(()=>__WATER_DATA_DIAGNOSTICS__.source),'indexeddb-cache');
    flags.failVersion=true;await page.reload();await page.locator('#districtFailure').waitFor();
    assert.equal(await page.evaluate(()=>__WATER_DATA_DIAGNOSTICS__.source),'indexeddb-cache-offline');
    flags.failData=false;flags.failVersion=false;await page.locator('#districtRetry').click();await ready(page,'dok-kham-tai',EXPECTED['ดอกคำใต้'].length);
    await finish(test,'validated_cache_offline_rejection_retry');
  }
  for(const spec of [
    {name:'static_bootstrap',flags:{failData:true,failVersion:true}},
    {name:'count_mismatch',flags:{count:SCOPE_DATA.length+1}},
    {name:'duplicate_id',data:[...SCOPE_DATA,SCOPE_DATA[0]]},
    {name:'invalid_id',data:[...SCOPE_DATA,{id:'bad',tambon:'แม่กา'}]}
  ]){
    const test=await context(spec);await test.page.goto(BASE+'/district/mae-chai/');await test.page.locator('#districtFailure').waitFor();
    assert.equal(await test.page.locator('#tblBody').count(),0);
    await finish(test,'fail_closed_'+spec.name);
  }
  {
    const test=await context({data:SCOPE_DATA.filter(r=>!EXPECTED['ภูกามยาว'].includes(r.id))});
    await test.page.goto(BASE+'/district/phu-kam-yao/');await ready(test.page,'phu-kam-yao',0);
    assert.ok(await test.page.locator('#authorityEmptyNotice').isVisible());assert.equal(await test.page.evaluate(()=>__SCOPED_MAP__.layer().getLayers().length),0);
    await finish(test,'valid_empty_district');
  }

  // Legacy authority.html-vs-district pixel/parity blocks and the layer-panel/legacy-toolbar interactions were
  // retired with phase 2 (both route families now share site/index.html). Equivalent contracts live in
  // tests/scoped_template_playwright.mjs (selection, highlight, image retry, counter) and authority_image_requests.
  for(const [width,height] of VIEWPORTS){
    for(const [district,slug] of DISTRICTS){
      const t=await context({width,height});await t.page.goto(BASE+'/district/'+slug+'/');await ready(t.page,slug,EXPECTED[district].length);
      assert.ok(await t.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2));await finish(t,'responsive_'+slug+'_'+width);
    }
  }

  {
    const test=await context({host:ACTIVE}),{page}=test;
    const identities=[];
    for(const [district,slug] of DISTRICTS){
      await page.goto(ACTIVE+'/district/'+slug+'/');await ready(page,slug,EXPECTED[district].length);
      await page.waitForFunction(()=>document.querySelector('#vcTotal').textContent==='246');
      const identity=await page.evaluate(()=>VisitorCounter.identity(__DISTRICT_CONTEXT__));identities.push(identity);
      assert.equal(identity.namespace,'pyo-water-district-'+slug);assert.equal(identity.visitKey,'pyoDistrictVisitDate:'+slug);
      assert.equal(test.calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/'+identity.namespace+'/')).length,2);
      await page.reload();await ready(page,slug,EXPECTED[district].length);await page.waitForFunction(()=>document.querySelector('#vcTotal').textContent==='246');
      assert.equal(test.calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/'+identity.namespace+'/')).length,2);
    }
    assert.equal(new Set(identities.map(i=>i.namespace)).size,4);assert.equal(new Set(identities.map(i=>i.visitKey)).size,4);
    const authorityIdentities=await page.evaluate(()=>AuthorityRoutes.entries.map(e=>VisitorCounter.identity({authority:e.authority,slug:e.slug})));
    assert.equal(authorityIdentities[1].namespace,'pyo-water-maeka-dashboard');assert.equal(authorityIdentities[1].visitKey,'pyoMaeKaVisitDate');
    assert.ok(identities.every(i=>!authorityIdentities.some(a=>a.namespace===i.namespace||a.visitKey===i.visitKey)));
    assert.ok(identities.every(i=>i.namespace!=='pyo-water-dashboard-2026'&&i.visitKey!=='pyoVisitDate'));
    assert.equal(await page.evaluate(()=>VisitorCounter.identity({kind:'district',district:'แม่ใจ',slug:'bad'})),null);
    const requestsBeforeInvalid=test.calls.length;
    await page.goto(ACTIVE+'/district/no-such-district/');await page.locator('#districtFailure').waitFor();
    assert.equal(test.calls.length,requestsBeforeInvalid);
    assert.deepEqual(test.errors,[]);await test.ctx.close();results.push('four_counter_identities_mocked_hits_daily_dedup');
  }
  for(const host of ['https://deploy-preview-123--dashboard-waterresources1.netlify.app',BASE]){
    const test=await context({host});for(const [district,slug] of DISTRICTS){await test.page.goto(host+'/district/'+slug+'/');await ready(test.page,slug,EXPECTED[district].length);await test.page.waitForFunction(()=>document.querySelector('#vcTotal').textContent==='246');}
    await finish(test,'no_hits_'+host);
  }
  for(const failCounter of [true]){
    const test=await context({flags:{failCounter}});await test.page.goto(BASE+'/district/mae-chai/');await ready(test.page,'mae-chai',EXPECTED['แม่ใจ'].length);
    await test.page.waitForFunction(()=>document.querySelector('#vcTotal').textContent==='—');await finish(test,'counter_failure_graceful');
  }
  const report={ok:true,mocked:true,realProductionVerification:false,tests:results,visualComparisons,screenshots:shots};
  if(process.env.DISTRICT_RESULT_PATH)fs.writeFileSync(process.env.DISTRICT_RESULT_PATH,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
