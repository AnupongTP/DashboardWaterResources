# TEST REPORT — DashboardWaterResources v1.4.3 Candidate

วันที่ทดสอบ: 2026-08-27  
Ruleset: `2026-08-27.2`  
Policy: `KebNamComplete-LocalAuthority-v1.2`  
สถานะ: **PASS — Candidate only, ยังไม่ใช่ Production approval**

## 1. KebNamComplete v1.2 parity

ตรวจเทียบ 3 แหล่งโดยตรง:

1. `KebNamComplete_LocalAuthority_v1.2/code.js` — server rules/resolver
2. `KebNamComplete_LocalAuthority_v1.2/scripts.html` — client fallback rules
3. Dashboard `docs/AUTHORITY_MAPPING_CONTRACT.json` + `area-responsibility.js`

ผล:

- exact mapping ตรงกันทั้ง 3 แหล่ง: **PASS**
- exact mapping combinations: **47**
- server resolver parity sweep: **6,960 cases PASS**
- ครอบคลุม 29 ตำบล × หมู่ 1–20 × blank/10 master authorities/invalid authority

ตรวจ semantics:

- `SELECT`: exact > 1 → explicit ต้องอยู่ใน exact options: **PASS**
- `SUGGEST`: exact = 1 → ค่าแนะนำเปลี่ยนเป็น authority อื่นใน master ของตำบลเดียวกันได้: **PASS**
- `TAMBON_ONLY`: exact = 0 → explicit LocalAuthority ถูก reject: **PASS**
- cross-tambon explicit authority ถูก reject: **PASS**
- `WaterOwner` ไม่ถูกใช้ resolve jurisdiction: **PASS**

ผล machine-readable: `tests/kebnam-v12-parity-results.json`

## 2. Area responsibility unit tests

Command:

```text
node tests/area_responsibility_test.mjs
```

ผล: **PASS**

ครอบคลุม:

- Master 29 ตำบล / 10 authorities
- canonical `บ้านปิน`
- 47 exact mapping combinations
- 4 exact-overlap cases
- recommendedAuthority
- validAuthoritiesFor
- validConfiguredMoos
- explicit SELECT
- explicit SUGGEST override
- invalid cross-tambon
- invalid TAMBON_ONLY
- legacy fallback
- ambiguous legacy unassigned
- raw field preservation after decorate/redecorate
- active authority counts
- one-record/one-authority invariant
- internal resolution statistics

## 3. Google Apps Script sync contract

Command:

```text
node tests/gas_sync_contract_test.mjs
```

ผล: **PASS**

ตรวจแล้ว:

- Sheet เดิม 24 columns ยัง sync ได้
- Sheet ใหม่ 25 columns อ่าน `LocalAuthority` ได้
- ค่า LocalAuthority ถูก preserve exact รวมถึงค่าผิดเพื่อให้ Dashboard ตรวจ invalid explicit ได้
- blank LocalAuthority → `null`
- alias `บ้านปิ่น → บ้านปิน`
- alias `เทศบาลเมืองพะเยา → เทศบาลเมือง`
- trailing unrelated column ไม่ถูกส่งออก
- helper ไม่มีการเขียนข้อมูลกลับ Sheet
- ยกเลิก hard cap `24 columns` แบบเดิมและใช้ header-driven read

## 4. Netlify functions

Command:

```text
node tests/netlify_function_test.mjs
```

ผล: **10/10 PASS**

- unauthorized sync 401
- reject non-JSON
- exact 29-tambon scope
- raw LocalAuthority preservation
- idempotent version
- version changes only when dataset changes
- version endpoint
- dataset ETag / 304
- local Blob fallback version
- wrong methods rejected

จุดสำคัญ v1.4.3: Netlify **ไม่ silently แปลง invalid LocalAuthority เป็น null** เพราะจะทำให้ Dashboard เข้าใจผิดว่าเป็น legacy blank record แล้ว fallback ผิดเขตได้

## 5. Browser / Dashboard end-to-end tests

Command:

```text
python tests/playwright_dashboard_test.py
```

ผล: **23/23 PASS**

Test dataset:

- static bootstrap เดิม: 1,158 records
- synthetic authority fixtures: 35 records
- รวม: 1,193 records

กรณีสำคัญที่ผ่าน:

