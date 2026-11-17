# Dashboard UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** ปรับหน้าตาจังหวัดและหน้าลิงก์แยก 33 หน้าให้ใช้ธีมอ้างอิง พร้อมเปลี่ยนชื่อไทย/อังกฤษ โดยคงข้อมูล ตัวเลข และพฤติกรรมเดิม

**Architecture:** ใช้ `site/index.html` และ template `site/authority.html` เดิม เพิ่ม stylesheet ที่แยกขอบเขตสองหน้าชัดเจน และปรับ markup เฉพาะส่วนตกแต่ง/การจัดวาง ไม่เปลี่ยน JavaScript ที่คำนวณหรือจัดการ state ใช้ semantic snapshots จาก fixture เดียวกันเทียบก่อน–หลัง แยกจากการตรวจภาพที่ตั้งใจให้เปลี่ยน

**Tech Stack:** HTML, CSS, JavaScript เดิม; Leaflet 1.9.4, MarkerCluster 1.5.3, Chart.js 4.4.1; Node.js และ Python Playwright/Chromium ที่มีในเครื่อง ไม่มี framework/build system/dependency ใหม่

**Spec:** `docs/superpowers/specs/2026-11-16-dashboard-ui-refresh-design.md` — ผู้ใช้อนุมัติแล้ว 16 พฤศจิกายน 2026; ต้องอ่านคู่กับแผนนี้

## Global Constraints

- ขอบเขต: หน้าจังหวัด + อปท. 29 แห่ง + อำเภอ 4 แห่ง รวม 34 หน้า; `/maeka.html` และ `maeka-app.js` เดิมคงเดิม
- ชื่อไทย: **กว๊านกักเก็บ แดชบอร์ดศูนย์ข้อมูลแหล่งน้ำ จังหวัดพะเยา**
- ชื่ออังกฤษ: **KwanKukkeb – Phayao Water Resources Data Center Dashboard**
- คงชื่อพื้นที่/ชื่อแท็บที่สร้างจาก route เดิม ไม่แปลชื่อ อปท. เพิ่มและไม่ hardcode แม่กา/แม่ใจให้ทุกหน้า
- คง IDs, data attributes, event bindings, สูตร, ตัวกรอง, adapters, API/version/cache/fallback/fail-closed และ counter identity/guards
- คงหมุดซ้อน/spiderfy, mobile popup, map stretch, fullscreen, image DOM reuse, placeholder และ fallback ที่ผู้ใช้กดเอง
- คง DSS/insight/ข้อความเดิม รวมข้อแนะนำที่ซ่อนและรายการชำรุดแบบแสดงเพิ่ม/น้อยลง; ปุ่มล้างตัวกรองคงสีน้ำเงิน
- ไม่คัดลอก script, dataset ฝัง, deduplication, analytics หรือ global-filter state จาก reference
- อ้างอิงไฟล์ `index (5).html`, `index_maeka.html`, `index_maechai.html` ใน `C:\Users\Anupong\Desktop\rawชั่วคราว` เฉพาะ UX/UI
- Viewports: 1440×900, 768×1024, 412×915, 390×844, 360×800; mobile ใช้ Android user agent + touch จริงใน Chromium จำลอง
- Mock API/ภาพ/tiles/counters และบล็อก external requests ที่ไม่ได้กำหนด; ไม่ส่ง Google image/visitor hit/Production write จริง
- ไม่มี commit/push/merge/deploy ในแผนดำเนินงานนี้จนกว่าผู้ใช้สั่ง Git/เผยแพร่แยกต่างหาก; แต่ละ task จบด้วย local diff checkpoint แทน commit
- ใช้ repository ที่ `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main` เก็บงานค้างเดิมและเอกสารไว้ทั้งหมด ห้าม reset/stash/ลบทิ้งเพื่อให้ tree สะอาด

## Review Focus

1. ชื่อหน่วยงานไทยยาวและ browser zoom 200%: header/context ต้องไม่ทับ filters หรือซ่อนปุ่ม — Task 2
2. Google Fonts โหลดไม่ได้: ฟอนต์สำรองยังอ่านได้และปุ่มไม่ล้น — Task 2
3. Dropdown/modal/fullscreen บนมือถือ: CSS ใหม่ต้องไม่สร้าง stacking context หรือ clip ส่วนโต้ตอบ — Tasks 3–4
4. ข้อมูลว่าง ไม่มีพิกัด หรือ dataset ไม่ผ่านการตรวจ: UI ต้องไม่แสดงตัวเลขเก่าหรือเปิดขอบเขตอื่น — Tasks 4–5
5. ตารางจังหวัดเกิน 500 รายการ: คง cap 500, จำนวนรวม และการเลื่อนตารางเดิม; body ไม่ล้น — Task 3

