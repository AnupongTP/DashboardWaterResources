# TEST REPORT — DashboardWaterResources v1.4.5 Mobile Scroll Tables Candidate

วันที่: 2026-08-30  
สถานะ: **PASS — Candidate**

## เป้าหมายรอบนี้

แก้ Mobile Responsive โดย **ไม่เปลี่ยนตารางเป็น Card**:

- `เปรียบเทียบตำบล` คงตารางเดิม 10 คอลัมน์
- `ตารางข้อมูลแหล่งน้ำ` คงตารางเดิม 12 คอลัมน์
- `แหล่งน้ำชำรุด` คงตารางเดิม 10 คอลัมน์
- มือถือเลื่อนซ้าย–ขวา **เฉพาะภายในกรอบตาราง**
- หน้าเว็บทั้งหน้าไม่มี horizontal overflow
- ไม่มีการซ่อนคอลัมน์
- ตารางเปรียบเทียบตำบลตรึงคอลัมน์ `ตำบล` ไว้ทางซ้ายระหว่างเลื่อน
- มีข้อความช่วย `← เลื่อนตารางซ้าย–ขวาเพื่อดูข้อมูลครบ →` บนมือถือ

## Tests ที่รันหลังแก้

```text
static_integrity_test.py           PASS
playwright_dashboard_test.py       PASS 23/23
playwright_cache_logic_test.py     PASS 5/5
area_responsibility_test.mjs       PASS
gas_sync_contract_test.mjs         PASS
mobile_responsive_audit_test.py    PASS 27 checks
```

Mobile audit ทดสอบที่ viewport:

```text
360 × 800
390 × 844
412 × 915
```

ตรวจโดยตรงว่าแต่ละตาราง:

- header ยังแสดง
- จำนวนคอลัมน์ครบ
- `scrollWidth > clientWidth` บนมือถือ
- สามารถเปลี่ยน `scrollLeft` ได้จริง
- overflow อยู่ใน wrapper ไม่ดันทั้งหน้า

## Backend

โฟลเดอร์ `netlify/` และ assets ด้าน authority/data loader/combobox ไม่มีการเปลี่ยนจาก v1.4.4 ในรอบนี้ จึงไม่เปลี่ยน data contract หรือ LocalAuthority logic

## Screenshots

- `tests/screenshots/mobile-390-compare-v1.4.5.png`
- `tests/screenshots/mobile-390-table-v1.4.5.png`
- `tests/screenshots/mobile-390-damaged-v1.4.5.png`

## Result

```text
Original table layout on mobile     PASS
Internal horizontal table scroll    PASS
All columns retained                PASS
No page-level horizontal overflow   PASS
Authority/LocalAuthority logic      PASS
Existing dashboard functional tests PASS
Cache behavior                      PASS
```
