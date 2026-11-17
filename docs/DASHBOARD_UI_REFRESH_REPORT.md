# รายงานปรับ UX/UI กว๊านกักเก็บ

วันที่ 16 พฤศจิกายน 2026 — ทดสอบในเครื่องด้วยข้อมูลและบริการจำลอง

## งานที่ทำ

ปรับหน้าจังหวัดและ template ร่วมของ 29 อปท./4 อำเภอ ตามเอกสารออกแบบและแผนที่ผู้ใช้อนุมัติ
ใช้ธีมม่วง–น้ำเงิน พื้นหลังอ่อน การ์ด pastel มุมโค้ง และปรับ spacing/focus states
บน desktop หน้าลิงก์แยกวางแผนที่กับตารางเคียงกัน แล้ววางสามกราฟในแถวถัดไป
บน tablet/mobile เรียงแผนที่ ตาราง กราฟ และ DSS ตามลำดับ DOM เดิม

ชื่อใหม่ที่ใช้กับหน้าที่ปรับ:

- ไทย: **กว๊านกักเก็บ แดชบอร์ดศูนย์ข้อมูลแหล่งน้ำ จังหวัดพะเยา**
- อังกฤษ: **KwanKukkeb – Phayao Water Resources Data Center Dashboard**

คงชื่อพื้นที่และชื่อแท็บตาม route เดิม ลิงก์แม่กาเก่าบนหน้าหลักยังซ่อนตามคำสั่งก่อนหน้า
`/maeka.html` เดิมไม่รับธีมใหม่และไม่แก้เนื้อหา/ชื่อในหน้านั้น

## ไฟล์

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `site/assets/dashboard-theme.css` | ธีมร่วม แยก selectors จังหวัด/scoped ไม่เปลี่ยน semantic palette ของกราฟ/แผนที่ |
| `site/index.html` | ชื่อไทย/อังกฤษใหม่ โหลด stylesheet/Prompt และเพิ่ม body class; รวมการซ่อนลิงก์แม่กาที่ทำค้างไว้ก่อนแล้ว |
| `site/authority.html` | ชื่อแบรนด์ใหม่ โหลด stylesheet/Prompt และเพิ่ม body class ใช้กับทั้ง 33 scoped routes |
| `tests/dashboard_ui_playwright.mjs` | capture baseline, semantic parity, branding, geometry, routes, zero/failure และ screenshots |
| `tests/district_browser_support.mjs` | MIME ถูกต้องสำหรับ CSS/JSON ที่ mock จากไฟล์ |
| `tests/playwright_dashboard_test.py`, `tests/file_mode_test.py` | inline theme CSS ใน fixtures ที่สร้าง HTML ด้วย `set_content()` |
| `docs/superpowers/…` | เอกสารออกแบบ แผน และสถานะงานที่อนุมัติ |
| รายงานนี้ | ผลทดสอบและข้อจำกัด |

ไม่มีการเปลี่ยนสูตร, WaterData, API origin/version/cache, responsibility mapping, adapters,
Netlify Functions/routing, dataset, sync authentication หรือ visitor-counter logic
ตรวจเปรียบเทียบไฟล์ site เดิม 20 ไฟล์กับสำเนาก่อนแก้ พบเปลี่ยนเฉพาะ `index.html` และ `authority.html`
และเพิ่ม stylesheet ใหม่; JavaScript ใน template เดิมยังคงเดิม

## หลักฐานก่อน–หลัง

Artifact directory:

`C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\ui-refresh-20261116`

- `baseline-source/` — สำเนา source/tests ก่อนปรับ รวมลิงก์แม่กาที่ซ่อนอยู่แล้ว ไม่มี `.env`/credentials
- `baseline/states.json`, `baseline/hashes.json` — semantic baseline และ hashes
- `baseline/*.png` — ภาพก่อนปรับ 40 route/viewport cases
- `verify-all/results.json` — ผลตรวจ UI รวม 78 groups และเทียบ 230 semantic states
- `verify-all/*.png`, `verify-province/*.png`, `verify-scoped/*.png` — ภาพหลังปรับ 5 viewport
- `reference-*.png`, `after-*.png` — ภาพเทียบกับไฟล์อ้างอิงที่ 1440/390px โดย mock network ทั้งหมด
- `mobile-map/`, `selection-shots/` — popup/selection evidence จาก regression เดิม
- `*.final.log`, `ui-all.log` — ผลรันจริงของแต่ละชุด

