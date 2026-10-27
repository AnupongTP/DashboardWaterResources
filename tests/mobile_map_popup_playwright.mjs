// Real Leaflet/MarkerCluster and Android touch events; all services/images mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium, installMocks, record, ready, ROOT} from './district_browser_support.mjs';

const host='http://mobile-map.test';
const data=Array.from({length:4},(_,i)=>record(9801+i,'แม่กา',{
  name:`POPUP-${i+1}`,localAuthority:'เทศบาลตำบลแม่กา',lat:19.15,lng:99.8,
  problem:'ชำรุด',owner:'หน่วยงานผู้ดูแล '.repeat(35),
  imglink:'https://drive.google.com/uc?export=view&id=mobilePopupFixture123456789'
}));
const output=process.env.MOBILE_MAP_TEST_OUTPUT;
if(output)fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const results=[];
const mapHook=';window.__popupMaps={};window.__popupGroups={};L.Map.addInitHook(function(){window.__popupMaps[this._container.id]=this;this.on("layeradd",e=>{if(L.MarkerClusterGroup&&e.layer instanceof L.MarkerClusterGroup)window.__popupGroups[this._container.id]=e.layer;});});';
try {
  for(const [kind,route,mapName,layerName,selector] of [
    ['authority','/authority/tt-mae-ka/','map','markersLayer','#mapbox'],
    ['district','/district/mueang-phayao/','map','markersLayer','#mapbox'],
    ['province','/index.html','window.__popupMaps.map','window.__popupGroups.map','#map'],
    ['damaged','/index.html','window.__popupMaps["damaged-map"]','window.__popupGroups["damaged-map"]','#damaged-map']
  ]) for(const width of [360,390,412,1440]) {
    if(process.env.MOBILE_MAP_KIND && kind!==process.env.MOBILE_MAP_KIND)continue;
    if(process.env.MOBILE_MAP_WIDTH && width!==Number(process.env.MOBILE_MAP_WIDTH))continue;
    const mobile=width<500;
    const context=await browser.newContext({viewport:{width,height:mobile?844:900},
      isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
    const calls=[],errors=[];
    await installMocks(context,{host,data,calls});
    await context.route('**/leaflet.js',route=>route.fulfill({contentType:'application/javascript',
      body:fs.readFileSync(path.join(process.env.DISTRICT_VENDOR_DIR,'leaflet.js'),'utf8')+
        mapHook}));
    // The provincial page embeds Leaflet inline, unlike authority.html.
    await context.route(host+'/index.html',route=>{
      const file=path.join(process.env.MOBILE_MAP_BASELINE||ROOT,'site/index.html');
      const html=fs.readFileSync(file,'utf8').replace('<script src="./assets/cluster-icon.js"></script>',
        '<script>'+mapHook+'</script><script src="./assets/cluster-icon.js"></script>');
      return route.fulfill({contentType:'text/html',body:html});
    });
    // Optional read-only snapshot comparison; never alters the working tree.
    if(process.env.MOBILE_MAP_BASELINE)await context.route(host+'/**',async(route,next)=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==='/index.html')return route.fallback();
      const relative=/^\/(authority|district)\//.test(pathname)?'site/authority.html':'site'+pathname;
      const file=path.join(process.env.MOBILE_MAP_BASELINE,relative);
      if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:file.endsWith('.html')?'text/html':'application/javascript',body:fs.readFileSync(file)});
      return route.fallback();
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host+route);
    if(kind==='authority'||kind==='district')await ready(page,kind==='authority'?'tt-mae-ka':'mueang-phayao',4,kind);
    else {
      await page.waitForFunction('window.__popupGroups?.map').catch(async e=>{
        console.log(await page.evaluate(()=>({maps:Object.keys(window.__popupMaps||{}),groups:Object.keys(window.__popupGroups||{}),body:document.body.innerText.slice(-600)})),errors);
        throw e;
      });
      if(kind==='damaged'){
        if(mobile)await page.locator('[data-view="detail"]').tap();
        else await page.locator('[data-view="detail"]').click();
        if(mobile)await page.locator('[data-tab="damaged"]').tap();
        else await page.locator('[data-tab="damaged"]').click();
        await page.waitForFunction('window.__popupGroups?.["damaged-map"]');
      }
    }
    const act=async locator=>mobile?locator.tap():locator.click();
    await page.locator(selector).scrollIntoViewIfNeeded();
    // Zooming past the old cutoff must retain four coincident records as a
    // selectable cluster, including circle markers on the provincial damage map.
    for(const zoom of [16,18]){
      await page.evaluate(({mapName,zoom})=>eval(mapName).setView([19.15,99.8],zoom,{animate:false}),{mapName,zoom});
      await page.waitForTimeout(400);
      await act(page.locator(selector+' .leaflet-marker-icon').filter({hasText:/^\s*4\s*$/}).last().locator('svg text'));
      await page.waitForTimeout(400);
      const overlap=await page.evaluate(({mapName,layerName})=>{
        const mp=eval(mapName),group=eval(layerName),markers=group.getLayers();
        return {count:markers.length,spiderfied:!!group._spiderfied,
          positions:new Set(markers.map(m=>{const p=mp.latLngToContainerPoint(m.getLatLng());return `${Math.round(p.x)},${Math.round(p.y)}`})).size};
      },{mapName,layerName});
      assert.deepEqual(overlap,{count:4,spiderfied:true,positions:4},`${kind}/${width}/zoom${zoom}: overlapping records inaccessible`);
    }
    await page.evaluate(({mapName,kind})=>{
      const mp=eval(mapName);mp.setView([19.15,99.8],15,{animate:false});
      window.popupTrace=[];mp.on('popupopen popupclose',e=>popupTrace.push(e.type));
    },{mapName,kind});
    await page.waitForTimeout(600);
    await act(page.locator(selector+' .leaflet-marker-icon').filter({hasText:/^\s*4\s*$/}).last().locator('svg text'));
    await page.waitForTimeout(450);
    const opened=await page.evaluate(({layerName})=>!!eval(layerName)._spiderfied,{layerName});
    assert.ok(opened,`${kind}/${width}: cluster did not spiderfy`);
    if(kind==='damaged'){
      // Select the actual group child without relying on SVG DOM ordering.
      await page.evaluate(({layerName})=>eval(layerName).getLayers()[0].getElement().setAttribute('data-popup-test-marker','selected'),{layerName});
      await act(page.locator(selector+' [data-popup-test-marker="selected"]'));
    }
    else await act(page.locator(selector+' .leaflet-marker-icon:not(.marker-cluster)').filter({hasNot:page.locator('svg text')}).first());
    await page.waitForTimeout(1100);
    const measure=()=>page.evaluate(({mapName,layerName})=>{
      const mp=eval(mapName),popup=mp._popup,el=popup?.getElement();
      const content=el?.querySelector('.leaflet-popup-content');
      return {open:!!popup?.isOpen(),height:el?.getBoundingClientRect().height,mapHeight:mp.getSize().y,
        scroll:content?content.scrollHeight>content.clientHeight:false,
        inBounds:popup?mp.getBounds().contains(popup.getLatLng()):false,
        spiderfied:!!eval(layerName)._spiderfied,trace:window.popupTrace};
    },{mapName,layerName});
    let status=await measure();
    assert.ok(status.open,`${kind}/${width}: popup closed ${JSON.stringify(status)}`);
    assert.ok(status.height<status.mapHeight,`${kind}/${width}: popup exceeds map ${JSON.stringify(status)}`);
    assert.ok(status.inBounds&&(kind==='damaged'||status.spiderfied),`${kind}/${width}: marker removed/collapsed`);
    const imagesBefore=calls.filter(c=>c.kind==='image').length;
    const fullscreen=page.locator(selector+' .map-fullscreen-btn');
    const provinceFullscreen=page.locator(selector+' .map-expand-ctrl a');
    // Use the existing button through its observed DOM, with the public function
    // only for the provincial control whose class is different across maps.
    if(kind==='authority'||kind==='district')await act(fullscreen);
    else await act(provinceFullscreen);
    await page.waitForTimeout(500);
    assert.ok((await measure()).open,`${kind}/${width}: fullscreen closed popup`);
    assert.equal(calls.filter(c=>c.kind==='image').length,imagesBefore,'Resize recreated image requests');
    if(kind==='authority'||kind==='district'){
      await act(page.locator(selector+' .leaflet-popup img[data-drive-id]'));
      await page.waitForSelector('#imgModalBg.open');
      assert.ok(await page.locator('#imgModalBg').evaluate(el=>{
        const r=el.querySelector('img').getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }),'Image modal is behind fullscreen map');
      await act(page.locator('#imgModalClose'));
    }else{
      await page.evaluate(()=>showSiteCard(9801));
      assert.ok(await page.locator('#siteCardModal').evaluate(el=>{
        const r=el.querySelector('.site-card-box').getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }),'Province detail modal is behind fullscreen map');
      await act(page.locator('#siteCardClose'));
    }
    if(kind==='authority'||kind==='district')await act(fullscreen);
    else await act(provinceFullscreen);
    await page.waitForTimeout(500);
    status=await measure();
    assert.ok(status.open && status.height<status.mapHeight && status.inBounds,
      `${kind}/${width}: shrinking map lost popup ${JSON.stringify(status)}`);
    if(output&&mobile&&width===390)await page.screenshot({path:path.join(output,`${kind}-${width}.png`)});
    await act(page.locator(selector+' .leaflet-popup-close-button'));
    assert.equal((await measure()).open,false,'Explicit popup close stopped working');
    assert.deepEqual(errors,[],`${kind}/${width}: JavaScript errors`);
    results.push({kind,width,...status,imagesBefore});
    console.log(`PASS ${kind} ${width}px: popup stable, bounded, cluster preserved, modal above map`);
    await context.close();
  }
} finally {await browser.close();if(output)fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));}
console.log(`PASS ${results.length} mobile/desktop map cases (mocked external services)`);
