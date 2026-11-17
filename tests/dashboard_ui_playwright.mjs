// UI refresh contract: real project libraries, deterministic data, no live services.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {chromium,ROOT,VIEWPORTS,DISTRICTS,SCOPE_DATA,PARITY_DATA,record,installMocks} from './district_browser_support.mjs';

const {values:{mode,artifacts,baseline}}=parseArgs({options:{mode:{type:'string'},artifacts:{type:'string'},baseline:{type:'string'}}});
assert.ok(['capture','verify-brand','verify-province','verify-scoped','verify-all'].includes(mode));
assert.ok(artifacts&&path.isAbsolute(artifacts),'--artifacts must be absolute');
const HOST='http://dashboard-ui.test';
const TH='กว๊านกักเก็บ แดชบอร์ดศูนย์ข้อมูลแหล่งน้ำ จังหวัดพะเยา';
const EN='KwanKukkeb – Phayao Water Resources Data Center Dashboard';
const DATA=[...SCOPE_DATA,...PARITY_DATA,...Array.from({length:12},(_,i)=>record(7000+i,'แม่กา',{
  localAuthority:'ทต.แม่กา',name:`MAEKA-${i+1}`,problem:['ชำรุด','วัชพืชปกคลุม','น้ำเน่าเสีย,น้ำมีสี','ใช้งานได้'][i%4],
  depthnet:i%4===0?3:10,lat:i===11?null:19.15,lng:i===11?null:99.8,
  imglink:i===0?'https://drive.google.com/uc?export=view&id=UIFixtureImage123456789':null
}))];
const CASES=[['province','/index.html'],...DISTRICTS.map(([,s])=>['district',`/district/${s}/`]),
  ['authority','/authority/tt-mae-ka/'],['authority','/authority/obt-mae-na-ruea/'],['authority','/authority/tm-dok-kham-tai/']];
const dest=path.join(artifacts,mode==='capture'?'baseline':mode);
fs.mkdirSync(dest,{recursive:true});
const baselineFile=baseline?path.resolve(baseline):path.join(artifacts,'baseline','states.json');
const expected=mode==='capture'?{}:JSON.parse(fs.readFileSync(baselineFile,'utf8'));
const actual={},results=[],animationEvidence={};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});