การเทียบ semantics ใช้ fixture เดียวกันต่อ route/viewport/action: จำนวน/รายการ, KPI,
chart labels/datasets, filter state, context, DSS และ counter identity ต้องเท่ากัน
ชื่อแบรนด์/ชื่อแท็บจังหวัดตรวจด้วย assertions ชื่อใหม่แยกจาก baseline
ไม่ใช้ pixel equality ระหว่าง UI เก่ากับ UI ใหม่ เพราะหน้าตาเป็นส่วนที่ตั้งใจเปลี่ยน

ข้อมูลฝังในไฟล์อ้างอิงไม่ได้ใช้เป็นข้อมูลของระบบใหม่ ภาพ reference กับภาพระบบใหม่จึงมีจำนวนต่างกันได้
ตัวเลขที่ใช้ยืนยัน parity มาจาก fixture ก่อน–หลังของระบบจริง ไม่ใช่จาก reference

## ผลตรวจ

| ชุด | ผล |
|---|---|
| UI baseline capture | ผ่าน 40 groups ก่อนเปลี่ยน product code |
| UI brand | ผ่าน 42 groups; เห็น RED จากชื่อเดิมก่อนแก้ แล้ว GREEN หลังแก้ |
| UI province | ผ่าน 8 groups รวม table cap 500 จาก fixture 501 รายการ |
| UI scoped | ผ่าน 37 groups รวม desktop layout, ลำดับ mobile และ DSS accent 5px |
| UI verify-all | ผ่าน 78 groups / 230 state comparisons รวมทุก 29 อปท., 4 อำเภอ, จังหวัด, invalid/failed/empty cases |
| `playwright_dashboard_test.py` | ผ่าน 23 checks |
| `file_mode_test.py` | ผ่าน 5 checks |
| `phase2_filter_playwright.py` | ผ่าน desktop + mobile 360/390/412 |
| `round3_map_stretch_playwright.py` | ผ่าน desktop + mobile 360/390/412 |
| `mobile_responsive_audit_test.py` | ผ่าน 27 checks |
| `development_data_source_playwright.py` | ผ่าน A–E และ G ที่ 1440/360/390/412; mocked API |
| `authority_locked_playwright.py` | ผ่าน 43 checks รวม 29 routes และ refresh |
| `authority_selection_playwright.py` | ผ่าน 5 viewport |
| `authority_cluster_playwright.py` | ผ่าน 15 checks |
| `authority_image_requests_playwright.py` | ผ่าน 3 modes |
| `authority_parity_playwright.py` | ผ่าน 9 checks รวม Mae Ka เดิม |
| `authority_rollout_functional_playwright.py` | ผ่าน 6 checks |
| `authority_rollout_jurisdiction_playwright.py` | ผ่าน 5 checks |
| `authority_counter_rollout_playwright.py` | ผ่าน 6 checks |
| `authority_wheel_zoom_playwright.py` | ผ่าน 1440/768/390/360; zoom/scroll/popup/fullscreen และไม่มี page errors |
| `district_scope_test.mjs` | ผ่าน canonical mappings, scope IDs, unresolved และ coordinate handling |
| `district_dashboard_playwright.mjs` | ผ่าน 52 groups + 5 visual comparisons ของ template ปัจจุบัน; ไม่เปิด historical snapshot comparison ที่ตั้งใจจะต่างเพราะ UI ใหม่ |
| `broken_kpi_insight_playwright.mjs` | ผ่าน 11 checks |
| `mobile_map_popup_playwright.mjs` | ผ่าน 16 checks รวม Android touch, หมุดซ้อน zoom 16/18, popup/fullscreen/modal |
| Syntax/diff | JavaScript/inline syntax และ `git diff --check` ผ่าน |

ระหว่างตรวจพบ generic card border ทำให้ accent สีของ DSS บางลงจาก 5px เป็น 1px
เพิ่ม test ที่เห็น FAIL ก่อน แล้วคืนความหนา 5px โดยไม่แตะกฎหรือข้อความ DSS

## ข้อจำกัดและการตัดสินใจ

