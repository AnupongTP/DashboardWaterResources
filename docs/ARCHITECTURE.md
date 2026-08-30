# Architecture — DashboardWaterResources v1.4.6 Candidate

```text
Google Sheet: WaterResources
        │
        │ optional Y: LocalAuthority
        ▼
Google Apps Script
WaterResourcesDashboardSync.gs
        │ read-only snapshot
        │ localAuthority optional/backward-compatible
        ▼
/api/waterresources/sync
Netlify Function
        │ normalize 29 tambons
        │ preserve raw LocalAuthority
        ▼
Netlify Blob
store: water-resources-cache
key: dataset
        │
        ├─ /api/waterresources/version
        └─ /api/waterresources
                     │
                     ▼
               water-data-loader.js
                     │
                IndexedDB cache
                     │
                     ▼
             area-responsibility.js
                     │
        policy: KebNamComplete v1.2
                     │
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
     SELECT        SUGGEST      TAMBON_ONLY
 exact >1        exact =1       exact =0
        │            │             │
 explicit exact   explicit may     no authority
 options only     override within  accepted
                  same tambon
        └────────────┼─────────────┘
                     ▼
            resolvedLocalAuthority
                     │
     ┌───────────────┼────────────────┐
     ▼               ▼                ▼
Executive         Detail           Damaged
KPI/Map           Table/Map        Table/Map
```

## Data contract

`localAuthority` เป็น optional field เพื่อรองรับช่วงเปลี่ยนผ่าน

```json
{
  "tambon": "ดอกคำใต้",
  "moo": 3,
  "localAuthority": "ทม.ดอกคำใต้"
}
```

Netlify เก็บค่าดิบที่ sync เข้ามาไว้ ไม่ silently เปลี่ยนค่าที่ไม่รู้จักเป็น `null` เพราะ Browser ต้องแยกให้ได้ระหว่าง:

- field ว่างจริง = legacy record
- field มีแต่ผิด = invalid explicit record

## Resolver fields

หลัง decorate record จะมีแนวคิดแยกกัน:

```text
localAuthorityRaw          ค่าเดิมจาก dataset
recommendedAuthority      ค่าแนะนำจาก exact Tambon+Moo
resolvedLocalAuthority     ค่าใช้จริงหลัง policy validation
localAuthority             alias สำหรับ UI ปัจจุบัน = resolvedLocalAuthority
authorityConfidence        explicit-field / explicit-override / legacy-inferred / ...
authorityMode              SELECT / SUGGEST / TAMBON_ONLY
```

## Legacy transition

ข้อมูลเก่าที่ไม่มี `LocalAuthority`:

- exact = 1 → `legacy-inferred`
- exact > 1 → unassigned
- exact = 0 → unassigned

Fallback นี้มีไว้เพื่อรักษาความต่อเนื่องของ Dashboard จนกว่าจะ backfill ข้อมูลเก่า ไม่ถือว่าเป็น explicit confirmation

## Authority safety

- `WaterOwner` ไม่ถูกใช้เป็น jurisdiction
- cross-tambon explicit authority ถูก reject จาก authority counts
- explicit authority บน TAMBON_ONLY ถูก reject
- 1 record match ได้สูงสุด 1 authority
- invalid/unassigned record ยังอยู่ใน dataset และยังกรองด้วย Tambon ได้
- ไม่มี unresolved warning/bucket ใน UI

## Active authority UI

```text
full loaded dataset
→ resolve every record
→ count resolvedLocalAuthority
→ count > 0 = show authority
→ count = 0 = hide authority
```

รายการนี้ไม่ขึ้นกับ filter ประเภท/ปัญหา/ตำบลที่ผู้ใช้กำลังเลือก

## GAS integration

`WaterResourcesDashboardSync.gs` ใน v1.4.6 ถูกเตรียมให้รองรับ `LocalAuthority` แบบ optional แล้ว:

- ถ้ายังไม่มีคอลัมน์ `LocalAuthority` → sync เดิมยังทำงาน
- ถ้ามีคอลัมน์ → ส่ง `localAuthority`
- helper อ่าน Sheet เท่านั้น ไม่มีการเขียนกลับ
- ไม่มี hard cap 24 columns แบบเดิม

## Cache

IndexedDB เป็น object cache จึงเก็บ `localAuthority` ได้โดยไม่ bump DB schema; dataset version/ETag เป็นตัวควบคุม refresh


## Runtime modes v1.4.6

```text
Hosted Netlify   → relative /api/*
Netlify Dev      → relative /api/* (local Blob sandbox)
file://          → configured Production Netlify read API
                  ↓ fail
                  IndexedDB cache
                  ↓ fail
                  waterresources.initial.js bootstrap
```

`runtime-config.js` เป็นจุดเดียวที่กำหนด Production origin สำหรับ file mode.
Root `index.html` และ `maeka.html` เป็น launcher ไปยังไฟล์จริงใน `/site` เพื่อให้ asset path ทำงานเหมือนกันทั้ง file mode และ Netlify publish.
`maeka.html` ไม่ใช้ dataset ฝังแบบคงที่อีกต่อไป แต่ใช้ `WaterData.load()` แล้ว map/filter เฉพาะ `tambon=แม่กา`.
