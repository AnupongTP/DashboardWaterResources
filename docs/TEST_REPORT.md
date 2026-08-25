# FINAL TEST REPORT — DashboardWaterResources

Build: `FINAL 29 Tambons + Strict Autocomplete + Netlify Blob Cache`
Ruleset: `2026-08-25.2`
ทดสอบวันที่: 2026-08-25 (Asia/Bangkok)

## สรุป

ผลรวม: **PASS**

- Area responsibility unit test: PASS
- Static/source integrity: PASS
- Netlify Function + Blob behavior (in-memory mock): PASS
- Playwright Dashboard functional test — Chromium Desktop: PASS
- Playwright responsive/touch test — 390×844 Mobile: PASS
- Playwright Cache/IndexedDB logic: PASS
- JavaScript syntax check: PASS

Google Sheet ไม่ถูกแก้ไขระหว่างการพัฒนา/ทดสอบ

## Playwright — Dashboard/UI

ใช้ bootstrap จริง 1,158 รายการ + synthetic test records 24 รายการ รวม 1,182 รายการใน test fixture เท่านั้น

ผ่าน 19 กรณี:

1. ตัวกรองตำบลทั้ง Executive / Detail / Damaged เป็น Custom Combobox ไม่ใช่ `<select>`
2. Master List แสดงครบ 29 ตำบลตามลำดับที่กำหนด
3. พิมพ์ `แม่` แล้วรายการแนะนำถูกกรองจาก Master List
4. Free text ที่ไม่ได้เลือกจากรายการถูก reject และไม่กลายเป็น filter state
5. เลือก suggestion จริงแล้ว filter ถูกนำไปใช้
6. เลือก `ทม.ดอกคำใต้` แล้ว suggestion ตำบลเหลือเฉพาะ 4 ตำบลใน scope
7. พิมพ์ตำบลนอก scope อปท. แล้วเลือกไม่ได้
8. Detail cascade `อบต.แม่อิง → แม่อิง → หมู่ 4,5,6,8`
9. `อบต.บ้านปิน → บ้านปิน` ทำงานด้วยชื่อมาตรฐาน
10. ดอกคำใต้ หมู่ 1,2 แสดงในตัวกรองหมู่แต่ disabled พร้อม “ต้องยืนยันเขต”
11. ดอนศรีชุม หมู่ 8,9 แสดงแต่ disabled พร้อม “ต้องยืนยันเขต”
12. ทต.ดงเจนแสดงชื่อหมู่บ้านคู่เลขหมู่ตามโจทย์
13. bucket `⚠️ ต้องยืนยันเขต อปท.` เก็บเฉพาะกรณี ambiguous/unresolved ของพื้นที่ที่มี brief อปท.
14. 8 ตำบลที่เคยตกจาก whitelist รอบ 21 ตำบลกลับมาเลือกได้ครบ
15. แท็บแหล่งน้ำชำรุดใช้ strict combobox และ state แยกจากหน้ารายละเอียด
16. Reset คืนข้อมูลทั้งหมดและล้าง combobox state/validation
17. Keyboard `ArrowDown + Enter` เลือกค่าจาก allow-list ได้
18. Desktop ไม่มี uncaught page error
19. Mobile 390×844 เลือก suggestion ด้วย touch ได้และไม่มี horizontal overflow

Screenshots:

- `tests/screenshots/desktop-autocomplete-open-final.png`
- `tests/screenshots/desktop-29tambons-autocomplete-final.png`
- `tests/screenshots/mobile-autocomplete-open-final.png`
- `tests/screenshots/mobile-29tambons-autocomplete-final.png`

## Strict autocomplete behavior

ค่าที่พิมพ์ใน input และค่าที่ใช้ filter ถูกแยกกัน:

```text
input text ≠ selectedTambon
```

เมื่อผู้ใช้พิมพ์แก้ข้อความ ระบบล้าง selected value เดิมทันที ข้อมูลจะไม่ถูกกรองด้วยข้อความใหม่จนกว่าจะเลือก suggestion ด้วย click/touch/keyboard

