// Screenshots of the selected-record highlight (marker + table row + DSS) at 1440 and 390. All services mocked.
//   node tests/scoped_template_highlight_shots.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import {chromium, PARITY_DATA, installMocks} from './district_browser_support.mjs';

const out = process.argv[2];
fs.mkdirSync(out, {recursive: true});
const HOST = 'http://highlight-shots.test';
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({viewport: {width, height: width > 600 ? 900 : 844}, isMobile: width < 500, hasTouch: width < 500});
  await installMocks(ctx, {data: PARITY_DATA, host: HOST, baseline: true});
  const page = await ctx.newPage();
  await page.goto(HOST + '/authority/tm-dok-kham-tai/');
  await page.waitForFunction(() => document.body.classList.contains('authority-ready'));
  // select record 9103 from the table (switches to the exec tab, reveals + opens its marker)
  await page.click('.main-nav button[data-view="detail"]');
  await page.click('.tab-btn[data-tab="table"]');
  await (width < 500 ? page.locator('#tblBody tr[data-id="9103"]').tap() : page.locator('#tblBody tr[data-id="9103"]').click());
  await page.locator('.leaflet-popup').waitFor();
  await page.waitForTimeout(900);
  await page.locator('#heroMapStage').screenshot({path: path.join(out, `highlight-map-${width}.png`), animations: 'disabled'});
  await page.screenshot({path: path.join(out, `highlight-marker-page-${width}.png`), fullPage: true, animations: 'disabled'});
  // detail tab: the same record is highlighted in the table
  await page.click('.main-nav button[data-view="detail"]');
  await page.click('.tab-btn[data-tab="table"]');
  console.log(width, await page.evaluate(() => ({sel: window.__SCOPED_MAP__.selectedId(), rows: document.querySelectorAll('#tblBody tr.selected').length})));
  await page.locator('#tblBody tr.selected').scrollIntoViewIfNeeded();
  await page.screenshot({path: path.join(out, `highlight-row-${width}.png`)});
  await ctx.close();
}
await browser.close();
console.log('written ' + out);