## File Structure และขอบเขตความรับผิดชอบ

| ไฟล์ | หน้าที่ |
|---|---|
| Create `site/assets/dashboard-theme.css` | tokens/ธีมร่วม + selectors ที่แยกจังหวัดกับ scoped; ไม่มี JavaScript |
| Modify `site/index.html` | ชื่อใหม่, โหลดธีม, เพิ่ม root marker, styling hooks/markup ที่จำเป็น |
| Modify `site/authority.html` | ชื่อใหม่และ styling hooks ของ template ร่วม 33 routes |
| Create `tests/dashboard_ui_playwright.mjs` | baseline capture/semantic parity/branding/geometry/visual evidence |
| Modify `tests/district_browser_support.mjs` | MIME ของ CSS และการจัดการ fonts สำหรับ harness แบบ offline |
| Modify `tests/playwright_dashboard_test.py`, `tests/file_mode_test.py` | ฝัง theme CSS ใน HTML fixtures ที่ใช้ `set_content()` |
| Modify existing browser tests เฉพาะที่จำเป็น | selector/visual expectation ที่เปลี่ยนเพราะ presentation; คง assertions เชิงพฤติกรรม |
| Create `docs/DASHBOARD_UI_REFRESH_REPORT.md` | ผลตรวจจริง ภาพอ้างอิง ข้อจำกัด และ Git status หลังลงมือ |

ไม่วางแผนแก้ `authority-app.js`, `maeka-app.js`, data loader, adapters, mappings, runtime config, Netlify routing/functions หรือข้อมูล หากจำเป็นต้องแตะ business logic ให้หยุดรายงานก่อน

## Test Environment และ Interfaces ร่วม

ใช้ runtime ที่มีอยู่จริงในเครื่อง ไม่ติดตั้ง package เพื่อความสะดวก:

```powershell
$auditRoot = 'C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\district-preflight-20261025'
$artifactRoot = 'C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\ui-refresh-20261116'
$env:PLAYWRIGHT_MODULE_PATH = 'C:\Users\Anupong\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\Users\Anupong\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe'
$env:DISTRICT_VENDOR_DIR = "$auditRoot\vendor"
$py = 'C:\Users\Anupong\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$env:PYTHONPATH = "$auditRoot;$auditRoot\python-packages"
$env:PYTHONIOENCODING = 'utf-8'
```

ตรวจ `Test-Path`/runtime launch ก่อนใช้ หากเส้นทางเปลี่ยนให้ค้นหาของที่มีอยู่ ไม่ดาวน์โหลด/ติดตั้ง runtime/package โดยอัตโนมัติ
Fonts ใน screenshots ใช้ cache ที่มีอยู่; หากไม่มี ให้บล็อก requests และใช้ fallback อย่างชัดเจน บันทึก `fontMode:fallback` และไม่อ้างว่าเทียบการแสดง Prompt จริงสำเร็จ
เก็บ screenshots/logs/source hashes/snapshots นอก repo ที่ `$artifactRoot`; สำรอง generated results เดิมก่อนรัน test ที่เขียนทับ และคืนจากสำเนาตัวเองหลังเก็บหลักฐาน ไม่ใช้ Git reset

Harness ใหม่ใช้ `http://dashboard-ui.test` เป็น host จำลองผ่าน `installMocks(context,{host,data,calls})` จาก `tests/district_browser_support.mjs`
จึงไม่ต้องเริ่ม Netlify Dev เพื่อทดสอบ harness นี้; การทดสอบชุด Python เดิมใช้ local server ที่ตรวจว่าพร้อมจริงแล้ว
ห้ามตีความการเสิร์ฟไฟล์ด้วย mock เป็นการยืนยัน Netlify routing/Production จริง

สัญญาของ harness ที่จะสร้างใน Task 1:

