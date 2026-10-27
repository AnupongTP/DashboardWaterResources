# รายงาน District Dashboards: 4 อำเภอ ใช้ Authority Dashboard ร่วมกัน

วันที่ตรวจ: 25 ตุลาคม 2026 (Asia/Bangkok)

สถานะ: **ผ่านการพัฒนาและการทดสอบ local พร้อมให้ผู้ใช้ตรวจรับ** ยังไม่มีการ commit, push, merge หรือ deploy

## 1. Baseline และงานเดิมที่เก็บรักษาไว้

- Repository: `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main`
- Branch: `main`; HEAD ก่อนและหลังงาน: `75f624b854375d0a1df980fc04c6d075ea015ab9`
- สถานะเริ่มต้นมีเฉพาะ `site/assets/authority-app.js` และ `site/authority.html` ที่แก้ค้างจากคำสั่งก่อนหน้า ได้แก่ ซ่อนคำแนะนำงบประมาณภาพรวม, การ์ดสรุปปัญหา 4 ช่องพร้อมการกรอง, และป้องกันข้อความคุณภาพน้ำซ้ำใน DSS รายจุด ทั้งหมดเป็นงานที่ทราบที่มาและเก็บไว้
- ใช้ working tree ปัจจุบันนี้เป็น Authority baseline ไม่ใช้หน้าจังหวัด และไม่ย้อนกลับไปใช้ UI จาก commit เก่า จึงยังคงการ์ดปัญหาที่ผู้ใช้เพิ่งอนุมัติและการซ่อนคำแนะนำภาพรวมไว้ ข้อความ/กฎ/คำแนะนำรายจุดทั้งสี่กลุ่มยังคงเดิม
- เนื่องจาก working tree ไม่สะอาดตั้งแต่เริ่ม จึงคง branch `main` ตามเงื่อนไขให้สร้าง development branch เมื่อ clean ไม่มีการย้าย branch หรือเปลี่ยนประวัติ Git
- เก็บ snapshot และ hash ก่อนแก้ไว้ภายนอก repository ใน `C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\district-preflight-20261025` โดยไม่ได้คัดลอก `.env` หรือ credentials

## 2. สถาปัตยกรรมและไฟล์

ใช้ HTML และ UI JavaScript ชุดเดียว คือ `site/authority.html` และ `site/assets/authority-app.js` ไม่มีสำเนาหน้าอำเภอ 4 ชุด ไม่มี framework/backend/database หรือ application dependency ใหม่

