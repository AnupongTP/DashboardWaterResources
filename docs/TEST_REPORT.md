# TEST REPORT — DashboardWaterResources v1.4.8 File Mode Hardened Candidate

สถานะ: **Candidate — ต้อง Deploy v1.4.8 ขึ้น Netlify อย่างน้อย 1 ครั้งก่อนการดับเบิลคลิกไฟล์จะเข้าถึง live Production ผ่าน script bridge ได้**

## เป้าหมาย

แก้กรณีดับเบิลคลิก `index.html`/`maeka.html` แล้ว browser เปิด `file://` แต่ CORS ของ Production API ใช้งานไม่ได้ จนระบบ fallback ไป bootstrap 1,158 รายการและตัวกรอง อปท. ไม่มีรายการจริง

## Data path ใหม่สำหรับ file://

1. Production JSON API ผ่าน CORS
2. ถ้า fetch ถูกบล็อก → GET-only script bridge `/api/waterresources/file-bridge`
3. ถ้า Production ใช้ไม่ได้ → IndexedDB cache ที่ตรงกับ Production origin
4. ถ้ายังไม่มี → local bootstrap

เมื่อใช้ local bootstrap หน้าหลักจะแสดง `ข้อมูลสำรอง ... รายการ` อย่างชัดเจน ไม่แสดงเสมือนเป็นข้อมูล Production ล่าสุด

## Security

- Script bridge เป็น GET/HEAD เท่านั้น
- callback ต้องผ่าน allowlist identifier regex
- ไม่มี secret ใน browser
- `/api/waterresources/sync` ยังเป็น POST + Bearer secret และไม่ได้เปิด CORS
- JSON read API เดิมยังเป็น read-only

## Automated tests

- `area_responsibility_test.mjs` — PASS
- `gas_sync_contract_test.mjs` — PASS
- `static_integrity_test.py` — PASS
- `netlify_function_test.mjs` — PASS, 12 tests
- `playwright_cache_logic_test.py` — PASS, 5/5
- `playwright_dashboard_test.py` — PASS, 23/23
- `mobile_responsive_audit_test.py` — PASS, 27 checks ที่ 360/390/412 px
- `file_mode_test.py` — PASS, 5 tests
  - live CORS API
  - CORS fetch fail → script bridge live data
  - Mae Ka adapter
  - offline bootstrap fallback
  - root double-click launchers

## Manual Windows gate

CI browser ถูก policy จำกัด `file://` navigation จึงยังต้อง UAT บน Windows จริงหลัง Deploy:

1. Deploy candidate ไป Netlify
2. ดับเบิลคลิก root `index.html`
3. ตัวเลขต้องเป็นข้อมูล Production ล่าสุด ไม่ใช่ 1,158 bootstrap
4. Dropdown อปท. ต้องมี Active Authorities จาก dataset จริง
5. ดับเบิลคลิก `maeka.html` และตรวจจำนวนแม่กา
6. ปิดอินเทอร์เน็ตเพื่อยืนยันว่าป้าย `ข้อมูลสำรอง`/cache fallback ไม่ทำให้ผู้ใช้เข้าใจว่าเป็น live data

Production origin ที่ตั้งใน candidate: `https://dashboard-waterresources.netlify.app`
