# DashboardWaterResources — FINAL 29 ตำบล + Strict Autocomplete + Netlify Blob Cache

เวอร์ชันนี้โฟกัส `index.html` และใช้สถาปัตยกรรม Cache เดิม โดยปรับระบบกรองพื้นที่ให้ครบ 29 ตำบล และเปลี่ยนตัวกรอง **ตำบล** จาก `<select>` เป็นช่องค้นหาแบบ Custom Autocomplete ที่รับได้เฉพาะค่าจาก Master List เท่านั้น

โครงสร้างการกรองหลัก:

`อปท./เทศบาล → ตำบล (Autocomplete) → หมู่ → หมู่บ้าน`

ชื่อมาตรฐานของตำบลตามคำยืนยันล่าสุดคือ **บ้านปิน**

## พฤติกรรมช่องตำบล

ใช้ Custom Combobox ทั้ง 3 จุด:

1. บทสรุปผู้บริหาร (`efTambon`)
2. หน้ารายละเอียด (`fTambon`)
3. แท็บแหล่งน้ำชำรุด (`dfTambon`)

กติกา:

- กดช่องว่าง ๆ → แสดงรายชื่อตำบลที่เลือกได้
- พิมพ์บางคำ → กรองรายการแนะนำ เช่น `แม่` → แม่กา, แม่นาเรือ, แม่ใส, ...
- ต้องคลิกรายการแนะนำ หรือเลือกด้วย Keyboard (`↑/↓ + Enter`) ก่อนจึงจะถือว่าเป็นค่าที่เลือก
- ข้อความที่พิมพ์เองแต่ไม่ได้เลือกจากรายการ **ไม่ถูกนำไปกรองข้อมูล**
- ถ้าพิมพ์ค่าที่ไม่อนุญาตและออกจากช่อง จะแสดง `กรุณาเลือกตำบลจากรายการที่กำหนด`
- ปุ่ม `×` ล้างตำบล = กลับเป็นทุกตำบล
- เมื่อเลือก อปท. ก่อน รายการตำบลแนะนำจะแคบลงตามขอบเขต อปท. นั้น
- รองรับ Mouse, Touch/Mobile และ Keyboard

## Master List 29 ตำบล

เรียงตามลำดับที่กำหนด:

```text
แม่กา
แม่นาเรือ
แม่ใส
บ้านตุ่น
บ้านสาง
สันป่าม่วง
บ้านต๋อม
บ้านต๊ำ
ท่าจำปี
เทศบาลเมือง
เจริญราษฎร์
แม่ปืม
แม่สุก
ป่าแฝก
บ้านเหล่า
บ้านใหม่
แม่ใจ
ศรีถ้อย
สว่างอารมณ์
บุญเกิด
ดอกคำใต้
ดอนศรีชุม
คือเวียง
บ้านปิน
จำป่าหวาย
บ้านถ้ำ
แม่อิง
สันโค้ง
ดงเจน
```

8 ตำบลที่เพิ่มกลับเข้าจากรอบก่อนหน้า:

`เจริญราษฎร์, แม่ปืม, แม่สุก, ป่าแฝก, บ้านเหล่า, บ้านใหม่, แม่ใจ, ศรีถ้อย`

ทั้ง Browser Master List, Netlify server whitelist และ Google Apps Script sync whitelist ใช้ขอบเขต 29 ตำบลเดียวกัน

## กติกา อปท.

ตัวกรอง อปท. ใช้ ruleset แยกต่างหากจาก Master List ตำบล

- `WaterOwner` ไม่ถูกใช้ตัดสินเขตการปกครอง
- `ดอกคำใต้ หมู่ 1,2` ไม่เดา อปท. เพราะซ้อนกัน
- `ดอนศรีชุม หมู่ 8,9` ไม่เดา อปท. เพราะเป็นเพียงบางส่วนของหมู่
- พื้นที่ที่ตัดสินไม่ได้จากกติกาที่ได้รับจะแสดง `⚠️ ต้องยืนยันเขต อปท.`
- 18 ตำบลชุดเดิมยังกรองตามตำบลได้ตามปกติ แต่หากไม่มี rule อปท. ในโจทย์ชุดนี้ จะไม่ถูกบังคับเดา อปท.

