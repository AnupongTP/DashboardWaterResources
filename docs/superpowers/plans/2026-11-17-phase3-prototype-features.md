# Phase 3 — Prototype Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. แผนนี้ "port โค้ดต้นแบบ" — คัดลอกบล็อกจากต้นแบบแล้วต่อเข้ากับข้อมูล/ตัวกรองของระบบเรา ห้ามเขียนใหม่จากความเข้าใจเอง

**Goal:** เพิ่มฟีเจอร์ของต้นแบบให้ทั้ง 34 หน้า (template เดียว `site/index.html`): แท็บ 🔬 ข้อมูลเชิงลึก, แท็บ 🧪 คุณภาพน้ำ, คลังภาพใหม่ + lightbox, แผนที่ชำรุดใหม่, ไม่นับปริมาตรซ้ำ

**Spec:** `docs/superpowers/specs/2026-11-17-prototype-parity-design.md` — D2, D7, D13–D16, §3 (อ่านคู่กัน)
**ต้นแบบ (อ้างอิงบรรทัดใน `C:\Users\Anupong\Desktop\rawชั่วคราว\index (5).html`):** ทั้ง 3 ไฟล์ต้นแบบเป็นโค้ดเดียวกัน ต่างเพียงชื่อ/คำเรียกพื้นที่/จุดกลางแผนที่/namespace counter/ข้อมูลฝัง — ใช้ `index (5).html` เป็นแหล่ง port; คำว่า "จังหวัด" ในข้อความให้ใช้ `SCOPE_UNIT` (มีแล้วใน `index.html`)

| บล็อก | บรรทัดต้นแบบ |
|---|---|
| CSS Insight | `<style id="ix-style">` 1235–1311, `<style id="ix-theme">` 1312–1997 (เลือกเฉพาะกฎ `#ixSection`, `.ix-*`, `.gal-*`, `.lb*`, `dmg*` ที่ยังไม่มี — ห้ามทับธีมที่ทำแล้ว) |
| Markup แท็บ insight / quality / gallery / damaged | 2278–2381 |
| Lightbox markup | 2382–2413 |
| markDupVolume + `vol()` ที่ข้าม `_dupSkip` | 2443, 3171 (+ `gfDupKey` ราว 2600) |
| คลังภาพ `galCard`/`renderGallery`/`openLightbox`/`lbStep`/`closeLightbox` | 4165–~4260 |
| แผนที่ชำรุด `makeDamageIcon`/`damagePopup`/`addBaseMaps`/`makeClusterGroup` | 2930–2950, 4343–~4400 |
| Insight script (`renderFinds…renderAll`, delegation `data-f`) | `<script id="ix-script">` 4523–5110 |

## Global Constraints

- **ห้าม port:** ข้อมูลฝัง (`dataScript`), การล้างข้อมูลตอนโหลด (ลบแถวซ้ำทุกช่อง, ต่อท้าย ID, แยกประเภทสระ/บ่อ — D16 OPEN), `applyGlobalFilter`/การผูกตัวกรองข้ามแท็บ (D2), `mc-script` (MarkerCluster ฝัง — เราโหลดจาก CDN แล้ว), counter ของต้นแบบ
- คงทั้งหมด: `WaterData`/fail-closed, AREA resolver + ล็อก route, ตัวกรองเฟส 1, ตำบล combobox, counter identity เดิม, image fallback (no-referrer/retry) — คลังภาพ/lightbox ใหม่ต้องใช้ fallback เดิม
- ข้อมูลที่ฟีเจอร์ใหม่ใช้ = ข้อมูลของแท็บรายละเอียด (`state` + ฟังก์ชันกรองฝั่งรายละเอียด) ซึ่งถูกจำกัดเขตแล้วด้วย `RAW` (D15)
- ไม่ commit/push/deploy; tests mock ทั้งหมด ห้าม visitor hit/Production write/Google image จริง
- Env: `. .superpowers/sdd/2026-11-16-dashboard-ui-refresh/env.ps1`

## Task 0: Gate — ทำให้ tree นิ่งก่อน (หยุดถามผู้ใช้)

- [ ] รัน regression ชุดเฟส 2 (ตาม `plans/2026-11-17-phase2-shared-template.md` Task 5) + `province_filter_bar_playwright.mjs` บน tree ปัจจุบัน (มีงานเฟส 2 ที่เอา DSS ออก + ส่วนความเสี่ยง D13 ที่ยังไม่ได้ทดสอบครบ)
- [ ] รายงานผลแล้ว **หยุด** ขอผู้ใช้อนุมัติ commit เฟส 2 + D13 ก่อนเริ่ม Task 1 (จุดย้อนกลับ)

## Task 1: ไม่นับปริมาตรซ้ำ (D14)