| ไฟล์ | การเปลี่ยนแปลงในงานอำเภอ |
| --- | --- |
| `site/assets/district-routes.js` (ใหม่) | Registry เฉพาะ 4 อำเภอ ตรวจให้ตรง `DISTRICT_ORDER`, slug ไม่ซ้ำ, รับเฉพาะเส้นทางที่ถูกต้อง และแสดง failure ของอำเภอโดยใช้ presentation เดิม |
| `site/assets/district-data-adapter.js` (ใหม่) | คัดข้อมูลด้วย `recordMatchesDistrict()` แล้วแปลงเป็น record contract เดิมด้วย `MaekaDataAdapter.toMaekaRecord()`; คงการแปลงปริมาตร/พิกัดเหมือน Authority โดยไม่แก้ Authority adapter |
| `site/authority.html` | เพิ่ม base URL สำหรับ district, โหลดโมดูลใหม่ และแยกเฉพาะ boot context/heading/title/ข้อความ zero state/tooltip reset ตามประเภท route |
| `site/assets/authority-app.js` | เพิ่ม counter identity ของ district และ path guard ของ counter เท่านั้น เมื่อเทียบกับ snapshot ก่อนงานนี้; โค้ด UI, กฎ DSS, filters, KPI, chart, map, images และ selection ก่อนส่วน counter เหมือนเดิมทุก byte |
| `netlify.toml` | เพิ่ม rewrite `/district` และ `/district/*` ไป template เดียว หลัง API และ Authority rules เดิม; root district ถูกปฏิเสธโดย registry ไม่เปิดข้อมูลจังหวัด |
| `tests/district_scope_test.mjs` (ใหม่) | Unit checks ของ registry, canonical mapping, IDs, unresolved records, aliases, พิกัด, input immutability และ conversion parity |
| `tests/district_browser_support.mjs` (ใหม่) | Fixtures อิสระและ Playwright network mocks; ใช้ library assets ที่ cache ตามเวอร์ชันจริง ปิดคำขอภายนอกที่ไม่ได้จำลอง |
| `tests/district_dashboard_playwright.mjs` (ใหม่) | Route/scope/failure/cache, ภาพ before/after, functional parity, mobile, image fallback และ counter isolation |
| `tests/authority_maeka_prototype_playwright.py`, `tests/authority_selection_playwright.py`, `tests/authority_rollout_functional_playwright.py`, `tests/authority_parity_playwright.py` | ปรับเฉพาะ assertion ที่ยังอ้าง overview DSS รุ่นก่อนคำสั่งปรับการ์ดล่าสุด ให้ตรวจหัวข้อ/การ์ดปัจจุบันและคำแนะนำที่ซ่อนอยู่ โดยคงการตรวจตัวเลขและ interactions |
| `docs/district-dashboard-test-results.json` (ใหม่) | ผลจริงของ 57 browser groups และ 10 visual comparisons |
| `docs/district-dashboard-screenshots/` (ใหม่) | ภาพ 15 ไฟล์: Authority ก่อนเพิ่มอำเภอ, Authority หลังเพิ่มอำเภอ และ District ที่ 5 viewport |
| รายงานฉบับนี้ (ใหม่) | บันทึกสถาปัตยกรรม ผลทดสอบ ขอบเขต และข้อจำกัด |

Shared app ยังคงชื่อ hook ภายใน `__AUTHORITY_DATA__`/`__AUTHORITY_CONTEXT__` เพื่อไม่ refactor ระบบเดิม หน้าอำเภอเพิ่ม `__DISTRICT_CONTEXT__` และ `__DISTRICT_PAGE__` สำหรับ diagnostics และไม่ตั้ง `__AUTHORITY_PAGE__` เป็นหน่วยงานปลอม

## 3. URL และ routing

| อำเภอ | Local ที่ทดสอบ | Production URL หลังผู้ใช้ deploy ในอนาคต |
| --- | --- | --- |
| เมืองพะเยา | http://localhost:8888/district/mueang-phayao/ | https://dashboard-waterresources1.netlify.app/district/mueang-phayao/ |
| แม่ใจ | http://localhost:8888/district/mae-chai/ | https://dashboard-waterresources1.netlify.app/district/mae-chai/ |
| ดอกคำใต้ | http://localhost:8888/district/dok-kham-tai/ | https://dashboard-waterresources1.netlify.app/district/dok-kham-tai/ |
| ภูกามยาว | http://localhost:8888/district/phu-kam-yao/ | https://dashboard-waterresources1.netlify.app/district/phu-kam-yao/ |

ทดสอบผ่าน Netlify Dev จริงทั้งมี/ไม่มี slash ปิดท้าย และ reload ได้ทั้งสองแบบ ไม่เพิ่ม redirect เพื่อบังคับ slash; ใช้ URL มี slash เป็นลิงก์ที่แนะนำ Root `/district`, `/district/`, unknown slug, ตัวพิมพ์ใหญ่, extra segment และ encoded slug ที่ไม่อยู่ใน registry ถูกปฏิเสธ ไม่โหลด dashboard/counter และไม่ fallback ไปจังหวัด Existing `/authority`, `/authority/`, `/authority/<slug>/`, `/`, `/index.html`, `/maeka.html` และ API precedence ผ่าน regression เดิม

ยังไม่ได้เผยแพร่หรือยืนยันว่า Production URL เหล่านี้ใช้งานได้บน deployment ปัจจุบัน