async function settle(page){
  await page.evaluate(async()=>{
    for(const c of Object.values(window.Chart?.instances||{})){c.stop();c.options.animation=false;c.update('none');}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}
export async function captureState(page,kind){
  await settle(page);
  return page.evaluate(kind=>{
    const text=id=>document.getElementById(id)?.textContent.trim()??null;
    const scoped=kind!=='province';
    const charts=Object.fromEntries(Object.values(Chart.instances).filter(c=>c.canvas?.id).map(c=>[c.canvas.id,{
      labels:[...c.data.labels],values:c.data.datasets.map(d=>[...d.data])
    }]));
    return {kpis:scoped?['statCount','statTypes','statBroken','statVol','statAvgVol'].map(text):text('execKpi'),
      ids:[...document.querySelectorAll(scoped?'#tblBody tr[data-id]':'#tblBody tr')].map(r=>scoped?Number(r.dataset.id):Number(r.cells[0]?.textContent)).filter(Number.isFinite),
      charts,filters:Object.fromEntries([...document.querySelectorAll('select,input:not([type=checkbox])')].filter(e=>e.id).map(e=>[e.id,e.value])),
      context:scoped?text('authorityHeading'):text('n-table'),dss:scoped?text('dssContent'):null,
      counterIdentity:scoped?window.visitorCounterIdentity(window.__AUTHORITY_CONTEXT__):null};
  },kind);
}
const BLOCKED_LIVE_HOSTS=['lh3.googleusercontent.com','drive.google.com','script.google.com','script.googleusercontent.com','fonts.googleapis.com','fonts.gstatic.com'];
const unmockedEscapes=[],hitWrites=[];
async function open(kind,url,width,height,{data=DATA,flags={}}={}){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,
    ...(width<500?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
  const calls=[],errors=[],css=[];
  // The original provincial counter has no scoped host guard. Simulate an
  // already-counted day for UI-only scenarios; never change its production code.
  await context.addInitScript(()=>localStorage.setItem('pyoVisitDate',new Date().toISOString().slice(0,10)));
  await installMocks(context,{host:HOST,data,flags,calls});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().endsWith('/dashboard-theme.css'))css.push(r.headers()['content-type']);});
  page.on('request',req=>{
    const u=new URL(req.url());
    if(u.href.includes('action=hit')||(u.hostname==='abacus.jasoncameron.dev'&&u.pathname.includes('/hit/')))hitWrites.push(u.href);
    if(![HOST.replace('http://',''),...BLOCKED_LIVE_HOSTS,'cdnjs.cloudflare.com','unpkg.com','abacus.jasoncameron.dev','ipwho.is','server.arcgisonline.com'].includes(u.hostname)&&!u.protocol.startsWith('data')&&!u.protocol.startsWith('blob')){
      unmockedEscapes.push(u.href);
    }
  });
  await page.goto(HOST+url);
  if(!Object.keys(flags).length){
    if(kind==='province')await page.waitForSelector('#execKpi .kpi-card');
    else await page.waitForSelector('body.authority-ready');
  }
  await settle(page);
  return {context,page,calls,errors,css};
}
async function brand(test,kind){
  const {page}=test;
  assert.equal(await page.locator('.header-brand .eyebrow').innerText(),TH);
  assert.equal(await page.locator('.header-brand h1').first().innerText(),EN);
  assert.ok(await page.locator('body').evaluate((e,kind)=>e.classList.contains(kind==='province'?'dashboard-provincial':'dashboard-scoped'),kind));
  assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).getPropertyValue('--dashboard-brand-start').trim()),'#2a1d7a');
  assert.ok(test.css.some(type=>type?.startsWith('text/css')),'Theme must be served as CSS');
  if(kind==='province'){
    assert.equal(await page.title(),TH);
    assert.equal(await page.locator('a[href="maeka.html"]').isVisible(),false);
  }
}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=2,'Body overflow');}
async function sampleAnimState(page,selector,pseudo,animName){
  return page.evaluate(({selector,pseudo,animName})=>{
    const el=document.querySelector(selector);
    if(!el)return null;
    const st=getComputedStyle(el,pseudo||undefined);
    const anims=document.getAnimations({subtree:true}).filter(a=>a.animationName===animName).map(a=>({
      animationName:a.animationName,playState:a.playState,currentTime:a.currentTime,
      duration:a.effect?.getTiming?.().duration??null
    }));
    return {
      transform:st.transform,opacity:st.opacity,boxShadow:st.boxShadow,borderColor:st.borderColor,
      borderRadius:st.borderRadius,height:st.height,backgroundColor:st.backgroundColor,backgroundImage:st.backgroundImage,
      color:st.color,filter:st.filter,fontSize:st.fontSize,width:st.width,
      animationName:st.animationName,animationDuration:st.animationDuration,transitionDuration:st.transitionDuration,
      content:pseudo?st.content:null,animations:anims
    };
  },{selector,pseudo,animName});
}
async function verifyLayoutAndFocus(page,kind){
  const rects=await page.evaluate(kind=>{
    const header=document.querySelector('.app-header')?.getBoundingClientRect();
    const firstCtrl=document.querySelector(kind==='province'?'.gf-inner':'.toolbar')?.getBoundingClientRect();
    return {headerBottom:header?.bottom??0,ctrlTop:firstCtrl?.top??0};
  },kind);
  assert.ok(rects.ctrlTop>=rects.headerBottom-1,'Header does not overlap filter bar/toolbar');
  const focusSel=kind==='province'?'#efReset':'#txtSearch';
  await page.locator(focusSel).focus();
  await page.keyboard.press('Tab');
  const focused=await page.evaluate(()=>{
    const el=document.activeElement;
    if(!el||el===document.body)return null;
    const st=getComputedStyle(el);
    return {tag:el.tagName,outlineStyle:st.outlineStyle,outlineWidth:parseFloat(st.outlineWidth)||0,boxShadow:st.boxShadow};
  });
  assert.ok(focused&&(focused.outlineStyle!=='none'&&focused.outlineWidth>=2||focused.boxShadow!=='none'),'Keyboard focus produces visible ring');
}
async function verifyUiAndAnimations(page,kind,key,width){
  const isProvince=kind==='province';
  const ev={kind,key,width};
  if(isProvince){
    const barTop=await sampleAnimState(page,'.gf-inner','::before','');
    assert.equal(barTop.height,'6px',key+' .gf-inner::before height');
    assert.ok(barTop.backgroundImage.includes('gradient'),key+' .gf-inner::before rainbow');
    const dot1=await sampleAnimState(page,'#efCount','::before','ixPulse');
    await page.waitForTimeout(450);
    const dot2=await sampleAnimState(page,'#efCount','::before','ixPulse');
    ev.ixPulse={dot1,dot2};
    assert.equal(dot1.width,'7px',key+' #efCount::before width');
    assert.equal(dot1.height,'7px',key+' #efCount::before height');
    assert.equal(dot1.borderRadius,'50%',key+' #efCount::before radius');
    assert.equal(dot1.backgroundColor,'rgb(31, 169, 113)',key+' #efCount::before green');
    assert.equal(dot1.animationName,'ixPulse',key+' #efCount::before ixPulse');
    const efCountBox=await sampleAnimState(page,'#efCount',null,'');
    assert.equal(efCountBox.borderRadius,'999px',key+' #efCount pill radius');
    assert.equal(efCountBox.backgroundColor,'rgb(227, 242, 253)',key+' #efCount unfiltered background');
    assert.equal(efCountBox.color,'rgb(90, 112, 128)',key+' #efCount unfiltered color');
    assert.ok(dot1.animations.length>0&&dot2.animations.length>0&&dot2.animations[0].currentTime>dot1.animations[0].currentTime,key+' ixPulse advances');
    assert.notEqual(dot2.boxShadow,dot1.boxShadow,key+' ixPulse boxShadow animates');

    const selStyle=await sampleAnimState(page,'.gf-field select',null,'');
    const tambonStyle=await sampleAnimState(page,'.gf .tambon-combobox input[type=text]',null,'');
    assert.equal(tambonStyle.height,selStyle.height,key+' tambon input height matches select');
    assert.equal(tambonStyle.borderRadius,selStyle.borderRadius,key+' tambon input radius matches select');
    assert.equal(tambonStyle.backgroundColor,selStyle.backgroundColor,key+' tambon input bg matches select');

    await page.locator('#efTambon').focus();
    await page.waitForTimeout(260);
    const tambonFocus=await sampleAnimState(page,'#efTambon',null,'');
    assert.equal(tambonFocus.borderColor,'rgb(124, 92, 240)',key+' #efTambon:focus borderColor');

    await page.locator('#efReset').hover();
    await page.waitForTimeout(260);
    const resetHover=await sampleAnimState(page,'#efReset',null,'');
    assert.equal(resetHover.color,'rgb(255, 255, 255)',key+' #efReset:hover text white');
    assert.ok(resetHover.backgroundImage.includes('gradient'),key+' #efReset:hover gradient');

    const chartDot=await sampleAnimState(page,'.chart-box > h3','::before','');
    assert.equal(chartDot.width,'8px',key+' .chart-box>h3::before width');
    assert.equal(chartDot.borderRadius,'50%',key+' .chart-box>h3::before radius');
  }else{
    const bodySt=await sampleAnimState(page,'body',null,'');
    assert.equal(bodySt.backgroundColor,'rgb(242, 240, 255)',key+' scoped body lavender');
    assert.equal(bodySt.color,'rgb(28, 27, 75)',key+' scoped body ink');
    const tb=await sampleAnimState(page,'.toolbar',null,'');
    assert.equal(tb.borderRadius,'22px',key+' scoped toolbar radius');
    const tbSel=await sampleAnimState(page,'.toolbar select',null,'');
    const tbIn=await sampleAnimState(page,'.toolbar input[type=text]',null,'');
    assert.equal(tbIn.height,tbSel.height,key+' scoped input height matches select');
    assert.equal(tbIn.borderRadius,tbSel.borderRadius,key+' scoped input radius matches select');
    await page.locator('#txtSearch').focus();
    await page.waitForTimeout(260);
    const inFocus=await sampleAnimState(page,'#txtSearch',null,'');
    assert.equal(inFocus.borderColor,'rgb(124, 92, 240)',key+' scoped #txtSearch:focus borderColor');
  }

  // Hover -> fxFloat + icon rotate/scale, :active press, click -> fxStamp + fxFlag
  const cardSel=isProvince?'#execKpi .kpi-card':'.kpis .kpi';
  const targetIdx=isProvince?1:2;
  const targetCardCss=isProvince?`#execKpi .kpi-card:nth-child(${targetIdx+1})`:`.kpis .kpi:nth-child(${targetIdx+1})`;
  const iconSel=isProvince?`${targetCardCss} .ki`:`${targetCardCss} .kpi-icon`;
  const wmSel=isProvince?targetCardCss:`${targetCardCss} .kpi-bgicon`;
  const wmPseudo=isProvince?'::after':null;
  const activeCls=isProvince?'kpi-active':'active';
  const card=page.locator(cardSel).nth(targetIdx);
  await card.scrollIntoViewIfNeeded();
  const preIcon=await sampleAnimState(page,iconSel,null,'');
  assert.equal(preIcon.transform,'none',key+' pre-hover icon transform none');
  await card.hover();
  await page.waitForTimeout(40);
  const f1=await sampleAnimState(page,wmSel,wmPseudo,'fxFloat');
  await page.waitForTimeout(420);
  const f2=await sampleAnimState(page,wmSel,wmPseudo,'fxFloat');
  const hIcon=await sampleAnimState(page,iconSel,null,'');
  ev.fxFloat={f1,f2,hIcon};
  if(width===1440)await page.screenshot({path:path.join(dest,`${key}-kpi-hover.png`)});
  assert.equal(f1.animationName,'fxFloat',key+' hover watermark fxFloat');
  assert.ok(f1.animations.length>0&&f2.animations.length>0&&f2.animations[0].currentTime>f1.animations[0].currentTime,key+' fxFloat currentTime advances');
  assert.notEqual(f2.transform,f1.transform,key+' fxFloat transform animates');
  assert.notEqual(hIcon.transform,'none',key+' icon rotates/scales on hover');

  const box=await card.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.waitForTimeout(30);
  const pressed=await sampleAnimState(page,targetCardCss,null,'');
  await page.mouse.move(2,2);
  await page.mouse.up();
  assert.notEqual(pressed.transform,'none',key+' :active transform');
  await page.waitForTimeout(50);

  const selCard=card;
  const selCardCss=targetCardCss;
  const selWmCss=wmSel;
  const selLblCss=isProvince?`${selCardCss} .kl`:`${selCardCss} .l`;
  await selCard.click();
  await page.waitForTimeout(25);
  const s1=await sampleAnimState(page,selWmCss,wmPseudo,'fxStamp');
  const g1=await sampleAnimState(page,selLblCss,'::after','fxFlag');
  await page.waitForTimeout(520);
  const s2=await sampleAnimState(page,selWmCss,wmPseudo,'fxStamp');
  const g2=await sampleAnimState(page,selLblCss,'::after','fxFlag');
  ev.selected={fxStamp:{s1,s2},fxFlag:{g1,g2}};
  if(width===1440)await page.screenshot({path:path.join(dest,`${key}-kpi-selected.png`)});
  assert.equal(await selCard.evaluate((e,c)=>e.classList.contains(c),activeCls),true,key+' selected class');
  assert.equal(s1.animationName,'fxStamp',key+' selected watermark fxStamp');
  assert.equal(g1.animationName,'fxFlag',key+' selected badge fxFlag');
  assert.ok(g1.content.includes('กำลังกรอง'),key+' selected badge text');
  assert.ok(s1.transform!==s2.transform||s1.opacity!==s2.opacity||(s1.animations[0]&&s2.animations[0]&&s2.animations[0].currentTime>s1.animations[0].currentTime),key+' fxStamp animates');
  assert.ok(g1.transform!==g2.transform||(g1.animations[0]&&g2.animations[0]&&g2.animations[0].currentTime>g1.animations[0].currentTime),key+' fxFlag animates');
  await selCard.click();
  await page.waitForTimeout(50);
  assert.equal(await selCard.evaluate((e,c)=>e.classList.contains(c),activeCls),false,key+' toggle off clears active');

  if(isProvince){
    await page.locator('[data-view="detail"]').click();
    await settle(page);
    const tabAct=await sampleAnimState(page,'.tab-btn.active',null,'');
    assert.equal(tabAct.borderRadius,'999px',key+' .tab-btn.active pill');
    await page.locator('[data-tab="damaged"]').click();
    await page.waitForTimeout(900);
    const dfChip=page.locator('#dfProblemChips .df-chip').first();
    if(await dfChip.count()){
      await dfChip.click();
      await page.waitForTimeout(25);
      const dfAfter=await sampleAnimState(page,'#dfProblemChips .df-chip.active','::after','fxFlag');
      assert.ok(dfAfter?.content.includes('✓'),key+' .df-chip.active::after check');
      assert.equal(dfAfter?.animationName,'fxFlag',key+' .df-chip.active::after fxFlag');
      await page.waitForTimeout(900);
    }
    await page.locator('[data-tab="gallery"]').click();
    const gcard=page.locator('#galleryGrid .gcard').first();
    if(await gcard.count()){
      await gcard.hover();
      await page.waitForTimeout(240);
      const gAfter=await sampleAnimState(page,'#galleryGrid .gcard:first-child .img-box','::after','');
      assert.ok(gAfter.content.includes('🔍'),key+' .gcard:hover .img-box::after zoom icon');
      assert.equal(gAfter.opacity,'1',key+' .gcard:hover .img-box::after opacity');
    }
    await page.locator('[data-view="exec"]').click();
    await settle(page);
  }

  // Fullscreen map ancestor check
  const fsBtn=page.locator('.map-expand-ctrl a, .map-fullscreen-btn').first();
  if(await fsBtn.count()){
    await fsBtn.click();
    await page.waitForTimeout(50);
    const offenders=await page.evaluate(sel=>{
      const mapEl=document.querySelector(sel);
      const list=[];
      for(let p=mapEl?.parentElement;p&&p!==document.documentElement;p=p.parentElement){
        const st=getComputedStyle(p);
        if(st.transform!=='none'||st.filter!=='none'||st.animationName!=='none')list.push({cls:p.className,t:st.transform,f:st.filter,a:st.animationName});
      }
      return list;
    },isProvince?'#map':'#mapbox');
    assert.deepEqual(offenders,[],key+' fullscreen map ancestors free of transform/filter/animation');
    await fsBtn.click();
    await page.waitForTimeout(50);
  }

  // Reduced motion check
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(40);
  const rmCard=await sampleAnimState(page,targetCardCss,null,'');
  const rmWm=await sampleAnimState(page,wmSel,wmPseudo,'fxFloat');
  ev.reducedMotion={rmCard,rmWm};
  assert.ok(parseFloat(rmCard.transitionDuration)<=0.001,key+' reduced-motion transitionDuration');
  assert.ok(parseFloat(rmWm.animationDuration)<=0.001,key+' reduced-motion animationDuration');
  await page.emulateMedia({reducedMotion:'no-preference'});
  animationEvidence[key]=ev;
}
async function finish(test,name){
  assert.deepEqual(test.errors,[],name+' page errors');
  assert.equal(test.calls.filter(c=>c.kind==='counter'&&c.url.includes('/hit/')).length,0,'No visitor writes');
  assert.ok(test.calls.filter(c=>c.kind==='api').every(c=>c.method==='GET'));
  await test.context.close();results.push(name);console.log('PASS '+name);
}