ถ้า blur ออกจากช่องทั้งที่ยังมีข้อความที่ไม่ได้เลือก จะแสดง validation error

## Netlify Functions / Blob behavior

ทดสอบด้วย in-memory Blob mock เพื่อไม่แตะ Netlify account จริง

ผ่าน 9 กรณี:

1. Sync ไม่มี/ผิด Secret → 401
2. Content-Type ไม่ใช่ JSON → 415
3. whitelist ฝั่ง server มี exact 29 ตำบล
4. authorized sync รับครบ 29 ตำบล + normalize alias + ตัด out-of-scope
5. Dataset เหมือนเดิม → Version ไม่เปลี่ยน
6. Dataset เปลี่ยน → Version เปลี่ยน
7. Version endpoint คืน metadata ล่าสุด
8. Dataset endpoint รองรับ ETag / `304 Not Modified`
9. Read endpoints ปฏิเสธ HTTP method ที่ไม่รองรับ

ผลละเอียด: `tests/netlify-function-results.json`

## Playwright — Cache/IndexedDB

ผ่าน 5 กรณี:

1. Cold load → โหลด dataset จาก Netlify API และเขียน IndexedDB
2. Version เดิม → ใช้ IndexedDB โดยไม่ request dataset ซ้ำ
3. Version ใหม่ → โหลด dataset ใหม่และอัปเดต IndexedDB
4. API offline + มี cache → ใช้ warm cache
5. API offline + ไม่มี cache → ใช้ static bootstrap

ผลละเอียด: `tests/playwright-cache-results.json`

## Area responsibility rules

Node unit test ตรวจ:

- Master List exact 29 ตำบล
- 18 original/config tambons + 11 authority-brief tambons
- 10 อปท./เทศบาลตามโจทย์
- exact moo lists ของพื้นที่แบ่งตามหมู่
- ดอกคำใต้ หมู่ 1,2 = ambiguous
- ดอนศรีชุม หมู่ 8,9 = partial/ambiguous
- แม่อิงแบ่งระหว่าง อบต.แม่อิง และ ทต.ดงเจน
- ดงเจน 12 หมู่ตามรายการ
- canonical/display name = `บ้านปิน`
- WaterOwner ไม่ถูกใช้เดาเขต
- 8 ตำบลที่เพิ่มกลับไม่มีการเดา authority โดยไม่มีหลักฐาน

## Static integrity / Safety

ตรวจว่า:

- `site/index.html` และ root `index.html` byte-identical
- `site/maeka.html` และ root `maeka.html` byte-identical
- `maeka.html` ยังตรง SHA-256 ของ build ก่อนหน้า
- `water-data-loader.js` ยังตรง SHA-256 ของ build Cache ที่ validate แล้ว
- `index.html` โหลด `tambon-combobox.js`
- ไม่มี `<select id="efTambon">`, `<select id="fTambon">`, `<select id="dfTambon">`
- Browser master list, Netlify whitelist และ Apps Script whitelist มี 29 ตำบล
- Google Apps Script Sync ไม่มี `setValue`, `setValues`, `appendRow`, `deleteRow`, `clearContent`
- Netlify publish directory = `site`
- Functions directory = `netlify/functions`
- user-facing `index.html` ใช้ `บ้านปิน`

## ข้อจำกัดที่ตั้งใจไว้

กรณี “บางส่วนของหมู่” ยังไม่สามารถตัดสินจุดแหล่งน้ำเป็น อปท. ใดได้จาก `Tambon + Moo` เพียงอย่างเดียว จึงถูกแยกไว้ใน `⚠️ ต้องยืนยันเขต อปท.` โดยเจตนา

การระบุให้แม่นยำกว่านี้ต้องมี Polygon เขต อปท. หรือฟิลด์ LocalAuthority ที่ได้รับการยืนยัน
