# แก้หมุดพิกัดซ้อน — 26 ตุลาคม 2026

## สาเหตุ

ตรวจ Production ด้วย GET แบบอ่านอย่างเดียวพบรายการฝาย ID 1109–1112 ใช้พิกัด
`19.089317, 99.920653` ตรงกันทั้งสี่รายการ
เดิม `disableClusteringAtZoom:16` ทำให้ซูมถึง 16 แล้วแสดงหมุดทั้งสี่ซ้อนกัน
จึงมองเห็นเหมือนเหลือหนึ่งจุด ทั้งที่ข้อมูลยังอยู่ครบ
ตั้งค่านี้อยู่ก่อนการแก้ mobile popup รอบก่อนแล้ว

## การแก้

- `site/assets/authority-app.js`: คงรัศมีคลัสเตอร์ 70px ก่อน zoom 16;
  ตั้งแต่ zoom 16 ใช้รัศมี 1px แทนการปิดคลัสเตอร์ทั้งหมด
  จึงยังรวมพิกัดที่ซ้อนกันและกดกางหมุดเลือกได้ ขณะที่จุดแยกกันยังแสดงแยก
  มีผลกับ template ร่วมของ 29 อปท. และ 4 อำเภอ
- `site/index.html`: ใช้กติกาเดียวกันในแผนที่หลักจังหวัดและแผนที่ชำรุด
  รัศมีก่อน zoom 16 ยังคงเดิม 70px/60px ตามลำดับ
  ตอนกาง circle markers ในแผนที่ชำรุด ให้แตะผ่านไอคอนคลัสเตอร์จางได้
  เพื่อไม่บังวงกลมด้านบน และคืน pointer events เมื่อรวบกลับ
- ไม่เปลี่ยนข้อมูลต้นทาง พิกัด ID จำนวนรายการ KPI ตัวกรอง หรือ popup/image handler
  การกางหมุดเป็นตำแหน่งแสดงผลชั่วคราว ไม่ใช่การแก้พิกัดจริง
- ไม่แก้หน้า Mae Ka เดิม ไม่เปลี่ยน API/Netlify configuration

## การทดสอบ

- Playwright ทดสอบพิกัดตรงกับ ID 1109–1112 ด้วย fixture: ที่ zoom 16 ยังเป็นคลัสเตอร์ 4
  กดแล้วกางเป็น 4 ตำแหน่ง และเพิ่มจุดใกล้เคียงแต่พิกัดต่างกันแล้วตรวจว่าไม่ถูกรวม
- `tests/mobile_map_popup_playwright.mjs`: ผ่าน 16 กรณี
  ครอบคลุม อปท./อำเภอ/แผนที่หลักจังหวัด/แผนที่ชำรุด × 360/390/412/1440px
  เพิ่มตรวจหมุดซ้อนที่ zoom 16 และ 18 ว่ามีครบสี่รายการและกางได้สี่ตำแหน่ง
  ตรวจ popup, การย่อ/ขยายแผนที่, modal stacking และจำนวนคำขอรูปเดิมด้วย
- `tests/authority_cluster_playwright.py`: ผ่าน 15 กรณี
  ปรับ fixture ให้ตรวจพิกัดต้นทางแทนพิกัดแสดงผลขณะ spiderfy;
  เตรียมมุมมองให้ A/B อยู่บนจอ และใช้ maximum zoom ปัจจุบันแทนสมมติฐานเดิมว่า 15 เป็นระดับสุดท้าย
  ยังคงตรวจ A→B, table reveal, filters, stale callbacks และคลัสเตอร์จังหวัด
- `authority_selection_playwright.py`: ผ่าน 5 viewport
- JavaScript syntax, provincial inline scripts และ `git diff --check`: ผ่าน

Browser tests ทั้งหมดจำลองข้อมูล/ภาพ/บริการภายนอก ไม่ใช่การทดสอบ Google Drive จริง
ไม่ได้ทดสอบโทรศัพท์จริงหรือ Safari และไม่ได้รันทุก historical suite ซ้ำ
หลักฐานอยู่ที่ `C:\Users\Anupong\.codex\visualizations\2026\10\17\01a14bb5-5388-7fb3-8f0c-2ec080094e0f\cluster-overlap-fix-20261026`
โดยเฉพาะ `mobile-final.log`, `final/results.json`, `cluster-final.log`

งานค้างเดิมยังอยู่ครบ ไม่มี commit, push, merge, deployment หรือ Production mutation
เอกสารนี้อัปเดตกติกาคลัสเตอร์ต่อจาก `MOBILE_MAP_POPUP_FIX_REPORT.md`