รายละเอียด: `docs/AREA_RESPONSIBILITY_RULES_TH.md`

## บ้านปิน

Canonical/display name คือ `บ้านปิน`

มี compatibility ภายในสำหรับ legacy input ที่อาจสะกด `บ้านปิ่น` เพื่อไม่ให้แถวเดิมหลุดจาก Sync; snapshot ที่ Dashboard ใช้จะ normalize เป็น `บ้านปิน` และ **ไม่มีการเขียนค่ากลับ Google Sheet**

## สถาปัตยกรรม

```text
Google Sheet: WaterResources
        │ READ ONLY โดย Sync helper
        ▼
Google Apps Script
        │ HTTPS + Secret
        ▼
/api/waterresources/sync
        ▼
Netlify Blob
        │ ETag / Cache Version
        ▼
/api/waterresources + /version
        ▼
index.html
        │
        ├─ 29-tambon Master List + Area Rules
        └─ IndexedDB cache ใน browser/mobile
```

ข้อมูลเปลี่ยนไม่ต้อง Deploy `index.html` ใหม่

## โครงสร้างโปรเจกต์

```text
DashboardWaterResources_FINAL_29Tambons_Autocomplete/
├─ site/
│  ├─ index.html
│  ├─ maeka.html
│  ├─ assets/
│  │  ├─ water-data-loader.js
│  │  ├─ area-responsibility.js
│  │  └─ tambon-combobox.js
│  └─ data/
│     ├─ waterresources.initial.json
│     └─ waterresources.initial.meta.json
├─ netlify/
│  ├─ functions/
│  └─ lib/water-store.mjs
├─ google-apps-script/
│  └─ WaterResourcesDashboardSync.gs
├─ docs/
├─ tests/
├─ netlify.toml
└─ package.json
```

ไฟล์ `index.html` และ `maeka.html` ที่ root เป็นสำเนา byte-identical กับใน `site/` เพื่อให้อ่าน/ตรวจง่าย แต่ Netlify publish จาก `site/`

# ขั้นตอน Deploy

## 1. Deploy ทั้งโปรเจกต์ขึ้น Netlify

ใช้ Git + Netlify หรือ Netlify CLI

`netlify.toml` กำหนดไว้แล้ว:

- Publish = `site`
- Functions = `netlify/functions`
- Node = `22.16.0`

ห้าม Deploy เฉพาะ `site/` ด้วย Netlify Drop เพราะ Functions/Blob จะไม่ถูก Deploy

## 2. ตั้ง Netlify Environment Variable

สร้าง:

```text
WATER_SYNC_SECRET=<secret อย่างน้อย 24 ตัวอักษร>
```

Secret ต้องไม่อยู่ใน `index.html` หรือ public JavaScript

ถ้ามี Secret จากระบบ Cache เดิมและยังถือว่าเป็นความลับ สามารถใช้ค่าเดิมได้

## 3. เพิ่ม Sync helper ใน Google Apps Script

นำไฟล์นี้ไปเพิ่ม/แทนที่ใน Apps Script โปรเจกต์ WaterResources:

```text
google-apps-script/WaterResourcesDashboardSync.gs
```

ไฟล์นี้อ่าน `WaterResources` เพื่อสร้าง snapshot เท่านั้น ไม่เขียน/แก้/ลบข้อมูลใน Sheet

## 4. ตั้ง Script Properties

```text
WATER_DASHBOARD_SYNC_URL=https://YOUR-SITE.netlify.app/api/waterresources/sync
WATER_DASHBOARD_SYNC_SECRET=<ค่าเดียวกับ WATER_SYNC_SECRET ใน Netlify>
```

## 5. Initial Sync — ต้องทำหลัง Deploy เวอร์ชันนี้

Run:

```javascript
syncWaterResourcesToDashboard()
```

เหตุผล: Blob เดิมจาก build ก่อนหน้าอาจมี whitelist แค่ 21 ตำบล จึงต้องสร้าง snapshot ใหม่ที่รองรับ 29 ตำบล

หลังสำเร็จ ตรวจ:

```text
https://YOUR-SITE.netlify.app/api/waterresources/version
```

