# รายงานขยาย Authority Dashboard ครบ 29 หน่วยงาน

วันที่ตรวจ: 18 ตุลาคม 2026 · Repository: `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main` · branch `review/authority-dashboard` · HEAD `5851709cdf2ade6208775e17d9e8bcee2e15851b`

## A. ผลการพัฒนาและสถาปัตยกรรม

URL `/authority/<slug>/` ทั้ง 29 รายการใช้ `site/authority.html` และ `site/assets/authority-app.js` ชุดเดียวกันผ่าน Netlify rewrite เดียว โดย `AuthorityRoutes` ตรวจ slug เทียบกับ master ก่อนโหลดชุดข้อมูลที่ผ่านการตรวจเวอร์ชัน แล้ว `AuthorityDataAdapter` ใช้ `AreaResponsibility` คัดเฉพาะรายการที่ได้รับการยืนยันว่าอยู่ในความรับผิดชอบของหน่วยงานนั้น ชื่อหน้า ตัวกรอง สถิติ และแผนที่มาจากบริบทที่ตรวจแล้ว ไม่มีการทำสำเนาหน้าแยก 28 ชุด

`/authority` และ `/authority/` ไปหน้าจังหวัด `/` โดย 302 redirect; `/` และ `/maeka.html` ไม่ถูกแก้ไข URL ที่มี slug หน่วยงานซึ่งไม่อยู่ใน registry ไปยังหน้าปฏิเสธเดิมโดยไม่เปิดข้อมูลจังหวัดหรือเริ่ม counter ส่วนข้อมูล API ที่ล้มเหลว/เวอร์ชันไม่ผ่านยัง fail closed; หน่วยงานที่มีข้อมูลถูกต้องแต่จำนวนศูนย์แสดงสถานะไม่มีข้อมูล Netlify จัดการเส้นทางแบบ [Pretty URLs](https://docs.netlify.com/manage/routing/redirects/redirect-options/) ทำให้ rewrite แบบ 200 ไป `index.html` ถูก `authority.html` ที่มีอยู่บังใน Netlify Dev จึงใช้ 302 เฉพาะ root เพื่อคงผลลัพธ์หน้าจังหวัด; ไม่มี slug ผิดใดถูก redirect ไปจังหวัด

## B. ไฟล์ที่แก้

| ไฟล์ | เหตุผลและสิ่งที่คงไว้ |
| --- | --- |
| `netlify.toml` | เปลี่ยน rewrite `/authority/*` ให้ใช้ `authority.html` และเอากฎเฉพาะแม่กาออก; ให้ `/authority` และ `/authority/` redirect ไปจังหวัดจริงด้วยกฎ root ที่ force เพราะ 200 rewrite ถูก static pretty URL บัง; คง API rewrite ตามลำดับเดิม |
| `site/authority.html` | เอาข้อจำกัด `tt-mae-ka` ออก และใช้ชื่อเริ่มต้นแบบกลางก่อนตั้งชื่อจริงจาก route; คง HTML/CSS/DSS ที่ได้รับอนุมัติก่อนงานนี้ |
| `site/assets/authority-app.js` | สร้าง namespace/key จาก slug ที่อยู่ใน registry; คง namespace/key แม่กาเดิม; จำกัด `/hit/` ให้เฉพาะ host Production และ path ที่ตรงกับ slug; ตรวจ HTTP status ก่อนนับว่าส่ง hit สำเร็จ โดยไม่แตะ DSS, KPI, แผนที่หรือสูตร |
| `tests/authority_locked_playwright.py` | เปลี่ยน assertion 28 route จากหน้าจังหวัดเดิมเป็น Authority template พร้อมตรวจชื่อ, context, ID, KPI, counter, zero state และ root ทั้งสองรูปแบบ |
| `tests/authority_parity_playwright.py` | ให้ virtual-host fixture เปิด Authority template ทุก slug และใช้ไดเรกทอรีภาพทดสอบผ่าน environment variable เพื่อไม่เขียนทับภาพเดิม |
| `tests/authority_counter_rollout_playwright.py` | เพิ่มการทดสอบ counter 29 identity, dedup, country, host guard และความล้มเหลว (ทุกคำขอภายนอกถูก mock) |
| `tests/authority_rollout_jurisdiction_playwright.py` | เพิ่ม oracle ID ที่กำหนดอิสระสำหรับเขตซ้อน, legacy, explicit, invalid, multi-Tambon, Moo ซ้ำ, ไม่มีพิกัด และศูนย์รายการ |
| `tests/authority_rollout_functional_playwright.py` | เพิ่ม browser regression ของ template เดียวบนเส้นทางที่ไม่ใช่แม่กา 5 ขนาดหน้าจอ |
| `docs/AUTHORITY_29_ROLLOUT_REPORT.md` | บันทึกหลักฐาน URL ทั้ง 29, จำนวน snapshot, ผลทดสอบ และข้อจำกัด |

ก่อนเริ่มงานมี uncommitted work ใน `site/assets/authority-app.js`, `site/authority.html`, `tests/authority_locked_playwright.py`, `tests/authority_maeka_prototype_playwright.py` และไฟล์เอกสาร/ภาพ/ทดสอบ Authority ที่ยังไม่ tracked; ทั้งหมดถูกเก็บไว้ ไม่ reset/clean/stash/ทับงานเดิม ไฟล์ `site/maeka.html`, `site/assets/maeka-app.js`, `site/index.html`, `site/assets/area-responsibility.js`, Netlify Functions และข้อมูล static ไม่ถูกแก้

## C. ผลครบ 29 URL

ค่าในตารางมาจาก Production snapshot **เวอร์ชัน `"c4c69c0654a5be8255561dd1fa5a61ff"` ที่อ่านด้วย GET เท่านั้น**: version API HTTP 200 รายงาน 1,844 รายการ และ dataset API HTTP 200 ส่ง 1,844 รายการเวอร์ชันตรงกัน จากนั้นให้ Playwright เปิด URL บน Netlify Dev จริงทุกเส้นทาง โดย mock browser API ให้คืน snapshot เดียวกันและปิดคำขอ counter ภายนอก ผลทุกแถว: หน้า Authority ที่ถูกต้อง, ชื่อและ slug ถูกต้อง, จำนวนแถวตรงกับ oracle ของ master, ไม่มี JavaScript page error ค่าเหล่านี้เป็น snapshot ไม่ใช่ค่าคงที่

| หน่วยงาน | Slug | รายการ | ผลหน้า Authority |
| --- | --- | ---: | --- |
| เทศบาลเมืองพะเยา | `tm-phayao` | 16 | ผ่าน |
| เทศบาลตำบลแม่กา | `tt-mae-ka` | 41 | ผ่าน |
| องค์การบริหารส่วนตำบลแม่นาเรือ | `obt-mae-na-ruea` | 234 | ผ่าน |
| องค์การบริหารส่วนตำบลแม่ใส | `obt-mae-sai` | 463 | ผ่าน |
| องค์การบริหารส่วนตำบลบ้านตุ่น | `obt-ban-tun` | 118 | ผ่าน |
| เทศบาลตำบลบ้านสาง | `tt-ban-sang` | 30 | ผ่าน |
| เทศบาลตำบลสันป่าม่วง | `tt-san-pa-muang` | 94 | ผ่าน |
| เทศบาลตำบลบ้านต๋อม | `tt-ban-tom` | 82 | ผ่าน |
| เทศบาลตำบลบ้านต๊ำ | `tt-ban-tam` | 61 | ผ่าน |
| เทศบาลตำบลท่าจำปี | `tt-tha-cham-pi` | 20 | ผ่าน |
| เทศบาลตำบลแม่ปืม | `tt-mae-puem` | 52 | ผ่าน |
| เทศบาลตำบลบ้านใหม่ | `tt-ban-mai` | 53 | ผ่าน |
| เทศบาลตำบลแม่ใจ | `tt-mae-chai` | 6 | ผ่าน |
| เทศบาลตำบลรวมใจพัฒนา | `tt-ruam-chai-phatthana` | 38 | ผ่าน |
| เทศบาลตำบลศรีถ้อย | `tt-si-thoi` | 44 | ผ่าน |
| องค์การบริหารส่วนตำบลแม่สุก | `obt-mae-suk` | 54 | ผ่าน |
| เทศบาลตำบลป่าแฝก | `tt-pa-faek` | 63 | ผ่าน |
| เทศบาลตำบลบ้านเหล่า | `tt-ban-lao` | 30 | ผ่าน |
| เทศบาลตำบลเจริญราษฎร์ | `tt-charoen-rat` | 46 | ผ่าน |
| เทศบาลเมืองดอกคำใต้ | `tm-dok-kham-tai` | 32 | ผ่าน |
| องค์การบริหารส่วนตำบลคือเวียง | `obt-khue-wiang` | 0 | ผ่าน: ไม่มีข้อมูล |
| องค์การบริหารส่วนตำบลบ้านปิน | `obt-ban-pin` | 40 | ผ่าน |
| องค์การบริหารส่วนตำบลดอกคำใต้ | `obt-dok-kham-tai` | 28 | ผ่าน |
| องค์การบริหารส่วนตำบลจำป่าหวาย | `obt-cham-pa-wai` | 27 | ผ่าน |
| เทศบาลตำบลบ้านถ้ำ | `tt-ban-tham` | 6 | ผ่าน |
| องค์การบริหารส่วนตำบลดอนศรีชุม | `obt-don-si-chum` | 13 | ผ่าน |
| องค์การบริหารส่วนตำบลสันโค้ง | `obt-san-khong` | 95 | ผ่าน |
| องค์การบริหารส่วนตำบลแม่อิง | `obt-mae-ing` | 26 | ผ่าน |
| เทศบาลตำบลดงเจน | `tt-dong-chen` | 9 | ผ่าน |

จาก snapshot นี้ 1,821 รายการมีหน่วยงานที่ยืนยันได้; 23 รายการยังไม่ถูกจัดเข้าหน้า Authority ใดตามกฎเดิม

## D. เขตความรับผิดชอบ

`authority_rollout_jurisdiction_playwright.py` ใช้ fixture พร้อม expected ID ที่ระบุเองจากกรณีขอบเขตใน master: แม่กาแบบ Tambon เดียวและ legacy ได้ ID `31001`; ทม.ดอกคำใต้แบบหลาย Tambon ได้ `30001, 30002, 30003, 30025, 30027, 30030, 30032`; อบต.ดอกคำใต้ได้ `30004, 30026, 30031`; คือเวียงได้ศูนย์ ID ค่า Moo 1 ในสว่างอารมณ์และบุญเกิดแยกกันด้วย composite Tambon+Moo รายการเขตซ้อน/LocalAuthority ผิด `30005, 30029, 30035` ไม่รั่วเข้าหน้าใด รายการ `30027` ไม่มีพิกัดยังอยู่ในตารางและ DSS แต่ไม่สร้างหมุด หน้า slug ไม่ถูกต้อง fail closed; ไม่พบการรั่วข้อมูลข้ามหน่วยงาน

## E. Visitor counter

แม่กาใช้ `pyo-water-maeka-dashboard` และ `pyoMaeKaVisitDate` เดิมร่วมกับ `/maeka.html` อีก 28 หน่วยงานใช้ `pyo-water-authority-${slug}` และ `pyoAuthorityVisitDate:${slug}` โดยมี namespace/key ไม่ซ้ำกันทั้ง 29 และไม่ชน counter จังหวัด `pyo-water-dashboard-2026` การนับรายวันยังใช้วันที่ UTC ตามเดิม Mock browser test ตรวจสามหน่วยงาน, reload, ข้ามหน่วยงาน, ผลรวม/ประเทศ, localhost, preview, invalid route และจำลอง Production host (`/hit/` ทั้งหมดถูก intercept; ไม่มี hit จริง)

เมื่อ `/hit/total-views` คืน HTTP error จะไม่บันทึก daily key; เมื่อ total สำเร็จจะบันทึก key ทันทีเพื่อไม่ให้ reload นับ total ซ้ำหาก `/hit/country-*` ล้มเหลว ข้อจำกัด: hit สองรายการของบริการ Abacus ไม่เป็นธุรกรรมเดียวกัน จึงไม่อาจรับประกันว่า breakdown ประเทศตรงกับ total ในกรณีคำขอประเทศล้มเหลวหรือสถานะเครือข่ายกำกวม โดยไม่มีการแก้ backend/บริการภายนอกซึ่งอยู่นอกขอบเขต

## F–G. ฟังก์ชันและหลักฐานทดสอบ

| การทดสอบที่รัน | ผล |
| --- | --- |
| `tests/authority_locked_playwright.py` | ผ่าน 29 URL, reload, จังหวัด root, API route, invalid, cache/fallback, zero และ mobile |
| 29 URL กับ Production snapshot ผ่าน mocked browser API | ผ่าน 29/29; จำนวนในตารางตรงทุกหน้า; page errors 0 |
| `tests/authority_rollout_jurisdiction_playwright.py` | ผ่าน 4 เส้นทางกับ expected ID อิสระและ filter edge cases |
| `tests/authority_rollout_functional_playwright.py` | ผ่าน ทม.ดอกคำใต้ที่ 1440/768/412/390/360 และ อบต.ดอกคำใต้; KPI 5, chart 3, ตาราง, search, filter, map layer, popup A→B, popup X→DSS overview, individual DSS, image/chart modal, fullscreen, wheel zoom, ไม่มี overflow/page error |
| `tests/authority_counter_rollout_playwright.py` | ผ่าน identity ทั้ง 29, 3 namespace, daily dedup, country, read-only host guard, failure/partial failure |
| `tests/authority_parity_playwright.py` | ผ่าน parity แม่กา 5 viewport, DSS 4 หมวด, หน้า `/maeka.html` ต้นฉบับ, counter host guard |
| `tests/authority_selection_playwright.py` | ผ่าน selection และ popup lifecycle 5 viewport |
| `tests/authority_wheel_zoom_playwright.py` | ผ่าน zoom เข้า/ออก, page scroll นอก map, zoom controls, popup, fullscreen, desktop pan และ mobile 412/390/360 |
| `tests/authority_maeka_prototype_playwright.py` | ผ่าน filter/map/DSS/modal/image/zero และ 5 viewport |
| `tests/authority_image_requests_playwright.py` | ผ่านภาพสำเร็จ, placeholder, fallback ที่ผู้ใช้กดเอง โดย mock รูป |
| `tests/area_responsibility_test.mjs`, `tests/phase2_area_responsibility_test.mjs` | ผ่านทั้งคู่ |
| `tests/phase2_static_contract_test.py`, `tests/static_integrity_test.py` | ผ่านทั้งคู่ |
| `node --check site/assets/authority-app.js`, `node --check site/assets/authority-routes.js` | ผ่านทั้งคู่ |

GET Production สองครั้งด้านบนเป็นการอ่านจริง; browser image/counter และ browser API ของชุด deterministic/29 route snapshot เป็น mock และไม่พิสูจน์ความพร้อมของบริการภาพหรือ counter จริงในทุกเวลา ไม่มีการทดสอบ gesture ปัดหน้าจอสัมผัสจริง (มีการแตะ control ผ่าน mobile emulation ในชุด wheel test)

## H–I. Git และข้อจำกัด

`git diff --check` ผ่าน (Git แสดงเพียงคำเตือน LF/CRLF) branch และ HEAD ตามหัวรายงาน สถานะสุดท้ายมีไฟล์ source/test ที่ระบุใน B และเอกสาร/ภาพ/ทดสอบจากงานก่อนที่ยัง untracked ซึ่งรักษาไว้ ไม่มี commit, push, merge, pull request, deploy, Netlify/Blob/Google Sheet write หรือ visitor `/hit/` จริง

ข้อจำกัด: จำนวนข้อมูลอาจเปลี่ยนหลัง snapshot; ยังต้องให้ผู้ใช้ตรวจหน้าตาของทั้ง 29 หน้าเอง; ภาพ Google Drive จริงและยอด counter จริงไม่ได้ตรวจด้วยคำขอ live ในรอบนี้; การนับประเทศกับยอดรวมไม่เป็น atomic เมื่อบริการภายนอกขัดข้อง

**READY FOR USER VISUAL REVIEW**