## 4. ขอบเขตข้อมูลและความน่าเชื่อถือ

ลำดับ: `WaterData.load()` → `AuthorityRoutes.validateCurrentDataset()` เดิม → `DistrictDataAdapter` → shared UI

- Localhost ยังใช้ GET version/dataset ที่ active Production origin ตาม runtime เดิม ในการทดสอบ intercept ทั้งหมดเป็น fixtures ไม่มีการอ่าน/เขียน dataset จริงบน Production
- District ใช้ canonical `districtForTambon()` ผ่าน `recordMatchesDistrict()` และใช้ `DISTRICT_TAMBONS` สำหรับตัวกรองตำบล ไม่รวมยอดจาก Authority dashboards
- LocalAuthority ที่ว่าง, ambiguous หรือ invalid ไม่ทำให้ record ถูกตัดออก หากตำบลยืนยันอำเภอได้ ไม่ใช้ owner, ชื่อไม่ครบ หรือพิกัดมาทายอำเภอ
- ตัวอย่าง fixtures อิสระมี 37 records โดย 36 อยู่ในขอบเขต 29 ตำบล: เมืองพะเยา 13, แม่ใจ 6, ดอกคำใต้ 15, ภูกามยาว 2; อีกหนึ่งตำบลนอกขอบเขตถูกตัดออก ตัวเลขนี้เป็น **mock fixture เท่านั้น ไม่ใช่ยอด Production และไม่ได้ hardcode ลง application**
- ดอกคำใต้รวม ID 2001–2006 ตามตำบล แม้มีข้อมูลหน่วยงานว่าง/ผิด/เขตซ้อน ID 2003 ไม่มีพิกัดยังอยู่ในตารางและสถิติ แต่ไม่มีหมุด ID 2004 ใช้ alias `บ้านปิ่น` → `บ้านปิน` จาก mapping เดิม
- Records ที่ไม่มีพิกัดหรือพิกัดไม่ถูกต้องยังอยู่ใน KPI/charts/table/DSS การแปลง field ด้านปริมาตร/ความลึกใช้กฎเดิมและมี unit parity check กับ Authority adapter
- Validator เดิมตรวจ origin/version/count/ID uniqueness และ provenance ของ IndexedDB; cache ที่ version endpoint ยืนยันแล้วใช้ได้ ส่วน offline cache, static bootstrap, malformed ID, duplicate ID และจำนวนไม่ตรงถูกปฏิเสธ
- Dataset ที่ valid แต่ไม่มี record ในอำเภอนั้นเป็น zero state จริง ไม่ใช่ API failure
- `DATA` ของ shared UI ถูกเตรียมเฉพาะอำเภอไว้ตั้งแต่ boot ทุกตัวกรองและ reset จึงไม่สามารถคืนข้อมูลนอกอำเภอ ไม่มี district/authority selector ใหม่ ตัวกรองตำบลอยู่ภายในอำเภอเสมอ

## 5. Visitor counters

| Slug | Namespace | Daily key |
| --- | --- | --- |
| `mueang-phayao` | `pyo-water-district-mueang-phayao` | `pyoDistrictVisitDate:mueang-phayao` |
| `mae-chai` | `pyo-water-district-mae-chai` | `pyoDistrictVisitDate:mae-chai` |
| `dok-kham-tai` | `pyo-water-district-dok-kham-tai` | `pyoDistrictVisitDate:dok-kham-tai` |
| `phu-kam-yao` | `pyo-water-district-phu-kam-yao` | `pyoDistrictVisitDate:phu-kam-yao` |

ไม่มี collision กับ 29 Authority counters, provincial namespace `pyo-water-dashboard-2026`/key `pyoVisitDate` หรือ Mae Ka เดิม `pyo-water-maeka-dashboard`/`pyoMaeKaVisitDate` Daily dedup ใช้ ISO UTC เหมือนเดิม ไม่แก้การแสดงยอดหรือ country breakdown

