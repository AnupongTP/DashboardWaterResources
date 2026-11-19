#!/usr/bin/env node
// สร้างริชเมนู 5 ช่อง (ชุดเดียวสำหรับทุกคน) ผ่าน LINE Messaging API แล้วตั้งเป็นเมนูหลักของ OA
//
// ผู้ใช้รันเองในเครื่อง (PowerShell) — token อยู่ในเชลล์เท่านั้น ห้ามบันทึกลงไฟล์:
//   node scripts/line/create-rich-menu.mjs --dry-run         # พิมพ์ JSON ไม่ยิง API ไม่ต้องใช้ token
//   $env:LINE_CHANNEL_ACCESS_TOKEN = '<token>'
//   node scripts/line/create-rich-menu.mjs                   # สร้าง + อัปโหลดภาพ + ตั้งเป็นเมนูหลัก + ลบเมนูเก่าของสคริปต์
//   node scripts/line/create-rich-menu.mjs --rollback        # ยกเลิกเมนูหลักจาก API + ลบเมนูของสคริปต์ (เมนู OA Manager กลับมา)
//   Remove-Item Env:LINE_CHANNEL_ACCESS_TOKEN                # แล้วกด Reissue token ที่ LINE Developers
// ภาพ: line/richmenu/richmenu-5.jpg (หรือ .png) ขนาด 2500×1686 ไม่เกิน 1 MB
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMAGE_BASE = path.join(ROOT, 'line', 'richmenu', 'richmenu-5');
const API = 'https://api.line.me/v2/bot';
const DATA_API = 'https://api-data.line.me/v2/bot';
const MAX_IMAGE_BYTES = 1024 * 1024;
const W = 2500;
const H = 1686;

export const MENU_NAME = 'kwankukkeb-main-5';

const MY_LIFF = 'https://liff.line.me/2011020414-b0taNEeB';
const AREAS = [
  // แถวบน 2 ช่อง
  [{ x: 0, y: 0, width: 1250, height: 843 }, 'กว๊านกักเก็บ', 'https://liff.line.me/2011020414-6k3clTwr'],
  [{ x: 1250, y: 0, width: 1250, height: 843 }, 'แดชบอร์ด', MY_LIFF],
  // แถวล่าง 3 ช่อง
  [{ x: 0, y: 843, width: 833, height: 843 }, 'รายงาน',
    'https://script.google.com/macros/s/AKfycbzYUmqGc2JfHD4n8f6Y8hf-h5RoXVI9Y1IZkUCJrk7NaJ1DrqGRV5q9Pe_BJz0JRgk8wQ/exec?openExternalBrowser=1'],
  [{ x: 833, y: 843, width: 834, height: 843 }, 'ผู้ดูแลระบบ', 'https://liff.line.me/2011020414-MGeiCo8P'],
  [{ x: 1667, y: 843, width: 833, height: 843 }, 'ตั้งค่าพื้นที่', MY_LIFF + '?change=1']
];

export function buildMenu() {
  return {
    size: { width: W, height: H },
    selected: true,
    name: MENU_NAME,
    chatBarText: 'เมนู',
    areas: AREAS.map(([bounds, label, uri]) => ({ bounds: { ...bounds }, action: { type: 'uri', label, uri } }))
  };
}

// อ่านขนาดภาพจาก header ของ PNG/JPEG โดยไม่ใช้ไลบรารี
export function imageSize(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'image/png' };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), type: 'image/jpeg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

function loadImage() {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const file = `${IMAGE_BASE}.${ext}`;
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    if (buf.length > MAX_IMAGE_BYTES) throw new Error(`${file} is ${buf.length} bytes (> 1 MB)`);
    const size = imageSize(buf);
    if (!size || size.width !== W || size.height !== H) {
      throw new Error(`${file} must be ${W}x${H} PNG/JPEG (got ${size ? size.width + 'x' + size.height : 'unknown'})`);
    }
    return { buf, type: size.type, file };
  }
  throw new Error('image not found: line/richmenu/richmenu-5.jpg|png');
}

async function call(token, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: 'Bearer ' + token, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function ownMenus(token) {
  const list = await call(token, `${API}/richmenu/list`);
  return (list.richmenus || []).filter((m) => m.name === MENU_NAME);
}

async function rollback(token) {
  await call(token, `${API}/user/all/richmenu`, { method: 'DELETE' }).catch((e) => console.warn('cancel default:', e.message));
  for (const m of await ownMenus(token)) {
    await call(token, `${API}/richmenu/${encodeURIComponent(m.richMenuId)}`, { method: 'DELETE' });
    console.log('deleted', m.richMenuId);
  }
  console.log('rollback done — เมนูจาก LINE OA Manager จะกลับมาแสดง (ถ้าเปิดไว้)');
}

async function main(argv, env) {
  const menu = buildMenu();
  if (argv.includes('--dry-run')) {
    console.log(JSON.stringify(menu, null, 2));
    return;
  }
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  if (argv.includes('--rollback')) return rollback(token);

  const image = loadImage();
  const previous = await ownMenus(token);
  const created = await call(token, `${API}/richmenu`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(menu)
  });
  const id = created.richMenuId;
  console.log('created', id);
  try {
    await call(token, `${DATA_API}/richmenu/${encodeURIComponent(id)}/content`, {
      method: 'POST', headers: { 'Content-Type': image.type }, body: image.buf
    });
    await call(token, `${API}/user/all/richmenu/${encodeURIComponent(id)}`, { method: 'POST' });
  } catch (error) {
    await call(token, `${API}/richmenu/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    throw new Error(`${error.message} (deleted unfinished menu ${id})`);
  }
  console.log('default rich menu set:', id);
  for (const m of previous) {
    await call(token, `${API}/richmenu/${encodeURIComponent(m.richMenuId)}`, { method: 'DELETE' });
    console.log('deleted old', m.richMenuId);
  }
  console.log('\nเสร็จแล้ว: ปิดเมนูใน LINE OA Manager, ลบ token ออกจากเชลล์ แล้วกด Reissue token ที่ LINE Developers');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