- CLI: `node tests/dashboard_ui_playwright.mjs --mode <capture|verify-brand|verify-province|verify-scoped|verify-all> --artifacts <absolute-directory>`
- `capture`: เก็บ baseline semantic states, screenshots และ source hashes; ไม่ตรวจว่ามีธีมใหม่
- `verify-*`: อ่าน baseline ที่มีอยู่ เปรียบเทียบ semantics และตรวจ presentation เฉพาะขอบเขตที่เลือก; ห้ามสร้าง baseline ใหม่เงียบ ๆ
- `captureState(page, kind)` คืน `{kpis, ids, charts, filters, context, dss, counterIdentity}` โดยอ่าน DOM/Chart.js test hooks เดิม; ไม่ต้องเพิ่ม production hook
- `ids`: scoped อ่าน `#tblBody tr[data-id]`; จังหวัดเปิดแท็บ table แล้วอ่าน ID จาก `td:first-child` และเก็บ `#n-table` ด้วย
- `charts`: labels และ dataset values เท่านั้น; ไม่เทียบสี/ขนาด/พิกัด pixels ใน semantic parity
- เปรียบเทียบแต่ละ state กับ baseline ของ route/viewport/action เดียวกัน ยกเว้น brand/title ที่มี assertions ชื่อใหม่แยกต่างหาก
- fixture หลักใช้ `SCOPE_DATA`/`PARITY_DATA` เดิม และเพิ่ม fixture ชื่อยาว, >500 rows, zero, invalid/stale ตาม tests ของแต่ละ task; record IDs/expected counts ต้องระบุอิสระจาก production resolver
- ผลสำเร็จ: exit 0, ไม่มี page errors/unmocked writes, JSON report ระบุ `mocked:true, realProductionVerification:false`; failure ต้อง exit nonzero

---

### Task 1: Baseline และชุดทดสอบที่เห็นธีมจริง

**Files:** Create `tests/dashboard_ui_playwright.mjs`; Modify `tests/district_browser_support.mjs`

**Interfaces:** Consumes `installMocks`, `record`, `VIEWPORTS`, `SCOPE_DATA`, `PARITY_DATA`, `snapshot` เดิม; Produces CLI และ `captureState(page,kind)` ตามสัญญาข้างต้น พร้อม `baseline/` และรายงานภายใต้ artifact directory

- [x] **Step 1:** ตรวจ Git status/HEAD ใหม่ ยืนยัน pending `site/index.html` มีเพียงลิงก์ `maeka.html` ที่ผู้ใช้ให้ซ่อน บันทึก hash และสำเนาไฟล์ที่จะเปลี่ยน ห้ามทำให้ลิงก์กลับมา
- [x] **Step 2:** เมื่อเริ่ม execution สร้าง branch `codex/dashboard-ui-refresh` จาก working state เดิมด้วย `git switch -c` โดยเก็บไฟล์ค้างไว้ หากชื่อมีอยู่และไม่ยืนยันว่าเป็นงานเดียวกันให้รายงาน ไม่ force/reset
- [x] **Step 3:** เขียน harness ที่กัน network ก่อน navigation ใช้ browser context ใหม่ต่อ scenario และเก็บ semantic state ของ initial/filter/search/reset/selection ตามหน้าจริง
- [x] **Step 4:** ปรับ MIME dispatch ของ `installMocks`: `.css` → `text/css`, `.html` → `text/html`, JavaScript ตามเดิม; เพิ่ม route สำหรับไฟล์ฟอนต์ที่ cache ไว้ หากไม่มีให้จำลอง font failure อย่างชัดเจน
- [x] **Step 5:** Run `node tests/dashboard_ui_playwright.mjs --mode capture --artifacts "$artifactRoot"`; expected PASS และได้ baseline สำหรับจังหวัด/4 อำเภอ/ตัวแทน อปท. ที่กำหนดใน harness รวมภาพ 5 viewport
- [x] **Step 6:** เพิ่ม assertions `verify-brand`: brand ไทย/อังกฤษตรงค่าตาม spec, root class ของแต่ละ template ถูกต้อง, stylesheet MIME ถูกต้องและโหลดจริง โดยตรวจ computed token `--dashboard-brand-start` ไม่ใช่เพียง link มีอยู่
- [x] **Step 7:** Run `node tests/dashboard_ui_playwright.mjs --mode verify-brand --artifacts "$artifactRoot"`; expected FAIL เพราะชื่อเดิม/ยังไม่มีธีม ไม่ใช่ FAIL เพราะ mock หรือ network พัง เก็บ local diff checkpoint

