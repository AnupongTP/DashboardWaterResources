# รายงานตรวจสอบและแก้แหล่งข้อมูล Local Development

วันที่ตรวจสอบ: 18 ตุลาคม 2026 (เวลาไทย)

## 1. สถานะก่อนแก้

- Repository ที่ใช้จริง: `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main` มี `.git` เป็น directory และ `git rev-parse --show-toplevel` ชี้มาที่นี่
- Branch: `main`; HEAD: `bb81574b95a9c8834e5e48df854ea55c969825a6`
- `git status --porcelain=v1` ก่อนแก้: ว่าง ไม่มีไฟล์แก้ค้าง ทั้ง staged และ unstaged
- ตรวจ `site/index.html`, runtime config, loader, bootstrap JSON/JS, `netlify.toml`, Functions สำหรับข้อมูล/version/file bridge, Blob store, package, เอกสาร และชุดทดสอบก่อนแก้ไฟล์

## 2. สาเหตุที่ตรวจยืนยัน

หน้าเว็บเรียก `WaterData.load()` ก่อนสร้าง KPI, ตัวกรอง และแผนที่. Runtime เดิมตรวจ `localhost`, `127.0.0.1`, `[::1]` เป็น `development` แต่ `apiUrl()` ส่ง `/api/waterresources/version` และ `/api/waterresources` แบบ relative สำหรับ development. ดังนั้น `localhost:8888` เรียก Netlify Dev/Blob ฝั่ง local ไม่ได้เรียกบัญชี Production ปัจจุบัน. หาก Blob ฝั่งนั้นยังว่าง ฟังก์ชัน GET dataset จะเรียก `seedFromStaticRequest()` และเขียน snapshot ที่แนบใน repo ลง Blob ฝั่งนั้น; snapshot มี 1,158 รายการ. นี่เป็นเส้นทางในโค้ดที่อธิบายผลสังเกต local 1,158 เทียบกับ Production 1,846 โดยไม่สมมติว่า Blob สองบัญชีใช้ร่วมกัน.

ข้อบกพร่องร่วม: cache ของโหมดที่ไม่ใช่ `file` เดิมรับ IndexedDB โดยไม่ตรวจ `remoteOrigin`; ค่า `water-dashboard-production-origin` ใน localStorage ชี้บัญชีเก่าได้; static bootstrap ที่ cache ไว้อาจถูกแสดงเหมือน cache จาก API. โหมด `file` เดิมใช้ Production origin เก่าเป็นค่าเริ่มต้น. ฟังก์ชันอ่านทั้งสองประกาศ CORS สำหรับ GET อยู่แล้ว; ตรวจ live เพิ่มเติมพบ `Access-Control-Allow-Origin: *` ทั้งคู่.

## 3. การแก้และนโยบายเลือก origin

Production ที่ใช้งาน: `https://dashboard-waterresources1.netlify.app` ใช้เฉพาะคำขออ่าน:

- `GET https://dashboard-waterresources1.netlify.app/api/waterresources/version`
- `GET https://dashboard-waterresources1.netlify.app/api/waterresources`

`runtime-config.js` เป็นจุดกำหนด origin. `development` ใช้ค่า `WATER_DASHBOARD_CONFIG.productionOrigin` หากระบุอย่างชัดเจน มิฉะนั้นใช้ Production ปัจจุบัน; ไม่ใช้ localStorage หรือ query override ที่ค้างจากบัญชีเก่า. `file` ยังคงรองรับ query/config override ที่ระบุชัด, รองรับ stored override อื่น และละทิ้ง stored origin ของบัญชีเก่า. `hosted` เรียก API same-origin แบบเดิม. Development/file ส่ง GET แบบ CORS โดยไม่มี `If-None-Match` ที่ทำให้เกิด preflight; hosted คงการใช้ ETag/304.

ก่อนแก้: Google Sheet → Production Sync → Production Blob → Production หน้าเว็บ; ส่วน localhost → Netlify Dev Blob หรือ bootstrap 1,158.

หลังแก้: Google Sheet → Production Sync → **Blob ของ active Production** → Production read APIs → localhost dashboard. ไม่มีการเรียก sync หรือ POST จาก local.

IndexedDB ยังคงตรวจ version ก่อนดาวน์โหลด dataset. Cache ใช้ซ้ำได้ต่อเมื่อ `remoteOrigin` ตรงกับ API origin ที่เลือกและ version ไม่ใช่ `bootstrap:*`; cache รุ่นเก่าที่ไม่มี origin, cache จาก localhost/บัญชีเก่า และ bootstrap จึงไม่ถูกยอมรับเป็นข้อมูล Production. หาก version ตรงกันใช้ cache โดยไม่ดาวน์โหลด dataset. หาก API ล้มเหลวใช้ cache ที่ยืนยัน origin ได้พร้อมคำเตือน; หากไม่มี cache ดังกล่าวใช้ static bootstrap และแสดง `ข้อมูลสำรอง`. Bootstrap ใหม่ไม่ถูกเขียนเป็น Production cache. คำเตือนเก่าถูกล้างเมื่อ API กลับมาใช้งานได้.

## 4. ไฟล์ที่แก้