try{
  for(const [kind,url] of CASES){
    if(mode==='verify-province'&&kind!=='province'||mode==='verify-scoped'&&kind==='province')continue;
    for(const [width,height] of VIEWPORTS){
      const test=await open(kind,url,width,height),{page}=test;
      const key=`${url.replaceAll('/','_')}-${width}`;
      if(mode!=='capture'){await brand(test,kind);await verifyLayoutAndFocus(page,kind);}
      await noOverflow(page);
      if(['verify-province','verify-all'].includes(mode)&&kind==='province'){
        assert.equal(await page.locator('.gf-inner').evaluate(e=>getComputedStyle(e).borderRadius),'22px','Reference filter card theme');
        assert.equal(await page.locator('#execKpi .kpi-card').first().evaluate(e=>getComputedStyle(e).borderRadius),'20px');
      }
      if(['verify-scoped','verify-all'].includes(mode)&&kind!=='province'){
        assert.equal(await page.locator('#dssBoard').evaluate(e=>getComputedStyle(e).borderLeftWidth),'5px','Keep DSS severity accent');
        const layout=await page.evaluate(()=>{
          const map=document.querySelector('#mapbox').closest('.card').getBoundingClientRect();
          const table=document.querySelector('.tablecard').getBoundingClientRect();
          const charts=[...document.querySelectorAll('.railcol .card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y};});
          return {map:{x:map.x,y:map.y,bottom:map.bottom},table:{x:table.x,y:table.y},charts};
        });
        if(width>=1101){
          assert.ok(Math.abs(layout.map.y-layout.table.y)<2&&layout.table.x>layout.map.x,'Desktop map and table side by side');
          assert.ok(layout.charts.every(c=>Math.abs(c.y-layout.charts[0].y)<2),'Three charts share a desktop row');
        }else assert.ok(layout.table.y>=layout.map.bottom,'Mobile/tablet reading order');
      }
      await page.screenshot({path:path.join(dest,key+'.png'),fullPage:true});
      const save=async state=>{
        const k=key+':'+state;actual[k]=await captureState(page,kind);
        if(mode!=='capture')assert.deepEqual(actual[k],expected[k],k+' semantic parity');
      };
      await save('initial');
      if(mode!=='verify-brand'){
        if(kind==='province'){
          const value=await page.locator('#efType option').evaluateAll(a=>a.find(e=>e.value)?.value);
          await page.selectOption('#efType',value);await save('type');
          await page.locator('#efReset').click();await save('reset');
          await page.locator('[data-view="detail"]').click();
          await page.locator('#searchBox').fill('NO-SUCH-RESOURCE');await save('zero');
          await page.locator('#searchBox').fill('');
          for(const tab of ['table','gallery','damaged','tambon','overview']){
            await page.locator(`[data-tab="${tab}"]`).click();if(tab==='damaged')await page.waitForTimeout(900);await noOverflow(page);
          }
          await page.locator('[data-view="exec"]').click();await settle(page);
        }else{
          const value=await page.locator('#fType option').evaluateAll(a=>a.find(e=>e.value!=='all')?.value);
          await page.selectOption('#fType',value);await save('type');
          await page.locator('[data-kpi="count"]').click();await save('reset');
          await page.locator('#txtSearch').fill('NO-SUCH-RESOURCE');await save('zero');
          await page.locator('#txtSearch').fill('');
          await page.locator('[data-kpi="broken"]').click();await save('broken');
          await page.locator('[data-kpi="count"]').click();
          const row=page.locator('#tblBody tr[data-id]').first();
          if(await row.count()){await row.click();await save('selected');}
        }
        const runUiProbe=(width===1440||width===390)&&(url==='/index.html'||url==='/authority/tt-mae-ka/'||url==='/district/mae-chai/');
        if(runUiProbe&&['verify-province','verify-scoped','verify-all'].includes(mode)){
          await verifyUiAndAnimations(page,kind,key,width);
        }
      }
      await finish(test,key);
    }
  }
  if(mode!=='capture'){
    // Extra-long context, effective 200% layout, blocked fonts, and keyboard focus.
    const test=await open('authority','/authority/obt-mae-na-ruea/',720,450);
    await brand(test,'authority');await noOverflow(test.page);
    await test.page.locator('#authorityHeading').evaluate(e=>e.textContent+=' ชื่อหน่วยงานยาวสำหรับทดสอบการตัดบรรทัด'.repeat(4));
    await noOverflow(test.page);
    await test.page.locator('#txtSearch').focus();
    assert.equal(await test.page.locator('#txtSearch').evaluate(e=>document.activeElement===e),true);
    await finish(test,'long-context-font-fallback-200-percent-layout');
    const legacy=await browser.newContext();await installMocks(legacy,{host:HOST,data:DATA});
    const page=await legacy.newPage();await page.goto(HOST+'/maeka.html');
    assert.equal(await page.locator('link[href*="dashboard-theme.css"]').count(),0);await legacy.close();results.push('legacy-no-theme');
  }
  if(['verify-province','verify-all'].includes(mode)){
    const rows=Array.from({length:501},(_,i)=>record(20000+i,'แม่กา',{localAuthority:'ทต.แม่กา'}));
    const test=await open('province','/index.html',360,800,{data:rows});
    await test.page.locator('[data-view="detail"]').click();await test.page.locator('[data-tab="table"]').click();
    assert.equal(await test.page.locator('#tblBody tr').count(),500);
    assert.ok((await test.page.locator('#n-table').innerText()).includes('501'));
    await noOverflow(test.page);await finish(test,'province-501-record-table-cap');
  }
  if(mode==='verify-all'){
    const ctx={window:{}};for(const name of ['area-responsibility','authority-routes'])vm.runInNewContext(fs.readFileSync(path.join(ROOT,'site/assets/'+name+'.js'),'utf8'),ctx);
    assert.equal(ctx.window.AuthorityRoutes.entries.length,29);
    for(const entry of ctx.window.AuthorityRoutes.entries){
      const test=await open('authority','/authority/'+entry.slug+'/',390,844);await brand(test,'authority');
      assert.ok((await test.page.locator('#authorityHeading').innerText()).includes(ctx.window.AuthorityRoutes.fullName(entry.authority)));
      await noOverflow(test.page);await finish(test,'route-'+entry.slug);
    }
    for(const url of ['/authority/unknown/','/district/unknown/']){
      const test=await open('invalid',url,360,800,{flags:{invalid:true}});
      await test.page.locator(url.startsWith('/district')?'#districtFailure':'#authorityFailure').waitFor();
      assert.equal(test.calls.filter(c=>c.kind==='api').length,0);await finish(test,'invalid-'+url);
    }
    for(const flags of [{failVersion:true,failData:true},{count:DATA.length+1}]){
      const test=await open('authority','/authority/tt-mae-ka/',360,800,{flags});
      await test.page.locator('#authorityFailure').waitFor();await finish(test,'fail-closed-'+JSON.stringify(flags));
    }
    for(const url of ['/authority/tt-mae-ka/','/district/mae-chai/']){
      const test=await open('authority',url,360,800,{data:[]});assert.equal(await test.page.locator('#statCount').innerText(),'0');
      await noOverflow(test.page);await finish(test,'empty-'+url);
    }
  }
  if(mode==='capture'){
    assert.equal(fs.existsSync(baselineFile),false,'Never overwrite baseline');
    fs.writeFileSync(baselineFile,JSON.stringify(actual,null,2));
    const hashes=Object.fromEntries(['site/index.html','site/authority.html','site/maeka.html','site/assets/authority-app.js','site/assets/maeka-app.js','site/assets/water-data-loader.js','netlify.toml'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));
    fs.writeFileSync(path.join(dest,'hashes.json'),JSON.stringify(hashes,null,2));
  }
}finally{await browser.close();fs.writeFileSync(path.join(dest,'animation-evidence.json'),JSON.stringify(animationEvidence,null,2));fs.writeFileSync(path.join(dest,'results.json'),JSON.stringify({mode,mocked:true,realProductionVerification:false,fontMode:'fallback',unmockedEscapes,hitWrites,tests:results,states:Object.keys(actual).length,animationProbes:Object.keys(animationEvidence).length},null,2));}
assert.deepEqual(unmockedEscapes,[],'Zero unmocked external network escapes');
assert.deepEqual(hitWrites,[],'Zero production hit writes');
console.log(`PASS ${mode}: ${results.length} groups`);
