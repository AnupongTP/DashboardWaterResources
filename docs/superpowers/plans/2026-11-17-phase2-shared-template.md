# Phase 2 — Shared Template for 33 Scoped Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. แผนนี้มีจุดหยุดตรวจรับ 1 จุด (หลัง Task 4) — หยุดรอผู้ใช้ตรงนั้น

**Goal:** route `/authority/<slug>/` (29) และ `/district/<slug>/` (4) แสดง `site/index.html` (โครงเหมือนต้นแบบ `index_maeka.html`/`index_maechai.html`) ล็อกข้อมูลตามเขตด้วย resolver เดิม พร้อม DSS, selection flow, ตัวนับแยกหน่วยงาน

**Spec:** `docs/superpowers/specs/2026-11-17-prototype-parity-design.md` — D2, D5, D7, D9–D12, §3, §4 เฟส 2 (อ่านคู่กัน) · Memory: `C:\Users\Anupong\Desktop\rawชั่วคราว\DashboardWaterresourceMem.md` บท 8.3, 12, 13, 14, 16 (grep หัวข้อแล้วอ่านเฉพาะบท)

## ข้อเท็จจริงที่ตรวจแล้ว (17 พ.ย.)

- `site/index.html` มีโหมด authority แล้ว: `<base href="/">` สำหรับ `/authority`, `ROUTES.validateCurrentDataset` (fail-closed), `RAW = DECORATED_RECORDS.filter(AREA.recordMatchesAuthority)` = predicate เดียวกับ `AuthorityDataAdapter`, `LOCKED_AUTHORITY/LOCKED_DISTRICT`; แต่ **ซ่อน visitor counter** และ **ไม่มีโหมด district**
- District scope = `AREA.recordMatchesDistrict(record, district)` (ไม่ decorate/ไม่ตัด unresolved) — `district-data-adapter.js`
- DSS อยู่ใน `authority-app.js` (`updateDSSPanel`, `setFocus`, `exitFocus`, `buildPopupHTML`, `makeIcon`) ทำงานบนแถวรูปแบบ `MaekaDataAdapter.toMaekaRecord` + `volumeKnown`
- Counter identity: `visitorCounterIdentity(context)` + `initVisitorCounter()` ใน `authority-app.js`
- Tests ผูก: `__AUTHORITY_PAGE__`, `__DISTRICT_PAGE__`, `__AUTHORITY_CONTEXT__`, `__DISTRICT_CONTEXT__`, `body.authority-ready`, `#dssBoard/#dssTitleText/#dssResetBtn/#dssContent`, `#tblBody tr[data-id]`; harness `tests/district_browser_support.mjs:93`, `tests/mobile_map_popup_playwright.mjs:46`, `tests/authority_parity_playwright.py:90` map scoped routes → `authority.html`

## Global Constraints

- ห้ามแก้: `area-responsibility.js`, `*-routes.js` (ยกเว้นเพิ่ม export ที่ไม่เปลี่ยนพฤติกรรม — ต้อง Ruling), `*-data-adapter.js`, `water-data-loader.js`, Netlify Functions, DSS rules/ข้อความ, สูตร KPI หน้าจังหวัด
- ห้ามลบ `authority.html`, `authority-app.js` (rollback = คืน `netlify.toml`)
- หน้าจังหวัด (`/`) ต้องเหมือนหลังเฟส 1 ทุกอย่าง (semantic parity) — ไม่มี DSS ในโหมดจังหวัด
- Counter: namespace/visitKey ต่อหน่วยงานต้องเท่ากับของเดิม (`visitorCounterIdentity`) ห้ามสร้าง namespace ใหม่; tests ห้าม hit จริง
- ไม่ commit/push/deploy; generated test outputs ห้ามลบ/คืนเอง
- Env: `. .superpowers/sdd/2026-11-16-dashboard-ui-refresh/env.ps1`

## Task 1: Baseline contracts ก่อนแก้ (RED harness)

