# Phase 1 — Province Filter Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, recommended — Sonnet session). Steps use `- [ ]`.

**Goal:** แถบกรองบทสรุปผู้บริหารหน้าจังหวัดมีโครง/หน้าตาตามต้นแบบ `index (5).html` และลำดับช่องที่ผู้ใช้กำหนด พร้อมตัวกรองค้นหา/สถานะ/ปัญหา และชิป

**Spec:** `docs/superpowers/specs/2026-11-17-prototype-parity-design.md` §4 เฟส 1 (ต้องอ่านคู่กัน)

**Files:** `site/index.html` (markup แถบกรอง + JS ส่วน `EXECUTIVE ANALYTICS ENGINE`), `site/assets/dashboard-theme.css`, test ใหม่ `tests/province_filter_bar_playwright.mjs`

## Global Constraints

- ห้ามแตะ: แท็บรายละเอียด (`df*`, `f*`, `searchBox`, `state`), `WaterData`, `AREA`/resolver, Netlify, `authority.html`/`authority-app.js`, สูตร KPI/DSS, counter
- คง IDs เดิม: `efDistrict`, `efAuthority`, `efTambon*` (combobox), `efType`, `efReset`, `efCount`, `crossFilterBar`
- ID ใหม่ (ตามต้นแบบ): `gfBar`, `efSearch`, `efSearchClear`, `efStatus`, `efProblem`, `gfChips`
- คง `LOCKED_DISTRICT`/`LOCKED_AUTHORITY` ในทุกจุดที่ reset
- Tests ทุกตัว mock network ผ่าน `installMocks`; ห้าม visitor hit/Production write; ไม่ commit/push/deploy
- generated JSON/screenshots ที่ tests เดิมเขียนทับ: ห้ามลบ/คืนเอง — รายงานว่าเปลี่ยนอะไร
- Env: `. .superpowers/sdd/2026-11-16-dashboard-ui-refresh/env.ps1` (PowerShell) ก่อนรัน tests; output ยาวให้ redirect ลงไฟล์แล้วอ่าน tail

## Task 1: Failing test — โครงและลำดับ

- [ ] สร้าง `tests/province_filter_bar_playwright.mjs` (ใช้ `chromium, VIEWPORTS, SCOPE_DATA, PARITY_DATA, installMocks` จาก `district_browser_support.mjs`, host `http://province-filter.test`, seed `pyoVisitDate` แบบ `province_reference_ui_playwright.mjs`) ตรวจที่ทุก viewport:
  - มี `#gfBar #efSearch, #efDistrict, #efAuthority, #efTambon, #efType, #efStatus, #efProblem` ครบ และแต่ละช่องมีป้ายกำกับมองเห็นได้
  - ลำดับ DOM ของช่อง = ค้นหา, อำเภอ, อบต./เทศบาล, ตำบล, ประเภท, สถานะ, ปัญหา
  - geometry: 1440 → ค้นหา/อำเภอ/อปท./ตำบล อยู่ y เดียวกัน, ค้นหากว้างที่สุด (≥1.8× อำเภอ), ประเภท/สถานะ/ปัญหา อยู่แถวถัดไป y เดียวกัน; 768 → ค้นหากว้างเต็มแถว แถวอื่น 2 คอลัมน์; 390/360/412 → 1 คอลัมน์ทุกช่อง; ไม่มี horizontal overflow
  - ปุ่ม `#efReset` ข้อความ "↺ ล้างตัวกรอง", อยู่ในหัวแถบเดียวกับ `#efCount`
- [ ] รัน `node tests/province_filter_bar_playwright.mjs` — Expected: **FAIL** (ไม่มี `#efSearch`/`#gfBar`)

## Task 2: Markup + CSS (ยังไม่มี logic ใหม่)

- [ ] แทนบล็อก `<!-- TOP FILTER BAR -->` ใน `site/index.html` ด้วยโครง `.gf > .gf-inner > .gf-head (.gf-title, .gf-meta>#efCount, #efReset) + .gf-grid + #gfChips` ตามต้นแบบบรรทัด 2013–2038; ย้าย combobox ตำบลเดิมทั้งก้อน (input/listbox/clear/error IDs เดิม) เข้า `.gf-field`
  - วาง `#gfBar` **ที่เดิม** (ภายใน `#view-exec`) — ไม่ย้ายออกนอกแท็บ (D2)
  - status options ตามต้นแบบ (`ok`/`bad`/`broken`); problem มีแค่ "ทั้งหมด" (เติมใน Task 3)
