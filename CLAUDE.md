# KwanKukkeb – Phayao Water Resources Data Center Dashboard

แดชบอร์ดแหล่งน้ำจังหวัดพะเยา: หน้าจังหวัด + หน้า อปท. 29 แห่ง + อำเภอ 4 แห่ง (ใช้ template เดียว)

## Stack
- HTML/CSS/JS ล้วน ไม่มี framework/build — Leaflet 1.9.4, MarkerCluster 1.5.3, Chart.js 4.4.1
- Netlify: `publish = "site"`, functions ใน `netlify/functions` (Node 22, `@netlify/blobs`)
- ข้อมูลต้นทาง: Google Form/Sheet → `google-apps-script/WaterResourcesDashboardSync.gs` → Netlify Blob

## แผนที่โค้ด
- **`site/` คือตัวที่ deploy** — `index.html`/`maeka.html` ที่ root ไม่ได้ deploy อย่าแก้/อ่านโดยไม่จำเป็น
- `site/index.html` (~4,000 บรรทัด, CSS+HTML+JS ในไฟล์เดียว) — grep หา marker แล้วอ่านเฉพาะช่วง:
  - Markup: `===== HEADER`, `VIEW 1: EXECUTIVE`, `TOP FILTER BAR`, `SECTION HERO`, `SECTION 1`–`SECTION 5`, `VIEW 2: DETAIL`, `PIVOT TABLE`, `SITE DETAIL CARD MODAL`, `CHART EXPAND MODAL`
  - Script: `// ===== MAIN NAV`, `HEADER KPI`, `EXECUTIVE ANALYTICS ENGINE`, `// ===== MAP`, `EXPAND MODAL SYSTEM`, `DETAIL VIEW LOGIC`, `ตัวนับผู้เข้าชม`
- `site/authority.html` + `assets/authority-app.js` — template หน้า อปท./อำเภอ (route `/authority/*`, `/district/*`)
  - routes: `authority-routes.js`, `district-routes.js` | adapters: `authority-data-adapter.js`, `district-data-adapter.js`
- `site/maeka.html` + `maeka-app.js` + `maeka-data-adapter.js` — prototype แม่กา (คงเดิม ไม่อยู่ในขอบเขต UI refresh)
- `site/assets/` อื่น ๆ: `water-data-loader.js` (API/version/cache/fallback), `map-popup.js`, `cluster-icon.js`, `tambon-combobox.js` (autocomplete 29 ตำบล), `area-responsibility.js` (กฎเขต อปท.), `runtime-config.js`, `stream-data.js`, `dashboard-theme.css` (ธีมใหม่)
- `site/data/waterresources.initial.*` — ข้อมูลตั้งต้น/fallback
- `netlify/functions/waterresources*.mjs` + `netlify/lib/water-store.mjs` — API `/api/waterresources[/version|/sync|/file-bridge]`
- `docs/` — contracts (`AUTHORITY_MAPPING_CONTRACT.json`, `LOCALAUTHORITY_POLICY_CONTRACT.json`, `AREA_RESPONSIBILITY_RULES_TH.md`), `TEST_REPORT.md`
- `docs/superpowers/` — spec/plan ของงานปัจจุบัน (ยึดตามนี้)

## เทสต์
- หลัก: `node tests/area_responsibility_test.mjs`, `python tests/static_integrity_test.py`, `node tests/netlify_function_test.mjs`, `python tests/playwright_dashboard_test.py`, `python tests/playwright_cache_logic_test.py`
- เฉพาะเรื่อง: `tests/authority_*_playwright.py`, `tests/*_playwright.mjs` — รันเฉพาะไฟล์ที่เกี่ยวกับส่วนที่แก้
- ไฟล์ `tests/*-results.json` และ `tests/screenshots/` ถูกเขียนทับเมื่อรันเทสต์
- **ห้าม Claude รัน Playwright เอง** (ผู้ใช้สั่ง 17 พ.ย. 2026): เขียนคำสั่ง PowerShell ให้ผู้ใช้รัน — บรรทัดแรก `. .superpowers\sdd\2026-11-16-dashboard-ui-refresh\env.ps1` แล้วตามด้วยคำสั่งเทสต์ + ผลที่คาด แล้วรอผลจากผู้ใช้; รันเองได้เฉพาะ syntax check/grep/`git diff --check`

## กฎเฉพาะโปรเจกต์
- ห้ามเปลี่ยน IDs, data attributes, event bindings, สูตร, ตัวกรอง, adapters, API/cache/fallback, counter guards
- เทสต์ต้อง mock API/ภาพ/tiles/counters — ห้ามยิง Production write, Google image หรือ visitor hit จริง
- ห้าม commit/push/deploy จนกว่าผู้ใช้สั่ง; ห้าม reset/stash งานค้างใน working tree
- commit message **ห้ามใส่ `Co-Authored-By: Claude`** หรือ attribution ของ Claude; **ห้าม push เอง** — ให้คำสั่ง git ผู้ใช้รันเอง (ผู้ใช้สั่ง 18 พ.ย. 2026)
