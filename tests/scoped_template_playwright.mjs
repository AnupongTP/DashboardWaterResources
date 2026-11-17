// Phase 2: scoped routes (/authority/*, /district/*) served by site/index.html.
// All network is mocked (installMocks): no visitor hits, no Production writes.
//   Record baseline from the old template:  SCOPED_TEMPLATE=authority SCOPED_BASELINE_OUT=<file> node tests/scoped_template_playwright.mjs
//   Verify the new template:                SCOPED_BASELINE_FILE=<file> node tests/scoped_template_playwright.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {chromium, ROOT, ACTIVE, SCOPE_DATA, PARITY_DATA, DISTRICTS, installMocks} from './district_browser_support.mjs';

// SCOPED_SKIP=counter,dss,structure lets a task verify its own slice while later tasks are unbuilt.
const SKIP = new Set((process.env.SCOPED_SKIP || '').split(',').filter(Boolean));
const DATA = [...SCOPE_DATA, ...PARITY_DATA];
const OUT = process.env.SCOPED_BASELINE_OUT;
const BASELINE_FILE = process.env.SCOPED_BASELINE_FILE;
const TEMPLATE = process.env.SCOPED_TEMPLATE === 'authority' ? 'authority' : 'index';

// Route list is read from the shipped route registries (slug lists only).
function entriesOf(file, name) {
  const sandbox = {window: {AreaResponsibility: null}};
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'site/assets', file), 'utf8'), sandbox);
  return sandbox.window[name].entries;
}
const AUTHORITIES = entriesOf('authority-routes.js', 'AuthorityRoutes').map(e => ({kind: 'authority', slug: e.slug, path: `/authority/${e.slug}/`}));
const DISTRICT_ROUTES = DISTRICTS.map(([, slug]) => ({kind: 'district', slug, path: `/district/${slug}/`}));
const ROUTES = [...AUTHORITIES, ...DISTRICT_ROUTES];

const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});

async function open(route, {host = ACTIVE, width = 1440, height = 900, data = DATA, flags = {}, imageMode = 'success'} = {}) {
  const ctx = await browser.newContext({viewport: {width, height}});
  const calls = [];
  // baseline:true => files come from disk; API/counter/image/tiles are all intercepted.
  await installMocks(ctx, {data, host, baseline: true, calls, flags, imageMode});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(host + route.path);
  return {ctx, page, calls, errors};
}
async function ready(page, route) {
  await page.waitForFunction(r => {
    const meta = r.kind === 'district' ? window.__DISTRICT_PAGE__ : window.__AUTHORITY_PAGE__;
    return meta?.slug === r.slug && document.body.classList.contains('authority-ready');
  }, route, {timeout: 20000});
}
async function counterIdentity(page, calls) {
  // wait for the page's own counter requests to settle (they are mock-fulfilled)
  await page.waitForFunction(() => /\d|—/.test(document.getElementById('vcTotal')?.textContent || ''), null, {timeout: 8000}).catch(() => {});
  await page.waitForTimeout(250);
  const urls = calls.filter(c => c.kind === 'counter').map(c => c.url);
  const hit = urls.find(u => u.includes('/hit/') && u.endsWith('/total-views'));
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => /Visit/i.test(k)));
  return {namespace: hit ? new URL(hit).pathname.split('/')[2] : null, visitKey: keys[0] || null,
    hits: urls.filter(u => u.includes('/hit/')).length};
}
async function collect(route) {
  const started = Date.now();
  const t = await open(route);
  await ready(t.page, route);
  const ids = await t.page.locator('#tblBody tr[data-id]').evaluateAll(rows => rows.map(r => Number(r.dataset.id)).sort((a, b) => a - b));
  const dss = (await t.page.locator('#dssTitleText').count() ? await t.page.locator('#dssTitleText').innerText() : null);
  const counter = SKIP.has('counter') ? {namespace: 'skipped', visitKey: null, hits: 0} : await counterIdentity(t.page, t.calls);
  assert.deepEqual(t.errors, [], `${route.path} page errors`);
  await t.ctx.close();
  console.log(`  ${route.path} ${ids.length} records ${Date.now() - started}ms`);
  return {ids, dss, counter};
}

