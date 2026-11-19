import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMenu, imageSize, MENU_NAME } from '../scripts/line/create-rich-menu.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const menu = buildMenu();

// layout chosen by the user: top กว๊านกักเก็บ | แดชบอร์ด ; bottom รายงาน | ผู้ดูแลระบบ | ตั้งค่าพื้นที่
assert.deepEqual(menu.size, { width: 2500, height: 1686 });
assert.equal(menu.name, MENU_NAME);
assert.ok(menu.chatBarText.length >= 1 && menu.chatBarText.length <= 14);
assert.equal(menu.selected, true);
assert.deepEqual(menu.areas.map((a) => a.bounds), [
  { x: 0, y: 0, width: 1250, height: 843 },
  { x: 1250, y: 0, width: 1250, height: 843 },
  { x: 0, y: 843, width: 833, height: 843 },
  { x: 833, y: 843, width: 834, height: 843 },
  { x: 1667, y: 843, width: 833, height: 843 }
]);
assert.deepEqual(menu.areas.map((a) => a.action.uri), [
  'https://liff.line.me/2011020414-6k3clTwr',
  'https://liff.line.me/2011020414-b0taNEeB',
  'https://script.google.com/macros/s/AKfycbzYUmqGc2JfHD4n8f6Y8hf-h5RoXVI9Y1IZkUCJrk7NaJ1DrqGRV5q9Pe_BJz0JRgk8wQ/exec?openExternalBrowser=1',
  'https://liff.line.me/2011020414-MGeiCo8P',
  'https://liff.line.me/2011020414-b0taNEeB?change=1'
]);
menu.areas.forEach((a) => {
  assert.equal(a.action.type, 'uri');
  assert.ok(a.action.label && a.action.label.length <= 20, 'label present and short');
});
// areas tile the whole image exactly (no gaps, no overlaps)
assert.equal(menu.areas.reduce((sum, a) => sum + a.bounds.width * a.bounds.height, 0), 2500 * 1686);
menu.areas.forEach((a, i) => menu.areas.slice(i + 1).forEach((b) => {
  const A = a.bounds; const B = b.bounds;
  assert.ok(!(A.x < B.x + B.width && B.x < A.x + A.width && A.y < B.y + B.height && B.y < A.y + A.height), 'no overlap');
}));

// imageSize reads PNG and JPEG headers
{
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(2500, 16);
  png.writeUInt32BE(1686, 20);
  assert.deepEqual(imageSize(png), { width: 2500, height: 1686, type: 'image/png' });

  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x06, 0x96, 0x09, 0xc4, 0x03]);
  assert.deepEqual(imageSize(jpg), { width: 2500, height: 1686, type: 'image/jpeg' });
  assert.equal(imageSize(Buffer.from('not an image')), null);
}

// --dry-run prints JSON and needs no token / network
const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'line', 'create-rich-menu.mjs'), '--dry-run'], {
  env: { PATH: process.env.PATH }, encoding: 'utf8'
});
assert.deepEqual(JSON.parse(out), menu);

// without token (and not dry-run) it refuses before any network call
let failed = false;
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'line', 'create-rich-menu.mjs')], { env: { PATH: process.env.PATH }, encoding: 'utf8', stdio: 'pipe' });
} catch (error) {
  failed = true;
  assert.match(String(error.stderr), /LINE_CHANNEL_ACCESS_TOKEN/);
}
assert.ok(failed);

console.log('line_richmenu_script_test: all passed');