Guard ยอม hit เฉพาะ HTTPS active Production hostname และ district path ที่ตรง validated context เท่านั้น Localhost/preview/invalid routes ไม่ hit การจำลอง Production origin ใน tests intercept `/hit/` ทั้งหมดก่อนออก network จึงไม่มี visitor writes จริง

## 6. ผลทดสอบ

Browser: Chromium `chromium-1234`; หน้า local จาก Netlify Dev ที่ `http://localhost:8888` ทุกข้อมูล/ภาพ/counter/geo ถูก mock และ library assets ใช้ pinned versions ที่ cache ไว้นอก repository ไม่มีการขอภาพ Google Drive จริง ไม่มี Production dataset หรือ visitor-counter verification จริง

| การตรวจ | ผลจริง |
| --- | --- |
| `node tests/district_scope_test.mjs` | ผ่าน registry 4/29 canonical tambons, strict paths, scope IDs, unresolved inclusion, aliases, invalid/missing coordinates, ไม่แก้ input และ conversion parity |
| `node tests/district_dashboard_playwright.mjs` | **ผ่านครบ 57 กลุ่ม** ดู JSON ผลทดสอบที่แนบ |
| Route/scope | ครบ 4 อำเภอ, มี/ไม่มี slash, reload, heading/title, IDs และ totals จาก oracle อิสระ, ไม่มี record นอกขอบเขตหรือ duplicate, reset กลับอำเภอเดิม |
| Cache/failure | validated IndexedDB, offline/stale rejection, static-bootstrap rejection, count mismatch, duplicate/malformed ID, retry และ valid zero district ผ่าน |
| Functional | KPI ทั้งห้าและ insight, charts ทั้งสาม/expanded dialogs, summary problem filters, tambon/type/problem/search/reset, zero-result, table→marker, marker A→B, popup close, no-coordinate record, DSS สี่กลุ่มและคำแนะนำเดิม ผ่าน |
| Map | ใช้ MarkerCluster จริง 1.5.3; cluster zoom, overlapping-coordinate spiderfy, map-only layers, fullscreen และ mouse wheel ผ่าน |
| Images | mock primary success/enlargement, failed placeholder/original link, reopen ไม่ retry อัตโนมัติ, user thumbnail success และทุก endpoint fail พร้อมซ่อนปุ่มเมื่อครบ ผ่าน |
| District counters | 4 identities, daily dedup, no collisions, localhost/preview/invalid no hit, service failure ผ่านด้วย mocks |
| Responsive | ครบทั้ง 4 อำเภอที่ 1440/768/412/390/360px ไม่มี horizontal overflow; functional parity ใช้ shared template ที่ทุกขนาดจอ |
| `authority_locked_playwright.py` | ผ่านทั้ง 29 URL พร้อม refresh, root, API precedence, failure/cache, reset และ mobile |
| `authority_maeka_prototype_playwright.py` | ผ่าน 8 กลุ่ม |
| `authority_selection_playwright.py` | ผ่านทั้ง 5 viewport |
| `authority_rollout_functional_playwright.py` | ผ่าน 6 กลุ่ม รวม non-Mae Ka และ single/multi-Tambon |
| `authority_parity_playwright.py` | ผ่าน 9 กลุ่ม รวมหน้า Mae Ka ต้นฉบับและ counter mocks |
| `authority_cluster_playwright.py` | ผ่าน 15 กลุ่ม รวม provincial icon geometry/zoom และ overlapping markers |
| `authority_wheel_zoom_playwright.py` | ผ่าน 1440/412/390/360px รวม wheel, controls, popup, outside scroll, fullscreen ไม่มี page error |
| `authority_counter_rollout_playwright.py` | ผ่าน 6 กลุ่ม |
| `authority_rollout_jurisdiction_playwright.py` | ผ่าน ID oracle, เขตซ้อน, multi-Tambon+Moo, search, no coordinates และ zero authority |
| `authority_image_requests_playwright.py` | ผ่าน primary success, manual thumbnail success และ all-fail ไม่มี JavaScript page error |
| `development_data_source_playwright.py` | ผ่าน A–E และ responsive 1440/360/390/412 ด้วย API mocks |
| `playwright_dashboard_test.py` | ผ่าน 23 การตรวจหน้าจังหวัด |
| `mobile_responsive_audit_test.py` | ผ่าน 27 การตรวจที่ 360/390/412 |
| `file_mode_test.py`, `playwright_cache_logic_test.py` | ผ่าน 5 + 5 กลุ่ม |
| `phase2_filter_playwright.py`, `round3_map_stretch_playwright.py` | ผ่าน desktop และ mobile 360/390/412 โดยใช้ localhost:8888 |
| `area_responsibility_test.mjs`, `phase2_area_responsibility_test.mjs` | ผ่าน mapping regression ทั้งคู่ |
| `netlify_function_test.mjs` | ผ่าน 14 กลุ่มด้วย memory-store mocks รวม public reads ไม่เขียน และ authenticated sync ยังทำงาน |
| `gas_sync_contract_test.mjs`, `phase2_static_contract_test.py`, `static_integrity_test.py` | ผ่านทั้งหมด |
| Syntax และ whitespace | `node --check` ของไฟล์ JS/MJS ที่เกี่ยวข้อง, compile inline boot scripts และ `git diff --check` ผ่าน |