- [ ] Test RED (`tests/prototype_features_playwright.mjs` ใหม่): fixture 2 แถวชื่อ/ตำบล/พิกัดเดียวกัน ปริมาตร 100 และ 300 → KPI ปริมาตรรวมนับ 300 ครั้งเดียว; แถวที่ไม่มีพิกัด/ชื่อไม่ถูกตัด; จำนวนแหล่งน้ำ **ไม่เปลี่ยน**
- [ ] port `gfDupKey` + `markDupVolume` (เรียกหลัง `RAW` ถูกจำกัดเขตแล้ว) และทุก `vol()`/การรวมปริมาตรในหน้าให้ข้าม `_dupSkip` แบบต้นแบบ — grep `typeof r.volume` / `vol(` ให้ครบ
- [ ] test เดิมที่คาดปริมาตรรวมเปลี่ยนเพราะ fixture มีแถวซ้ำ: ปรับค่าคาดพร้อม Ruling (อนุมัติแล้ว D14) — แถวไม่ซ้ำต้องได้ค่าเดิม

## Task 2: แท็บ 🔬 ข้อมูลเชิงลึก

- [ ] Test RED: ปุ่ม `data-tab="insight"` มี; เปิดแล้ว `#ixSection` แสดงการ์ดครบชุดตาม `renderAll` ของต้นแบบ; ไม่มี page error ที่ 1440/390; คลิกแถว `[data-f]` → จำนวนในตารางแท็บรายละเอียดลดตามกฎ และ **ตัวกรอง/KPI บทสรุปไม่เปลี่ยน** (D15); หน้า scoped แสดงเฉพาะข้อมูลในเขต
- [ ] port CSS/markup/script ตามตาราง; `D` (ชุดข้อมูลของ insight) = ข้อมูลแท็บรายละเอียดปัจจุบัน; `window.ixSetFilter` → ตั้ง `state.rule`/`state.missing`/ค่าอื่นของฝั่งรายละเอียด แล้ว `render()` ฝั่งรายละเอียด (port `gfRule`/`gfBlank` มาใช้ในตัวกรองฝั่งรายละเอียด)
- [ ] แผนที่เครือข่ายลำน้ำ (`ixNetMap`): ใช้ tile/cluster เดิมของเรา; จุดกลาง = fit bounds ข้อมูลในเขต (ไม่ hardcode)
- [ ] `ixUpdated` "ข้อมูลล่าสุดเมื่อ": ใช้ `dt` สูงสุดของข้อมูลจริง (แบบต้นแบบ) — ไม่เดา

## Task 3: แท็บ 🧪 คุณภาพน้ำ

- [ ] Test RED: ปุ่ม `data-tab="quality"`; รายการ = เฉพาะแถวที่มีปัญหาคุณภาพน้ำ (คีย์เวิร์ดต้นแบบ) จากข้อมูลแท็บรายละเอียด; ตาราง/คลังภาพในแท็บนี้ตรงชุดเดียวกัน
- [ ] port markup 2291–2321 + logic ที่ markup นี้เรียก (grep id ใน markup แล้วตามหาฟังก์ชัน)

## Task 4: คลังภาพใหม่ + lightbox

- [ ] Test RED: แท็บประเภท/ปัญหา + ตำบลกรองภาพได้; 1 แหล่งน้ำหลายภาพ (`photoLinks`); lightbox ก่อน/ถัดไป/ปิด (Esc); รูปเสีย → fallback เดิม (ไม่ยิงซ้ำ, ปุ่มลองใหม่โดยผู้ใช้)
- [ ] port `galCard`/`renderGallery`/`openLightbox`/`lbStep`/`closeLightbox` + markup แทนคลังภาพเดิม — คง hook image fallback เดิม

## Task 5: แผนที่แหล่งน้ำชำรุดใหม่

- [ ] Test RED: `#dmgPick`/`#dmgLegend` เลือกกลุ่มความเสียหายแล้วหมุดเปลี่ยน; popup ชำรุด; สลับแผนที่ฐาน; fullscreen/popup มือถือยังผ่าน `mobile_map_popup_playwright.mjs`
- [ ] port ฟังก์ชันตามตาราง; ใช้ `cluster-icon.js` ร่วม (ห้าม SVG clipped stroke กลับมา)

## Task 6: ตรวจและส่งมอบ

- [ ] รัน: tests ใหม่, `province_filter_bar`, `scoped_template_playwright.mjs`, `authority_locked` (29), `district_dashboard`, `mobile_map_popup`, `authority_image_requests`, `playwright_dashboard_test.py`
- [ ] ภาพเต็มหน้า **ทุกแท็บ** เทียบต้นแบบ ที่ 1440/390 สำหรับ จังหวัด/แม่กา/แม่ใจ (ต้นแบบเปิดแบบ offline ตัด network) → scratchpad; บันทึกความต่างที่เหลือ
- [ ] รายงาน "เฟส 3" ใน `docs/DASHBOARD_UI_REFRESH_REPORT.md` + Rulings; ไม่อ้าง parity จนผู้ใช้ตรวจ

## Review Focus

- Insight/คุณภาพน้ำ/คลังภาพ ในหน้า scoped ห้ามมีข้อมูลนอกเขต
- `_dupSkip` ไม่กระทบจำนวนแหล่งน้ำ/KPI นับ — กระทบเฉพาะผลรวมปริมาตร
- ภาพ Google: ไม่มีคำขอซ้ำเพิ่มจาก gallery/lightbox (เทียบ `authority_image_requests`)