### Task 2: ชื่อใหม่และธีมที่ใช้เฉพาะ 34 หน้าที่กำหนด

**Files:** Create `site/assets/dashboard-theme.css`; Modify `site/index.html`, `site/authority.html`, `tests/playwright_dashboard_test.py`, `tests/file_mode_test.py`; Test `tests/dashboard_ui_playwright.mjs`

**Interfaces:** Consumes baseline/harness Task 1; Produces root classes `dashboard-provincial` และ `dashboard-scoped`, link `./assets/dashboard-theme.css` หลัง styles เดิม และ brand strings ตาม Global Constraints

- [x] **Step 1:** เพิ่ม test ชื่อยาว/viewport 360 และ browser-equivalent 200% ผ่าน viewport/scale ที่บันทึกชัดเจน พร้อม test ปิดกั้น Google Fonts; assert heading ไม่ทับ controls, focus ยังเห็น และ body overflow ≤2px
- [x] **Step 2:** เปลี่ยนข้อความ brand ในสอง template และ `<title>` จังหวัดเท่านั้น คง `authorityHeading` และ `document.title` ตามพื้นที่ของ scoped bootstrap เดิม คง `hidden` ของลิงก์แม่กา
- [x] **Step 3:** เพิ่ม stylesheet และ root classes; ใช้ font Prompt สำหรับ heading และ Sarabun สำหรับ body พร้อม sans-serif fallback โดยไม่แตะ dependencies
- [x] **Step 4:** กำหนด presentation tokens: `--dashboard-brand-start:#2a1d7a`, `--dashboard-brand-mid:#4b34c8`, `--dashboard-brand-end:#2f6fed`, `--dashboard-canvas:#f5f3ff`, `--dashboard-surface:#fff`, `--dashboard-border:#e4e0fb`, `--dashboard-radius:18px`; ไม่ override ตัวแปรที่ JavaScript ใช้สื่อความหมายข้อมูล เช่น `--danger`, status/type colors
- [x] **Step 5:** ทุก selector ธีมขึ้นต้นด้วย root class ของสอง template; ไม่มี rules global ที่ไปเปลี่ยน `/maeka.html` หลีกเลี่ยง transform/filter/contain บน ancestor ของ map/modal/fullscreen และไม่ตั้ง header overflow ให้ clip controls
- [x] **Step 6:** ใน HTML fixtures ของ `make_test_html()` และ `build_index_filemode_html()` อ่าน theme CSS แล้วแทน link ด้วย `<style>` เพื่อทดสอบแบบ `set_content()` ได้จริง; ไม่เปลี่ยน assertions เดิม
- [x] **Step 7:** Run `verify-brand`; expected PASS ชื่อใหม่/fallback font/long heading และ legacy ไม่โหลดธีม จากนั้น run Python `playwright_dashboard_test.py`, `file_mode_test.py`; เก็บผลจริงและ diff checkpoint

### Task 3: ปรับหน้าจังหวัดโดยคงการกรองและทุกแท็บ

**Files:** Modify `site/assets/dashboard-theme.css`, `site/index.html`; Test `tests/dashboard_ui_playwright.mjs`

**Interfaces:** Consumes root `.dashboard-provincial` จาก Task 2; Preserves `.main-nav [data-view]`, `[data-tab]`, `#efDistrict`, `#efAuthority`, `#efTambon`, `#efReset`, `#execKpi`, `#heroMapStage`, `#map`, `#damagedMapStage` และ modal roots เดิม