### ปัญหาระหว่างตรวจและการแก้

1. Existing prototype test ล้มที่ assertion ของหัวข้อ DSS เก่า แม้ใช้ snapshot ก่อนเริ่มเพิ่มอำเภอ จึงยืนยันว่าเป็น outdated test จากการปรับการ์ดก่อนหน้างานนี้ ปรับ 4 test files ให้ตรวจ UI baseline ที่ผู้ใช้อนุมัติล่าสุด รวมค่าการ์ด/การซ่อนคำแนะนำ และรันใหม่ผ่าน ไม่เปลี่ยน application เพื่อให้เข้ากับ assertion เก่า
2. Screenshot รอบแรกต่างเฉพาะ Chart.js animation จึงแก้ test ให้ `chart.stop()`/`update('none')` และรอ frame ก่อนถ่าย ไม่ปรับ source UI
3. การทดสอบ marker/spiderfy ต้องรอ MarkerCluster animation และ pan หมุดให้เข้าจอก่อน dispatch click โดยเฉพาะมือถือ แก้เฉพาะ test ไม่เปลี่ยน threshold หรือ app behavior
4. Test ของ image all-fail เคยคาดว่าปุ่ม retry ถูกลบ แต่ behavior เดิมซ่อนปุ่มไว้ ปรับ assertion เป็น `isHidden()` ตาม implementation เดิม แล้วผ่าน
5. การเริ่ม Netlify Dev ครั้งแรกชนโปรเซสเดิมที่พอร์ต 8888/3999 ตรวจ PID และ HTTP response ก่อนใช้ process เดิมจริง ต่อมา process เดิมหยุดและ tests บางส่วนได้ connection refused ตรวจว่าพอร์ตว่างแล้วจึงเปิด Netlify Dev แบบ `--offline --no-open --port 8888` และรันชุดที่ขัดจังหวะใหม่จนผ่าน ไม่หยุด/kill process ของผู้ใช้โดยพลการ CLI มี warning ว่า local Netlify Database เริ่มไม่ได้ แต่โครงการนี้ไม่ได้ใช้ Database และ static server/functions/routing ทำงาน
6. Python เริ่มต้นไม่มี Playwright จึงเตรียม Python Playwright แยกไว้ใน test-tools directory ภายนอก repo ไม่แก้ package.json/lockfile หรือ app dependencies