- strict autocomplete 29 ตำบล
- zero-count authority hidden
- authority → tambon cascade
- v1.2 authority → tambon → moo cascade
- `ดอกคำใต้ ม.1` legacy ambiguous ไม่ถูก assign
- `ดอกคำใต้ ม.2` explicit SELECT ถูก assign
- `ดอกคำใต้ ม.7` explicit override ไป `อบต.ดอกคำใต้` ถูกยอมรับ
- `ดอกคำใต้ ม.3` explicit override ไป `ทม.ดอกคำใต้` ถูกยอมรับ
- `ดอนศรีชุม ม.4` explicit override ไป `ทม.ดอกคำใต้` ถูกยอมรับ
- cross-tambon explicit invalid ไม่ถูกนับ
- ไม่มี unresolved warning/bucket ใน UI
- KPI/Table filter pipeline ไม่ double-count authority
- damaged tab independent filter state
- reset / keyboard / mobile behavior
- desktop ไม่มี uncaught page errors
- authority → tambon dropdown แสดงขอบเขตหมู่ด้วยภาษาง่าย โดย value ตำบลไม่เปลี่ยน
- mobile ไม่มี horizontal overflow


## 5A. Authority → Tambon scope labels

เพิ่ม metadata ใน dropdown ตำบลเฉพาะเมื่อเลือก อปท. โดย **ไม่เปลี่ยน value ของตำบล**:

- `สว่างอารมณ์` → แสดงเฉพาะชื่อตำบล (ไม่ต่อท้าย `ทุกหมู่`)
- `บุญเกิด` → แสดงเฉพาะชื่อตำบล (ไม่ต่อท้าย `ทุกหมู่`)
- `ดอกคำใต้` ภายใต้ `ทม.ดอกคำใต้` → `ม.1, 2, 7`
- `ดอนศรีชุม` ภายใต้ `ทม.ดอกคำใต้` → `ม.1, 5, 7, 10 ทั้งหมู่ · ม.8, 9 บางพื้นที่`
- mobile แสดงเป็นสองบรรทัดเมื่อพื้นที่แคบ
- input หลังเลือกยังเก็บ/แสดงเฉพาะชื่อตำบล เช่น `ดอนศรีชุม`

ผล unit + browser assertions: **PASS**

## 6. IndexedDB/cache tests

Command:

```text
python tests/playwright_cache_logic_test.py
```

ผล: **5/5 PASS**

- cold network load
- warm cache same version
- version change refresh
- valid + invalid raw LocalAuthority preserved through cache
- offline warm cache
- cold offline static bootstrap

## 7. Static/integrity tests

Command:

```text
python tests/static_integrity_test.py
```

ผล: **PASS**

ตรวจ:

- package/build version = 1.4.3
- Netlify Blobs = 11.0.1
- unresolved UI ไม่มี
- `WaterOwner` ไม่อยู่ใน resolver
- root/site HTML copies ตรงกัน
- `maeka.html` และ `water-data-loader.js` ยัง byte-identical กับ validated v1.3.1
- GAS sync เป็น read-only
- LocalAuthority policy contract มีครบ

## 8. สิ่งที่ยังไม่ได้ทำใน Candidate นี้

ยังไม่ได้ทำ live integration กับ Production dataset ปัจจุบันหลังกรอก `LocalAuthority` จริง เพราะขั้นนั้นต้องเกิดหลังฟอร์ม `KebNamComplete v1.2` บันทึกคอลัมน์ Y จริงแล้ว

Production gate ที่เหลือ:

```text
กรอก KebNamComplete v1.2 จริง
→ ตรวจ Sheet Y = LocalAuthority
→ วาง GAS sync helper รุ่นนี้
→ manual sync
→ ตรวจ /api/waterresources
→ ตรวจ Authority counts ด้วย dataset จริง
→ ตรวจ KPI / Table / Map
→ Deploy Dashboard Production
```

## Result

```text
Area resolver                 PASS
KebNam v1.2 exact mapping     PASS (47 combinations)
KebNam server parity          PASS (6,960 cases)
GAS sync contract             PASS
Static integrity              PASS
Netlify functions             PASS (10/10)
Playwright dashboard          PASS (23/23)
Playwright cache              PASS (5/5)
Production live integration   NOT RUN — gated intentionally
```