- [ ] สร้าง `tests/scoped_template_playwright.mjs` (mocks จาก `district_browser_support.mjs`, fixture `SCOPE_DATA+PARITY_DATA`) สำหรับ route ตัวอย่าง: `/authority/tt-mae-ka/`, อปท. ที่มี 0 รายการ, อปท. หลายตำบล, `/district/mae-chai/`, slug ไม่ถูกต้อง, API unavailable
- [ ] **ก่อนแก้** บันทึก baseline จาก `authority.html` ปัจจุบันลง scratchpad: ชุด record IDs ต่อ route, counter identity (namespace/key), DSS overview title ต่อ route — เก็บเป็น JSON (ใช้ `baseline:true` ของ harness ถ้าจำเป็น)
- [ ] เขียน assertions ของเป้าหมาย: หน้า scoped มี `#gfBar` (ค้นหา·ตำบล·ประเภท·สถานะ·ปัญหา; ไม่มีช่องอำเภอ/อปท./หมู่ที่มองเห็น), แท็บบทสรุป/รายละเอียด, `#execKpi .kpi-card` 8 ใบ, `#dssBoard`, ไม่มีแถบ "กลับสู่หน้าหลัก", ชื่อเว็บเป็นลิงก์ `/`; record IDs = baseline; counter identity = baseline
- [ ] ปรับ harness ให้ map scoped routes ตาม env `SCOPED_TEMPLATE=index|authority` (default `index`) ใน 3 ไฟล์ข้างบน — **ไม่ลบ** โหมด authority
- [ ] รัน — Expected: **FAIL** (ยังเสิร์ฟโครง authority เดิม/ไม่มี district mode)

## Task 2: Routing + bootstrap ใน index.html

- [ ] `netlify.toml`: เปลี่ยนเฉพาะ 3 rewrite `/authority/*`, `/district`, `/district/*` → `/index.html` (คง `/authority` → `/` 302)
- [ ] `index.html` `<base>` script: ครอบ `/district` ด้วย
- [ ] โหลด `district-routes.js`, `maeka-data-adapter.js` (ใช้ใน Task 4) ใน index.html
- [ ] Bootstrap: resolve district ก่อน authority (แบบ `authority.html` บรรทัด ~636); district → `RAW = DECORATED_RECORDS.filter(r => AREA.recordMatchesDistrict(r, district))` (ตรวจว่า decorate ไม่ตัดแถวต่างจาก adapter — ถ้าต่าง ใช้ `LOADED_RECORDS` ก่อน decorate ตาม adapter และ Ruling); `LOCKED_DISTRICT = district`, `LOCKED_AUTHORITY=''`
- [ ] ตั้ง window contracts เท่าเดิม: `__AUTHORITY_PAGE__`/`__DISTRICT_PAGE__`, `__AUTHORITY_CONTEXT__`/`__DISTRICT_CONTEXT__` (shape เดียวกับ authority.html), `document.title`, invalid → `showFailure('invalid')`, unavailable → `showFailure('unavailable')`, zero → หน้าว่างพร้อมชื่อหน่วยงาน/KPI 0 ไม่ crash
- [ ] เพิ่ม `body.authority-ready` เมื่อ render ครบในโหมด scoped
- [ ] รัน Task 1 test เฉพาะ record IDs/states — Expected: PASS ส่วนนี้

## Task 3: หน้าตา scoped ตามต้นแบบ

- [ ] หัวเว็บ: ชื่อไทยรวมชื่อหน่วยงาน/อำเภอตามแบบต้นแบบ (เช่น "กว๊านกักเก็บ แดชบอร์ดศูนย์ข้อมูลแหล่งน้ำ เทศบาลตำบลแม่กา อำเภอเมืองพะเยา จังหวัดพะเยา" — ใช้ `ROUTES.fullName` + อำเภอจาก route; **ไม่มี "และประปา"**), ชื่อเว็บเป็นลิงก์ `/` (D12); ซ่อน `authorityLockBadge` ถ้าซ้ำกับหัวเว็บ
- [ ] แถบกรองบทสรุป: ซ่อน field อำเภอ/อปท. (ค่า locked คงใน state); ตำบลแสดงเมื่อเขตมีมากกว่า 1 ตำบล ตามสัญญาเดิม; grid ตามต้นแบบ (ค้นหา 2.2fr + 4 ช่อง)
- [ ] แท็บรายละเอียด: ซ่อน/ล็อกตัวกรองอำเภอ/อปท. แบบเดียวกัน; ไม่มี dropdown หมู่ที่ (D11) — ตรวจว่าค้นหาครอบ `moo` และตาราง/popup ยังแสดงหมู่
- [ ] ข้อความที่อ้าง "จังหวัด" ใน KPI/insight ให้ใช้ชื่อพื้นที่ตามต้นแบบเฉพาะจุดที่ต้นแบบเปลี่ยน (เทียบ `index_maeka.html` กับ `index (5).html` ด้วย diff ข้อความ ไม่เดา)
- [ ] รัน `province_reference_ui_playwright.mjs` กับ `index_maeka.html` และ `index_maechai.html` → ภาพ 1440/390 ลง scratchpad; Expected: PASS + ตรวจภาพด้วยตาว่าโครงตรงต้นแบบ

