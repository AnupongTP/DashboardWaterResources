# DashboardWaterResources v1.4.5 — LocalAuthority v1.2 Candidate

สถานะ: **Candidate — ยังไม่ Deploy Production จนกว่าจะทดสอบ Form/Sheet/Sync integration จริง**

## สิ่งที่เปลี่ยนจาก v1.4.0

- ใช้ policy เดียวกับ `KebNamComplete LocalAuthority v1.2`
- แยก `recommendedAuthority` ออกจาก `resolvedLocalAuthority`
- `SUGGEST`: ผู้กรอกแก้ค่าแนะนำเป็น อปท. อื่นใน master ของตำบลเดียวกันได้ และ Dashboard ต้องเคารพค่าที่บันทึกจริง
- `SELECT`: พื้นที่ exact หลาย อปท. ต้องใช้ explicit field จาก exact options เท่านั้น
- `TAMBON_ONLY`: ไม่รับ LocalAuthority
- ข้อมูลเก่า exact เดียวใช้ `legacy-inferred` ชั่วคราว
- ค่า explicit ที่ผิดไม่ถูกเปลี่ยนเป็น legacy blank ระหว่าง Netlify normalization
- Dropdown อปท. ยังซ่อน authority ที่ resolved count = 0
- ไม่มี `ต้องยืนยันเขต อปท.` ใน UI
- Cascading Moo ใช้ authority options ที่ valid ตาม policy v1.2
- GAS sync helper รองรับคอลัมน์ `LocalAuthority` แบบ optional และยังเป็น read-only
- Strict autocomplete 29 ตำบล, Netlify Blob 11.0.1, IndexedDB cache เดิมยังคงอยู่

## Contracts

- Exact mapping: `docs/AUTHORITY_MAPPING_CONTRACT.json`
- v1.2 policy: `docs/LOCALAUTHORITY_POLICY_CONTRACT.json`
- รายละเอียดภาษาไทย: `docs/AREA_RESPONSIBILITY_RULES_TH.md`

## Test suite

```text
node tests/area_responsibility_test.mjs
python tests/static_integrity_test.py
node tests/netlify_function_test.mjs
python tests/playwright_dashboard_test.py
python tests/playwright_cache_logic_test.py
```

ดูผลล่าสุดใน `docs/TEST_REPORT.md`

## Production gate

```text
KebNamComplete v1.2 กรอกจริงผ่าน
→ Sheet Y = LocalAuthority ถูกต้อง
→ ใช้ GAS sync v1.4.5
→ manual sync
→ ตรวจ /api/waterresources ว่า localAuthority มาครบ
→ ตรวจ Dashboard counts / KPI / Table / Map
→ ค่อย Deploy Production
```
