// Phase 1: province executive filter bar — structure, field order, geometry, behaviour. All services mocked.
import assert from 'node:assert/strict';
import {chromium, VIEWPORTS, SCOPE_DATA, PARITY_DATA, installMocks} from './district_browser_support.mjs';

const HOST = 'http://province-filter.test';
const DATA = [...SCOPE_DATA, ...PARITY_DATA];
const FIELD_IDS = ['efSearch', 'efDistrict', 'efAuthority', 'efTambon', 'efType', 'efStatus', 'efProblem'];

// ---- expected values computed from the fixture, independent of page code ----
const DAMAGE_KEYWORDS = ['ชำรุด', 'ไม่มีน้ำ/แห้งแล้ง', 'น้ำเน่าเสีย', 'น้ำมีสี', 'น้ำมีกลิ่น', 'น้ำเค็ม'];
const has = (r, t) => !!r.problem && r.problem.includes(t);
const searchHit = (r, q) => {
  const hay = [r.name, r.owner, r.village, r.moo, r.tambon, r.note].map(v => String(v ?? '')).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t));
};
const EXPECT = {
  total: DATA.length,
  q: DATA.filter(r => searchHit(r, 'dok structure')).length,
  ok: DATA.filter(r => has(r, 'ใช้งานได้')).length,
  bad: DATA.filter(r => DAMAGE_KEYWORDS.some(k => has(r, k))).length,
  broken: DATA.filter(r => has(r, 'ชำรุด')).length,
  weed: DATA.filter(r => has(r, 'วัชพืชปกคลุม')).length,
  badAndType: DATA.filter(r => DAMAGE_KEYWORDS.some(k => has(r, k)) && r.type === 'ฝาย').length,
};
const shown = async page => {
  const t = await page.locator('#efCount').textContent();
  const m = t.replace(/,/g, '').match(/(\d+)\s*รายการ/);
  return m ? Number(m[1]) : NaN;
};
async function behaviour(page, tag, check) {
  const settle = () => page.waitForTimeout(450);
  const chipKeys = () => page.locator('#gfChips .gf-chip').evaluateAll(els => els.map(e => e.dataset.k));
  check(await shown(page) === EXPECT.total, `${tag}: initial count ${await shown(page)} == ${EXPECT.total}`);

  // (a) search: every word must match
  await page.fill('#efSearch', 'dok structure'); await settle();
  check(await shown(page) === EXPECT.q && EXPECT.q > 0, `${tag}: search count ${await shown(page)} == ${EXPECT.q}`);
  check(await page.locator('#efSearchClear').isVisible(), `${tag}: search clear button visible`);
  check((await page.locator('#execKpi .kpi-card .kv').first().textContent()).replace(/,/g, '').trim() === String(EXPECT.q), `${tag}: KPI sites == search count`);
  await page.click('#efSearchClear'); await settle();
  check(await page.inputValue('#efSearch') === '' && await shown(page) === EXPECT.total, `${tag}: search clear restores`);

  // (b) status
  for (const [v, n] of [['ok', EXPECT.ok], ['bad', EXPECT.bad], ['broken', EXPECT.broken]]) {
    await page.selectOption('#efStatus', v); await settle();
    check(await shown(page) === n && n > 0, `${tag}: status=${v} count ${await shown(page)} == ${n}`);
  }
  await page.selectOption('#efStatus', ''); await settle();

  // (c) problem options + filter
  const opts = await page.locator('#efProblem option').evaluateAll(o => o.map(x => ({v: x.value, t: x.textContent})));
  check(opts.length > 1 && !opts.some(o => o.v === 'ใช้งานได้'), `${tag}: problem options exclude ใช้งานได้ (${opts.length})`);
  const weedOpt = opts.find(o => o.v === 'วัชพืชปกคลุม');
  check(weedOpt && weedOpt.t.includes(String(EXPECT.weed)), `${tag}: problem option shows count (${weedOpt?.t})`);
  await page.selectOption('#efProblem', 'วัชพืชปกคลุม'); await settle();
  check(await shown(page) === EXPECT.weed && EXPECT.weed > 0, `${tag}: problem count ${await shown(page)} == ${EXPECT.weed}`);

  // (d) chips
  await page.fill('#efSearch', 'dok'); await settle();
  await page.selectOption('#efStatus', 'bad'); await settle();
  let keys = await chipKeys();
  check(['q', 'status', 'problem'].every(k => keys.includes(k)), `${tag}: chips ${keys}`);
  await page.locator('#gfChips .gf-chip[data-k="status"]').click(); await settle();
  check(await page.inputValue('#efStatus') === '' && !(await chipKeys()).includes('status'), `${tag}: status chip clears only status`);
  check(await page.inputValue('#efSearch') === 'dok', `${tag}: other values kept`);
  await page.locator('#gfChips .gf-chip[data-k="q"]').click(); await settle();
  check(await page.inputValue('#efSearch') === '', `${tag}: q chip clears search`);

  // (f) cross-filter stacks with new filters, and a bar change clears it
  await page.selectOption('#efProblem', ''); await page.selectOption('#efStatus', 'bad'); await settle();
  await page.evaluate(() => window.setCrossFilter('type', 'ฝาย')); await settle();
  check(await shown(page) === EXPECT.badAndType, `${tag}: cross-filter ∩ status ${await shown(page)} == ${EXPECT.badAndType}`);
  await page.selectOption('#efStatus', 'ok'); await settle();
  check(await page.locator('#crossFilterBar').isHidden(), `${tag}: changing bar filter clears cross-filter`);

  // (g) detail tab is independent (D2)
  await page.locator('[data-view="detail"]').click();
  const note = await page.locator('#countNote').textContent();
  check(/กำลังแสดง\s*[\d,]+\s*จาก\s*[\d,]+/.test(note) && note.replace(/,/g, '').includes(`${EXPECT.total} รายการ`) && note.replace(/,/g, '').match(/แสดง\s*(\d+)/)[1] === String(EXPECT.total), `${tag}: detail tab unaffected (${note})`);
  await page.locator('[data-view="exec"]').click();

  // combobox ตำบล after DOM move: list opens, not clipped by .gf-inner, option selectable
  await page.click('#efTambon'); await page.waitForTimeout(150);
  const cb = await page.evaluate(() => {
    const list = document.getElementById('efTambonListbox'), opt = list.querySelector('.tambon-combobox-option');
    if (list.hidden || !opt) return {open: false};
    const r = opt.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {open: true, hit: !!hit && (hit === opt || opt.contains(hit)), n: list.querySelectorAll('.tambon-combobox-option').length, name: opt.textContent.trim().slice(0, 40)};
  });
  check(cb.open && cb.hit && cb.n > 1, `${tag}: tambon list opens and is not clipped (${JSON.stringify(cb)})`);
  await page.locator('#efTambonListbox .tambon-combobox-option').first().click(); await settle();
  check((await chipKeys()).includes('tambon') && await page.inputValue('#efTambon') !== '', `${tag}: tambon option selected -> chip`);
  await page.locator('#gfChips .gf-chip[data-k="tambon"]').click(); await settle();
  check(await page.inputValue('#efTambon') === '' && !(await chipKeys()).includes('tambon'), `${tag}: tambon chip clears input and chip`);

  // (e) reset clears everything incl. search
  await page.fill('#efSearch', 'dok'); await page.selectOption('#efProblem', 'วัชพืชปกคลุม'); await settle();
  await page.click('#efReset'); await settle();
  const vals = await page.evaluate(() => ['efSearch', 'efDistrict', 'efAuthority', 'efTambon', 'efType', 'efStatus', 'efProblem'].map(id => document.getElementById(id).value));
  check(vals.every(v => v === ''), `${tag}: reset clears all (${vals})`);
  check(await shown(page) === EXPECT.total && (await chipKeys()).length === 0, `${tag}: reset restores count + no chips`);

  // district chip clears the select and rebuilds
  await page.selectOption('#efDistrict', 'ดอกคำใต้'); await settle();
  check((await chipKeys()).includes('district'), `${tag}: district chip shown`);
  await page.locator('#gfChips .gf-chip[data-k="district"]').click(); await settle();
  check(await page.inputValue('#efDistrict') === '' && await shown(page) === EXPECT.total, `${tag}: district chip clears`);
}
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

