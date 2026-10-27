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
      assert.equal(await page.locator('#authorityHeading').innerText(),`อำเภอ${district} จังหวัดพะเยา`);
      assert.equal(await page.title(),`อำเภอ${district} | ข้อมูลแหล่งน้ำ`);
      assert.deepEqual((await ids(page)).sort((a,b)=>a-b),EXPECTED[district]);
      assert.equal(new Set(await ids(page)).size,EXPECTED[district].length);
      assert.equal(await page.evaluate(()=>window.__AUTHORITY_PAGE__ || null),null);
      assert.equal(await page.evaluate(()=>__DISTRICT_CONTEXT__.district),district);
      assert.equal(await page.locator('#fTambon option').count(),({เมืองพะเยา:12,แม่ใจ:6,ดอกคำใต้:9,ภูกามยาว:2})[district]+1);
      assert.ok(!(await ids(page)).includes(2999));
      await page.reload();await ready(page,slug,EXPECTED[district].length);
      await page.locator('#fTambon').selectOption({เมืองพะเยา:'แม่กา',แม่ใจ:'แม่ใจ',ดอกคำใต้:'ดอกคำใต้',ภูกามยาว:'แม่อิง'}[district]);
      assert.ok((await ids(page)).length>0);
      await reset(page);assert.equal((await ids(page)).length,EXPECTED[district].length);
    }
    if(slug==='dok-kham-tai'){
      assert.ok((await ids(page)).includes(2002),'invalid LocalAuthority must not discard district record');
      assert.ok((await ids(page)).includes(2003),'ambiguous/no coordinates record retained');
      assert.equal(await page.evaluate(()=>markersLayer.getLayers().length),EXPECTED[district].length-1);
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
    assert.ok(await test.page.locator('#authorityZero').isVisible());assert.equal(await test.page.evaluate(()=>markersLayer.getLayers().length),0);
    await finish(test,'valid_empty_district');
  }

  for(const [width,height] of VIEWPORTS){
    let baselineBuffer;
    if(process.env.DISTRICT_BASELINE_DIR){
      const before=await context({width,height,data:PARITY_DATA,host:'http://baseline-authority.test',baseline:true});
      await before.page.goto('http://baseline-authority.test/authority/tm-dok-kham-tai/');await ready(before.page,'tm-dok-kham-tai',6,'authority');
      await settle(before.page);baselineBuffer=await before.page.screenshot({path:path.join(shots,`before-authority-${width}.png`),fullPage:true,animations:'disabled'});
      await finish(before,'before_authority_capture_'+width);
    }
    const authority=await context({width,height,data:PARITY_DATA});
    await authority.page.goto(BASE+'/authority/tm-dok-kham-tai/');await ready(authority.page,'tm-dok-kham-tai',6,'authority');
    await settle(authority.page);
    const authoritySnapshot=await snapshot(authority.page);
    const authorityBuffer=await authority.page.screenshot({path:path.join(shots,`after-authority-${width}.png`),fullPage:true,animations:'disabled'});
    if(baselineBuffer){const diff=await pixelDifference(authority.page,baselineBuffer,authorityBuffer);assert.ok(!diff.differentSize&&diff.different===0,JSON.stringify({width,baselineAuthorityDiff:diff}));visualComparisons.push({width,comparison:'authority-before-after',...diff});}
    await finish(authority,'authority_visual_unchanged_'+width);

    const test=await context({width,height,data:PARITY_DATA}),{page}=test;
    await page.goto(BASE+'/district/dok-kham-tai/');await ready(page,'dok-kham-tai',6);await settle(page);
    assert.deepEqual(await snapshot(page),authoritySnapshot);
    await page.screenshot({path:path.join(shots,`district-${width}.png`),fullPage:true,animations:'disabled'});
    await page.locator('#authorityHeading').evaluate(el=>{el.textContent='เทศบาลเมืองดอกคำใต้ จังหวัดพะเยา';});
    const districtBuffer=await page.screenshot({fullPage:true,animations:'disabled'});
    const diff=await pixelDifference(page,authorityBuffer,districtBuffer);
    assert.ok(!diff.differentSize&&diff.different===0,JSON.stringify({width,districtAuthorityDiff:diff}));
    visualComparisons.push({width,comparison:'district-authority-heading-normalized',...diff});
    await page.locator('#authorityHeading').evaluate(el=>{el.textContent='อำเภอดอกคำใต้ จังหวัดพะเยา';});
    assert.deepEqual(authoritySnapshot.kpis,['6','3','2','1.1K','210']);
    assert.deepEqual(authoritySnapshot.charts[0],{labels:['ฝาย','บ่อบาดาล','สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)'],values:[3,2,1]});
    assert.deepEqual(authoritySnapshot.charts[1].values,[500,250,300]);
    assert.deepEqual(authoritySnapshot.charts[2].values,[2,1,2,1,2]);
    assert.equal(await page.evaluate(()=>markersLayer.getLayers().length),5);
    assert.equal(await page.locator('.kpi[data-kpi]').count(),5);
    assert.equal(await page.evaluate(()=>map.scrollWheelZoom.enabled()),true);
    for(const key of ['types','vol','avg']){await page.locator(`.kpi[data-kpi="${key}"]`).click();assert.ok((await page.locator('#kpiInsight').innerText()).length>50);}
    await page.locator('.kpi[data-kpi="broken"]').click();assert.deepEqual(await ids(page),[9101,9105]);await reset(page);
    for(const [key,wanted] of [['broken',[9101,9105]],['depth',[9101,9106]],['weeds',[9102]],['water',[9101,9103]]]){
      await page.locator(`[data-summary-problem="summary:${key}"]`).click();assert.deepEqual(await ids(page),wanted);await reset(page);
    }
    await page.locator('#fType').selectOption('บ่อบาดาล');assert.deepEqual(await ids(page),[9102,9106]);await reset(page);
    await page.locator('#fProblem').selectOption('น้ำมีสี');assert.deepEqual(await ids(page),[9101,9103]);await reset(page);
    await page.locator('#txtSearch').fill('NO-COORD');assert.deepEqual(await ids(page),[9104]);assert.equal(await page.evaluate(()=>markersLayer.getLayers().length),0);
    await page.locator('#tblBody tr[data-id="9104"]').click();assert.ok((await page.locator('#dssContent').innerText()).includes('ไม่มีพิกัดแผนที่'));
    await page.locator('#dssResetBtn').click();await reset(page);
    await page.locator('#txtSearch').fill('DOES-NOT-EXIST');assert.deepEqual(await ids(page),[]);assert.ok(await page.locator('.dss-empty').isVisible());await reset(page);
    for(const chart of ['type','vol','prob']){await page.locator(`.expand-btn[data-chart="${chart}"]`).click();assert.ok(await page.locator('#chartModalBg').isVisible());await page.locator('#chartModalClose').click();}
    await page.locator('#tblBody tr[data-id="9101"]').click();
    await page.waitForFunction(()=>map._popup?._source?.authorityRecordId===9101);
    const specific=await page.locator('#dssContent').innerText();
    assert.ok(specific.includes('ความจุลดลง 50%')&&specific.includes('โครงสร้างเสียหาย'));
    assert.equal(specific.split('วิกฤตคุณภาพน้ำ:').length-1,1);
    assert.equal(specific.split('ตรวจสอบการระบายน้ำเสียต้นน้ำ').length-1,1);
    await page.waitForFunction(()=>document.querySelector('.leaflet-popup img[data-drive-id]')?.naturalWidth===1);
    assert.ok((await page.locator('.leaflet-popup .pp-nav').getAttribute('href')).includes('destination='));
    await page.locator('.leaflet-popup img[data-drive-id]').click();assert.ok(await page.locator('#imgModalBg').isVisible());await page.locator('#imgModalClose').click();
    await page.locator('#tblBody tr[data-id="9102"]').click();await page.waitForFunction(()=>map._popup?._source?.authorityRecordId===9102);
    assert.ok((await page.locator('#dssContent').innerText()).includes('วัชพืชหนาแน่น'));
    assert.deepEqual(await snapshot(page),authoritySnapshot);
    await page.locator('.leaflet-popup-close-button').last().click();await page.waitForFunction(()=>state.focusId===null);
    assert.equal(await page.locator('.dss-summary-card').count(),4);assert.deepEqual(await snapshot(page),authoritySnapshot);
    await page.evaluate(()=>map.setView(markerRefs[9103].getLatLng(),16,{animate:false}));await settle(page);
    await page.evaluate(()=>markerRefs[9103].getElement().dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
    await page.waitForFunction(()=>state.focusId===9103&&map._popup?._source?.authorityRecordId===9103);
    await page.locator('#dssResetBtn').click();
    await page.evaluate(()=>map.setZoom(10,{animate:false}));await settle(page);
    assert.ok(await page.locator('#mapbox .leaflet-marker-icon svg').count()>0);
    await page.locator('#mapbox .leaflet-marker-icon svg').first().click();await page.waitForFunction(()=>map.getZoom()>10&&!map._animatingZoom);
    assert.equal(await page.evaluate(()=>markersLayer.options.spiderfyOnMaxZoom),true);
    await page.evaluate(()=>map.setView(markerRefs[9101].getLatLng(),15,{animate:false}));await settle(page);
    assert.ok(await page.evaluate(()=>{const cluster=markersLayer.getVisibleParent(markerRefs[9101]);if(typeof cluster.spiderfy!=='function')return false;cluster.spiderfy();return !!markersLayer._spiderfied;}));
    await page.evaluate(()=>markersLayer.unspiderfy());
    await page.locator('#layerBtn').click();await page.locator('#lpVillageNone').click();assert.equal(await page.evaluate(()=>markersLayer.getLayers().length),0);
    assert.deepEqual(await snapshot(page),authoritySnapshot);await page.locator('#lpVillageAll').click();assert.equal(await page.evaluate(()=>markersLayer.getLayers().length),5);
    await page.locator('#layerBtn').click();
    await page.locator('#mapbox').scrollIntoViewIfNeeded();await page.locator('.map-fullscreen-btn').click();assert.equal(await page.locator('.card.pseudo-fullscreen').count(),1);
    await page.evaluate(()=>map.setZoom(12,{animate:false}));await settle(page);
    const box=await page.locator('#mapbox').boundingBox();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.75);await page.mouse.wheel(0,-240);
    await page.waitForFunction(()=>map.getZoom()>12&&!map._animatingZoom);
    await page.keyboard.press('Escape');assert.equal(await page.locator('.card.pseudo-fullscreen').count(),0);
    await page.locator('#vcToggle').click();await page.waitForFunction(()=>document.querySelector('#vcCountryList').textContent.includes('ไทย'));
    assert.ok(await page.locator('#vcPanel').isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2));
    await finish(test,'visual_and_functional_parity_'+width);
    // All four routes also render without overflow at each required viewport.
    for(const [district,slug] of DISTRICTS){
      const t=await context({width,height});await t.page.goto(BASE+'/district/'+slug+'/');await ready(t.page,slug,EXPECTED[district].length);
      assert.ok(await t.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2));await finish(t,'responsive_'+slug+'_'+width);
    }
  }

  for(const imageMode of ['thumbnail','fail']){
    const test=await context({data:PARITY_DATA,imageMode}),{page}=test;
    await page.goto(BASE+'/district/dok-kham-tai/');await ready(page,'dok-kham-tai',6);
    const open=async()=>{await page.locator('#tblBody tr[data-id="9101"]').click();await page.locator('.leaflet-popup .authority-image-fallback').waitFor({state:'visible'});};
    await open();assert.equal(test.calls.filter(c=>c.kind==='image').length,1);
    assert.equal(await page.locator('.leaflet-popup .authority-image-fallback a').getAttribute('href'),PARITY_DATA[0].imglink);
    await page.locator('.leaflet-popup-close-button').click();await open();assert.equal(test.calls.filter(c=>c.kind==='image').length,1);
    await page.locator('.leaflet-popup .authority-image-fallback button').click();
    if(imageMode==='thumbnail'){
      await page.waitForFunction(()=>document.querySelector('.leaflet-popup img[data-drive-id]')?.naturalWidth===1);
    }else{
      await page.locator('.leaflet-popup .authority-image-fallback').waitFor({state:'visible'});
      await page.locator('.leaflet-popup .authority-image-fallback button').click();
      await page.locator('.leaflet-popup .authority-image-fallback').waitFor({state:'visible'});
      assert.ok(await page.locator('.leaflet-popup .authority-image-fallback button').isHidden());
    }
    assert.equal(test.calls.filter(c=>c.kind==='image').length,imageMode==='thumbnail'?2:3);
    await finish(test,'user_triggered_image_fallback_'+imageMode);
  }

  {
    const test=await context({host:ACTIVE}),{page}=test;
    const identities=[];
    for(const [district,slug] of DISTRICTS){
      await page.goto(ACTIVE+'/district/'+slug+'/');await ready(page,slug,EXPECTED[district].length);
      await page.waitForFunction(()=>document.querySelector('#vcTotal').textContent==='246');
      const identity=await page.evaluate(()=>visitorCounterIdentity(__DISTRICT_CONTEXT__));identities.push(identity);
      assert.equal(identity.namespace,'pyo-water-district-'+slug);assert.equal(identity.visitKey,'pyoDistrictVisitDate:'+slug);
      assert.equal(test.calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/'+identity.namespace+'/')).length,2);
      await page.reload();await ready(page,slug,EXPECTED[district].length);await page.waitForFunction(()=>document.querySelector('#vcTotal').textContent==='246');
      assert.equal(test.calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/'+identity.namespace+'/')).length,2);
    }
    assert.equal(new Set(identities.map(i=>i.namespace)).size,4);assert.equal(new Set(identities.map(i=>i.visitKey)).size,4);
    const authorityIdentities=await page.evaluate(()=>AuthorityRoutes.entries.map(e=>visitorCounterIdentity({authority:e.authority,slug:e.slug})));
    assert.equal(authorityIdentities[1].namespace,'pyo-water-maeka-dashboard');assert.equal(authorityIdentities[1].visitKey,'pyoMaeKaVisitDate');
    assert.ok(identities.every(i=>!authorityIdentities.some(a=>a.namespace===i.namespace||a.visitKey===i.visitKey)));
    assert.ok(identities.every(i=>i.namespace!=='pyo-water-dashboard-2026'&&i.visitKey!=='pyoVisitDate'));
    assert.equal(await page.evaluate(()=>visitorCounterIdentity({kind:'district',district:'แม่ใจ',slug:'bad'})),null);
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
