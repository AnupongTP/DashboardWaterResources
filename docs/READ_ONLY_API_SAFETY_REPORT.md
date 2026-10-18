# รายงานความปลอดภัยของ API สำหรับอ่านข้อมูลและการทดสอบถดถอย

วันที่ 18 ตุลาคม 2026 — โครงการ `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main`

## ขอบเขตและสถานะ Git

- สาขา `main`; HEAD `bb81574b95a9c8834e5e48df854ea55c969825a6`
- ก่อนเริ่มงานนี้มีการแก้ไขที่ยังไม่ commit จากงาน Local-to-Production อยู่แล้ว ได้แก่ `README_SETUP_TH.md`, `docs/ARCHITECTURE.md`, `site/assets/runtime-config.js`, `site/assets/water-data-loader.js`, `site/index.html`, `tests/file_mode_test.py`, `tests/netlify_function_test.mjs`, `tests/static_integrity_test.py` และไฟล์ใหม่ `docs/LOCAL_PRODUCTION_DATA_FIX_REPORT.md`, `tests/development_data_source_playwright.py` งานนี้เก็บทั้งหมดไว้
- ไม่มีการแก้ข้อมูลใน Production Blob, เปลี่ยนรหัสลับ, commit, push, merge, reset หรือ deploy

## สาเหตุและการแก้ไข

ก่อนแก้ `GET`/`HEAD /api/waterresources` และ file bridge จะเรียก `seedFromStaticRequest()` หาก Blob ว่าง ฟังก์ชันนี้ดึง `waterresources.initial.json` จำนวน 1,158 รายการแล้วเรียก `writeDataset()` จึงมีผลเขียนข้อมูลจากคำขออ่านสาธารณะ และอาจทำให้ Blob ว่างถูกเติมด้วยชุด bootstrap ที่เก่ากว่าข้อมูล Production จริง ส่วน version endpoint อ่านอย่างเดียวอยู่แล้ว

งานนี้ลบทางเรียก seed ออกจาก dataset API และ file bridge และลบ helper seed ที่ไม่มีผู้ใช้ออกจาก `netlify/lib/water-store.mjs` เมื่อ Blob ว่าง dataset API และ file bridge ตอบ 503 ตามเดิม; version API ตอบ 404 ตามเดิม ไม่มีการสร้าง endpoint เริ่มต้นข้อมูลใหม่ ไฟล์ bootstrap 1,158 รายการยังคงอยู่เพื่อ fallback ฝั่งเบราว์เซอร์

เส้นทางเขียนที่เหลือมีเพียง `POST /api/waterresources/sync` หลังตรวจ `WATER_SYNC_SECRET` และชนิดข้อมูล JSON ซึ่งเรียก `writeDataset()` ใน `water-store.mjs` เส้นทางอ่าน `GET`/`HEAD`/`OPTIONS` ของ dataset, version และ file bridge ไม่เรียกฟังก์ชันเขียน; file bridge ยังคงตอบ 405 ต่อ `OPTIONS` และไม่เขียนข้อมูล การเปลี่ยนแปลงไม่แตะ CORS, ETag, version, callback หรือรูปแบบข้อมูลตอบกลับของชุดที่มีอยู่

## ไฟล์ที่แก้ในงานนี้

| ไฟล์ | เหตุผล |
| --- | --- |
| `netlify/functions/waterresources.mjs` | ตัดการ seed ระหว่าง GET/HEAD |
| `netlify/functions/waterresources-file-bridge.mjs` | ตัดการ seed ระหว่าง GET/HEAD ของ JSONP bridge |
| `netlify/lib/water-store.mjs` | ลบ helper ที่ดึง bootstrap แล้วเขียน Blob |
| `tests/netlify_function_test.mjs` | เพิ่ม mock-store assertions สำหรับ Blob ว่าง, sync ที่ยืนยันตัวตน, และการอ่านชุดที่มีอยู่; แก้ path ของ test ให้ใช้กับ Windows |
| `tests/playwright_dashboard_test.py` | ปรับ assertion ตามรายการ อปท. master ปัจจุบัน, ใช้ Chromium path ผ่านตัวแปรสภาพแวดล้อม, และแทน CDN cluster เฉพาะ fixture offline |
| `tests/file_mode_test.py` | แทน assertion root launcher ที่ล้าสมัยด้วยการตรวจ asset ของหน้า `site/`; รองรับ Chromium path บน Windows และ fixture map แบบ offline |
| `docs/READ_ONLY_API_SAFETY_REPORT.md` | รายงานและนโยบายสำหรับงาน Authority-locked ระยะถัดไป |