- [x] **Step 1:** เพิ่ม `verify-province` assertions: semantic snapshots เท่ากับ baseline หลังเปลี่ยน district/authority/tambon, chart cross-filter, search/reset และสลับทุกแท็บเดิม; ตรวจ ID list จาก table แยกจากจำนวนทั้งหมด
- [x] **Step 2:** เพิ่ม fixture 501 records: initial total=501, table แสดง 500, `#n-table` บอก cap เดิม และ horizontal scroll อยู่ใน table container; เพิ่มเปิด combobox ที่ขอบล่างจอให้เลือก option ได้จริง
- [x] **Step 3:** ปรับหัวเว็บ/ปุ่ม nav, filter card, KPI cards, panel/chart/table surfaces ด้วยสีอ่อน/เงาบางและระยะ 12–24px ตามพื้นที่ โดยไม่เพิ่ม/ลบ controls หรือเปลี่ยน state model
- [x] **Step 4:** ใช้ grid/flex ของ `.exec-hero`, `.exec-hero-cards`, `.exec-hero-map` เดิมให้ header/filters ไม่เบียดกัน; คง desktop map stretch, minimum mobile map heights, fullscreen CSS และ modal z-index ที่แก้ไว้ ห้ามย้าย map/canvas ขณะ runtime
- [x] **Step 5:** Run `verify-province`; expected PASS semantic parity และไม่มี control ถูก clip จากนั้น run `phase2_filter_playwright.py`, `round3_map_stretch_playwright.py`, `mobile_responsive_audit_test.py` กับ mocks/offline guard เดิม
- [x] **Step 6:** บันทึกและตรวจภาพจังหวัดทั้ง 5 viewport รวม initial, dropdown, gallery, damaged map, image modal/fullscreen; ตรวจความใกล้ reference ด้วยสายตา ไม่กำหนดให้ภาพใหม่เท่ากับภาพเก่า เก็บ diff checkpoint

### Task 4: ปรับ template อปท./อำเภอโดยคง 5 KPI, 3 กราฟ และ DSS

**Files:** Modify `site/assets/dashboard-theme.css`, `site/authority.html`; Test `tests/dashboard_ui_playwright.mjs`, `tests/mobile_map_popup_playwright.mjs`

**Interfaces:** Consumes `.dashboard-scoped`; Preserves `.toolbar`, `.kpis`, `#kpiInsight`, `.layout`, `.mapcol`, `.railcol`, `#mapbox`, `.tablecard`, `#tblBody`, `#chartType`, `#chartVol`, `#chartProb`, `#dssBoard`, modal/layer roots และทุก data attribute

- [x] **Step 1:** เพิ่ม `verify-scoped` assertions ต่อกับ baseline สำหรับ filter/reset, ทุก KPI, 3 chart datasets, DSS overview/รายจุดทั้งสี่ประเภท, broken show more/less และ search zero results
- [x] **Step 2:** เพิ่มกรณีหลายตำบล/ชื่อยาว/no coordinates/zero records; assert no-coordinate record ยังอยู่ใน KPI/ตารางและไม่มี marker ส่วน true zero แสดงข้อความเดิม ไม่ใช่ failure
- [x] **Step 3:** ปรับ header/context/filter/KPI/insight ด้วย scoped CSS เดียว ไม่ทำ stylesheet แยกต่อ slug; คงความหมายสี/ปุ่มล้างสีน้ำเงินและ focus/selected/pressed states
- [x] **Step 4:** Desktop ≥1101px จัด map card และ table card เคียงกัน โดยปรับ static markup/wrappers ของ `.layout` เท่าที่จำเป็น แล้ววางกราฟสามใบในแถวถัดไป; ≤1100px เรียง map→table→charts และ DSS ต่อท้าย ใช้ DOM order ที่ตรงกับการอ่าน ไม่ใช้ runtime DOM move
- [x] **Step 5:** ก่อนเปลี่ยน wrapper ตรวจ parent-dependent selectors ใน fullscreen/chart logic; คง map target card, mapwrap/layer controls, table scroll และ canvas containers ให้ทำงานกับโค้ดเดิม หากต้องเปลี่ยน logic เพื่อรองรับ layout ให้รายงานก่อน
- [x] **Step 6:** Run `verify-scoped`, `authority_selection_playwright.py`, `authority_cluster_playwright.py`, `authority_image_requests_playwright.py`, `broken_kpi_insight_playwright.mjs`, `mobile_map_popup_playwright.mjs`; expected PASS รวม hit-test ของ modal เหนือ fullscreen และไม่มี request รูปเพิ่มจาก layout
- [x] **Step 7:** ตรวจภาพ scoped 5 viewport รวม menu/filter/popup/modal และ selected DSS โดยใช้หน่วยงานหลายตำบล/ชื่อยาวและครบสี่อำเภอ เก็บ diff checkpoint

### Task 5: ตรวจครบทุกลิงก์และสรุปพร้อมให้ผู้ใช้รับงาน

**Files:** Complete `tests/dashboard_ui_playwright.mjs`; Create `docs/DASHBOARD_UI_REFRESH_REPORT.md`; Modify existing tests เฉพาะ selector ที่จำเป็นพร้อมอธิบาย; ไม่มี product logic ใหม่

