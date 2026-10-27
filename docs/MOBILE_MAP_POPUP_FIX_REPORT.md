# แก้ popup แผนที่บนมือถือ — 26 ตุลาคม 2026

## ขอบเขตและสถานะเริ่มต้น

ทำตามคำขอให้แก้ popup ปิดเองและรูปขยายอยู่หลังแผนที่ พร้อมตรวจหน้ารวมจังหวัดด้วย
Repository: `D:\Codex Project\DashboardWaterResources\DashboardWaterResources-main`
Branch: `main`; HEAD: `75f624b854375d0a1df980fc04c6d075ea015ab9`
มีงานอำเภอ, DSS และชุดทดสอบค้างอยู่ก่อนแล้ว เก็บงานเหล่านั้นไว้ทั้งหมด
สำรองไฟล์ก่อนแก้แยกไว้นอก repository และเทียบผลโดยไม่ reset working tree

## สาเหตุที่ตรวจพบ

1. หน้า อปท./อำเภอเรียก `setFocus()` แล้ว `map.flyTo()` ซ้ำเมื่อกดหมุดที่มองเห็นอยู่แล้ว
   การเริ่ม zoom/move ชุดนี้ทำให้ MarkerCluster รวบหมุดที่ spiderfy กลับ และ popup ปิด
   ทดสอบโค้ดก่อนแก้ด้วย Android user agent และ touch events พบ `popupopen` ตามด้วย `popupclose`
   และคลัสเตอร์กลับจาก spiderfy จริง ไม่ใช่เพียงปัญหาความสูง popup
2. ไม่มีเพดานความสูง popup ให้สัมพันธ์กับแผนที่บนมือถือ การ auto-pan จึงพาหมุดออกนอกขอบเขต
   MarkerCluster บนมือถือคัดหมุดนอกขอบเขตออก ซึ่งปิด popup ที่ผูกกับหมุดด้วย
   ตัวอย่างหน้าจังหวัดก่อนแก้: popup สูง 681.08px ในแผนที่สูง 328px และหมุดหลุดขอบ
   หน้าจังหวัดไม่มี `setFocus().flyTo()` แบบหน้า อปท. จึงไม่เหมารวมสาเหตุข้อ 1 ให้หน้าจังหวัด
3. ชั้นรูปขยายของหน้า อปท. อยู่ที่ z-index 1100 ต่ำกว่าแผนที่เต็มจอ 5000
   หน้าจังหวัดมี modal ที่ 999/1300 ต่ำกว่าแผนที่เต็มจอ 9999 เช่นกัน
4. ตอนย่อแผนที่ชำรุดจังหวัดกลับจากเต็มจอ `invalidateSize()` เดิมส่ง `moveend` ก่อน `resize`
   จึงคัดหมุดออกก่อน popup ปรับขนาดได้ รันทดสอบพบกรณีนี้และแก้ด้วย `debounceMoveend:true`
   ให้การปรับ layout เกิดก่อนตรวจขอบเขตหมุด

## ไฟล์และการแก้เฉพาะงานนี้

- `site/assets/map-popup.js` — helper ร่วมสำหรับ record popup: จำกัดความสูง/ความกว้างตามแผนที่,
  เลื่อนอ่านเนื้อหาภายใน, ปรับเมื่อ resize และเก็บ DOM เดิมเพื่อไม่สร้างรูปใหม่เมื่อปรับขนาด
  ใช้ listener ต่อแผนที่ ไม่สร้าง resize listener แยกให้ทุกหมุด
- `site/assets/authority-app.js` — ใช้ helper; ไม่ flyTo ซ้ำเมื่อเลือกหมุดที่แสดงอยู่;
  คงการเปิดหมุดจากตารางด้วย workflow เดิม; debounce moveend ตอนสลับเต็มจอ
- `site/authority.html` — โหลด helper และยกชั้นรูปขยายเป็น 6000
  template นี้ครอบคลุม 29 อปท. และ 4 อำเภอ
- `site/index.html` — ใช้ helper ทั้งแผนที่หลักและแผนที่ชำรุด,
  debounce moveend ตอนสลับเต็มจอ และยก record/image modal เหนือแผนที่เต็มจอ
- `tests/mobile_map_popup_playwright.mjs` — ทดสอบจริงกับ Leaflet/MarkerCluster รุ่นที่โครงการใช้
  พร้อม Android user agent, touch events และภาพ/บริการภายนอกจำลอง
- `tests/playwright_dashboard_test.py`, `tests/file_mode_test.py` — เพิ่ม helper ใน HTML fixture
  ที่ฝัง JavaScript เองเพื่อทดสอบออฟไลน์ โดยคง assertions เดิม
- เอกสารฉบับนี้

ไม่เปลี่ยน radius/threshold ของคลัสเตอร์, KPI, DSS, ตัวกรอง, responsibility mapping,
data loader, API, visitor counter, Google Drive fallback หรือ `maeka.html`/`maeka-app.js`

## ผลทดสอบ

ทุก browser test ด้านล่างจำลอง dataset/ภาพ/บริการภายนอกและกัน network ที่ไม่ได้กำหนด
ไม่ได้ยืนยันว่ารูป Google Drive จริงโหลดสำเร็จ และไม่มีการยิง visitor hit จริง