ผลลัพธ์ JSON/screenshot เก่าที่ existing tests สร้างใหม่ถูกสำรองก่อนรัน เก็บผลรอบจริงไว้ใน `district-preflight-20261025/generated-run-results` แล้วคัดลอกเฉพาะไฟล์ generated ที่สำรองกลับมา ไม่ทิ้ง diff ของผลลัพธ์เก่าหรือ cache ในงานนี้ และไม่ใช้ Git reset/checkout เพื่อคืนไฟล์

## 7. หลักฐานภาพและการรักษา behavior

ไฟล์ `docs/district-dashboard-screenshots/` มี `before-authority-<width>.png`, `after-authority-<width>.png`, `district-<width>.png` สำหรับ 1440, 768, 412, 390 และ 360 รวม 15 ภาพ ตรวจภาพด้วยตาและเปรียบเทียบ pixels แล้ว:

| Width | Authority ก่อน–หลัง | District เทียบ Authority หลังปรับเฉพาะ heading ใน test |
| --- | ---: | ---: |
| 1440 | 0 | 0 |
| 768 | 0 | 0 |
| 412 | 0 | 0 |
| 390 | 0 | 0 |
| 360 | 0 | 0 |

ตัวเลขเป็นจำนวน pixels ที่ต่างเกิน 8/255 ในช่องสีใดช่องสีหนึ่ง การเปรียบเทียบ District ใช้ fixture เดียวกับ multi-Tambon Authority และ normalize เฉพาะ heading ใน browser ชั่วคราว ไม่มีการแก้ source เพื่อให้ภาพตรงกัน ตัวเลือกตำบลภายใน dropdown ต่างตามบริบทโดยเจตนา

ภาพใช้ tile/Google image/counter mocks และปิด third-party fonts จึงเห็น fallback fonts เหมือนกันทั้งสองฝั่ง พื้นแผนที่สีเทาในภาพเป็นผลจาก mock tiles ไม่ใช่การเอาภาพดาวเทียมออกจาก application

ตรวจ byte/hash เทียบ snapshot แล้วไฟล์ต่อไปนี้ตรงกันทั้งหมด: `site/index.html`, `site/maeka.html`, `site/assets/maeka-app.js`, `authority-routes.js`, `authority-data-adapter.js`, `area-responsibility.js`, `maeka-data-adapter.js`, `water-data-loader.js`, `runtime-config.js`, `cluster-icon.js` นอกจากนี้ CSS ใน shared template และโค้ด app ก่อนส่วน counter ซึ่งรวม KPI/DSS/map/selection/images/filters ตรงกับ snapshot ทุก byte

## 8. การรันทดสอบซ้ำ

New browser suite ใช้ Playwright ที่ติดตั้งสำหรับทดสอบ และ `DISTRICT_VENDOR_DIR` ที่มี `leaflet.js`, `leaflet.css` เวอร์ชัน 1.9.4, `chart.umd.min.js` 4.4.1, `leaflet.markercluster.js`, `MarkerCluster.css`, `MarkerCluster.Default.css` 1.5.3 ตาม URL ใน application เดิม cache assets เหล่านี้ไว้นอก repo เพียงครั้งเดียว

ตัวอย่าง environment ที่ใช้รอบนี้ (PowerShell):

```powershell
$audit='C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\district-preflight-20261025'
$env:DISTRICT_TEST_BASE='http://localhost:8888'
$env:DISTRICT_VENDOR_DIR="$audit\vendor"
$env:DISTRICT_BASELINE_DIR=$audit
$env:PLAYWRIGHT_MODULE_PATH='C:\Users\Anupong\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Users\Anupong\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe'
$env:DISTRICT_RESULT_PATH='docs/district-dashboard-test-results.json'
node tests/district_scope_test.mjs
node tests/district_dashboard_playwright.mjs
```

ก่อนรันต้องมี Netlify Dev ให้บริการที่พอร์ตจริงและใช้ไฟล์/routing ล่าสุด ชุด browser tests จะปิด external requests ที่ไม่ได้ mock; ไม่ต้องติดต่อ Production เพื่อทดสอบ Existing Python regressions ในรอบนี้ใช้ offline network guard `sitecustomize.py` จาก audit directory และ `PYTHONPATH` ของ Playwright ที่ติดตั้งแยกไว้