- ทุก browser test เป็น mocked verification ไม่มีการยืนยันจำนวนข้อมูล Production ปัจจุบันหรือรูป Google Drive จริง
- ฟอนต์ Google ถูกบล็อกในภาพทดสอบ ใช้ fallback ที่อ่านไทยได้; ไม่อ้างว่าภาพเหล่านี้ยืนยันการ render Prompt จาก Google สำเร็จ
- ใช้ Chromium จำลอง Android พร้อม touch ไม่ได้ทดสอบโทรศัพท์จริงหรือ Safari/iOS
- การทดสอบบางชุดใช้ read-only static server ที่จำลอง rewrites และ unavailable API; ไม่ใช่การยืนยัน Netlify deploy/Functions จริง
- ตัวนับจังหวัดเดิมส่ง hit บน HTTP host ที่ไม่ได้เป็น Production guard แบบ scoped pages; UI harness จำลอง session ที่นับวันนี้แล้วด้วย daily key เดิมและ intercept requests ทั้งหมด ไม่เปลี่ยน counter logic ในงาน UI นี้
- ทำในโฟลเดอร์ที่ผู้ใช้ระบุ บน branch `codex/dashboard-ui-refresh` ตามแผน แทนสร้าง checkout ใหม่; สำรอง source และงานค้างไว้ก่อนแก้
- ใช้ runtimes/vendor cache ที่ติดตั้งไว้แล้ว ไม่ติดตั้ง dependencies ใหม่
- Backend suite ไม่ได้รันซ้ำ เพราะไม่มี backend/storage changes
- ผลลัพธ์ที่ชุดทดสอบเขียนทับใน repo ถูกเก็บสำเนาเป็นหลักฐานนอก repo แล้วคืนไฟล์เดิมจากสำเนาก่อนเริ่ม ไม่ใช้ reset

## สถานะส่งมอบ

งานยังอยู่ใน local branch ไม่มี commit/push/merge/deploy และไม่มี Production mutation
ผลตรวจอิสระ: Ready — ไม่พบ Critical หรือ Important regression; ผู้ตรวจทดสอบเพิ่มแบบ mocked 8 กรณีที่ 360/720/1101/1440px รวมชื่อไทยยาว, font fallback, header/control geometry และ focus outline ผ่านทั้งหมด

ข้อเสนอ Minor ที่ยังไม่ทำ: เพิ่ม bounding-rectangle และ computed outline assertions ใน `tests/dashboard_ui_playwright.mjs` เพื่อจับ header ทับ controls หรือ focus outline หายโดยตรง ปัจจุบันชุดหลักตรวจ overflow/focus และผู้ตรวจอิสระยืนยัน geometry/outline แล้ว จึงเลื่อนไว้เป็นข้อเสนอเพิ่ม coverage ไม่ใช่ product defect

การตรวจ 200% ใช้ขนาด CSS viewport เทียบเท่า 720×450 ไม่ใช่การตั้ง browser zoom จริง

ภาพหลักฐานเพิ่มเติมอยู่ใน artifact root: `province-dropdown-1440.png`, `province-gallery-390.png`, `province-image-modal-390.png`, `scoped-fullscreen-image-390.png` และ `scoped-chart-modal-390.png` (ทั้งหมดใช้ mocked services)

สถานะส่งตรวจรับ: READY สำหรับผู้ใช้ตรวจ UI ใน localhost; คง branch และทุกไฟล์ไว้ในเครื่อง ไม่มี integration หรือ deployment

## แก้ไขหลังผู้ใช้ตรวจหน้าตา — 16 พฤศจิกายน 2026

คำสรุปรอบแรกว่าหน้าตาตรงแบบยังไม่เพียงพอ: CSS เปลี่ยนเพียงธีม แต่ยังคงโครง KPI และตัวกรองเดิม รอบนี้ใช้ไฟล์ `C:/Users/Anupong/Desktop/rawชั่วคราว/index (5).html` เป็น reference โดยตรงสำหรับหน้าจังหวัด

- `site/assets/dashboard-theme.css`: จัด KPI เป็น grid ไอคอนซ้าย/ตัวเลขขวา, ไอคอนวงกลม 40px, ลายน้ำ, gradient พาสเทล, border/radius/type ตาม reference; <=420px ใช้หนึ่งคอลัมน์; ปรับหัวเว็บ หัวข้อ แท็บ และกรอบแผนที่
- `site/index.html`: เพิ่มเฉพาะ wrapper/label ในตัวกรองเดิมเพื่อแยกหัวข้อ/จำนวน/ปุ่ม reset ออกจากช่องกรอง เก็บ IDs และ controls อำเภอ/อปท./ตำบล/ประเภทไว้ครบ ไม่เพิ่มตัวกรองหรือเปลี่ยน handler
- `tests/province_reference_ui_playwright.mjs`: เพิ่มการเทียบ computed presentation กับ reference จริง และ geometry/จำนวนคอลัมน์/overflow ที่ 1440/768/412/390/360; เห็น FAIL ก่อนแก้และ PASS หลังแก้
- `tests/dashboard_ui_playwright.mjs`: ปรับ assertion radius ให้ตรงต้นแบบ 22px สำหรับ filter และ 20px สำหรับ KPI
- หน้าจังหวัดเป็นขอบเขต correction รอบนี้; ไม่แก้ scoped-page implementation เพิ่ม และรักษางานเดิมทั้งหมด

