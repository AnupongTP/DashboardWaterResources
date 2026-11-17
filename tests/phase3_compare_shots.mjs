// Phase 3 helper: full-page screenshots of EVERY view/tab, current template vs prototype file (all network mocked).
//   node tests/phase3_compare_shots.mjs <outDir> [--widths 1440,390] [--only province,maeka,maechai]
// Prototype pages are opened from disk-through-route (HOST/__reference.html) with the same mocked CDN libraries and no other network.
// Data differs (prototype has its own embedded data; ours uses the test fixture), so compare layout/structure, not numbers.
import fs from 'node:fs';
import path from 'node:path';
import {chromium, SCOPE_DATA, PARITY_DATA, record, installMocks} from './district_browser_support.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const out = args[0];
if (!out) { console.error('usage: node tests/phase3_compare_shots.mjs <outDir> [--widths 1440,390] [--only province,maeka,maechai]'); process.exit(2); }
const widths = (flag('--widths') || '1440,390').split(',').map(Number);
const only = (flag('--only') || 'province,maeka,maechai').split(',');
const PROTO = 'C:\\Users\\Anupong\\Desktop\\rawชั่วคราว\\';
const PAGES = [
  {tag: 'province', route: '/index.html', ref: PROTO + 'index (5).html'},
  {tag: 'maeka', route: '/authority/tt-mae-ka/', ref: PROTO + 'index_maeka.html'},
  {tag: 'maechai', route: '/district/mae-chai/', ref: PROTO + 'index_maechai.html'},
].filter(p => only.includes(p.tag));
const VIEWS = [['exec', null], ['detail', 'overview'], ['detail', 'tambon'], ['detail', 'insight'], ['detail', 'quality'], ['detail', 'table'], ['detail', 'gallery'], ['detail', 'damaged']];
const dataset = [
  ...SCOPE_DATA, ...PARITY_DATA,
  ...Array.from({length: 8}, (_, i) => record(7100 + i, 'แม่กา', {
    localAuthority: 'ทต.แม่กา', name: `MAEKA-PARITY-${i + 1}`,
    problem: ['ชำรุด', 'วัชพืชปกคลุม', 'น้ำเน่าเสีย,น้ำมีสี', 'ใช้งานได้'][i % 4],
    imglink: `https://drive.google.com/open?id=PHOTO${i}`,
  })),
];
const HOST = 'http://phase3-compare.test';
fs.mkdirSync(out, {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});

async function shootAll(page, prefix, ready) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready();
  for (const [view, tab] of VIEWS) {
    try {
      await page.click(`.main-nav button[data-view="${view}"]`, {timeout: 5000});
      if (tab) await page.click(`.tab-btn[data-tab="${tab}"]`, {timeout: 5000});
      await page.waitForTimeout(1200);
      await page.screenshot({path: path.join(out, `${prefix}-${view}${tab ? '-' + tab : ''}.png`), fullPage: true, animations: 'disabled'});
    } catch (e) {
      console.log(`  skipped ${prefix} ${view}/${tab || ''}: ${String(e.message).split('\n')[0]}`);
    }
  }
  if (errors.length) console.log(`  page errors (${prefix}):`, JSON.stringify(errors.slice(0, 3)));
}

for (const p of PAGES) {
  for (const width of widths) {
    const opts = {viewport: {width, height: width > 600 ? 900 : 844}, isMobile: width < 500, hasTouch: width < 500};
    // current template
    let ctx = await browser.newContext(opts);
    await installMocks(ctx, {data: dataset, host: HOST, baseline: true});
    let page = await ctx.newPage();
    await page.goto(HOST + p.route);
    await shootAll(page, `${p.tag}-current-${width}`, async () => {
      await page.waitForFunction(() => document.querySelectorAll('#execKpi .kpi-card').length > 0, null, {timeout: 20000});
      await page.waitForTimeout(1200);
    });
    await ctx.close();
    // prototype (offline)
    if (fs.existsSync(p.ref)) {
      ctx = await browser.newContext(opts);
      await installMocks(ctx, {data: dataset, host: HOST, baseline: true});
      await ctx.route(HOST + '/__reference.html', r => r.fulfill({contentType: 'text/html', body: fs.readFileSync(p.ref)}));
      page = await ctx.newPage();
      await page.goto(HOST + '/__reference.html');
      await shootAll(page, `${p.tag}-reference-${width}`, async () => { await page.waitForTimeout(2500); });
      await ctx.close();
    } else console.log('  reference file missing: ' + p.ref);
    console.log(`done ${p.tag} @${width}`);
  }
}
await browser.close();
console.log('screens written to ' + out);