| ไฟล์ | เหตุผล |
| --- | --- |
| `site/assets/runtime-config.js` | เปลี่ยน active origin, เลือก API ของ development ผ่าน Production, กรอง stored URL เก่า |
| `site/assets/water-data-loader.js` | CORS GET, ตรวจ origin ของ cache, รักษา version optimization, แยก diagnostics และ fallback |
| `site/index.html` | แสดงป้ายข้อมูลสำรองสำหรับ offline cache/static ทุกโหมด |
| `tests/development_data_source_playwright.py` | ทดสอบ A–E และหน้าเต็มสี่ viewport ด้วย API จำลอง |
| `tests/static_integrity_test.py` | ปรับ contract ให้ตรง origin และ transport ปัจจุบัน |
| `tests/file_mode_test.py` | ใช้ active origin และตัดการเชื่อม file bridge จริงในเคส offline |
| `tests/netlify_function_test.mjs` | แก้การแปลง file URL เป็น path ให้ชุดทดสอบรันบน Windows ได้ |
| `docs/ARCHITECTURE.md`, `README_SETUP_TH.md` | อธิบาย routing, cache policy และตำแหน่ง file-mode ที่ใช้ได้จริง |
| `docs/LOCAL_PRODUCTION_DATA_FIX_REPORT.md` | รายงานนี้ |

ไม่ได้แก้ Apps Script, sync authentication, เนื้อหา Production Blob, สูตร KPI, resolver, ตัวกรอง, clustering หรือ CSS/layout.

## 5. ผลทดสอบ

| กรณี | ผล |
| --- | --- |
| A fresh localhost | ผ่าน: Chromium ขอ version แล้ว dataset ที่ active Production origin ด้วย GET (API จำลอง) |
| B IndexedDB ค้าง 1,158 รายการ | ผ่าน: cache `remoteOrigin=http://localhost:8888` ถูกปฏิเสธ แม้ version จำลองตรงกัน |
| C localStorage บัญชีเก่า | ผ่าน: development และ forced file ใช้ active origin |
| D API ล้มเหลว | ผ่าน: cold cache ใช้ static 1,158 พร้อม warning; warm cache ที่ origin ถูกต้องใช้ offline cache พร้อม warning; หลัง API กลับมา warning หาย |
| E hosted | ผ่าน: `apiUrl()` ยังคืน `/api/waterresources` แบบ same-origin |
| F ฟังก์ชันเดิม | `phase2_filter_playwright.py` ผ่าน desktop/mobile: KPI, district/authority/tambon, Top 10, ตัวกรอง; `round3_map_stretch_playwright.py` ผ่าน desktop/mobile: แผนที่และ expand/collapse; targeted test ตรวจ clustering, KPI และปุ่ม `efReset` สีฟ้า |
| G Chromium | targeted full-page ผ่าน 1440, 360, 390, 412 px: ไม่มี page error, API origin/method ถูกต้อง, map/cluster พร้อม และไม่มี horizontal overflow; API ในชุดนี้เป็น **mock** |
| H Production จริง | GET version และ dataset ผ่าน, CORS `*` ทั้งคู่; version `"370583b94517cf7227ecc5668ab35ca6"`, metadata count 1,846, data array 1,846. Chromium เปิด `http://localhost:8888/index.html` จริงแสดง `1,846 จาก 1,846`; diagnostics `production-api-development`, `fetch-cors`, version เดียวกัน, ไม่มี page error, network log มีเพียง GET สอง endpoint นี้สำหรับ dataset |

Regression เพิ่มเติม: `area_responsibility_test.mjs`, `phase2_area_responsibility_test.mjs`, `gas_sync_contract_test.mjs`, `netlify_function_test.mjs`, `static_integrity_test.py`, `phase2_static_contract_test.py`, `playwright_cache_logic_test.py` ผ่าน. `mobile_responsive_audit_test.py` ผ่าน 27 checks ที่ 360/390/412 px.

ข้อจำกัดของชุดทดสอบเดิม: `playwright_dashboard_test.py` ไม่ผ่าน assertion ชื่อ อปท. เนื่องจาก fixture HTML ที่ inject ในหน่วยความจำแสดงอักษรไทยเป็น `��` บน Chromium/Windows นี้; `file_mode_test.py` ผ่านส่วน API/file bridge/offline แล้ว แต่ล้มที่ assertion สุดท้ายซึ่งคาดว่าไฟล์ root เป็น launcher. ไฟล์ root จริงเป็นหน้าเว็บสำเนาเต็มและอ้าง `./assets` ที่ไม่มีอยู่. การเปิด `site/index.html` หรือ `site/maeka.html` เป็นทาง file-mode ที่ตรง asset path. ผลผ่านของ phase2, round3, mobile และ targeted เป็นการทดสอบหน้าเว็บจริงที่เสริมส่วนที่ suite เดิมตรวจไม่ครบ. ไม่อ้างว่าสอง script ที่ล้มนี้ผ่าน.

## 6. ตรวจทานและข้อจำกัดคงเหลือ

`git diff --check` ผ่าน. ตรวจ diff ทั้งหมดและคืนไฟล์ผลทดสอบ/ภาพที่ suite เขียนทับให้ตรง HEAD เดิม. ไม่มี credentials หรือ secrets ใน diff. คำขอ Production ที่ทำมีเพียง read-only GET; ไม่ทำ Production write, commit, push, merge หรือ deploy. ปริมาณข้อมูล 1,846 เป็นค่าที่ตรวจ ณ เวลานี้ ไม่ใช่ expected count ตายตัว. หาก active Production API ใช้ไม่ได้และไม่มี cache ที่ origin ถูกต้อง หน้าเว็บจะยังแสดง snapshot 1,158 พร้อมป้ายข้อมูลสำรอง. ไฟล์ root สำหรับการดับเบิลคลิกยังมีข้อบกพร่องเดิมเรื่อง path; ไม่แก้หน้าเว็บสำเนาเหล่านั้นในงาน data-source นี้.
