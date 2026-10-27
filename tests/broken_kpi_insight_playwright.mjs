import assert from 'node:assert/strict';
import {chromium,BASE,VIEWPORTS,record,installMocks,ready,ids,snapshot} from './district_browser_support.mjs';

const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
const data=Array.from({length:12},(_,i)=>record(9200+i,'แม่กา',{
  name:`BROKEN-${i+1}`,localAuthority:'ทต.แม่กา',problem:'ชำรุด',
  type:i<10?'ฝาย':'บ่อบาดาล'
}));
data.push(record(9300,'แม่กา',{name:'HEALTHY',localAuthority:'ทต.แม่กา'}));
const results=[];
try{
  for(const [width,height] of VIEWPORTS)for(const [kind,slug] of [['district','mueang-phayao'],['authority','tt-mae-ka']]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
    const calls=[];await installMocks(context,{data,calls});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${BASE}/${kind}/${slug}/`);await ready(page,slug,13,kind);
    await page.locator('.kpi[data-kpi="broken"]').click();
    assert.equal(await page.locator('#statCount').innerText(),'12');
    assert.equal((await ids(page)).length,12);
    const filtered=await snapshot(page);
    assert.equal(await page.locator('#brokenInsightNames b').count(),5);
    assert.equal(await page.locator('#brokenInsightMore').innerText(),'แสดงเพิ่มเติม (อีก 7 จุด)');
    assert.equal(await page.locator('#brokenInsightMore').getAttribute('aria-expanded'),'false');
    await page.locator('#brokenInsightMore').click();
    assert.equal(await page.locator('#brokenInsightNames b').count(),12);
    assert.equal(await page.locator('#brokenInsightMore').innerText(),'แสดงน้อยลง');
    assert.deepEqual(await snapshot(page),filtered,'expand must not change filtering, KPIs, table or charts');
    await page.locator('#brokenInsightMore').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#brokenInsightNames b').count(),5);
    await page.keyboard.press('Space');assert.equal(await page.locator('#brokenInsightNames b').count(),12);
    await page.locator('#fType').selectOption('บ่อบาดาล');
    assert.equal(await page.locator('#brokenInsightNames b').count(),2);
    assert.equal(await page.locator('#brokenInsightMore').count(),0);
    await page.locator('#fType').selectOption('all');
    assert.equal(await page.locator('#brokenInsightNames b').count(),5,'changed filter resets the preview');
    await page.locator('#txtSearch').fill('NOT-FOUND');assert.equal(await page.locator('#brokenInsightMore').count(),0);
    await page.locator('#txtSearch').fill('');assert.equal(await page.locator('#brokenInsightNames b').count(),5);
    await page.locator('.kpi[data-kpi="count"]').click();assert.equal(await page.locator('#statCount').innerText(),'13');
    assert.equal(await page.locator('#brokenInsightMore').count(),0);
    await page.locator('.kpi[data-kpi="broken"]').click();assert.equal(await page.locator('#brokenInsightNames b').count(),5);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2));
    assert.equal(calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/')).length,0);
    assert.deepEqual(errors,[]);await context.close();results.push(`${kind}_${width}`);
    console.log('PASS '+results.at(-1));
  }
  const large=Array.from({length:227},(_,i)=>record(10000+i,'แม่กา',{
    name:`LARGE-BROKEN-${i+1}`,localAuthority:'ทต.แม่กา',problem:'ชำรุด'
  }));
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await installMocks(context,{data:large});const page=await context.newPage();
  await page.goto(BASE+'/district/mueang-phayao/');await ready(page,'mueang-phayao',227);
  await page.locator('.kpi[data-kpi="broken"]').click();
  assert.equal(await page.locator('#brokenInsightNames b').count(),5);
  assert.equal(await page.locator('#brokenInsightMore').innerText(),'แสดงเพิ่มเติม (อีก 222 จุด)');
  await page.locator('#brokenInsightMore').click();assert.equal(await page.locator('#brokenInsightNames b').count(),227);
  await page.locator('#brokenInsightMore').click();assert.equal(await page.locator('#brokenInsightNames b').count(),5);
  assert.equal(await page.locator('#statBroken').innerText(),'227');
  await context.close();results.push('district_227_records');
  console.log(JSON.stringify({ok:true,mocked:true,tests:results}));
}finally{await browser.close();}
