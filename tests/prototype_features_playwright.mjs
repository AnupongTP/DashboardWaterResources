// Phase 3: prototype features on the shared template. Every network call is mocked (installMocks):
// no visitor hits, no Production writes, no real Google image requests.
import assert from 'node:assert/strict';
import {chromium, record, installMocks, SCOPE_DATA, PARITY_DATA} from './district_browser_support.mjs';

const DATA = [...SCOPE_DATA, ...PARITY_DATA];

const HOST = 'http://phase3.test';
const only = new Set((process.env.P3_ONLY || '').split(',').filter(Boolean));
const want = name => only.size === 0 || only.has(name);
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
const results = [];
const pass = n => { results.push(n); console.log('PASS ' + n); };

async function open(data, {width = 1440, height = 900, path = '/index.html', imageMode = 'success'} = {}) {
  const ctx = await browser.newContext({viewport: {width, height}});
  const calls = [];
  await installMocks(ctx, {data, host: HOST, baseline: true, calls, imageMode});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(HOST + path);
  await page.waitForFunction(() => document.querySelectorAll('#execKpi .kpi-card').length > 0, null, {timeout: 20000});
  return {ctx, page, calls, errors};
}
const kpi = (page, label) => page.locator('#execKpi .kpi-card', {hasText: label}).first().locator('.kv').innerText();

