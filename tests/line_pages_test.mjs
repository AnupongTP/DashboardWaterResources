import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const config = read('site/line/line-config.js');
const my = read('site/line/my/index.html');
const SDK = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

assert.match(config, /window\.LINE_LIFF\s*=\s*Object\.freeze\(\{\s*myId:\s*'2011020414-b0taNEeB'\s*\}\)/);
assert.equal(fs.existsSync(path.join(ROOT, 'site/line/register')), false, 'register page removed');

for (const [name, html] of [['config', config], ['my', my]]) {
  assert.ok(!/LINE_CHANNEL_ACCESS_TOKEN|channelSecret|Bearer\s+[A-Za-z0-9+/=]{40,}/.test(html), name + ' must not contain secrets');
}

assert.match(my, /<html lang="th">/);
assert.ok(my.includes(`<script src="${SDK}"`), 'loads LIFF SDK from LINE CDN');
assert.ok(my.includes('<script src="/line/line-config.js"'), 'loads config');
assert.ok(my.includes('liff.getIDToken()'), 'sends ID token');
assert.ok(my.includes('/api/line/me') && my.includes('/api/line/register'), 'calls both APIs');

// choose view
assert.ok(my.includes('id="chooseView"'));
assert.ok(my.includes('ใช้งานทั่วไป (ดูภาพรวมจังหวัด)'));
assert.ok(my.includes("mode: 'general'"));
assert.ok(my.includes('ไม่พบรหัสพื้นที่นี้ กรุณาตรวจสอบหรือติดต่อทีมจังหวัด'));
assert.ok(my.includes('พื้นที่ปัจจุบัน'));

// revision 3: no wait view — redirect immediately; ?change=1 opens the choose view
assert.ok(!my.includes('waitView') && !my.includes('WAIT_MS'), 'wait view removed');
assert.ok(my.includes("get('change') === '1'"), 'reads ?change=1 after liff.init');
assert.ok(/if \(me\.body\.registered && me\.body\.url && !changeMode\) return go\(me\.body\.url\)/.test(my), 'registered users go straight to their dashboard');
assert.ok(my.includes('go(result.body.url)'), 'after choosing, go straight to the dashboard');
assert.ok(my.includes('location.replace'));
// fallbacks
assert.ok(my.includes('AbortController'));
assert.ok(my.includes("const PROVINCE = '/'"));
assert.ok(my.includes('liff.logout()') && my.includes("'relogin'") && /status === 401/.test(my), 'relogin once on 401');

// review fixes: relogin works inside LINE app, init has a timeout, null/expired token is caught before calling API
assert.ok(my.includes('liff.isInClient()'), 'relogin inside LINE reloads instead of liff.login()');
assert.ok(/setTimeout\(\(\) => go\(PROVINCE\), TIMEOUT_MS\)/.test(my), 'relogin has a fallback timer to the province page');
assert.ok(my.includes('Promise.race'), 'liff.init guarded by timeout');
assert.ok(/exp \* 1000 <= Date\.now\(\)/.test(my), 'expired token detected client-side');
assert.ok(my.includes('function freshToken'), 'token freshness helper');

// short user id footer
assert.ok(my.includes('liff.getDecodedIDToken()'));
assert.ok(my.includes('รหัสผู้ใช้'));

console.log('line_pages_test: all passed');