ไฟล์ config/loader/หน้า dashboard และเอกสารบางส่วนที่อยู่ใน Git diff เป็นการแก้จากงานก่อนหน้า ไม่ได้เปลี่ยนเพื่อแก้ backend รอบนี้ ไม่มีการแก้สูตร KPI, ตัวกรอง, แผนที่, Top 10, static bootstrap หรือ GAS sync

## หลักฐานว่า public read ไม่เขียน

- ตรวจ source ของทุก public read path: `writeDataset()` ถูกอ้างจาก `waterresources-sync.mjs` เท่านั้น; `seedFromStaticRequest` ไม่เหลือใน `netlify/`
- mock Blob ว่าง: version GET/HEAD = 404, OPTIONS = 204; dataset GET/HEAD = 503, OPTIONS = 204; bridge GET/HEAD = 503, OPTIONS = 405; จำนวนการเรียก `writeDataset()` = 0, `setJSON()` = 0, รายการใน mock store = 0
- authenticated POST sync กับ mock Blob ว่างสำเร็จและเรียก `writeDataset()` หนึ่งครั้ง; POST ที่ไม่มีสิทธิ์ตอบ 401
- เมื่อมีชุดข้อมูลแล้ว version GET/HEAD, dataset GET/HEAD/304 และ bridge GET/HEAD ให้ metadata/ETag/version ถูกต้อง โดยตัวนับการเขียนไม่เพิ่ม
- ทดสอบทั้งหมดกับ mock store ภายในเครื่อง ไม่มีคำขอเขียนไป Production

## ผลทดสอบ

| กลุ่ม | ผล |
| --- | --- |
| `node tests/netlify_function_test.mjs` | ผ่าน 14 กรณี รวม empty Blob, read-only, sync, version, ETag, CORS, bridge |
| `node tests/area_responsibility_test.mjs` | ผ่าน |
| `node tests/phase2_area_responsibility_test.mjs` | ผ่าน |
| `node tests/gas_sync_contract_test.mjs` | ผ่าน |
| `python tests/static_integrity_test.py` | ผ่าน |
| `python tests/phase2_static_contract_test.py` | ผ่าน |
| `tests/development_data_source_playwright.py` | ผ่านกรณี A–E และ Chromium 1440/360/390/412 px; Production API เป็น mock |
| `tests/playwright_cache_logic_test.py` | ผ่าน 5 กรณี รวม version cache และ offline fallback |
| `tests/playwright_dashboard_test.py` | ผ่าน 23 กรณี desktop/mobile รวมตัวกรอง, KPI, map, tambon, clear/reset |
| `tests/file_mode_test.py` | ผ่าน 5 กรณี API, bridge, adapter, offline bootstrap, asset path |
| `tests/mobile_responsive_audit_test.py` | ผ่าน 27 กรณีที่ 360/390/412 px |
| `tests/phase2_filter_playwright.py` | ผ่าน desktop/mobile 360/390/412 px รวม filter และ Top 10 |
| `tests/round3_map_stretch_playwright.py` | ผ่าน desktop/mobile 360/390/412 px |
| `git diff --check` | exit code 0; ไม่มี whitespace error (มีเพียงคำเตือน Git เรื่อง LF/CRLF) |

Chromium ใช้ executable ที่ติดตั้งในเครื่องบน Windows; สำหรับสคริปต์ legacy อื่นที่ยัง hardcode path Linux ใช้ adapter ชั่วคราวในเครื่องขณะรันโดยไม่แก้ test source จากนั้นลบ adapter และ package ชั่วคราวแล้ว กรณี localhost ที่ทดสอบใช้ mock API จึงไม่ใช่การยืนยันจำนวนข้อมูล Production สด

### สาเหตุของสอง regression เดิม

1. `playwright_dashboard_test.py` คาดว่า dropdown แสดง อปท. ที่มีข้อมูลจาก synthetic fixture เพียงเก้ารายการ แต่หน้า dashboard ปัจจุบันแสดงรายการ master 29 อปท. และ bootstrap fixture ก็มีข้อมูล อปท. เพิ่มเติม นอกจากนี้ใช้ Chromium path `/usr/bin/chromium` และบล็อก CDN markercluster ทั้งที่หน้าเรียกใช้ script นั้น ปรับ test ให้ตรวจรายการ master กับตัวนับ active ที่แท้จริง และใช้ cluster stub เฉพาะ fixture offline; test map/cluster จริงยังมีชุด regression แยก ผลผ่าน 23 กรณี
2. `file_mode_test.py` คาดว่า `index.html`/`maeka.html` ที่ root เป็น redirect launcher ทั้งที่ปัจจุบันเป็นสำเนาหน้าเก่าที่อ้าง `./assets` ซึ่งไม่มีที่ root หน้าใช้งานอยู่ใน `site/` จึงตรวจ asset path ที่มีจริงแทน อีกทั้งแก้ Chromium path และ cluster fixture ซึ่งเคยทำให้หน้าไม่ render หลังโหลดข้อมูล ผลผ่าน 5 กรณี