ผลตรวจจริง (mocked services ทุกกรณี):

| การตรวจ | ผล |
|---|---|
| เทียบ reference presentation + layout | PASS ทั้ง 5 viewport |
| UI regression ทั่วระบบ | PASS 78 groups / 230 semantic states; ต่อจากนั้นปรับเฉพาะ mobile provincial column/font และทวน affected province suite อีกครั้ง |
| Province suite หลังแก้มือถือรอบสุดท้าย | PASS 8 groups |
| Dashboard / file mode | PASS 23 / 5 checks |
| Filter desktop/mobile | PASS 360/390/412 + desktop |
| Map stretch หลัง CSS สุดท้าย | PASS desktop + 360/390/412 |
| Popup/fullscreen/modal | PASS 16 mobile/desktop cases |
| Inline JS เทียบ baseline | ทั้งสอง template เหมือนเดิมทุก script และ syntax valid |
| node --check / git diff --check | PASS (Git แจ้ง line-ending warning เดิมใน test support ไม่มี whitespace error) |

ภาพเปรียบเทียบใหม่: artifact root เดิม ภายใต้ `reference-correction-final/reference-1440.png`, `current-1440.png`, `reference-390.png`, `current-390.png`; ผลละเอียด `reference-correction-final/results.json`

ความต่างที่ตั้งใจรักษา: ตัวกรองและข้อความ/สูตรเดิม ไม่คัดลอกชุดตัวกรองใหม่หรือข้อมูลฝังจาก reference; ภาพ mocked ใช้จำนวนข้อมูลต่างจาก reference จึงไม่ใช้ยอดตัวเลขเพื่อวัดความเหมือน หัวเว็บใช้ชื่อใหม่ที่อนุมัติ ไม่มีการยืนยันภาพ Google จริงหรือโทรศัพท์จริงในรอบนี้

คืน tracked generated JSON/screenshots จากสำเนาก่อนงานหลังเก็บหลักฐานแล้ว; ไม่ commit/push/merge/deploy หรือเปลี่ยน Production

## เฟส 1 — 17 พ.ย.

แผน: `docs/superpowers/plans/2026-11-17-phase1-province-filter-bar.md` · spec §4 เฟส 1 — **ส่งตรวจรับ: ยังไม่ยืนยัน visual parity จนกว่าผู้ใช้ตรวจด้วยตาที่ localhost**

### สิ่งที่เปลี่ยน
- `site/index.html`: แทนแถบกรองบทสรุปผู้บริหารด้วยโครง `#gfBar > .gf-inner > .gf-head + .gf-grid + #gfChips` (วางที่เดิมใน `#view-exec`). ลำดับ DOM = ค้นหา · อำเภอ · อบต./เทศบาล · ตำบล · ประเภท · สถานะ · ปัญหา; ปุ่ม "↺ ล้างตัวกรอง" อยู่ในหัวแถบเดียวกับ `#efCount`
- JS (เฉพาะ `EXECUTIVE ANALYTICS ENGINE`): `execFilter` เพิ่ม `q/status/problem`; `execExtraPass()` ใช้ใน `getExecData()` และ `RISK_BASE`; cache key แผนที่ + `isFiltered` รวมค่าใหม่; search debounce 220ms + ปุ่มล้าง; `updateGfChips()` (ไม่แสดงชิปของค่าที่ล็อกตาม route); ปุ่ม reset ล้างทุกช่องและคง `LOCKED_*`
- CSS: ลบกฎ `.exec-filter-bar*` ทั้งหมดใน `index.html` (inline) และ `dashboard-theme.css` (ซ้ำสองชุด) แทนด้วยชุด `.gf*` ชุดเดียว; overflow ของ `.gf-inner` เป็น `visible` เพื่อไม่ตัด list ตำบล
- ไม่แตะ: สูตร KPI/DSS, adapters, WaterData/cache/API, แท็บรายละเอียด, `authority.html`
- Tests: ใหม่ `tests/province_filter_bar_playwright.mjs`; ปรับ selector `.exec-filter-bar` → `.gf-*` ใน `phase2_filter_playwright.py`, `mobile_responsive_audit_test.py`, `dashboard_ui_playwright.mjs`, `province_reference_ui_playwright.mjs`