- [ ] CSS ใน `dashboard-theme.css`: ลบ/แทนกฎ `body.dashboard-provincial .exec-filter-bar*` ที่ซ้ำกันสองชุด (ราวบรรทัด 64–91 และ 387–590) ด้วยกฎ `.gf*` ชุดเดียวตามต้นแบบ (บรรทัด 1352–1395 + 1730–1745 ของต้นแบบ) และ grid ตาม spec §4; ตรวจว่าไม่มีกฎอื่นอ้าง `.exec-filter-bar` แล้ว (`grep`)
- [ ] รัน test Task 1 — Expected: geometry/ลำดับ **PASS**; หน้าไม่มี JS error (ช่องใหม่ยังไม่ทำงาน)

## Task 3: Logic ค้นหา/สถานะ/ปัญหา + ชิป

- [ ] เพิ่ม test: (a) พิมพ์ชื่อ fixture หนึ่งรายการใน `#efSearch` → `#efCount` และจำนวนแถว/KPI จำนวนแหล่งน้ำ = จำนวนที่คาดจาก fixture; (b) `efStatus=ok` → จำนวน = นับ `isUsable` ใน fixture; (c) `efProblem` = ปัญหาหนึ่ง → จำนวนตรง; (d) ชิปแสดงครบ กดชิปแล้วค่าช่องนั้นล้าง; (e) `#efReset` ล้างทุกช่องรวมค้นหา; (f) cross-filter ยังทำงานซ้อนได้; (g) แท็บรายละเอียดจำนวนไม่เปลี่ยนเมื่อกรองบทสรุป — รัน Expected: **FAIL**
- [ ] `execFilter` เพิ่ม `q:'', status:'', problem:''` ทั้งตอนประกาศและใน reset
- [ ] ฟังก์ชันใหม่ `execExtraPass(r)` (q/status/problem ตาม spec §4) เรียกใน `getExecData()` และใน `RISK_BASE` (ส่วน `TAMBON STATS`)
- [ ] ใส่ `q,status,problem` ใน cache key `fKey` (ใน `runBuildExec`/map) และในเงื่อนไข `isFiltered` ของ `#efCount`; **ไม่** ใส่ใน `hasGeographicScope`
- [ ] event handlers: search debounce 220ms + ปุ่มล้าง; status/problem `change`; ทุกตัวรีเซ็ต `crossFilter` + `updateCrossFilterBar()` + `runBuildExec()` ตามแบบ handler เดิม; เติม options ปัญหาจาก `PROBLEM_TAGS` (ไม่รวม "ใช้งานได้") พร้อมจำนวน
- [ ] `updateGfChips()` แสดงชิปของ q/district/authority/tambon/type/status/problem (ข้ามค่าที่เท่ากับ LOCKED_*); click ชิป → ล้างค่านั้น sync control (รวม combobox ผ่าน `setValue`) แล้ว rebuild
- [ ] รัน test — Expected: **PASS** ทุก viewport

## Task 4: Regression ตามความเสี่ยง

- [ ] `python tests/playwright_dashboard_test.py` — Expected: PASS (ถ้า fail เพราะ selector `.exec-filter-bar` ใน test เดิม ให้ปรับ test ไป selector ใหม่และบันทึก Ruling)
- [ ] `python tests/phase2_filter_playwright.py`, `python tests/round3_map_stretch_playwright.py`, `node tests/mobile_map_popup_playwright.mjs` — Expected: PASS
- [ ] `node tests/province_reference_ui_playwright.mjs "C:\Users\Anupong\Desktop\rawชั่วคราว\index (5).html" <scratchpad>/p1-ref` — Expected: PASS; เปิดภาพ `reference-province-1440/390` เทียบ `current-*` ด้วยตา บันทึกความต่างที่เหลือ
- [ ] `node --check` กับ inline script ไม่ได้ — ใช้ผลรัน browser (ไม่มี pageerror) แทน; `git diff --check`

## Task 5: ส่งตรวจรับ

- [ ] อัปเดตท้าย `docs/DASHBOARD_UI_REFRESH_REPORT.md` หัวข้อ "เฟส 1 — 17 พ.ย." : สิ่งที่เปลี่ยน, ผล test จริง (mocked), ภาพเทียบ, ข้อจำกัด, ไฟล์ generated ที่ถูกเขียนทับ
- [ ] แจ้งผู้ใช้ให้ตรวจด้วยตาที่ localhost — **ห้ามสรุปว่าผ่านจนผู้ใช้ตรวจรับ**; ไม่ commit

## Review Focus

- combobox ตำบลหลังย้าย DOM: เปิด list/คีย์บอร์ด/ล้างค่า ยังทำงาน, list ไม่ถูก `overflow:hidden` ของ `.gf-inner` ตัด (ต้นแบบใช้ overflow hidden — ต้องยกเว้นหรือใช้ `overflow:visible`)
- cache key แผนที่/RISK ไม่ stale เมื่อเปลี่ยน q/status/problem
- ค่าที่ล็อกตาม route (AUTHORITY_MODE) ไม่ถูกล้างโดยชิป/reset
