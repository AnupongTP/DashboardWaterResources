// Screenshots of the scoped template (and optionally a prototype HTML) for manual visual comparison.
// All services are mocked (installMocks); nothing leaves the machine.
//   node tests/scoped_template_screens.mjs <outDir> [--reference <prototype.html>] [--route /authority/tt-mae-ka/] [--tag maeka]
import fs from 'node:fs';
import path from 'node:path';
import {chromium, SCOPE_DATA, PARITY_DATA, record, installMocks} from './district_browser_support.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const out = args[0];
const route = flag('--route') || '/authority/tt-mae-ka/';
const reference = flag('--reference');
const tag = flag('--tag') || route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
const widths = (flag('--widths') || '1440,390').split(',').map(Number);
const dataset = flag('--dataset') === 'sparse' ? SCOPE_DATA.filter(r => r.id < 2000 && r.id !== 1011) : [
  ...SCOPE_DATA, ...PARITY_DATA,
  ...Array.from({length: 8}, (_, i) => record(7100 + i, 'แม่กา', {
    localAuthority: 'ทต.แม่กา', name: `MAEKA-PARITY-${i + 1}`,
    problem: ['ชำรุด', 'วัชพืชปกคลุม', 'น้ำเน่าเสีย,น้ำมีสี', 'ใช้งานได้'][i % 4], depthnet: i % 4 === 0 ? 3 : 10,
  })),
];
fs.mkdirSync(out, {recursive: true});
const HOST = 'http://scoped-screens.test';
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
for (const width of widths) {
  const ctx = await browser.newContext({viewport: {width, height: width > 600 ? 900 : 844}, isMobile: width < 500, hasTouch: width < 500});
  await installMocks(ctx, {data: dataset, host: HOST, baseline: true});
  if (reference) await ctx.route(HOST + '/__reference.html', r => r.fulfill({contentType: 'text/html', body: fs.readFileSync(reference)}));
  const page = await ctx.newPage();
  await page.goto(HOST + route);
  await page.waitForFunction(() => document.body.classList.contains('authority-ready'), null, {timeout: 20000});
  await page.waitForTimeout(1200);
  await page.screenshot({path: path.join(out, `${tag}-current-${width}.png`), fullPage: true, animations: 'disabled'});
  if (reference) {
    const ref = await ctx.newPage();
    await ref.goto(HOST + '/__reference.html');
    await ref.waitForTimeout(2500);
    await ref.screenshot({path: path.join(out, `${tag}-reference-${width}.png`), fullPage: true, animations: 'disabled'});
  }
  await ctx.close();
}
await browser.close();
console.log('screens written to ' + out);
