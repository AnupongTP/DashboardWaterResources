# รายงานการพัฒนาแดชบอร์ดล็อกตามหน่วยงานท้องถิ่น 29 แห่ง

## สถานะโครงการและขอบเขต

- ตำแหน่งโครงการ: `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main`
- ตรวจพบ Git repository จริง; branch `main`; HEAD ก่อนและหลังงาน `bb81574b95a9c8834e5e48df854ea55c969825a6`
- สถานะเริ่มต้น: มีการแก้ไขที่ยังไม่ commit อยู่แล้วใน `README_SETUP_TH.md`, `docs/ARCHITECTURE.md`, `netlify/functions/waterresources-file-bridge.mjs`, `netlify/functions/waterresources.mjs`, `netlify/lib/water-store.mjs`, `site/assets/runtime-config.js`, `site/assets/water-data-loader.js`, `site/index.html`, `tests/file_mode_test.py`, `tests/netlify_function_test.mjs`, `tests/playwright_dashboard_test.py`, `tests/static_integrity_test.py`; และมีไฟล์ใหม่ `docs/LOCAL_PRODUCTION_DATA_FIX_REPORT.md`, `docs/READ_ONLY_API_SAFETY_REPORT.md`, `tests/development_data_source_playwright.py` งานเดิมทั้งหมดถูกเก็บไว้
- ก่อนแก้ไขได้ตรวจ source, การกำหนดค่า Netlify, API, ตัวแก้เขตรับผิดชอบ, loader/cache, ตัวกรอง, แผนที่, กราฟ, Top 10, ลิงก์, เอกสาร และชุดทดสอบ; `git diff --check` ผ่าน

## ผลการแก้ไขและสถาปัตยกรรม

หน้า `/` และ `/index.html` ยังใช้ข้อมูลทั้งจังหวัดและตัวกรองเดิม ส่วน `/authority/<slug>/` ใช้ HTML เดียวกันผ่าน Netlify rewrite โดยวาง rewrite หลังเส้นทาง `/api/...` และตั้ง `<base href="/">` เฉพาะ authority URL ที่เปิดผ่าน HTTP เพื่อให้ asset แบบ relative โหลดได้ ขณะเปิด `file://` จะไม่ตั้ง base และยังใช้โหมดไฟล์เดิม URL ที่ไม่รู้จักหรือรูปแบบผิดแสดงหน้า “ไม่พบหน่วยงาน” โดยไม่สร้างแดชบอร์ดทั้งจังหวัด

ลำดับข้อมูลของ authority URL คือ โหลดชุดข้อมูลเต็มผ่าน `WaterData` → ตรวจแหล่งข้อมูล/เวอร์ชัน/จำนวน/โครงสร้าง → `AREA.decorateRecords()` → กรองด้วย `AREA.recordMatchesAuthority()` → ส่งเฉพาะ `RAW` ที่กรองแล้วเข้า KPI, กราฟ, Top 10, risk score, คำแนะนำ, แผนที่, ตาราง, ค้นหา, รูปภาพ, pivot และ modal ข้อมูลเต็มยังอยู่ใน IndexedDB ตามเดิม ไม่บันทึกชุดย่อยของหน่วยงานลง cache การจำแนกใช้กฎ explicit authority และ legacy inference ของตัวแก้เขตรับผิดชอบเดิม ไม่ใช้ `owner` หรือชื่อตำบลเพียงอย่างเดียว ระเบียนกำกวม/ไม่ทราบหมู่/authority ไม่ถูกต้องไม่ถูกเดาให้หน่วยงานใด

หน้าหน่วยงานแสดงชื่อเต็มภาษาไทยพร้อมสัญลักษณ์ล็อก; ตัวเลือกอำเภอและหน่วยงานในทั้งสามแท็บเป็นค่าเดียวและ disabled หากหน่วยงานครอบคลุมหลายอำเภอ จะแสดงป้ายหลายอำเภอโดยไม่ใช้ค่าอำเภอหนึ่งไปตัดข้อมูล ตัวกรองอื่นยังทำงานภายในชุด `RAW` ที่ล็อกไว้ การกด reset, clear, cross-filter, pivot หรือเปลี่ยนแท็บคืนค่าเฉพาะตัวกรองเสริม ไม่คืนข้อมูลทั้งจังหวัด ลิงก์ `maeka.html` และตัวนับผู้เข้าชมระดับเว็บไซต์ถูกซ่อน/ไม่เรียกในหน้า authority เพื่อหลีกเลี่ยงการพาไปหน้าข้อมูลอื่นหรือแสดงตัวเลขระดับเว็บไซต์ภายใต้หน้าเฉพาะหน่วยงาน หน้า `/` ยังใช้การนำทางเดิม

