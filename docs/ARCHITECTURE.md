# Architecture

```text
Google Sheet: WaterResources
        │
        │ read-only full snapshot when sync runs
        ▼
Google Apps Script
WaterResourcesDashboardSync.gs
        │  จำกัด scope = 29 ตำบล + normalize alias
        │  HTTPS POST + Bearer secret
        ▼
/api/waterresources/sync
Netlify Function
        │  validate/normalize ซ้ำฝั่ง server
        ▼
Netlify Blob
store: water-resources-cache
key: dataset
        │
        ├─ ETag = Cache Version
        └─ metadata = hash/count/bytes/update time
        │
        ├──────────────────────────┐
        ▼                          ▼
/api/waterresources/version   /api/waterresources
        │                          │
        └────────────┬─────────────┘
                     ▼
                 index.html
                     │
      ┌──────────────┴──────────────┐
      ▼                             ▼
area-responsibility.js       tambon-combobox.js
29-tambon master list        strict allow-list UI
อปท. → ตำบล → หมู่          keyboard/touch/mouse
      │                             │
      └──────────────┬──────────────┘
                     ▼
                  IndexedDB
```

## Source of truth

Google Sheet เป็น Source of Truth ของข้อมูลแหล่งน้ำ ส่วน Netlify Blob เป็น read-optimized snapshot สำหรับ Dashboard

กติกาเขต อปท. และ Master List 29 ตำบลอยู่ใน `site/assets/area-responsibility.js` และไม่ได้เขียนกลับ Sheet

## UI validation boundary

`site/assets/tambon-combobox.js` ป้องกันไม่ให้ free text กลายเป็น filter value โดยตรง ตัว state ของ Dashboard จะได้รับค่าตำบลเฉพาะเมื่อผู้ใช้เลือกค่าจาก allow-list ผ่าน click/touch/keyboard เท่านั้น

Server side ยัง validate ซ้ำด้วย `ALLOWED_TAMBONS` ใน `netlify/lib/water-store.mjs` ดังนั้นแม้มี payload ผิดจาก client/sync ก็ไม่ถูกเก็บลง Blob

## Versioning

ใช้ Netlify Blob ETag เป็น Cache Version และเก็บ SHA-256 ของ normalized dataset ใน metadata หาก Sync ข้อมูลเดิมซ้ำจะไม่เปลี่ยน Blob/Version

## Failure behavior

1. API ใช้งานได้ + Version เดิม → IndexedDB
2. API ใช้งานได้ + Version ใหม่ → โหลด dataset ใหม่และเขียน IndexedDB
3. API ล่ม + มี IndexedDB → ใช้ cache ล่าสุด
4. API ล่ม + ไม่มี IndexedDB → static bootstrap JSON

## Administrative boundary safety

กรณีเขตซ้อน/บางส่วนของหมู่จะไม่อนุมานจาก `WaterOwner`; ระบบติดสถานะ unresolved จนกว่าจะมี polygon หรือข้อมูลยืนยันเขต