### ผลทดสอบจริง (mocked ทั้งหมด — ไม่มี visitor hit / Production write)
| Test | ผล |
|---|---|
| `province_filter_bar_playwright.mjs` (ลำดับ/ป้ายกำกับ/geometry 1440·768·412·390·360 + ค้นหา/สถานะ/ปัญหา/ชิป/reset/cross-filter/แท็บรายละเอียด/combobox ตำบล) | RED ก่อนเขียนโค้ดทั้ง 2 ครั้ง (ไม่มี `#gfBar`; ปุ่มล้างค้นหาไม่ทำงาน) → PASS |
| `playwright_dashboard_test.py` | PASS |
| `phase2_filter_playwright.py`, `round3_map_stretch_playwright.py` | PASS (รันผ่าน wrapper ที่ mock counter; 0 `/hit/`) |
| `mobile_map_popup_playwright.mjs`, `static_integrity_test.py`, `mobile_responsive_audit_test.py`, `playwright_cache_logic_test.py` | PASS |
| `province_reference_ui_playwright.mjs` (เทียบ `index (5).html`) | PASS (รอบแรก fail 1 จุด padding มือถือ 14px→แก้เป็น 22px ตามต้นแบบ; อีกรอบ fail ที่ `.gcard:hover` ของหน้าต้นแบบ opacity 0.997 = timing → รันซ้ำผ่าน) |
| `dashboard_ui_playwright.mjs --mode verify-province` | **ไม่ได้รัน** — ต้องมี baseline `states.json` จากรอบ capture ก่อนหน้า (ไม่มีในเครื่อง); แก้ selector แล้วแต่ยังไม่ผ่านการรัน |
| `git diff --check` | ไม่มี whitespace error (มีเพียงคำเตือน LF→CRLF เดิม) |

### ภาพเทียบ (reference vs current, mocked)
`C:\Users\Anupong\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_2167d877-b920-4c63-b5dc-0682282b70a9\phase1-screens\` — `reference-province-{1440,768,390}.png` / `current-province-{1440,768,390}.png`

ความต่างที่เหลือ (ตั้งใจ/ข้อจำกัด): ต้นแบบไม่มีช่อง อำเภอ/อบต. (ผู้ใช้สั่งเพิ่ม D1) จึงจัดแถวต่างจากต้นแบบ; ไม่มี "ข้อมูลล่าสุดเมื่อ…" (OPEN); ช่องตำบลเป็น combobox พิมพ์ค้นหาเดิม ไม่มีลูกศร dropdown; จำนวนข้อมูลต่างเพราะใช้ fixture mock (57 รายการ) ไม่ใช่ข้อมูลฝังของต้นแบบ (1,827)

### ไฟล์ generated ที่ถูกเขียนทับ
เฉพาะที่ tests ที่รันเขียน: `tests/playwright-results.json`, `tests/playwright-cache-results.json`, `tests/mobile-responsive-audit-results.json` (และอาจมี `tests/screenshots/*` จาก `playwright_dashboard_test.py`) — ไม่ลบ/ไม่คืนค่า; ผลของ province_filter/reference ไปที่ scratchpad นอก repo

### Rulings
1. ปัญหา: แสดงเฉพาะ tag ใน `PROBLEM_FILTER_TAGS` ที่มีข้อมูลจริง ≥1 รายการ พร้อมจำนวน (ไม่แสดงตัวเลือกว่าง)
2. ปรับ selector ใน tests เดิม 4 ไฟล์ไปเป็น `.gf-*` แทนการคงคลาส `.exec-filter-bar` ไว้บน DOM
3. คงโครง `.gf-grid` ≥1100px ด้วย flex-wrap (สัดส่วน 2.2:1:1:1 แถวบน, 3 เท่ากันแถวล่าง) แทน CSS grid เพราะแถวบน/ล่างมีจำนวนคอลัมน์ต่างกัน
4. Final review: self-review (ไม่ได้ dispatch reviewer ใหม่ เพราะไม่มี commit ให้สร้าง review package)