### กฎความเชื่อถือของข้อมูล

- ยอมรับ GET ชุดข้อมูลสดจาก API origin ที่กำหนด (development/file ใช้ `https://dashboard-waterresources1.netlify.app`, hosted ใช้ origin ของไซต์เอง) เมื่อ response แจ้งจำนวนตรงกับข้อมูลและข้อมูลผ่านการตรวจโครงสร้าง
- ยอมรับ IndexedDB เฉพาะเมื่อ origin และ version ตรงกับ API ที่ตรวจในรอบโหลดปัจจุบัน และจำนวนใน cache ตรงกับจำนวนที่ API version แจ้ง; รองรับ 304 เมื่อมี cache ที่ตรงกัน
- ไม่แสดง KPI ทางการจาก `indexeddb-cache-offline`, `static-bootstrap`, `static-bootstrap-file`, `empty-failsafe`, origin ผิด, จำนวนไม่ตรง, ID ซ้ำ หรือข้อมูลผิดรูปแบบ หน้า authority จะแสดงข้อความไม่พร้อมใช้งานและปุ่มลองใหม่ ส่วนหน้า `/` ยังใช้ fallback เดิม
- หากชุดข้อมูลปัจจุบันใช้ได้แต่หน่วยงานหนึ่งไม่มีระเบียนที่ยืนยันแล้ว จะแสดงผลศูนย์พร้อมข้อความอธิบาย ไม่สับสนกับกรณีโหลดข้อมูลล้มเหลว

การตรวจนี้เป็นขอบเขตการนำเสนอ ไม่ใช่ระบบยืนยันสิทธิ์: Production API สาธารณะยังสามารถส่งข้อมูลทั้งจังหวัดได้ อีกทั้งการตรวจ version/cache ไม่ใช่การตรวจลายเซ็นข้อมูลแบบเข้ารหัส

## ไฟล์ที่เปลี่ยนในงานนี้

| ไฟล์ | เหตุผล |
| --- | --- |
| `site/assets/authority-routes.js` (ใหม่) | ตาราง slug แบบชัดเจน 29 แห่ง, ตรวจเทียบ master, resolve URL, ตรวจความน่าเชื่อถือของ dataset และหน้า fail-closed |
| `site/index.html` | base path เฉพาะ nested route, กรอง `RAW` ก่อนคำนวณ, ป้ายล็อกและ zero state, ล็อกตัวกรอง, รักษา scope ใน reset/การนำทาง, จำกัดตัวเลือก map และปิดลิงก์ที่ไม่สอดคล้อง |
| `site/assets/water-data-loader.js` | เพิ่ม diagnostics ของ origin/การยืนยันเวอร์ชัน/จำนวนข้อมูล และเก็บจำนวนที่ API แจ้งใน cache เต็ม; รักษา fallback ของหน้า `/` |
| `netlify.toml` | rewrite authority URL ไป `index.html` หลัง API rewrites |
| `tests/authority_locked_playwright.py` (ใหม่) | ทดสอบ Chromium แบบ mock สำหรับ 29 URL, การแยกข้อมูล, reset, routing, cache/fallback และ responsive |
| `tests/playwright_dashboard_test.py`, `tests/file_mode_test.py` | ทำ fixture offline ให้โหลดโมดูล route ใหม่และทำงานบน Chromium ของ Windows โดยรักษาการทดสอบเดิม |
| `docs/AUTHORITY_URLS.md` (ใหม่) | ตารางชื่อและ URL Production เป้าหมายทั้ง 29 แห่ง |
| `docs/AUTHORITY_LOCKED_DASHBOARD_REPORT.md` (ไฟล์นี้) | หลักฐานและข้อจำกัดของงาน |

ไฟล์ที่แก้ไว้ก่อนเริ่มงาน ได้แก่ function, `water-store`, `runtime-config`, เอกสารเดิม และชุดทดสอบอื่น ไม่ถูกลบหรือย้อนกลับ ไม่มีการเปลี่ยน Google Apps Script, sync credentials, static bootstrap หรือข้อมูล Production

## URL ทั้ง 29 และการตรวจข้อมูล Production จริง