ควรได้ `success: true`, `initialized: true`, มี `version` และ `count`

แล้วตรวจ:

```text
https://YOUR-SITE.netlify.app/api/waterresources
```

ควรได้ dataset ล่าสุดจาก Blob

## 6. Safety Trigger

ถ้ายังไม่เคยติดตั้ง ให้ Run ครั้งเดียว:

```javascript
installWaterDashboardSyncSafetyTriggers()
```

สร้าง:

- installable `onEdit` สำหรับการแก้ชีตด้วยมือ
- hourly reconciliation สำหรับตรวจทานกรณีมี write path ที่ไม่ได้เรียก hook

## 7. Hook หลัง Add / Edit / Delete

ถ้าระบบหลักยังไม่มี hook ให้เพิ่มหลังการเปลี่ยน `WaterResources` สำเร็จ:

```javascript
trySyncWaterResourcesDashboard_();
```

ตัวอย่างหลังเพิ่ม:

```javascript
sheet.appendRow(rowData);
trySyncWaterResourcesDashboard_();
```

หลังแก้:

```javascript
sheet.getRange(...).setValues([rowData]);
trySyncWaterResourcesDashboard_();
```

หลังลบ:

```javascript
sheet.deleteRow(...);
trySyncWaterResourcesDashboard_();
```

ห้ามวางก่อนคำสั่งเขียนข้อมูลหลัก

## 8. ตรวจหน้าเว็บหลัง Initial Sync

ทดสอบอย่างน้อย:

1. เปิดช่องตำบลโดยยังไม่เลือก อปท. → ต้องมี 29 รายการ
2. พิมพ์ `แม่` → ต้องได้เฉพาะรายชื่อที่มี `แม่`
3. พิมพ์ข้อความปลอมแล้วออกจากช่อง → ต้องขึ้น validation และข้อมูลต้องไม่ถูกกรองด้วยข้อความปลอม
4. เลือก `แม่สุก` จากรายการ → Dashboard ต้องกรองแม่สุก
5. เลือก `ทม.ดอกคำใต้` → รายการตำบลต้องเหลือ `สว่างอารมณ์, บุญเกิด, ดอกคำใต้, ดอนศรีชุม`
6. `อบต.บ้านปิน` → ต้องมี `บ้านปิน`
7. ตรวจมือถือด้วย Chrome/Safari/Browser ที่ใช้งานจริง

# Cache ฝั่ง Browser/Mobile

```text
เปิด index.html
    ↓
อ่าน IndexedDB
    ↓
GET /api/waterresources/version
    ↓
Version เท่าเดิม → ใช้ IndexedDB
Version เปลี่ยน   → โหลด dataset ใหม่ → เก็บ IndexedDB
```

Fallback:

```text
API ล่ม + มี IndexedDB → ใช้ข้อมูลล่าสุดในเครื่อง
API ล่ม + ไม่มี Cache  → ใช้ waterresources.initial.json
```

`waterresources.initial.json` ยังเป็น bootstrap snapshot 1,158 รายการ/10 ตำบลเดิม เพื่อความปลอดภัยเมื่อ API ยังไม่พร้อม ดังนั้น **Initial Sync หลัง Deploy เป็นขั้นตอนบังคับ** เพื่อให้ runtime Blob ใช้ข้อมูล Sheet ปัจจุบันครบ 29 ตำบล

# ความปลอดภัยของ Google Sheet

`WaterResourcesDashboardSync.gs` ถูกตรวจไม่ให้มีคำสั่งเขียน Sheet เช่น:

- `setValue`
- `setValues`
- `appendRow`
- `deleteRow`
- `clearContent`

หน้าที่ของไฟล์นี้คืออ่าน snapshot และส่งไป Netlify เท่านั้น

# การทดสอบ

Final build ตรวจด้วย:

- Node unit test: Master List 29 ตำบล + กติกาเขต อปท.
- Static/source integrity test
- Netlify Function + in-memory Blob test
- Playwright Desktop functional/validation/keyboard test
- Playwright Mobile 390×844 + touch selection + overflow test
- Playwright Cache/IndexedDB 5 สถานการณ์
- JavaScript syntax checks

ผล: `docs/TEST_REPORT.md`