try {
  if (want('dup')) {
    // D14: same name + tambon + coordinates => volume counted once (the larger); site count unchanged.
    const data = [
      record(5001, 'ดอกคำใต้', {name: 'DUP-POND', lat: 19.2, lng: 99.8, volume: 2000000}),
      record(5002, 'ดอกคำใต้', {name: 'DUP-POND', lat: 19.2, lng: 99.8, volume: 6000000}),
      record(5003, 'ดอกคำใต้', {name: 'NOCOORD', lat: null, lng: null, volume: 1000000}),
      record(5004, 'ดอกคำใต้', {name: 'NOCOORD', lat: null, lng: null, volume: 1000000}),
      record(5005, 'ดอกคำใต้', {name: '', lat: 19.3, lng: 99.8, volume: 0}),
    ];
    const t = await open(data);
    assert.equal((await kpi(t.page, 'ปริมาตรรวม')).trim(), '8.0M', 'dup pair counts once (6M) + 2 unkeyed rows (2M)');
    assert.equal((await t.page.locator('#execKpi .kpi-card .kv').first().innerText()).replace(/,/g, '').trim(), '5', 'site count unchanged');
    assert.deepEqual(t.errors, []);
    await t.ctx.close();
    pass('dup_volume_counted_once_sites_unchanged');
  }

  if (want('insight')) {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const t = await open(DATA, {width, height});
      const page = t.page;
      const gfBefore = await page.locator('#gfBar').evaluate(e => e.outerHTML);
      const kpiBefore = await page.locator('#execKpi').innerText();
      await page.click('.main-nav button[data-view="detail"]');
      assert.equal(await page.locator('.tab-btn[data-tab="insight"]').count(), 1, 'insight tab button');
      await page.click('.tab-btn[data-tab="insight"]');
      await page.waitForFunction(() => document.querySelectorAll('#ixBody .ix-p').length >= 10, null, {timeout: 10000});
      assert.ok(await page.locator('#ixSection').isVisible(), `#ixSection visible @${width}`);
      assert.ok((await page.locator('#ixUpdated').innerText()).includes('ข้อมูลล่าสุด') || (await page.locator('#ixUpdated').innerText()).includes('ไม่พบวันที่'), 'ixUpdated shown');
      assert.ok((await page.locator('#ixSubNote').innerText()).includes(String(DATA.length)), 'sub note shows record count');
      if (width === 1440) {
        const rows = () => page.locator('#tblBody tr').count();
        await page.click('.tab-btn[data-tab="table"]');
        const before = await rows();
        await page.click('.tab-btn[data-tab="insight"]');
        await page.locator('#ixBody [data-f*=\'"type"\']').first().click();
        await page.click('.tab-btn[data-tab="table"]');
        const after = await rows();
        assert.ok(after > 0 && after < before, `detail table narrowed ${before} -> ${after}`);
        // D15: summary tab filters/KPIs and the province filter bar are untouched
        await page.click('.main-nav button[data-view="exec"]');
        assert.equal(await page.locator('#gfBar').evaluate(e => e.outerHTML), gfBefore, '#gfBar unchanged');
        assert.equal(await page.locator('#execKpi').innerText(), kpiBefore, 'summary KPIs unchanged');
      }
      assert.deepEqual(t.errors, [], 'no page errors');
      await t.ctx.close();
    }
    pass('insight_tab_renders_and_filters_detail_only');
  }

  if (want('insight')) {
    // scoped page: insight uses only in-scope rows; clicking filters detail only; reset button clears it
    const t = await open(DATA, {path: '/authority/tm-dok-kham-tai/'});
    const page = t.page;
    await page.waitForFunction(() => document.body.classList.contains('authority-ready'), null, {timeout: 20000});
    await page.click('.main-nav button[data-view="detail"]');
    await page.click('.tab-btn[data-tab="table"]');
    const scoped = await page.locator('#tblBody tr').count();
    assert.ok(scoped > 0 && scoped < DATA.length, `scoped rows ${scoped}`);
    await page.click('.tab-btn[data-tab="insight"]');
    await page.waitForFunction(() => document.querySelectorAll('#ixBody .ix-p').length >= 10);
    assert.ok((await page.locator('#ixSubNote').innerText()).includes(String(scoped)), 'insight counts only in-scope rows');
    await page.locator('#ixBody [data-f*=\'"type"\']').first().click();
    await page.waitForFunction(n => !document.getElementById('ixSubNote').textContent.includes(String(n) + ' รายการ'), scoped);
    await page.click('#resetBtn');
    await page.waitForFunction(n => document.getElementById('ixSubNote').textContent.includes(String(n) + ' รายการ'), scoped);
    assert.deepEqual(t.errors, [], 'no page errors (scoped)');
    await t.ctx.close();
    pass('insight_scoped_in_scope_only_and_reset');
  }

  if (want('quality')) {
    const WQ = ['น้ำมีสี', 'น้ำเน่าเสีย', 'น้ำมีกลิ่น', 'น้ำเค็ม', 'น้ำขาดแคลน'];
    const count = (rows, tag) => rows.filter(r => r.problem && r.problem.includes(tag)).length;
    for (const [pth, rows] of [['/index.html', DATA], ['/authority/tm-dok-kham-tai/', null]]) {
      const t = await open(DATA, {path: pth});
      const page = t.page;
      if (rows === null) await page.waitForFunction(() => document.body.classList.contains('authority-ready'), null, {timeout: 20000});
      const kpiBefore = await page.locator('#execKpi').innerText();
      assert.equal(await page.locator('#view-exec #waterQuality, #view-exec #wqSiteDetail').count(), 0, 'water quality moved out of the summary tab');
      await page.click('.main-nav button[data-view="detail"]');
      assert.equal(await page.locator('.tab-btn[data-tab="quality"]').count(), 1, 'quality tab button');
      await page.click('.tab-btn[data-tab="quality"]');
      assert.ok(await page.locator('#panel-quality').isVisible());
      // expected set = what the detail tab shows (province: all rows; scoped: the rows of its table)
      await page.click('.tab-btn[data-tab="table"]');
      const ids = await page.evaluate(() => window.__ixData().map(r => r.id));
      const shown = DATA.filter(r => ids.includes(r.id));
      if (rows === null) assert.ok(shown.length > 0 && shown.length < DATA.length, 'scoped subset');
      await page.click('.tab-btn[data-tab="quality"]');
      const barText = await page.locator('#waterQuality').innerText();
      for (const tag of WQ) {
        assert.ok(barText.includes(tag), tag + ' bar');
        const line = (await page.locator('#waterQuality > div', {hasText: tag}).first().innerText()).replace(/\s+/g, ' ');
        assert.ok(line.includes(`${count(shown, tag)} แห่ง`), `${tag}: ${line} expects ${count(shown, tag)}`);
      }
      const tag = WQ.find(w => count(shown, w) > 0);
      assert.ok(tag, 'fixture has a water-quality row in scope');
      await page.locator('#waterQuality > div', {hasText: tag}).first().click();
      const head = await page.locator('#wqSiteDetail').innerText();
      assert.ok(head.includes(`${tag} (${count(shown, tag)} แห่ง)`), 'site list header: ' + head.slice(0, 60));
      const names = shown.filter(r => r.problem && r.problem.includes(tag)).map(r => r.name);
      for (const n of names.slice(0, 10)) assert.ok(head.includes(n), 'lists ' + n);
      for (const r of DATA.filter(r => !shown.includes(r) && r.problem && r.problem.includes(tag))) assert.ok(!head.includes(r.name), 'out-of-scope row hidden: ' + r.name);
      await page.click('.main-nav button[data-view="exec"]');
      assert.equal(await page.locator('#execKpi').innerText(), kpiBefore, 'summary KPIs unchanged by quality tab click');
      assert.deepEqual(t.errors, [], 'no page errors');
      await t.ctx.close();
    }
    pass('quality_tab_detail_data_only');
  }

  if (want('gallery')) {
    const drive = id => `https://drive.google.com/open?id=${id}`;
    const G = [
      record(6001, 'ดอกคำใต้', {name: 'GAL-ONE', type: 'ฝาย', problem: 'ใช้งานได้', imglink: `${drive('AAA111')} ${drive('BBB222')}`}),
      record(6002, 'ดอกคำใต้', {name: 'GAL-TWO', type: 'บ่อบาดาล', problem: 'ชำรุด', imglink: drive('CCC333')}),
      record(6003, 'แม่ใจ', {name: 'GAL-THREE', type: 'ฝาย', problem: 'วัชพืชปกคลุม', imglink: drive('DDD444')}),
      record(6004, 'แม่ใจ', {name: 'GAL-NOPHOTO', type: 'ฝาย', problem: 'ใช้งานได้', imglink: ''}),
    ];
    const t = await open(G);
    const page = t.page;
    await page.click('.main-nav button[data-view="detail"]');
    await page.click('.tab-btn[data-tab="gallery"]');
    await page.waitForSelector('#galTypeTabs .gtab');
    const flat = () => page.click('#galView [data-g="0"]');
    const cards = () => page.locator('#galleryGrid .gcard').count();
    await flat();
    assert.equal(await cards(), 3, 'only records with photos (3 of 4)');
    assert.ok((await page.locator('#n-gallery').innerText()).includes('4 ภาพ'), 'counts photos: ' + await page.locator('#n-gallery').innerText());
    // type tab
    await page.click('#galTypeTabs [data-type="ฝาย"]');
    assert.equal(await cards(), 2, 'type tab ฝาย');
    // tambon select
    await page.selectOption('#galTambon', 'ดอกคำใต้');
    assert.equal(await cards(), 1, 'type ฝาย + tambon ดอกคำใต้');
    await page.click('#galTypeTabs [data-type=""]');
    assert.equal(await cards(), 2, 'tambon only');
    await page.click('#galProbTabs [data-prob="ชำรุด"]');
    assert.equal(await cards(), 1, 'problem tab ชำรุด');
    await page.click('#galProbTabs [data-prob=""]');
    await page.selectOption('#galTambon', '');
    assert.equal(await cards(), 3);
    // lightbox: multi-photo, prev/next, Esc
    await page.locator('#galleryGrid .gcard', {hasText: 'GAL-ONE'}).click();
    assert.ok(await page.locator('#lb.open').count() === 1, 'lightbox opens');
    const pos = () => page.locator('#lb .lb-pos').innerText();
    assert.ok((await pos()).includes('รูป 1/2'), await pos());
    await page.click('#lbNext');
    assert.ok((await pos()).includes('รูป 2/2'), await pos());
    await page.click('#lbNext');
    assert.ok((await page.locator('#lb h3').innerText()).length > 0 && !(await pos()).includes('รูป'), 'moved to next site: ' + await pos());
    await page.click('#lbPrev');
    assert.ok((await pos()).includes('รูป 2/2'), 'prev returns to last photo of previous site');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lb.open').count(), 0, 'Esc closes');
    assert.equal(await page.locator('#lb').getAttribute('aria-hidden'), 'true');
    assert.deepEqual(t.errors, [], 'no page errors');
    await t.ctx.close();

    // failed images: one request per image, no automatic retry; user retry adds exactly one
    const f = await open(G, {imageMode: 'deny'});
    const fp = f.page;
    await fp.click('.main-nav button[data-view="detail"]');
    await fp.click('.tab-btn[data-tab="gallery"]');
    await fp.click('#galView [data-g="0"]');
    await fp.waitForSelector('#galleryGrid .gcard');
    await fp.waitForTimeout(1200);
    const reqs = () => f.calls.filter(c => c.kind === 'image').map(c => c.url);
    const perId = () => { const m = {}; reqs().forEach(u => { const id = /id=([\w-]+)|\/d\/([\w-]+)/.exec(u); const k = id && (id[1] || id[2]); m[k] = (m[k] || 0) + 1; }); return m; };
    assert.ok(Object.keys(perId()).length > 0, 'image requests are recorded (mocked)');
    for (const [k, n] of Object.entries(perId())) assert.ok(n <= 1, `no automatic retry for ${k}: ${n}`);
    const before = reqs().length;
    await fp.locator('#galleryGrid .gcard', {hasText: 'GAL-TWO'}).click();
    await fp.waitForSelector('#lb.open');
    await fp.waitForTimeout(600);
    const afterOpen = reqs().length;
    const retry = fp.locator('#lb .water-image-fallback button');
    assert.ok(await retry.count() > 0, 'lightbox shows a user retry button for the failed image');
    await retry.first().click(); await fp.waitForTimeout(500); assert.equal(reqs().length, afterOpen + 1, 'user retry = exactly one more request');
    assert.ok(afterOpen - before <= 1, 'lightbox open adds at most the large image request: ' + (afterOpen - before));
    assert.deepEqual(f.errors, [], 'no page errors (denied images)');
    await f.ctx.close();
    pass('gallery_filters_lightbox_and_image_fallback');
  }

  if (want('damaged')) {
    const KW = ['ชำรุด', 'ไม่มีน้ำ/แห้งแล้ง', 'น้ำเน่าเสีย', 'น้ำมีสี', 'น้ำมีกลิ่น', 'น้ำเค็ม'];
    const damaged = DATA.filter(r => r.problem && KW.some(k => r.problem.includes(k)));
    const withXY = damaged.filter(r => r.lat != null && r.lng != null);
    assert.ok(damaged.length >= 3 && withXY.length >= 3, 'fixture has damaged rows');
    const t = await open(DATA);
    const page = t.page;
    await page.click('.main-nav button[data-view="detail"]');
    await page.click('.tab-btn[data-tab="damaged"]');
    await page.waitForFunction(() => window.__DAMAGED_MAP__ && window.__DAMAGED_MAP__.markerIds().length > 0, null, {timeout: 15000});
    const ids = () => page.evaluate(() => window.__DAMAGED_MAP__.markerIds().sort((a, b) => a - b));
    assert.deepEqual(await ids(), withXY.map(r => r.id).sort((a, b) => a - b), 'one pin per damaged record with coordinates');
    // legend + hint
    const legend = await page.locator('#dmgLegend').innerText();
    assert.ok(legend.includes('ประเภท') && legend.includes('สถานะ'), 'legend: ' + legend.slice(0, 60));
    assert.ok(await page.locator('#panel-damaged .dmg-hint').count() === 1, 'hint line');
    // base map switch (satellite default, street on demand)
    assert.ok(await page.locator('#damaged-map .leaflet-control-layers').count() === 1, 'base map control');
    await page.locator('#damaged-map .leaflet-control-layers-base label', {hasText: 'ถนน'}).locator('input').check();
    await page.waitForFunction(() => document.querySelector('#damaged-map .leaflet-tile-pane img[src*="World_Street_Map"]'), null, {timeout: 8000});
    // marker click = pick: list narrows to that site, popup opens, chip clears it
    const rowsAll = await page.locator('#damagedBody tr.dmg-row').count();
    assert.equal(rowsAll, damaged.length, 'list shows every damaged record');
    const pick = withXY[0].id;
    await page.evaluate(id => { const h = window.__DAMAGED_MAP__, m = h.marker(id); h.layer().zoomToShowLayer(m, () => m.fire('click')); }, pick);
    await page.waitForSelector('#dmgPickClr', {timeout: 8000});
    assert.equal(await page.locator('#damagedBody tr.dmg-row').count(), 1, 'list narrowed to the picked site');
    assert.ok(await page.locator('#damagedBody tr.dmg-row.picked').count() === 1);
    await page.waitForSelector('#damaged-map .leaflet-popup', {timeout: 8000});
    assert.ok((await page.locator('#damaged-map .leaflet-popup').first().innerText()).includes(withXY[0].name), 'popup of the picked record');
    await page.click('#dmgPickClr');
    await page.waitForFunction(n => document.querySelectorAll('#damagedBody tr.dmg-row').length === n, rowsAll);
    assert.equal(await page.locator('#dmgPickClr').count(), 0, 'pick chip removed');
    // problem chip changes the pins
    await page.locator('#dfProblemChips .df-chip', {hasText: 'ชำรุด'}).click();
    const broken = withXY.filter(r => r.problem.includes('ชำรุด')).map(r => r.id).sort((a, b) => a - b);
    await page.waitForFunction(n => window.__DAMAGED_MAP__.markerIds().length === n, broken.length);
    assert.deepEqual(await ids(), broken, 'pins follow the problem filter');
    assert.deepEqual(t.errors, [], 'no page errors');
    await t.ctx.close();
    pass('damaged_map_pick_legend_basemap');
  }

  if (want('review')) {
    const drive = id => `https://drive.google.com/open?id=${id}`;
    const R = [
      record(8001, 'ดอกคำใต้', {name: 'NOTE-ONE', note: 'ขุดลอกฝายเดิม', problem: 'ใช้งานได้', type: 'ฝาย'}),
      record(8002, 'ดอกคำใต้', {name: 'NOTE-TWO', note: 'ซ่อมประตูน้ำ', problem: 'ใช้งานได้', type: 'ฝาย'}),
      record(8003, 'ดอกคำใต้', {name: 'WQ-PHOTO', problem: 'น้ำมีสี', type: 'ฝาย', imglink: drive('WQP111')}),
    ];
    const t = await open(R);
    const page = t.page;
    await page.click('.main-nav button[data-view="detail"]');
    // (1) insight note rows filter by the note text (the detail search box does not read notes) and the filter is visible/clearable
    await page.click('.tab-btn[data-tab="insight"]');
    await page.waitForFunction(() => document.querySelectorAll('#ixBody .ix-p').length >= 10);
    await page.evaluate(() => window.ixSetFilter({rule: 'note:ขุดลอก'}));
    assert.equal(await page.evaluate(() => window.__ixData().length), 1, 'note rule keeps only the matching record');
    await page.waitForSelector('#ixActive:not([hidden])');
    assert.ok((await page.locator('#ixActive').innerText()).includes('ขุดลอก'), 'indicator names the filter');
    await page.click('#ixActiveClear');
    assert.equal(await page.evaluate(() => window.__ixData().length), R.length, 'clear restores every row');
    assert.equal(await page.locator('#ixActive').isHidden(), true, 'indicator hidden again');
    // (2) water-quality thumbnails use the shared image component
    await page.click('.tab-btn[data-tab="quality"]');
    await page.evaluate(() => window.wqPick('น้ำมีสี'));
    assert.equal(await page.locator('#wqSiteDetail img[data-drive-id="WQP111"]').count(), 1, 'quality thumbnail uses imgTag');
    // (3) opening the lightbox must not make later renders re-request the large (w1600) copy for the cards
    await page.click('.tab-btn[data-tab="gallery"]');
    await page.click('#galView [data-g="0"]');
    await page.locator('#galleryGrid .gcard', {hasText: 'WQ-PHOTO'}).click();
    await page.waitForSelector('#lb.open');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.fill('#searchBox', 'WQ');
    await page.fill('#searchBox', '');
    await page.waitForTimeout(400);
    const src = await page.locator('#galleryGrid img[data-drive-id="WQP111"]').getAttribute('src');
    assert.ok(src && src.includes('=w500') && !src.includes('=w1600'), 'card image keeps its own size after lightbox: ' + src);
    const big = t.calls.filter(c => c.kind === 'image' && c.url.includes('=w1600')).length;
    assert.ok(big <= 1, 'large copy requested at most once: ' + big);
    assert.deepEqual(t.errors, [], 'no page errors');
    await t.ctx.close();
    pass('review_fixes_note_rule_indicator_thumb_lightbox_cache');
  }
} finally {
  await browser.close();
}
console.log(`prototype_features: ${results.length} groups passed`);