async function geometry(page) {
  return page.evaluate(ids => {
    const q = id => document.getElementById(id);
    const rect = id => q(id)?.closest('.gf-field')?.getBoundingClientRect().toJSON();
    const bar = q('gfBar');
    const out = {hasBar: !!bar, present: {}, labels: {}, rects: {}, order: [], overflow: document.documentElement.scrollWidth - innerWidth};
    for (const id of ids) {
      const el = bar ? bar.querySelector('#' + id) : null;
      out.present[id] = !!el;
      const field = el?.closest('.gf-field');
      const lab = field?.querySelector('label, :scope > span');
      const st = lab && getComputedStyle(lab);
      out.labels[id] = !!lab && lab.textContent.trim().length > 0 && st.display !== 'none' && st.visibility !== 'hidden' && lab.getBoundingClientRect().height > 0;
      out.rects[id] = rect(id);
    }
    const els = ids.map(id => bar?.querySelector('#' + id)).filter(Boolean);
    out.order = els.every((el, i) => i === 0 || (els[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) > 0);
    const reset = q('efReset'), count = q('efCount');
    out.reset = reset ? {text: reset.textContent.trim(), head: reset.parentElement === count?.closest('.gf-head') || !!reset.closest('.gf-head')?.contains(count)} : null;
    return out;
  }, FIELD_IDS);
}

const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({viewport: {width, height}, isMobile: width < 500, hasTouch: width < 500});
    const calls = [];
    await context.addInitScript(() => localStorage.setItem('pyoVisitDate', new Date().toISOString().slice(0, 10)));
    await installMocks(context, {host: HOST, data: DATA, calls});
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(HOST + '/index.html');
    await page.waitForSelector('#execKpi .kpi-card');
    await page.waitForTimeout(400);
    const g = await geometry(page);
    const tag = `${width}`;

    check(g.hasBar, `${tag}: #gfBar exists`);
    for (const id of FIELD_IDS) {
      check(g.present[id], `${tag}: #gfBar contains #${id}`);
      check(g.labels[id], `${tag}: #${id} has visible label`);
    }
    check(g.order, `${tag}: DOM order = ${FIELD_IDS.join(', ')}`);
    check(g.reset && g.reset.text === '↺ ล้างตัวกรอง', `${tag}: #efReset text (${g.reset?.text})`);
    check(g.reset && g.reset.head, `${tag}: #efReset and #efCount share .gf-head`);
    check(g.overflow <= 1, `${tag}: no horizontal overflow (${g.overflow})`);

    const r = g.rects;
    if (FIELD_IDS.every(id => r[id])) {
      const sameY = (a, b) => Math.abs(r[a].y - r[b].y) < 2;
      if (width >= 1100) {
        check(sameY('efSearch', 'efDistrict') && sameY('efDistrict', 'efAuthority') && sameY('efAuthority', 'efTambon'), `${tag}: row1 search/district/authority/tambon same y`);
        check(r.efSearch.width >= 1.8 * r.efDistrict.width, `${tag}: search >= 1.8x district (${r.efSearch.width} vs ${r.efDistrict.width})`);
        check(sameY('efType', 'efStatus') && sameY('efStatus', 'efProblem'), `${tag}: row2 type/status/problem same y`);
        check(r.efType.y > r.efSearch.y + 10, `${tag}: row2 below row1`);
        check(Math.abs(r.efType.width - r.efStatus.width) < 2 && Math.abs(r.efStatus.width - r.efProblem.width) < 2, `${tag}: row2 equal widths`);
      } else if (width >= 700) {
        check(r.efSearch.width > 1.8 * r.efDistrict.width, `${tag}: search full row (${r.efSearch.width} vs ${r.efDistrict.width})`);
        check(sameY('efDistrict', 'efAuthority') && sameY('efTambon', 'efType') && sameY('efStatus', 'efProblem'), `${tag}: others in 2 columns`);
        check(r.efDistrict.y > r.efSearch.y + 10, `${tag}: district below search`);
      } else {
        const xs = new Set(FIELD_IDS.map(id => Math.round(r[id].x)));
        const ys = FIELD_IDS.map(id => r[id].y);
        check(xs.size === 1, `${tag}: single column (x=${[...xs]})`);
        check(ys.every((y, i) => i === 0 || y > ys[i - 1]), `${tag}: fields stacked in order`);
      }
    }
    if (width === 1440 || width === 390) await behaviour(page, tag, check);
    check(pageErrors.length === 0, `${tag}: no pageerror (${pageErrors.join('|')})`);
    check(calls.filter(c => c.kind === 'counter' && c.url.includes('/hit/')).length === 0, `${tag}: no counter /hit/`);
    await context.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(failures, [], failures.join('\n'));
console.log('PASS: province filter bar structure/order/geometry at 1440/768/412/390/360 (mocked)');