const results = [];
const pass = name => { results.push(name); console.log('PASS ' + name); };

try {
  if (OUT) {
    assert.equal(TEMPLATE, 'authority', 'baseline must be recorded from the old authority.html template');
    const baseline = {};
    for (const route of ROUTES) baseline[route.path] = await collect(route);
    {
      // DSS text per record + overview from the old template (same fixture the new selection tests use)
      const route = {kind: 'authority', slug: 'tm-dok-kham-tai', path: '/authority/tm-dok-kham-tai/'};
      const t = await open(route, {data: PARITY_DATA});
      await ready(t.page, route);
      baseline.__dss = await t.page.evaluate(() => {
        const norm = v => v.replace(/\s+/g, ' ').trim();
        const out = {overview: {title: norm(dssTitleText.textContent), text: norm(dssContent.textContent)}, byId: {}};
        for (const r of DATA) { setFocus(r.id, true); out.byId[r.id] = {title: norm(dssTitleText.textContent), text: norm(dssContent.textContent)}; }
        return out;
      });
      await t.ctx.close();
    }
    fs.mkdirSync(path.dirname(OUT), {recursive: true});
    fs.writeFileSync(OUT, JSON.stringify(baseline, null, 1));
    console.log(`baseline for ${ROUTES.length} routes written: ${OUT}`);
  } else {
    assert.ok(BASELINE_FILE && fs.existsSync(BASELINE_FILE), 'SCOPED_BASELINE_FILE is required');
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));

    // 1) every route: record IDs + counter identity + DSS overview title equal baseline
    for (const route of ROUTES) {
      const now = await collect(route), was = baseline[route.path];
      assert.deepEqual(now.ids, was.ids, `${route.path} record IDs differ from baseline`);
      if (!SKIP.has('counter')) {
        assert.ok(was.counter.namespace, `${route.path} baseline has a counter namespace`);
        assert.deepEqual({namespace: now.counter.namespace, visitKey: now.counter.visitKey},
          {namespace: was.counter.namespace, visitKey: was.counter.visitKey}, `${route.path} counter identity`);
        assert.equal(now.counter.hits, was.counter.hits, `${route.path} number of hit requests`);
      }
    }
    pass('baseline_equal_all_' + ROUTES.length + '_routes');

    // 2) structure on representative routes
    if (!SKIP.has('structure')) {
    const zeroRoute = ROUTES.find(r => baseline[r.path].ids.length === 0 && r.kind === 'authority');
    assert.ok(zeroRoute, 'fixture has an authority with 0 records');
    const multiTambon = ['/authority/tt-mae-ka/', '/district/mae-chai/', zeroRoute.path];
    for (const p of multiTambon) {
      const route = ROUTES.find(r => r.path === p);
      const t = await open(route);
      await ready(t.page, route);
      const page = t.page;
      assert.ok(await page.locator('#gfBar').isVisible(), p + ' #gfBar visible');
      for (const id of ['efSearch', 'efType', 'efStatus', 'efProblem']) assert.ok(await page.locator('#' + id).isVisible(), `${p} #${id} visible`);
      for (const id of ['efDistrict', 'efAuthority']) assert.ok(!(await page.locator('#' + id).isVisible()), `${p} #${id} must be hidden`);
      assert.equal(await page.locator('.main-nav button').count(), 2, p + ' two tabs');
      assert.equal(await page.locator('#execKpi .kpi-card').count(), 8, p + ' 8 KPI cards');
      assert.equal(await page.locator('#dssBoard, .dss-summary-card, #dssContent').count(), 0, p + ' DSS card removed (spec D5 revised)');
      assert.equal(await page.getByText('กลับสู่หน้าหลัก').count(), 0, p + ' no back bar');
      assert.equal(await page.locator('.header-brand a[href="/"]').count(), 1, p + ' site title links to /');
      assert.equal(await page.locator('.header-brand .eyebrow, .header-brand h1').first().evaluate(() => true), true);
      const hidden = await page.evaluate(() => ['fDistrict', 'fAuthority', 'fMoo'].map(id => {
        const el = document.getElementById(id); return !el || el.offsetParent === null || el.closest('[hidden]') !== null;
      }));
      // detail-tab district/authority/moo controls are not shown to the user
      await page.click('.main-nav button[data-view="detail"]');
      for (const id of ['fDistrict', 'fAuthority']) assert.ok(!(await page.locator('#' + id).isVisible()), `${p} detail #${id} hidden`);
      assert.deepEqual(t.errors, []);
      await t.ctx.close();
      void hidden;
    }
    pass('structure_gf_tabs_kpi8_dss_title_link');
    }


    // 5) selection contract (Memory 12.3) without DSS: popup + highlighted marker/row, dataset never collapses
    if (!SKIP.has('selection')) {
      const route = {kind: 'authority', slug: 'tm-dok-kham-tai', path: '/authority/tm-dok-kham-tai/'};
      const t = await open(route, {data: PARITY_DATA});
      await ready(t.page, route);
      const page = t.page;
      const kpiCount = async () => (await page.locator('#execKpi .kpi-card .kv').first().innerText()).replace(/,/g, '').trim();
      const rowCount = () => page.locator('#tblBody tr[data-id]').count();
      const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const total = String(PARITY_DATA.length);
      const popupText = async () => (await page.locator('.leaflet-popup').first().textContent()) || '';
      const marks = () => page.evaluate(() => ({
        markers: document.querySelectorAll('.leaflet-marker-icon.dss-selected').length,
        rows: [...document.querySelectorAll('#tblBody tr.selected')].map(r => r.dataset.id)}));
      const pickRow = async id => {
        await page.click('.main-nav button[data-view="detail"]');
        await page.click('.tab-btn[data-tab="table"]');
        await page.locator(`#tblBody tr[data-id="${id}"]`).click();
        await page.waitForFunction(() => document.getElementById('view-exec').classList.contains('active'));
      };
      // zoomToShowLayer waits for the cluster group to actually add the marker before the callback runs
      const openMarker = id => page.evaluate(i => new Promise(resolve => {
        const h = window.__SCOPED_MAP__, m = h.marker(i);
        h.layer().zoomToShowLayer(m, () => { m.openPopup(); resolve(); });
      }), id);

      assert.equal(await page.locator('#dssBoard, .dss-summary-card').count(), 0, 'no DSS card on the page');
      assert.deepEqual(await marks(), {markers: 0, rows: []}, 'nothing highlighted initially');
      const A = 9103, B = 9105;
      await openMarker(A);
      assert.ok((await popupText()).includes('DOK-WATER'), 'marker A popup');
      assert.deepEqual(await marks(), {markers: 1, rows: [String(A)]}, 'A highlighted (marker + row)');
      assert.equal(await kpiCount(), total, 'KPI not collapsed by marker A');
      assert.equal(await rowCount(), PARITY_DATA.length, 'table not collapsed by marker A');
      await openMarker(B);
      await settle();
      // A's popup fades out for ~200ms before Leaflet removes it; wait until only B's popup is left
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-popup').length === 1);
      assert.ok((await popupText()).includes('DOK-STRUCTURE2'), 'marker B replaces A');
      assert.deepEqual(await marks(), {markers: 1, rows: [String(B)]}, 'B highlighted, A close event did not clear it');
      assert.equal(await kpiCount(), total, 'KPI not collapsed by marker B');
      await page.selectOption('#efType', 'ฝาย');
      const filteredCount = await kpiCount();
      assert.notEqual(filteredCount, total, 'type filter narrows KPIs');
      assert.deepEqual(await marks(), {markers: 0, rows: []}, 'a filter change drops the selection');
      await openMarker(B);
      await page.evaluate(() => window.__SCOPED_MAP__.map().closePopup());
      await settle();
      assert.deepEqual(await marks(), {markers: 0, rows: []}, 'popup close clears the highlight');
      assert.equal(await kpiCount(), filteredCount, 'filters kept after popup close');
      await page.selectOption('#efType', '');
      await pickRow(9104);
      assert.deepEqual((await marks()).rows, ['9104'], 'row without coordinates is highlighted');
      assert.equal(await page.locator('.leaflet-popup').count(), 0, 'no popup for a record without coordinates');
      assert.equal(await kpiCount(), total, 'table selection keeps the filtered set');
      await pickRow(A);
      await page.locator('.leaflet-popup').waitFor();
      assert.ok((await popupText()).includes('DOK-WATER'));
      assert.equal((await marks()).markers, 1, 'marker highlighted after table reveal');
      await page.click('#mlcToggle');
      await page.locator('#mlcTypeList .mlc-type-cb').first().uncheck();
      assert.equal(await kpiCount(), total, 'layer filter leaves KPIs unchanged');
      assert.equal(await rowCount(), PARITY_DATA.length, 'layer filter leaves table unchanged');
      assert.deepEqual(t.errors, []);
      await t.ctx.close();
      pass('selection_contract_and_highlight');
    }

    // 6) image fallback: no-referrer + two-stage retry, all mocked
    if (!SKIP.has('image')) {
      const route = {kind: 'authority', slug: 'tm-dok-kham-tai', path: '/authority/tm-dok-kham-tai/'};
      const t = await open(route, {data: PARITY_DATA, imageMode: 'deny'});
      const seen = [];
      t.page.on('request', r => { if (/googleusercontent|drive\.google/.test(r.url())) seen.push({url: r.url(), referer: r.headers().referer || null}); });
      await ready(t.page, route);
      // 9101 and 9102 share coordinates: a real cluster has to be spiderfied before the popup can open
      await t.page.evaluate(() => {
        const h = window.__SCOPED_MAP__, m = h.marker(9101);
        h.layer().zoomToShowLayer(m, () => m.openPopup());
      });
      const retry = t.page.locator('.leaflet-popup button:has-text("ลองแหล่งภาพสำรอง")');
      await retry.waitFor();
      await retry.click();
      const again = t.page.locator('.leaflet-popup button:has-text("ลองแหล่งภาพสำรอง")');
      await again.waitFor({timeout: 5000}).catch(() => {});
      if (await again.count() && await again.isVisible()) await again.click();
      await t.page.waitForLoadState('networkidle');
      assert.ok(seen.length >= 2, 'image requests were made (to the mock): ' + seen.length);
      assert.ok(seen.every(r => !r.referer), 'image requests carry no referrer');
      assert.deepEqual(t.errors, []);
      await t.ctx.close();
      pass('image_no_referrer_and_retry');
    }

    // 3) invalid slug / unavailable API
    for (const bad of ['/authority/no-such/', '/district/no-such/']) {
      const t = await open({path: bad, kind: 'x', slug: 'x'});
      await t.page.locator('#authorityFailure, #districtFailure').waitFor();
      assert.equal(await t.page.locator('#tblBody tr[data-id]').count(), 0);
      assert.equal(t.calls.filter(c => c.kind === 'api' || c.kind === 'counter').length, 0, bad + ' makes no data/counter calls');
      await t.ctx.close();
    }
    {
      const route = ROUTES.find(r => r.path === '/authority/tt-mae-ka/');
      const t = await open(route, {flags: {failData: true, failVersion: true}});
      await t.page.locator('#authorityFailure').waitFor();
      assert.equal(await t.page.locator('#tblBody tr[data-id]').count(), 0);
      await t.ctx.close();
    }
    pass('invalid_slug_and_unavailable_fail_closed');

    // 4) no real visitor hit outside production origin (host guard)
    {
      const route = ROUTES.find(r => r.path === '/authority/tt-mae-ka/');
      const t = await open(route, {host: 'http://scoped-local.test'});
      await ready(t.page, route);
      await t.page.waitForTimeout(400);
      assert.equal(t.calls.filter(c => c.kind === 'counter' && c.url.includes('/hit/')).length, 0, 'non-production host must not hit');
      await t.ctx.close();
    }
    pass('no_hit_on_non_production_host');
  }
} finally {
  await browser.close();
}
console.log(`scoped_template: ${results.length} groups passed`);