| ชุดทดสอบ | ผล |
|---|---|
| `mobile_map_popup_playwright.mjs` | ผ่าน 16 กรณี: 4 แผนที่ × 360/390/412/1440px |
| `authority_selection_playwright.py` | ผ่าน 5 viewport รวม 768px; รันซ้ำหลังแก้ fullscreen รอบสุดท้าย |
| `authority_cluster_playwright.py` | ผ่าน 15 กรณี รวมคลัสเตอร์จังหวัด |
| `authority_locked_playwright.py` | ผ่าน 43 checks รวม 29 routes และ refresh บนเซิร์ฟเวอร์ทดสอบแยก |
| `authority_image_requests_playwright.py` | ผ่าน 3 โหมด: primary success, explicit thumbnail fallback, all fail |
| `authority_parity_playwright.py` | ผ่าน 9 กรณี รวมหน้า Mae Ka เดิม |
| `district_scope_test.mjs` | ผ่าน canonical mapping, record IDs, unresolved authority และ coordinate cases |
| `district_dashboard_playwright.mjs` | ผ่าน 52 กรณี และเปรียบเทียบภาพ 5 viewport; ไม่เปิดการเทียบ historical snapshot อีก 5 กรณี |
| `playwright_dashboard_test.py` | ผ่าน 23 กรณี |
| `mobile_responsive_audit_test.py` | ผ่าน 27 กรณี ที่ 360/390/412px |
| `phase2_filter_playwright.py` | ผ่าน desktop และ mobile 360/390/412px |
| `round3_map_stretch_playwright.py` | ผ่าน desktop และ mobile 360/390/412px; รันซ้ำหลังแก้ fullscreen รอบสุดท้าย |
| `file_mode_test.py` | ผ่าน 5 กรณี |
| JavaScript/inline script syntax และ `git diff --check` | ผ่าน |

ชุดใหม่ตรวจ popup หลัง animation จบ, หมุดยังอยู่ใน bounds, เนื้อหายาวมี scroll,
เปิด/ย่อเต็มจอแล้ว popup ยังคงอยู่, ปิด popup ได้ตามปุ่ม และ modal ผ่าน hit-test เหนือแผนที่
ตรวจด้วยว่าการเปลี่ยนขนาด popup ไม่เพิ่มคำขอรูปก่อนเปิด modal
หน้า อปท./อำเภอ/แผนที่หลักจังหวัดทดสอบการกดคลัสเตอร์ 4 แล้วกดหมุดที่ spiderfy
แผนที่ชำรุดจังหวัดทดสอบการแตะ circle marker ที่ zoom 16

ผลตัวอย่างหลังแก้: หน้า อปท. บน 360px popup สูง 338px ในแผนที่ 418px,
ยังเปิดอยู่และหมุดไม่หลุดขอบ ส่วนหน้าจังหวัด popup อยู่ภายในแผนที่ขนาดเล็กและเลื่อนอ่านได้
ตรวจภาพ screenshot มือถือของแผนที่หลักและแผนที่ชำรุดแล้ว

หลักฐาน logs, JSON และ screenshots อยู่ที่:
`C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\mobile-map-fix-20261026`
ผลรอบสุดท้าย: `mobile-final.log`, `final/results.json`, `final/*-390.png`
และ `authority_locked.final.log`

## ข้อจำกัดและสิ่งที่ไม่ได้อ้างว่าผ่าน

- Netlify Dev หยุดระหว่างชุดทดสอบ routing ทำให้รอบแรกบางชุด timeout/connection refused
  จึงรัน regression ซ้ำบน HTTP server แยกที่อ่านไฟล์ปัจจุบันและจำลอง rewrites/API อย่างปลอดภัย
  ผล routing/API ใน server นี้ไม่ใช่การยืนยัน Netlify Functions หรือ Production rewrites จริง
- เปิด Netlify Dev ใหม่ภายหลัง ตรวจ GET หน้า `/authority/tt-mae-ka/` และ `/assets/map-popup.js`
  ที่ localhost:8888 ได้ HTTP 200 ทั้งคู่; ไม่เปลี่ยน routing เพื่อแก้ปัญหาของ dev server
- Netlify Dev แจ้ง local Database เริ่มไม่ได้; งานนี้ไม่ใช้ Database และไม่ได้แก้ระบบดังกล่าว
- ไม่ได้รันทดสอบบนโทรศัพท์จริงหรือ Safari/iOS; ทดสอบ Chromium ที่จำลอง Android พร้อม touch
- ไม่ได้ส่งคำขอรูป Google จริงในงานนี้ จึงไม่อ้างว่าแก้ HTTP 429/403 หรือ permissions ของ Google ได้
- ไม่รัน backend suite ซ้ำ เพราะไม่มีการแก้ Netlify Functions หรือ data storage

เก็บ generated test results/screenshots ที่ถูกเขียนทับไว้เป็นหลักฐานนอก repo แล้วคืนไฟล์เดิม
จากสำเนาก่อนรัน ไม่ใช้ Git reset และไม่ทิ้งงานที่ค้างอยู่ก่อนหน้า
ไม่มี commit, push, merge, deploy หรือแก้ Production data

สรุป: การแก้ popup และชั้น modal ผ่านการทดสอบข้างต้น พร้อมให้ตรวจบนโทรศัพท์จริงที่ localhost
