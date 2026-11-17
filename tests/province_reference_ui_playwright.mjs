// Compare presentation, pseudo-elements, interactive states, and animations over time
// between reference HTMLs and current provincial/scoped pages, with all services mocked.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium, VIEWPORTS, SCOPE_DATA, PARITY_DATA, record, installMocks} from './district_browser_support.mjs';

const args = process.argv.slice(2);
function getFlag(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}
const positional = args.filter((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
const reference = getFlag('--reference') || positional[0];
const out = getFlag('--out') || positional[1];
const explicitTarget = getFlag('--target') || positional[2];
assert.ok(reference && out, 'Usage: node tests/province_reference_ui_playwright.mjs <reference.html> <out-dir> [--target /index.html|/authority/tt-mae-ka/|/district/mae-chai/]');

const refBase = path.basename(reference).toLowerCase();
const inferred = refBase.includes('maeka')
  ? {kind: 'scoped', route: '/authority/tt-mae-ka/', tag: 'maeka'}
  : refBase.includes('maechai')
    ? {kind: 'scoped', route: '/district/mae-chai/', tag: 'maechai'}
    : {kind: 'province', route: '/index.html', tag: 'province'};
const targetRoute = explicitTarget || inferred.route;
const targetKind = targetRoute === '/index.html' ? 'province' : 'scoped';
const tag = explicitTarget ? targetRoute.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') : inferred.tag;

fs.mkdirSync(out, {recursive: true});
const HOST = 'http://province-reference.test';
const FIXTURE_DATA = [
  ...SCOPE_DATA,
  ...PARITY_DATA,
  ...Array.from({length: 8}, (_, i) => record(7100 + i, 'แม่กา', {
    localAuthority: 'ทต.แม่กา',
    name: `MAEKA-PARITY-${i + 1}`,
    problem: ['ชำรุด', 'วัชพืชปกคลุม', 'น้ำเน่าเสีย,น้ำมีสี', 'ใช้งานได้'][i % 4],
    depthnet: i % 4 === 0 ? 3 : 10,
    imglink: i < 2 ? `https://drive.google.com/uc?export=view&id=ParityImg${i + 1}` : null,
  })),
  ...Array.from({length: 6}, (_, i) => record(7200 + i, 'แม่ใจ', {
    localAuthority: 'ทต.แม่ใจ',
    name: `MAECHAI-PARITY-${i + 1}`,
    problem: ['ชำรุด', 'ตื้นเขิน', 'ใช้งานได้'][i % 3],
    depthnet: i % 3 === 0 ? 4 : 9,
    imglink: i === 0 ? 'https://drive.google.com/uc?export=view&id=MaechaiImg1' : null,
  })),
];

const BLOCKED_LIVE_HOSTS = [
  'lh3.googleusercontent.com',
  'drive.google.com',
  'script.google.com',
  'script.googleusercontent.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

const PROVINCIAL_CONTRACTS = [
  ['body', 'body', 'body', ['backgroundColor', 'backgroundImage', 'color', 'fontSize', 'lineHeight']],
  ['header', '.app-header', '.app-header', ['backgroundImage', 'boxShadow', 'borderBottomWidth']],
  ['eyebrow', '.header-brand .eyebrow', '.header-brand .eyebrow', ['fontSize', 'fontWeight', 'color', 'textShadow']],
  ['h1', '.header-brand h1', '.header-brand h1', ['fontSize', 'fontWeight', 'color']],
  ['nav-active', '.main-nav button.active', '.main-nav button.active', ['backgroundColor', 'color', 'borderRadius', 'boxShadow', 'fontSize', 'fontWeight']],
  ['nav-idle', '.main-nav button:not(.active)', '.main-nav button:not(.active)', ['backgroundColor', 'color', 'borderRadius', 'fontSize', 'fontWeight']],
  ['filter-bar', '.gf-inner', '.gf-inner', ['borderRadius', 'boxShadow', 'borderTopWidth', 'paddingTop', 'paddingLeft', 'backgroundColor']],
  ['filter-rainbow', '.gf-inner', '.gf-inner', ['height', 'backgroundImage'], '::before'],
  ['filter-icon', '.gf-ic', '.gf-ic', ['width', 'height', 'borderRadius', 'backgroundImage', 'boxShadow']],
  ['filter-title', '.gf-title', '.gf-title', ['fontSize', 'fontWeight', 'color']],
  ['filter-count', '#efCount', '#efCount', ['borderRadius', 'paddingTop', 'paddingLeft', 'fontSize', 'fontWeight']],
  ['filter-count-dot', '#efCount', '#efCount', ['width', 'height', 'borderRadius', 'backgroundColor', 'animationName'], '::before'],
  ['filter-reset', '#efReset', '#efReset', ['borderRadius', 'borderTopWidth', 'borderTopColor', 'backgroundColor', 'color', 'fontSize', 'fontWeight']],
  ['filter-select', '.gf-field select', '.gf-field select', ['height', 'borderRadius', 'backgroundColor', 'borderTopColor', 'fontSize', 'color']],
  ['filter-tambon-input', '.gf-field select', '.gf .tambon-combobox input[type=text]', ['height', 'borderRadius', 'backgroundColor', 'borderTopColor', 'fontSize', 'color']],
  ...Array.from({length: 8}, (_, i) => [
    `kpi-card-${i + 1}`,
    `#execKpi .kpi-card:nth-child(${i + 1})`,
    `#execKpi .kpi-card:nth-child(${i + 1})`,
    ['display', 'borderRadius', 'borderTopWidth', 'borderTopColor', 'paddingTop', 'paddingLeft', 'backgroundImage', 'boxShadow'],
  ]),
  ...Array.from({length: 7}, (_, i) => [
    `kpi-watermark-${i + 2}`,
    `#execKpi .kpi-card:nth-child(${i + 2})`,
    `#execKpi .kpi-card:nth-child(${i + 2})`,
    ['opacity', 'fontSize', 'transform'],
    '::after',
  ]),
  ['kpi-icon', '#execKpi .ki', '#execKpi .ki', ['width', 'height', 'borderRadius', 'backgroundColor', 'color', 'boxShadow']],
  ['kpi-value', '#execKpi .kv', '#execKpi .kv', ['fontSize', 'fontWeight', 'color', 'textAlign', 'lineHeight']],
  ['kpi-label', '#execKpi .kl', '#execKpi .kl', ['fontSize', 'fontWeight', 'color']],
  ['kpi-sub', '#execKpi .ks', '#execKpi .ks', ['fontSize', 'color']],
  ['sec-head', '.sec-head', '.sec-head, .exec-sec-head', ['borderBottomWidth']],
  ['sec-num', '.sec-num', '.sec-num', ['width', 'height', 'borderRadius', 'boxShadow']],
  ['sec-title', '.sec-head h2', '.sec-head h2, .exec-sec-head h2', ['fontSize', 'fontWeight', 'color']],
  ['hero-map', '.exec-hero-map', '.exec-hero-map', ['borderRadius', 'boxShadow', 'borderTopWidth']],
  ['chart-box', '.chart-box', '.chart-box', ['borderRadius', 'boxShadow', 'backgroundColor']],
  ['chart-dot', '.chart-box > h3', '.chart-box > h3', ['width', 'height', 'borderRadius', 'backgroundImage'], '::before'],
  ['panel', '.panel', '.panel', ['borderRadius', 'boxShadow', 'backgroundColor']],
  ['map-legend', '#mapLegend', '#mapLegend', ['borderRadius', 'backgroundColor', 'borderTopWidth', 'borderTopColor']],
  ['map-layer-btn', '.mlc-toggle', '.mlc-toggle', ['borderRadius', 'backgroundImage', 'color', 'boxShadow']],
];

const SCOPED_CONTRACTS = [
  ['body', 'body', 'body', ['backgroundColor', 'backgroundImage', 'color', 'fontSize', 'lineHeight']],
  ['header', '.app-header', '.app-header', ['backgroundImage', 'boxShadow', 'borderBottomWidth']],
  ['eyebrow', '.header-brand .eyebrow', '.header-brand .eyebrow', ['fontWeight', 'color', 'textShadow']],
  ['h1', '.header-brand h1', '.header-brand h1', ['color']],
  ['filter-bar', '.gf-inner', '.toolbar', ['borderRadius', 'boxShadow', 'backgroundColor']],
  ['filter-select', '.gf-field select', '.toolbar select', ['height', 'borderRadius', 'backgroundColor', 'borderTopColor', 'color']],
  ['filter-search', '.gf-field select', '.toolbar input[type=text]', ['height', 'borderRadius', 'backgroundColor', 'borderTopColor', 'color']],
  ...Array.from({length: 5}, (_, i) => [
    `scoped-kpi-${i + 1}`,
    `#execKpi .kpi-card:nth-child(${i + 2})`,
    `.kpis .kpi:nth-child(${i + 1})`,
    ['borderRadius', 'borderTopWidth', 'boxShadow'],
  ]),
  ['kpi-icon', '#execKpi .kpi-card:nth-child(2) .ki', '.kpis .kpi:nth-child(2) .kpi-icon', ['borderRadius', 'backgroundColor', 'boxShadow']],
  ['kpi-watermark', '#execKpi .kpi-card:nth-child(2)', '.kpis .kpi .kpi-bgicon', ['opacity', 'transform'], '::after', null],
  ['card', '.chart-box', '.railcol .card', ['borderRadius', 'boxShadow', 'backgroundColor']],
  ['map-layer-btn', '.mlc-toggle', '.layerbtn', ['borderRadius', 'backgroundImage', 'color']],
];

async function settle(page) {
  await page.evaluate(async () => {
    for (const c of Object.values(window.Chart?.instances || {})) {
      c.stop();
      c.options.animation = false;
      c.update('none');
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function readPresentation(page, contracts, useRefSelector) {
  return page.evaluate(({contracts, useRefSelector}) => {
    const out = {};
    for (const entry of contracts) {
      const [key, refSel, curSel, props, refPseudo = null, curPseudo = refPseudo] = entry;
      const sel = useRefSelector ? refSel : curSel;
      const pseudo = useRefSelector ? refPseudo : curPseudo;
      const el = document.querySelector(sel);
      if (!el) {
        out[key] = {__missing: sel};
        continue;
      }
      const st = getComputedStyle(el, pseudo || undefined);
      const vals = Object.fromEntries(props.map(p => [p, st[p]]));
      if (pseudo && curPseudo) vals.__content = st.content;
      out[key] = vals;
    }
    return out;
  }, {contracts, useRefSelector});
}

async function sampleElementAnim(page, selector, pseudo, animName) {
  return page.evaluate(({selector, pseudo, animName}) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const st = getComputedStyle(el, pseudo || undefined);
    const anims = document.getAnimations({subtree: true})
      .filter(a => a.animationName === animName)
      .map(a => ({
        animationName: a.animationName,
        playState: a.playState,
        currentTime: a.currentTime,
        duration: a.effect?.getTiming?.().duration ?? null,
      }));
    return {
      transform: st.transform,
      opacity: st.opacity,
      boxShadow: st.boxShadow,
      borderColor: st.borderColor,
      color: st.color,
      backgroundImage: st.backgroundImage,
      filter: st.filter,
      animationName: st.animationName,
      animationDuration: st.animationDuration,
      transitionDuration: st.transitionDuration,
      content: pseudo ? st.content : null,
      animations: anims,
    };
  }, {selector, pseudo, animName});
}

async function probeInteractiveAndAnimations(page, kind, label, outDir, width) {
  const isProvince = kind === 'province';
  const cardSel = isProvince ? '#execKpi .kpi-card' : '.kpis .kpi';
  // Card 1 starts .kpi-active in provincial ('total'); use unselected card 2 on provincial, card 3 on scoped.
  const targetIdx = isProvince ? 1 : 2;
  const targetCardCss = isProvince ? `#execKpi .kpi-card:nth-child(${targetIdx + 1})` : `.kpis .kpi:nth-child(${targetIdx + 1})`;
  const iconSel = isProvince ? `${targetCardCss} .ki` : `${targetCardCss} .kpi-icon`;
  const wmSel = isProvince ? targetCardCss : `${targetCardCss} .kpi-bgicon`;
  const wmPseudo = isProvince ? '::after' : null;
  const activeClass = isProvince ? 'kpi-active' : 'active';
  const evidence = {label, kind, width};

  // 1. ixPulse on #efCount::before (provincial & reference)
  if (await page.locator('#efCount').count()) {
    await page.waitForTimeout(80);
    const p1 = await sampleElementAnim(page, '#efCount', '::before', 'ixPulse');
    await page.waitForTimeout(450);
    const p2 = await sampleElementAnim(page, '#efCount', '::before', 'ixPulse');
    evidence.ixPulse = {p1, p2};
    assert.equal(p1.animationName, 'ixPulse', `${label}: #efCount::before animationName`);
    assert.ok(p1.animations.length > 0 && p2.animations.length > 0, `${label}: ixPulse getAnimations() active`);
    assert.ok(p2.animations[0].currentTime > p1.animations[0].currentTime, `${label}: ixPulse currentTime advances`);
    assert.notEqual(p2.boxShadow, p1.boxShadow, `${label}: ixPulse boxShadow animates over time`);
  }

  // 2. Hover state + fxFloat over time + .ki/.kpi-icon hover transform
  const preIcon = await sampleElementAnim(page, iconSel, null, '');
  assert.equal(preIcon.transform, 'none', `${label}: icon pre-hover transform is none`);
  const card = page.locator(cardSel).nth(targetIdx);
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(40);
  const f1 = await sampleElementAnim(page, wmSel, wmPseudo, 'fxFloat');
  await page.waitForTimeout(420);
  const f2 = await sampleElementAnim(page, wmSel, wmPseudo, 'fxFloat');
  const hoverCard = await sampleElementAnim(page, targetCardCss, null, '');
  const hoverIcon = await sampleElementAnim(page, iconSel, null, '');
  evidence.hover = {preIcon, hoverCard, hoverIcon, fxFloat: {f1, f2}};
  if (outDir) await page.screenshot({path: path.join(outDir, `${label}-hover-${width}.png`)});

  assert.equal(f1.animationName, 'fxFloat', `${label}: hover watermark animationName is fxFloat`);
  assert.ok(f1.animations.length > 0 && f2.animations.length > 0, `${label}: fxFloat getAnimations() active`);
  assert.ok(f2.animations[0].currentTime > f1.animations[0].currentTime, `${label}: fxFloat currentTime advances`);
  assert.notEqual(f2.transform, f1.transform, `${label}: fxFloat watermark transform animates over time`);
  assert.notEqual(hoverIcon.transform, 'none', `${label}: icon rotates/scales on hover`);
  assert.notEqual(hoverCard.transform, 'none', `${label}: KPI card lifts on hover`);

  // 3. Pressed (:active) state via mouse.down while over card
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(30);
  const activePress = await sampleElementAnim(page, targetCardCss, null, '');
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await page.waitForTimeout(50);
  evidence.pressed = activePress;
  assert.notEqual(activePress.transform, 'none', `${label}: :active press applies transform`);
  assert.ok(activePress.filter.includes('brightness'), `${label}: :active press applies brightness filter (${activePress.filter})`);

  // 4. Selected (.kpi-active / .kpi.active) + fxStamp + fxFlag over time
  const selCard = card;
  const selCardCss = targetCardCss;
  const selWmCss = wmSel;
  const selLabelCss = isProvince ? `${selCardCss} .kl` : `${selCardCss} .l`;

  await selCard.click();
  await page.waitForTimeout(25);
  const stamp1 = await sampleElementAnim(page, selWmCss, wmPseudo, 'fxStamp');
  const flag1 = await sampleElementAnim(page, selLabelCss, '::after', 'fxFlag');
  await page.waitForTimeout(520);
  const stamp2 = await sampleElementAnim(page, selWmCss, wmPseudo, 'fxStamp');
  const flag2 = await sampleElementAnim(page, selLabelCss, '::after', 'fxFlag');
  const isSelected = await selCard.evaluate((e, c) => e.classList.contains(c), activeClass);
  evidence.selected = {isSelected, fxStamp: {stamp1, stamp2}, fxFlag: {flag1, flag2}};
  if (outDir) await page.screenshot({path: path.join(outDir, `${label}-selected-${width}.png`)});

  assert.equal(isSelected, true, `${label}: clicked KPI card gains ${activeClass}`);
  assert.equal(stamp1.animationName, 'fxStamp', `${label}: selected watermark runs fxStamp`);
  assert.equal(flag1.animationName, 'fxFlag', `${label}: selected badge runs fxFlag`);
  assert.ok(flag1.content.includes('กำลังกรอง'), `${label}: selected badge shows ✓ กำลังกรอง (${flag1.content})`);
  assert.ok(
    stamp1.transform !== stamp2.transform || stamp1.opacity !== stamp2.opacity ||
    (stamp1.animations[0] && stamp2.animations[0] && stamp2.animations[0].currentTime > stamp1.animations[0].currentTime),
    `${label}: fxStamp progresses over time`
  );
  assert.ok(
    flag1.transform !== flag2.transform ||
    (flag1.animations[0] && flag2.animations[0] && flag2.animations[0].currentTime > flag1.animations[0].currentTime),
    `${label}: fxFlag progresses over time`
  );
  assert.ok(Number(stamp2.opacity) >= 0.28, `${label}: fxStamp settles at visible watermark opacity (${stamp2.opacity})`);

  // Click again (or count card) to clear selection
  await selCard.click();
  await page.waitForTimeout(60);
  const afterDeselect = await selCard.evaluate((e, c) => e.classList.contains(c), activeClass);
  const badgeAfter = await sampleElementAnim(page, selLabelCss, '::after', 'fxFlag');
  assert.equal(afterDeselect, false, `${label}: clicking selected KPI again clears ${activeClass}`);
  assert.ok(!badgeAfter.content.includes('กำลังกรอง'), `${label}: badge removed after deselect`);

  // 5. Filter controls: hover #efReset, focus select/input, reset state
  if (await page.locator('#efReset').count()) {
    const resetBtn = page.locator('#efReset');
    await resetBtn.hover();
    await page.waitForTimeout(260);
    const resetHover = await sampleElementAnim(page, '#efReset', null, '');
    evidence.resetHover = resetHover;
    assert.equal(resetHover.color, 'rgb(255, 255, 255)', `${label}: #efReset:hover text turns white`);
    assert.ok(resetHover.backgroundImage.includes('gradient'), `${label}: #efReset:hover uses purple gradient`);

    const typeSel = page.locator('#efType');
    await typeSel.focus();
    await page.waitForTimeout(260);
    const selFocus = await sampleElementAnim(page, '#efType', null, '');
    evidence.selectFocus = selFocus;
    assert.equal(selFocus.borderColor, 'rgb(124, 92, 240)', `${label}: select:focus borderColor`);

    const val = await typeSel.locator('option').evaluateAll(opts => opts.find(o => o.value)?.value || '');
    if (val) {
      await typeSel.selectOption(val);
      await resetBtn.click();
      assert.equal(await typeSel.inputValue(), '', `${label}: #efReset restores #efType`);
    }
  }
  if (!isProvince && await page.locator('#txtSearch').count()) {
    await page.locator('#txtSearch').focus();
    await page.waitForTimeout(260);
    const inputFocus = await sampleElementAnim(page, '#txtSearch', null, '');
    evidence.scopedInputFocus = inputFocus;
    assert.equal(inputFocus.borderColor, 'rgb(124, 92, 240)', `${label}: scoped #txtSearch:focus borderColor`);
  }
  if (isProvince && await page.locator('#efTambon').count()) {
    await page.locator('#efTambon').focus();
    await page.waitForTimeout(260);
    const tambonFocus = await sampleElementAnim(page, '#efTambon', null, '');
    evidence.tambonFocus = tambonFocus;
    assert.equal(tambonFocus.borderColor, 'rgb(124, 92, 240)', `${label}: #efTambon:focus borderColor`);
  }

  // 6. Detail view: tabs, .df-chip.active::after fxFlag, .gcard:hover .img-box::after
  if (isProvince && await page.locator('[data-view="detail"]').count()) {
    await page.locator('[data-view="detail"]').click();
    await settle(page);
    const tabActive = await sampleElementAnim(page, '.tab-btn.active', null, '');
    assert.equal(tabActive.borderColor, 'rgba(0, 0, 0, 0)', `${label}: .tab-btn.active transparent border`);
    await page.locator('[data-tab="damaged"]').click();
    await page.waitForTimeout(900);
    const dfChip = page.locator('#dfProblemChips .df-chip').first();
    if (await dfChip.count()) {
      await dfChip.click();
      await page.waitForTimeout(25);
      const dfAfter = await sampleElementAnim(page, '#dfProblemChips .df-chip.active', '::after', 'fxFlag');
      evidence.dfChipActive = dfAfter;
      assert.ok(dfAfter?.content.includes('✓'), `${label}: .df-chip.active::after renders checkmark`);
      assert.equal(dfAfter?.animationName, 'fxFlag', `${label}: .df-chip.active::after runs fxFlag`);
      await page.waitForTimeout(900);
    }
    await page.locator('[data-tab="gallery"]').click();
    const gcard = page.locator('#galleryGrid .gcard').first();
    if (await gcard.count()) {
      await gcard.hover();
      await page.waitForTimeout(240);
      const gAfter = await sampleElementAnim(page, '#galleryGrid .gcard:first-child .img-box', '::after', '');
      const gImg = await sampleElementAnim(page, '#galleryGrid .gcard:first-child .img-box img', null, '');
      evidence.galleryHover = {gAfter, gImg};
      assert.ok(gAfter.content.includes('🔍'), `${label}: .gcard:hover .img-box::after shows 🔍`);
      assert.equal(gAfter.opacity, '1', `${label}: .gcard:hover .img-box::after opacity is 1`);
      assert.notEqual(gImg.transform, 'none', `${label}: .gcard:hover .img-box img scales`);
    }
    await page.locator('[data-view="exec"]').click();
    await settle(page);
  }

  // 7. Map fullscreen ancestor safety (no persistent transform/filter/animation breaking fixed positioning)
  const fsBtn = page.locator('.map-expand-ctrl a, .map-fullscreen-btn').first();
  if (await fsBtn.count()) {
    await fsBtn.click();
    await page.waitForTimeout(50);
    const mapSel = isProvince ? '#map' : '#mapbox';
    const lockOk = await page.evaluate(sel => {
      const mapEl = document.querySelector(sel);
      const locked = document.body.classList.contains('map-fullscreen-lock') || document.body.classList.contains('map-fs-lock');
      const offenders = [];
      for (let p = mapEl?.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.transform !== 'none' || st.filter !== 'none' || st.animationName !== 'none') {
          offenders.push({tag: p.tagName, cls: p.className, transform: st.transform, filter: st.filter, anim: st.animationName});
        }
      }
      return {locked, offenders};
    }, mapSel);
    evidence.fullscreenAncestors = lockOk;
    assert.equal(lockOk.locked, true, `${label}: fullscreen lock class set`);
    if (!label.startsWith('reference')) {
      assert.deepEqual(lockOk.offenders, [], `${label}: fullscreen map ancestors free of transform/filter/animation`);
    } else {
      assert.deepEqual(lockOk.offenders.filter(o => o.transform !== 'none' || o.filter !== 'none'), [], `${label}: fullscreen map ancestors free of transform/filter`);
    }
    await fsBtn.click();
    await page.waitForTimeout(50);
  }

  // 8. Reduced-motion media query enforcement
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForTimeout(40);
  const rmCard = await sampleElementAnim(page, targetCardCss, null, '');
  const rmWm = await sampleElementAnim(page, wmSel, wmPseudo, 'fxFloat');
  await card.hover();
  await page.waitForTimeout(30);
  const rmH1 = await sampleElementAnim(page, wmSel, wmPseudo, 'fxFloat');
  await page.waitForTimeout(260);
  const rmH2 = await sampleElementAnim(page, wmSel, wmPseudo, 'fxFloat');
  evidence.reducedMotion = {rmCard, rmWm, rmH1, rmH2};
  assert.ok(parseFloat(rmCard.transitionDuration) <= 0.001, `${label}: reduced-motion collapses card transitionDuration (${rmCard.transitionDuration})`);
  assert.ok(parseFloat(rmWm.animationDuration) <= 0.001, `${label}: reduced-motion collapses watermark animationDuration (${rmWm.animationDuration})`);
  if (!label.startsWith('reference')) {
    assert.equal(rmH2.transform, rmH1.transform, `${label}: reduced-motion disables fxFloat movement over time`);
  }
  await page.emulateMedia({reducedMotion: 'no-preference'});

  return evidence;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const results = [];
const failures = [];
const animationEvidence = {};
const networkAudit = {blockedLiveRequests: [], unmockedEscapes: [], hitWrites: 0};

try {
  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: {width, height},
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const calls = [];
    await context.addInitScript(() => localStorage.setItem('pyoVisitDate', new Date().toISOString().slice(0, 10)));
    await installMocks(context, {host: HOST, data: FIXTURE_DATA, calls});
    await context.route(HOST + '/reference.html', r => r.fulfill({contentType: 'text/html', body: fs.readFileSync(reference)}));

    const page = await context.newPage();
    page.on('request', req => {
      const u = new URL(req.url());
      if (BLOCKED_LIVE_HOSTS.includes(u.hostname)) networkAudit.blockedLiveRequests.push(req.url());
      if (u.href.includes('action=hit') || (u.hostname === 'abacus.jasoncameron.dev' && u.pathname.includes('/hit/'))) {
        networkAudit.hitWrites += 1;
      }
      if (![HOST.replace('http://', ''), ...BLOCKED_LIVE_HOSTS, 'cdnjs.cloudflare.com', 'unpkg.com', 'abacus.jasoncameron.dev', 'ipwho.is', 'server.arcgisonline.com'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) {
        networkAudit.unmockedEscapes.push(req.url());
      }
    });

    // Reference render
    await page.goto(HOST + '/reference.html');
    await page.waitForSelector('#execKpi .kpi-card');
    await settle(page);
    await page.screenshot({path: path.join(out, `reference-${tag}-${width}.png`)});
    const contracts = targetKind === 'province' ? PROVINCIAL_CONTRACTS : SCOPED_CONTRACTS;
    const expected = await readPresentation(page, contracts, true);
    const expectedColumns = await page.locator('#execKpi').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);

    if (width === 1440 && targetKind === 'province') {
      try {
        animationEvidence[`reference-${width}`] = await probeInteractiveAndAnimations(page, 'province', `reference-${tag}`, out, width);
      } catch (e) {
        failures.push(`reference-${width} animation/interaction: ${e.message}`);
      }
    }

    // Current target render in same browser & context
    await page.goto(HOST + targetRoute);
    if (targetKind === 'province') await page.waitForSelector('#execKpi .kpi-card');
    else await page.waitForSelector('body.authority-ready');
    await settle(page);
    await page.screenshot({path: path.join(out, `current-${tag}-${width}.png`)});
    const actual = await readPresentation(page, contracts, false);

    for (const [key, expProps] of Object.entries(expected)) {
      const actProps = actual[key];
      if (!actProps || expProps.__missing || actProps.__missing) {
        failures.push(`${width}: missing element for ${key}: ref=${expProps?.__missing || 'ok'} cur=${actProps?.__missing || 'ok'}`);
        continue;
      }
      for (const [prop, expVal] of Object.entries(expProps)) {
        if (prop === '__content') {
          try {
            assert.ok(actProps.__content && actProps.__content !== 'none', `${width}: ${key}::pseudo content present`);
          } catch (e) { failures.push(e.message); }
          continue;
        }
        try {
          assert.equal(actProps[prop], expVal, `${width}: ${key} ${prop}`);
        } catch (e) { failures.push(e.message); }
      }
    }

    if (targetKind === 'province') {
      const actualColumns = await page.locator('#execKpi').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      try { assert.equal(actualColumns, expectedColumns, 'KPI columns match reference'); }
      catch (e) { failures.push(`${width}: ${e.message}`); }

      const geometry = await page.evaluate(() => {
        const rect = s => document.querySelector(s).getBoundingClientRect().toJSON();
        return {
          icon: rect('#execKpi .ki'),
          number: rect('#execKpi .kv'),
          card: rect('#execKpi .kpi-card'),
          filterTitle: rect('.gf-title'),
          filter: rect('#efDistrict'),
          reset: rect('#efReset'),
          labelled: ['efDistrict', 'efAuthority', 'efTambon', 'efType'].every(id => document.querySelector(`label[for="${id}"]`)),
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      try {
        assert.ok(geometry.icon.x < geometry.number.x, 'Icon left, number right');
        assert.ok(geometry.filter.y >= geometry.filterTitle.bottom, 'Filter fields below title');
        assert.ok(geometry.labelled, 'All original filters have visible labels');
        assert.ok(geometry.overflow <= 1, 'No horizontal overflow');
        assert.ok(geometry.card.height >= 138, 'Reference-sized KPI card');
      } catch (e) { failures.push(`${width}: ${e.message}`); }
      results.push({width, expected, actual, geometry});
    } else {
      const scopedGeometry = await page.evaluate(() => {
        const dss = getComputedStyle(document.querySelector('#dssBoard'));
        const mapRect = document.querySelector('#mapbox').closest('.card').getBoundingClientRect();
        const tblRect = document.querySelector('.tablecard').getBoundingClientRect();
        return {
          dssBorderLeftWidth: dss.borderLeftWidth,
          overflow: document.documentElement.scrollWidth - innerWidth,
          mapTop: mapRect.y,
          mapBottom: mapRect.bottom,
          tblTop: tblRect.y,
          tblLeft: tblRect.x,
          mapLeft: mapRect.x,
        };
      });
      try {
        assert.equal(scopedGeometry.dssBorderLeftWidth, '5px', '#dssBoard preserves 5px severity border');
        assert.ok(scopedGeometry.overflow <= 1, 'No horizontal overflow');
        if (width >= 1101) assert.ok(Math.abs(scopedGeometry.mapTop - scopedGeometry.tblTop) < 2 && scopedGeometry.tblLeft > scopedGeometry.mapLeft, 'Desktop map+table side by side');
        else assert.ok(scopedGeometry.tblTop >= scopedGeometry.mapBottom, 'Mobile/tablet reading order');
      } catch (e) { failures.push(`${width}: ${e.message}`); }
      results.push({width, expected, actual, scopedGeometry});
    }

    if (width === 1440 || width === 390) {
      try {
        animationEvidence[`current-${tag}-${width}`] = await probeInteractiveAndAnimations(page, targetKind, `current-${tag}`, out, width);
      } catch (e) {
        failures.push(`current-${tag}-${width} animation/interaction: ${e.message}`);
      }
    }

    assert.equal(calls.filter(c => c.kind === 'counter' && c.url.includes('/hit/')).length, 0, 'No counter /hit/ writes');
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'animation-evidence.json'), JSON.stringify(animationEvidence, null, 2));
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({
    mocked: true,
    realProductionVerification: false,
    fontMode: 'fallback',
    reference,
    targetRoute,
    targetKind,
    networkAudit: {
      interceptedLiveHostCount: networkAudit.blockedLiveRequests.length,
      unmockedEscapes: networkAudit.unmockedEscapes,
      hitWrites: networkAudit.hitWrites,
    },
    results,
    failures,
  }, null, 2));
}

assert.deepEqual(networkAudit.unmockedEscapes, [], 'No unmocked external network escapes');
assert.equal(networkAudit.hitWrites, 0, 'Zero production hit writes');
assert.deepEqual(failures, [], failures.join('\n'));
console.log(`PASS: ${tag} reference parity, pseudo-elements, and animations over time at 1440/768/412/390/360 (mocked)`);