## 9. ข้อจำกัดและสถานะสุดท้าย

- ไม่ได้ทดสอบ Production deployment จริงหรืออ่านจำนวน records ล่าสุดจาก Production จึงไม่อ้างตัวเลข Production 1,844/1,846 หรือยอดอำเภอจริง
- Google Drive sharing/rate limits, ความพร้อมของ Abacus/Esri/Google Fonts และ browser อื่นนอกจาก Chromium ยังไม่ได้ยืนยันด้วยบริการจริงในงานนี้
- กฎ DSS และการตีความ depth/volume ที่เคยอภิปรายยังคง baseline เดิมตามข้อห้ามของงานนี้ ข้อความเชิงสาเหตุ/ความเร่งด่วนไม่ใช่ผลตรวจทางวิศวกรรมใหม่จากการเพิ่มหน้าอำเภอ
- Dataset scope มีเพียง 29 ตำบลใน 4 อำเภอตาม master ของโครงการ ไม่ใช่ทุกตำบลหรือทุกอำเภอของจังหวัดพะเยา
- Google Drive Project Memory ยังไม่ถูกแก้ รายการที่ควรเพิ่มภายหลัง: 4 district URLs, distinction ของ district/authority scoping และ unresolved inclusion, shared-template architecture, counter identities, fail-closed policy, baseline UI cards ล่าสุด และผลทดสอบ local โดยไม่อ้างว่า deploy แล้ว
- Branch/HEAD คงเดิม `main` / `75f624b854375d0a1df980fc04c6d075ea015ab9` มี source/config/test changes และรายงาน/ภาพใหม่ตามรายการข้างต้น ทั้งหมดไม่ staged และยังไม่ commit งานค้างเดิมสองไฟล์ยังอยู่
- ไม่มีการ commit, push, merge, reset, force push, deploy, publish, unlock Auto Publishing, แก้ Production data/secrets, Google Sheets, Apps Script, Netlify Blob หรือ visitor-counter data จริง

ผลสรุป: **พร้อมตรวจรับ local District Dashboards ทั้ง 4 อำเภอ โดยใช้ Authority UI เดียวกันและผ่านชุดทดสอบที่เกี่ยวข้องแล้ว**

## ติดตามหลังงานอำเภอ: ย่อรายชื่อใน KPI จุดชำรุดเสียหาย

หลังรายงานข้างต้น ผู้ใช้สั่งให้ย่อรายชื่อที่ยาวมากเมื่อกด KPI จุดชำรุดเสียหาย จึงปรับ shared `renderKpiInsight()` ให้แสดง 5 รายการแรกและปุ่มแสดงเพิ่มเติม/แสดงน้อยลง รายการไม่เกิน 5 จุดไม่แสดงปุ่ม และกลับสู่แบบย่อเมื่อเปลี่ยนชุดข้อมูลที่กรองหรือออกจาก KPI นี้ ยอดรวมและข้อมูลตาราง/แผนที่/กราฟยังนับทั้งหมดตามเดิม ใช้ร่วมกันทั้ง Authority และ District; ไม่แก้หน้าจังหวัดหรือ Mae Ka ต้นฉบับ

`tests/broken_kpi_insight_playwright.mjs` ผ่าน 11 กลุ่มด้วย mocks: Authority/District ที่ 1440/768/412/390/360px และ fixture 227 จุด ตรวจ preview 5 จุด, expand/collapse, Enter/Space, filter/reset/zero state, ไม่มี overflow และยอด/ตาราง/กราฟไม่เปลี่ยนเมื่อขยายรายชื่อ Syntax และ `git diff --check` ผ่าน ผล 57 กลุ่ม/ภาพ baseline ในรายงานหลักเป็นหลักฐานก่อนการปรับตามคำสั่งติดตามนี้