## แนวทางสำหรับ Authority-locked Dashboard ระยะถัดไป

ยังไม่ได้เพิ่ม `/authority/.../` หรือระบบกรอง URL ในงานนี้ หน้า dashboard หลักยังใช้ cache หรือ bootstrap เมื่อ API ขัดข้องตามเดิม ตัว loader ให้ `window.__WATER_DATA_DIAGNOSTICS__.source` สำหรับจำแนกความน่าเชื่อถือดังนี้:

| source | ความหมาย | ข้อเสนอสำหรับหน้า Authority-locked |
| --- | --- | --- |
| `production-api-development`, `production-api-file`, `production-script-bridge-file`, `netlify-blob-api` | รับชุดข้อมูลจาก API Production/hosted ในการโหลดครั้งนี้ | ใช้ได้เมื่อ origin, schema และขอบเขต authority ถูกตรวจแล้ว |
| `indexeddb-cache`, `indexeddb-cache-304` | cache ของ origin ที่เลือก และ version ตรงกับ GET version หรือ dataset 304 ในการโหลดครั้งนี้ | ใช้ได้หลังยืนยัน version ในครั้งนี้และตรวจ authority scope |
| `indexeddb-cache-offline` | cache เดิมจาก origin ที่ถูกต้อง แต่ยืนยันความสดไม่ได้ | ปิดผลทางการของหน้า authority; แสดงสถานะไม่พร้อมใช้งาน |
| `static-bootstrap`, `static-bootstrap-file` | ชุดสำรอง local อาจเก่าและไม่ครบ | ปิดผลทางการของหน้า authority; ห้ามแสดงยอด/รายการเป็นข้อมูลทางการ |
| `empty-failsafe` | ไม่ได้ข้อมูล | แสดง unavailable; ไม่มี KPI/รายการทางการ |

นโยบาย fail-closed ที่เสนอ: ก่อนแสดงยอดหรือรายการของ authority ให้ยืนยัน source, API origin, version ในการโหลดปัจจุบัน, รูปแบบข้อมูล และการจับคู่ authority slug กับขอบเขตที่อนุมัติ หากข้อใดไม่ผ่านให้แสดงข้อความว่าข้อมูลหน่วยงานยังตรวจสอบไม่ได้ โดยไม่แสดงยอดจาก stale cache หรือ bootstrap เป็นยอดทางการ ค่า `source` เป็น diagnostics ฝั่ง client ไม่ใช่หลักฐานความถูกต้องเพียงอย่างเดียว; ระยะถัดไปต้องเพิ่มการตรวจ scope และ completeness ของข้อมูลที่รับมา

ความเสี่ยงที่ยังต้องพิจารณา: `docs/ARCHITECTURE.md` ส่วนเก่ายังอธิบายว่า dropdown ซ่อน อปท. ที่ count เป็นศูนย์ แต่โค้ด UI ใช้ master list ทั้งหมด ควรจัดเอกสารให้ตรงก่อนใช้รายการดังกล่าวกำหนด authority lock นอกจากนี้ file script bridge เป็นทางเลือกสำหรับ `file://` เมื่อ CORS fetch ล้มเหลว และ diagnostics ปัจจุบันไม่ได้เป็น security boundary; หน้า authority ต้องตรวจ URL/ข้อมูลเอง ความครบถ้วนของชุดข้อมูลจาก Production จริงไม่ได้ยืนยันในงาน mock นี้

## Git diff และข้อสรุป

ส่วนที่เพิ่มในรอบนี้เป็นการลบ seed จาก API อ่านสองไฟล์และ store helper, เพิ่มการทดสอบ write-safety, ซ่อม regression tests สองไฟล์ และเพิ่มรายงานนี้ การเปลี่ยนจากงาน Local-to-Production เดิมยังคงอยู่ครบ ผล `git diff --check` ผ่าน หลังคืนผลทดสอบและ screenshot ที่เดิมสะอาด ไม่มี test artifact ชั่วคราวเหลือใน working tree

**READY FOR NEXT DEVELOPMENT PHASE** — backend read paths ไม่เขียน Blob ตาม source และ mock tests; งาน Authority-locked ต้องใช้ fail-closed policy ข้างต้น และยังต้องทดสอบกับข้อมูล Production จริงเมื่อเริ่มระยะนั้น
