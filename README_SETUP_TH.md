# DashboardWaterResources v1.4.6 — LocalAuthority v1.2 Candidate

สถานะ: **Candidate — ยังไม่ Deploy Production จนกว่าจะทดสอบ Form/Sheet/Sync integration จริง**

## สิ่งที่เปลี่ยนจาก v1.4.0

- ใช้ policy เดียวกับ `KebNamComplete LocalAuthority v1.2`
- แยก `recommendedAuthority` ออกจาก `resolvedLocalAuthority`
- `SUGGEST`: ผู้กรอกแก้ค่าแนะนำเป็น อปท. อื่นใน master ของตำบลเดียวกันได้ และ Dashboard ต้องเคารพค่าที่บันทึกจริง
- `SELECT`: พื้นที่ exact หลาย อปท. ต้องใช้ explicit field จาก exact options เท่านั้น
- `TAMBON_ONLY`: ไม่รับ LocalAuthority
- ข้อมูลเก่า exact เดียวใช้ `legacy-inferred` ชั่วคราว
- ค่า explicit ที่ผิดไม่ถูกเปลี่ยนเป็น legacy blank ระหว่าง Netlify normalization
- Dropdown อปท. ยังซ่อน authority ที่ resolved count = 0
- ไม่มี `ต้องยืนยันเขต อปท.` ใน UI
- Cascading Moo ใช้ authority options ที่ valid ตาม policy v1.2
- GAS sync helper รองรับคอลัมน์ `LocalAuthority` แบบ optional และยังเป็น read-only
- Strict autocomplete 29 ตำบล, Netlify Blob 11.0.1, IndexedDB cache เดิมยังคงอยู่

## Contracts

- Exact mapping: `docs/AUTHORITY_MAPPING_CONTRACT.json`
- v1.2 policy: `docs/LOCALAUTHORITY_POLICY_CONTRACT.json`
- รายละเอียดภาษาไทย: `docs/AREA_RESPONSIBILITY_RULES_TH.md`

## Test suite

```text
node tests/area_responsibility_test.mjs
python tests/static_integrity_test.py
node tests/netlify_function_test.mjs
python tests/playwright_dashboard_test.py
python tests/playwright_cache_logic_test.py
```

ดูผลล่าสุดใน `docs/TEST_REPORT.md`

## Production gate

```text
KebNamComplete v1.2 กรอกจริงผ่าน
→ Sheet Y = LocalAuthority ถูกต้อง
→ ใช้ GAS sync v1.4.6
→ manual sync
→ ตรวจ /api/waterresources ว่า localAuthority มาครบ
→ ตรวจ Dashboard counts / KPI / Table / Map
→ ค่อย Deploy Production
```


## File Mode (ดับเบิลคลิกได้)

```text
index.html  → site/index.html → Production read API
maeka.html  → site/maeka.html → Production read API → filter แม่กา
```

ไม่ต้องรัน `npm`, `netlify dev` หรือ Cloudflare เพื่อเปิดดูข้อมูลผ่านไฟล์ในเครื่อง
เมื่อเปิดด้วย `file://` ระบบจะใช้ `site/assets/runtime-config.js` เพื่อชี้ไปยัง Production Netlify read API และ fallback เป็น IndexedDB/Bootstrap หาก API ใช้ไม่ได้

ค่าเริ่มต้น Production origin: `https://dashboard-waterresources.netlify.app`
หากชื่อ Netlify Production เปลี่ยน ให้แก้เพียง `DEFAULT_PRODUCTION_ORIGIN` ใน `site/assets/runtime-config.js` จุดเดียว

CORS เปิดเฉพาะ read endpoints (`/api/waterresources`, `/api/waterresources/version`) ส่วน `/api/waterresources/sync` ยังคงใช้ Bearer Secret และไม่ได้เปิด CORS เพิ่ม


## v1.4.8 — เปิดไฟล์ตรงจาก Windows (File Mode)

หลัง Deploy v1.4.8 ขึ้น Netlify อย่างน้อยหนึ่งครั้ง สามารถดับเบิลคลิก `index.html` หรือ `maeka.html` ได้โดยไม่ต้องเปิด Netlify Dev/Cloudflare Tunnel

File Mode ใช้ลำดับการอ่านข้อมูล: Production JSON API (CORS) → read-only script bridge → IndexedDB cache → bootstrap ในไฟล์

ถ้าเห็นป้าย `ข้อมูลสำรอง ... รายการ` แปลว่าไฟล์เชื่อม Production ไม่สำเร็จและยังไม่ควรใช้ตัวกรอง อปท. เป็นข้อมูลล่าสุด

Production origin เริ่มต้น: `https://dashboard-waterresources.netlify.app`

## v1.4.8 — แก้ Production origin สำหรับ File Mode

ค่า Production Netlify ที่ยืนยันแล้ว: `https://dashboard-waterresources.netlify.app`

เมื่อเปิด `index.html` / `maeka.html` ด้วย `file://` ระบบจะเรียก read API และ file bridge จากโดเมนนี้โดยตรง ก่อน fallback ไป cache/bootstrap.