URL เต็มทุกเส้นทางอยู่ใน `docs/AUTHORITY_URLS.md` และยัง **ไม่ใช่ URL ที่เปิดใช้งานจริงบน Production จนกว่าจะ deploy** การเรียก GET แบบอ่านอย่างเดียวจาก Production ที่ใช้งานอยู่ให้ version `370583b94517cf7227ecc5668ab35ca6` และจำนวน 1,846 รายการ ณ เวลาตรวจ; ทั้ง `/api/waterresources/version` และ `/api/waterresources` ให้ version/count ตรงกัน ค่านี้เป็นผลตรวจครั้งนี้ ไม่ใช่ expected count ที่ hardcode

จาก 1,846 รายการ: resolve เข้าหน่วยงานได้ 1,823; explicit 19, legacy inference 1,804, ambiguous 23, unresolved 0, out-of-brief 0, invalid explicit 0 จำนวนของแต่ละหน่วยงานมาจากข้อมูล Production จริงและกฎ resolver ปัจจุบัน ส่วนคอลัมน์ทดสอบ URL ใช้ mock fixture แยกต่างหาก:

| หน่วยงาน | Slug | จำนวนจริง | Chromium URL test |
| --- | --- | ---: | --- |
| ทม.พะเยา | `tm-phayao` | 16 | ผ่าน |
| ทต.แม่กา | `tt-mae-ka` | 43 | ผ่าน |
| อบต.แม่นาเรือ | `obt-mae-na-ruea` | 234 | ผ่าน |
| อบต.แม่ใส | `obt-mae-sai` | 463 | ผ่าน |
| อบต.บ้านตุ่น | `obt-ban-tun` | 118 | ผ่าน |
| ทต.บ้านสาง | `tt-ban-sang` | 30 | ผ่าน |
| ทต.สันป่าม่วง | `tt-san-pa-muang` | 94 | ผ่าน |
| ทต.บ้านต๋อม | `tt-ban-tom` | 82 | ผ่าน |
| ทต.บ้านต๊ำ | `tt-ban-tam` | 61 | ผ่าน |
| ทต.ท่าจำปี | `tt-tha-cham-pi` | 20 | ผ่าน |
| ทต.แม่ปืม | `tt-mae-puem` | 52 | ผ่าน |
| ทต.บ้านใหม่ | `tt-ban-mai` | 53 | ผ่าน |
| ทต.แม่ใจ | `tt-mae-chai` | 6 | ผ่าน |
| ทต.รวมใจพัฒนา | `tt-ruam-chai-phatthana` | 38 | ผ่าน |
| ทต.ศรีถ้อย | `tt-si-thoi` | 44 | ผ่าน |
| อบต.แม่สุก | `obt-mae-suk` | 54 | ผ่าน |
| ทต.ป่าแฝก | `tt-pa-faek` | 63 | ผ่าน |
| ทต.บ้านเหล่า | `tt-ban-lao` | 30 | ผ่าน |
| ทต.เจริญราษฎร์ | `tt-charoen-rat` | 46 | ผ่าน |
| ทม.ดอกคำใต้ | `tm-dok-kham-tai` | 32 | ผ่าน |
| อบต.คือเวียง | `obt-khue-wiang` | 0 | ผ่าน |
| อบต.บ้านปิน | `obt-ban-pin` | 40 | ผ่าน |
| อบต.ดอกคำใต้ | `obt-dok-kham-tai` | 28 | ผ่าน |
| อบต.จำป่าหวาย | `obt-cham-pa-wai` | 27 | ผ่าน |
| ทต.บ้านถ้ำ | `tt-ban-tham` | 6 | ผ่าน |
| อบต.ดอนศรีชุม | `obt-don-si-chum` | 13 | ผ่าน |
| อบต.สันโค้ง | `obt-san-khong` | 95 | ผ่าน |
| อบต.แม่อิง | `obt-mae-ing` | 26 | ผ่าน |
| ทต.ดงเจน | `tt-dong-chen` | 9 | ผ่าน |

`อบต.คือเวียง` มีศูนย์ **รายการที่ยืนยันเข้าหน่วยงานนี้ใน dataset ปัจจุบัน** ไม่ได้หมายความว่าไม่มีแหล่งน้ำจริงในพื้นที่ การตรวจ Chromium กับ Production GET จริงบน localhost แสดง `tt-mae-ka` 43 (`dataset-get`), `tm-phayao` 16 (`version-get` + IndexedDB ปัจจุบัน) และ `obt-khue-wiang` 0 (`version-get` + IndexedDB ปัจจุบัน) ตรงกับตัวเลขที่ resolve จาก API; ไม่มีการทดสอบเขียน Production

## ผลทดสอบ