**Interfaces:** Consumes completed theme/templates และ baseline ของ Task 1; Produces report ระบุผลจริงทุกคำสั่ง, screenshots, limitations และ final diff

- [x] **Step 1:** Run `verify-all`: ตรวจ branding/theme/context/overflow ในทุก 29 authority +4 district routes และจังหวัด; ใช้ fresh mocked context ต่อกรณี ทดสอบ invalid route, invalid/stale metadata, API failure และ offline validated cache โดยคง fail-closed เดิม
- [x] **Step 2:** Run `node tests/district_scope_test.mjs`, `district_dashboard_playwright.mjs`, `authority_locked_playwright.py`, `authority_rollout_jurisdiction_playwright.py`, `authority_counter_rollout_playwright.py`, `authority_parity_playwright.py` และ `development_data_source_playwright.py`; ตั้ง screenshot/report output นอก repo และ offline guard ให้แต่ละชุดก่อนรัน
- [x] **Step 3:** ยืนยัน 33 scoped counter identities/guards, namespace Mae Ka เดิม, ไม่มี localhost/preview/test hit จริง และ `/maeka.html` source hash/พฤติกรรมคงเดิม ถ้าใช้ mock hit ใน test ให้ระบุว่า mock ชัดเจน
- [x] **Step 4:** ตรวจ JavaScript ที่แก้ด้วย `node --check`, Python ด้วย `ast.parse`, inline scripts ด้วย `vm.Script` และ `git diff --check`; ต้องไม่มี syntax/whitespace error
- [x] **Step 5:** Inspect complete diff เทียบ source hashes: จำกัด product changes ที่สอง template/stylesheet, ยืนยันไม่แตะ protected data/API/mappings/formulas/routing และลิงก์แม่กาเดิมยังซ่อน คืน generated outputs จากสำเนาก่อนรันเมื่อเก็บหลักฐานแล้ว
- [x] **Step 6:** เขียนรายงานไทยพร้อมรายการไฟล์, before/after image locations, semantic parity, ผ่าน/ไม่ผ่าน/ไม่ได้รัน, mocked vs real verification, ข้อจำกัด Google images/โทรศัพท์จริง และ Git status; อย่าอ้างผ่านจากเพียง exit code หาก assertions ถูกข้าม
- [x] **Step 7:** หากพบ defect ในขอบเขต UI ให้แก้และรัน affected tests ซ้ำเท่านั้น; หากต้องเปลี่ยน business behavior ให้หยุดรายงาน ห้ามแก้สูตรหรือซ่อนฟังก์ชันเพื่อให้ผ่าน
- [x] **Step 8:** ส่งผลให้ผู้ใช้ตรวจรับและหยุดที่ local changes ไม่มี commit/push/deploy อัตโนมัติ

## Self-review ของแผน

- Spec coverage: branding/theme → Task 2; province UX → Task 3; scoped UX → Task 4; data/route/cache/counter/legacy → Tasks 1 และ 5; map/images/DSS → Tasks 3–4
- Review Focus ทั้งห้าข้อมี test owner กำหนดไว้แล้ว และแยก visual change ออกจาก semantic parity
- ไม่มีชื่อ production function ใหม่ที่ task อื่นต้องเดา; helper ใหม่จำกัดอยู่ใน test harness และ CLI ตามสัญญาร่วม
- ไม่คัดลอก business logic หรือเพิ่ม UI features จาก reference และไม่เปลี่ยนหน้าที่ของ controls เดิม
- ขั้นนี้เป็นเอกสารแผน ไม่ใช่หลักฐานว่าการปรับ UI หรือ tests ใหม่สำเร็จแล้ว

## Execution handoff

เสนอ **Native**: ผู้ช่วยตัวเดิมลงมือทีละ task ในแชตนี้ แล้วมีผู้ทบทวนอิสระตอนท้าย
เพราะงานส่วนใหญ่แก้ stylesheet และ HTML สองไฟล์ร่วมกัน การแบ่งผู้แก้หลายตัวพร้อมกันเสี่ยงชนกันและเพิ่มต้นทุน
อีกทางคือ **Subagent-driven**: ผู้แก้/ผู้ทบทวนใหม่ในแต่ละ task ละเอียดกว่าแต่ใช้หลาย context มากกว่า
ผู้ใช้ต้องตรวจแผนและเลือกวิธีดำเนินงานก่อนเริ่ม implementation ตามสกิล writing-plans