## Task 4: DSS + selection + counter + image fallback (scoped เท่านั้น)

- [ ] ย้ายโค้ด DSS จาก `authority-app.js` (`updateDSSPanel` และ helpers ที่ใช้) **แบบคัดลอกไม่แก้กฎ** ไป `site/assets/dss-panel.js` เป็นฟังก์ชันรับ `(rows, selectedRow, context)`; rows ได้จาก `MaekaDataAdapter.toMaekaRecord` + `volumeKnown` ตามสูตรเดียวกับ adapter — `authority-app.js` เดิมไม่แก้
- [ ] markup `#dssBoard/#dssTitleText/#dssResetBtn/#dssContent` ใต้ KPI/แผนที่ในแท็บบทสรุป (D5)
- [ ] Selection flow ตาม Memory 12.3 บนแผนที่/ตารางของหน้าจังหวัด: คลิกหมุด A→B ไม่ยุบ dataset, ปิด popup → overview คง filters, แถวตารางไม่มีพิกัด → DSS รายจุด; ใช้ request-version/microtask แบบ `setFocus` เดิม **ห้าม fixed timeout**
- [ ] Counter: แสดง `#visitorCounter` ในโหมด scoped ด้วย identity เดิม (ย้าย `visitorCounterIdentity` เป็นโมดูลร่วมแบบคัดลอก); guard host เดิม
- [ ] Image fallback: popup/gallery ใช้ no-referrer + retry แบบ `authorityImage*` เดิม
- [ ] Test: selection 5 กรณีของตาราง 12.3, counter identity = baseline, ไม่มี hit, image retry — รัน Expected: PASS
- [ ] **CHECKPOINT — หยุด**: ส่งภาพ + ผล test ให้ผู้ใช้ตรวจ localhost (แม่กา, แม่ใจ, อปท. 0 รายการ) ก่อน Task 5

## Task 5: Regression 33 routes (หลังผู้ใช้ OK checkpoint)

- [ ] `python tests/authority_locked_playwright.py` (29 routes), `authority_rollout_jurisdiction_playwright.py`, `authority_selection_playwright.py`, `authority_cluster_playwright.py`, `authority_counter_rollout_playwright.py`, `authority_image_requests_playwright.py`, `node tests/district_dashboard_playwright.mjs`, `node tests/district_scope_test.mjs`, `node tests/mobile_map_popup_playwright.mjs`, `node tests/scoped_template_playwright.mjs`, หน้าจังหวัด `node tests/province_filter_bar_playwright.mjs`, `python tests/playwright_dashboard_test.py`
- [ ] test ที่ fail เพราะ **selector ของ DOM เดิม** (ไม่ใช่ข้อมูล/เขต): ปรับ selector พร้อม Ruling ต่อไฟล์; test ที่ fail เพราะ **record set/counter/DSS** = bug ต้องแก้โค้ด ห้ามแก้ test
- [ ] `authority_parity_playwright.py` เทียบ Mae Ka เดิม: คาดว่าต่างโดยตั้งใจ (UI ใหม่) — เก็บส่วน data parity, Ruling ส่วน UI
- [ ] รายงาน "เฟส 2 — <วันที่>" ใน `docs/DASHBOARD_UI_REFRESH_REPORT.md`: routes ที่ตรวจ, mocked vs live, ความต่างที่ตั้งใจ, rollback (คืน 3 บรรทัดใน `netlify.toml`)

## Review Focus

- record set ต่อ route ต้องเท่า baseline ทุก 33 route (รวม 0 รายการ และ unresolved ไม่หลุดเข้า authority)
- District: unresolved LocalAuthority ต้อง **ไม่** ถูกตัด
- cache key แผนที่/ตัวกรองไม่ปนข้าม route (localStorage/IndexedDB key เดิม)
- หน้าจังหวัด `/` ไม่มี DSS/counter behavior เปลี่ยน