| ชุดทดสอบ | ผลที่รันจริง |
| --- | --- |
| `tests/authority_locked_playwright.py` (Chromium, Netlify Dev, mock Production GET) | ผ่าน 42 checks: URL 29 แห่ง และอีก 13 checks สำหรับหน้า root, precedence ของ API route, back/forward/new tab, URL ไม่ถูกต้อง, cache ปัจจุบัน/เก่า, bootstrap, API ล้มเหลว, dataset ผิดรูป, จำนวนไม่ตรง, zero state, reset/isolation และ mobile 360/390/412; desktop 1440 ในการทดสอบ URL |
| Production API smoke (GET จริง) | ผ่าน version/count 1,846 และ localhost แสดง 43/16/0 สำหรับสาม authority ตัวอย่าง |
| `tests/netlify_function_test.mjs` | ผ่าน 14 cases |
| `tests/area_responsibility_test.mjs`, `tests/phase2_area_responsibility_test.mjs`, `tests/gas_sync_contract_test.mjs` | ผ่านทั้งหมด |
| `tests/static_integrity_test.py`, `tests/phase2_static_contract_test.py` | ผ่านทั้งหมด |
| `tests/development_data_source_playwright.py` | ผ่าน A–E และ viewport 1440/360/390/412 |
| `tests/playwright_cache_logic_test.py` | ผ่าน 5 cases |
| `tests/playwright_dashboard_test.py` | ผ่าน 23 cases; fixture offline ถูกปรับให้โหลด route module ใหม่โดยไม่ลดการตรวจตัวกรอง |
| `tests/file_mode_test.py` | ผ่าน 5 cases; ตรวจหน้า site ที่ใช้งานจริงและ runtime file mode บน Windows |
| `tests/mobile_responsive_audit_test.py` | ผ่าน 27 cases ที่ 360/390/412 |
| `tests/phase2_filter_playwright.py` | ผ่าน desktop และ mobile 360/390/412 |
| `tests/round3_map_stretch_playwright.py` | ผ่าน desktop และ mobile 360/390/412 |

Authority suite ใช้ mock เพื่อควบคุมกรณีกำกวมและความล้มเหลว ส่วน Production smoke เป็น GET จริงและไม่ใช่ชุดทดสอบที่ปลอมผลตอบกลับ แผนที่ markercluster จริงยังตรวจโดย regression เดิม; fixture offline บางชุดแทน plugin เพื่อให้ตรวจตัวกรองโดยไม่ขึ้นกับ CDN ตรวจหน้าจอ mobile 390 ด้วยภาพแล้วไม่พบ horizontal overflow หรือ badge/controls ทับกัน

## ตรวจ diff และความเสี่ยงคงเหลือ

ตรวจรายการไฟล์ที่เปลี่ยนและ diff ทั้งหมดแล้ว; `git diff --stat` ของ working tree รวมงานก่อนหน้าแสดงไฟล์ที่ติดตาม 13 ไฟล์, เพิ่ม 261 บรรทัด, ลบ 117 บรรทัด (ไฟล์ใหม่ที่ยัง untracked ไม่รวมในตัวเลขนี้) `git diff --check` ผ่าน (Git แสดงเพียงคำเตือนการแปลง LF/CRLF ของ working copy บน Windows) ไม่มี credential, token หรือสำเนา dataset Production เพิ่มใน repository ไม่มีการส่ง POST/PUT/PATCH/DELETE ไป Production และไม่มีการเปลี่ยน Blob จริง ไม่มี commit, push, merge, reset หรือ deploy

ข้อจำกัด: ยังไม่ได้ทดสอบ authority URL บน Production หลัง deploy เพราะห้าม deploy; ต้องตรวจ rewrite, asset และ hosted same-origin อีกครั้งเมื่อมีขั้นตอนเผยแพร่ที่ได้รับอนุญาต ข้อมูลกำกวม 23 รายการจากชุดจริงไม่ถูกจัดสรรให้หน่วยงานใด จึงอาจทำให้ยอดตามหน่วยงานรวมต่ำกว่ายอดทั้งจังหวัด หากต้องการแก้ต้องปรับข้อมูลอ้างอิง/explicit authority โดยผู้ดูแลข้อมูล ไม่ควรเดาสังกัด การตรวจ cache ใช้ origin/version/count และโครงสร้าง ไม่รับรองความถูกต้องแบบ cryptographic สำหรับข้อมูลที่ผู้ใช้แก้ใน browser เอง

**READY FOR REVIEW** — โค้ดในเครื่องผ่านชุดทดสอบที่ระบุและตัวอย่าง GET จริง; ขั้นตอนต่อไปคือ review และการตรวจหลัง deploy ตามกระบวนการของเจ้าของโครงการ
