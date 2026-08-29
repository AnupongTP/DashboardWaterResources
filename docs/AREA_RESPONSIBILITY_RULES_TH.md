# กติกาพื้นที่รับผิดชอบของ DashboardWaterResources

Ruleset: `2026-08-27.2`  
Policy: `KebNamComplete-LocalAuthority-v1.2`

ไฟล์ใช้งานจริง: `site/assets/area-responsibility.js`

## หลักการ

1. `Tambon` = ตำบล
2. `Moo` = หมู่
3. `LocalAuthority` = เขต อปท. ที่ผู้จัดเก็บข้อมูลยืนยันจากฟอร์ม
4. `WaterOwner` = เจ้าของ/ผู้ดูแลแหล่งน้ำ และ **ห้ามใช้** ตัดสินเขต อปท.
5. `Tambon + Moo` มีหน้าที่สร้าง exact mapping / ค่าแนะนำ ไม่ได้มีสิทธิ์ทับ `LocalAuthority` ที่ผู้กรอกยืนยันอย่างถูกต้อง
6. ถ้า exact mapping มีหลายค่า (`SELECT`) ผู้กรอกต้องเลือกจาก exact options ของหมู่นั้นเท่านั้น
7. ถ้า exact mapping มีค่าเดียว (`SUGGEST`) ค่านั้นเป็นค่าแนะนำ แต่ผู้กรอกแก้เป็น อปท. อื่นที่อยู่ใน master ของตำบลเดียวกันได้
8. ถ้าไม่มี exact mapping (`TAMBON_ONLY`) ไม่ควรมี `LocalAuthority`
9. ข้อมูลเก่าที่ไม่มี `LocalAuthority` และ exact mapping มีค่าเดียว ใช้ legacy fallback ชั่วคราว
10. ข้อมูลเก่าที่ exact mapping มีหลายค่า จะไม่ถูกเดาเข้า อปท. ใด
11. Dashboard ไม่มี bucket หรือข้อความ `ต้องยืนยันเขต อปท.` ใน UI
12. Dropdown อปท. แสดงเฉพาะ อปท. ที่มี resolved record อย่างน้อย 1 รายการใน dataset เต็ม
13. 1 record resolve ได้สูงสุด 1 อปท. เท่านั้น

## Master List ตำบล 29 รายการ

`แม่กา, แม่นาเรือ, แม่ใส, บ้านตุ่น, บ้านสาง, สันป่าม่วง, บ้านต๋อม, บ้านต๊ำ, ท่าจำปี, เทศบาลเมือง, เจริญราษฎร์, แม่ปืม, แม่สุก, ป่าแฝก, บ้านเหล่า, บ้านใหม่, แม่ใจ, ศรีถ้อย, สว่างอารมณ์, บุญเกิด, ดอกคำใต้, ดอนศรีชุม, คือเวียง, บ้านปิน, จำป่าหวาย, บ้านถ้ำ, แม่อิง, สันโค้ง, ดงเจน`

Canonical/display name คือ `บ้านปิน`; legacy `บ้านปิ่น` ถูก normalize ภายในเท่านั้น

## Exact Master Mapping

| อปท./เทศบาล | ตำบล | exact mapping |
|---|---|---|
| ทม.ดอกคำใต้ | สว่างอารมณ์ | ทั้งตำบล |
| ทม.ดอกคำใต้ | บุญเกิด | ทั้งตำบล |
| ทม.ดอกคำใต้ | ดอกคำใต้ | หมู่ 1,2,7 |
| ทม.ดอกคำใต้ | ดอนศรีชุม | หมู่ 1,5,7,10 และบางส่วนหมู่ 8,9 |
| อบต.คือเวียง | คือเวียง | ทั้งตำบล |
| อบต.บ้านปิน | บ้านปิน | ทั้งตำบล |
| อบต.ดอกคำใต้ | ดอกคำใต้ | หมู่ 1,2,3,4,5,6,8,9,10 |
| อบต.จำป่าหวาย | จำป่าหวาย | ทั้งตำบล |
| ทต.บ้านถ้ำ | บ้านถ้ำ | ทั้งตำบล |
| อบต.ดอนศรีชุม | ดอนศรีชุม | หมู่ 2,3,4,6 และบางส่วนหมู่ 8,9 |
| อบต.แม่อิง | แม่อิง | หมู่ 4,5,6,8 |
| ทต.ดงเจน | แม่อิง | หมู่ 1,2,3,7 |
| ทต.ดงเจน | ดงเจน | หมู่ 1,2,3,4,5,8,9,10,11,12,13,16 |
| อบต.สันโค้ง | สันโค้ง | ทั้งตำบล |

Machine-readable exact mapping: `docs/AUTHORITY_MAPPING_CONTRACT.json`  
Machine-readable policy: `docs/LOCALAUTHORITY_POLICY_CONTRACT.json`

## Policy v1.2

### SELECT

ตัวอย่าง `ดอกคำใต้ หมู่ 1`

```text
exact options:
- ทม.ดอกคำใต้
- อบต.ดอกคำใต้
```

ถ้าไม่มี `LocalAuthority` → ไม่ assign อปท.  
ถ้ามี `LocalAuthority` → ต้องเป็นหนึ่งในสองค่านี้

### SUGGEST

ตัวอย่าง `ดอกคำใต้ หมู่ 3`

```text
recommendedAuthority = อบต.ดอกคำใต้
valid explicit authorities =
- อบต.ดอกคำใต้
- ทม.ดอกคำใต้
```

ดังนั้น record นี้ถูกต้องทั้งสองแบบ:

```json
{"tambon":"ดอกคำใต้","moo":3,"localAuthority":"อบต.ดอกคำใต้"}
```

```json
{"tambon":"ดอกคำใต้","moo":3,"localAuthority":"ทม.ดอกคำใต้"}
```

ค่าแรก = ยืนยันค่าที่ระบบแนะนำ  
ค่าที่สอง = explicit override ที่ผู้กรอกยืนยัน

กติกาเดียวกันใช้กับ `ดอนศรีชุม` และ `แม่อิง`: ถ้า exact mapping มีค่าเดียว ผู้กรอกเปลี่ยนได้เฉพาะ อปท. ที่มีอยู่ใน master ของตำบลเดียวกัน

### TAMBON_ONLY

ตัวอย่าง `ดงเจน หมู่ 6` หรือพื้นที่ที่ไม่มี mapping

```text
exact options = 0
LocalAuthority ต้องว่าง
```

แม้ตำบลนั้นจะมี อปท. อยู่ใน master ก็ห้ามเดาหรือรับ explicit value ถ้า `Tambon + Moo` ไม่มี exact mapping

## Resolver Priority

```text
มี LocalAuthority
→ validate ด้วย policy v1.2
→ valid: ใช้ LocalAuthority จริง
→ invalid: resolved authority = null

ไม่มี LocalAuthority
→ exact options = 1: legacy fallback ชั่วคราว
→ exact options > 1: null
→ exact options = 0: null
```

`recommendedAuthority` และ `resolvedLocalAuthority` เป็นคนละค่าเสมอ

## Active Authority Dropdown

รายการ อปท. ใน Executive / Detail / Damaged ใช้ full loaded dataset:

```text
RAW
→ resolveAuthority(record)
→ count ต่อ resolvedLocalAuthority
→ count > 0 แสดง
→ count = 0 ซ่อน
```

Master Mapping ไม่ถูกลบ และ dropdown ไม่เปลี่ยนไปมาตาม WaterType/Tambon filter ปัจจุบัน
