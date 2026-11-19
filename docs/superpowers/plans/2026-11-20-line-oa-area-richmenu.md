# LINE OA Rich Menu ตามพื้นที่ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าหน้าที่ลงทะเบียนรหัสพื้นที่ผ่าน LIFF แล้วปุ่มแดชบอร์ดในริชเมนูพาไปหน้าพื้นที่ของตน; คนทั่วไปได้เมนู 4 ช่องเดิม

**Architecture:** rich menu 3 ชุด (ลงทะเบียน=default / ทั่วไป / เจ้าหน้าที่) สร้างด้วยสคริปต์; หน้า LIFF static 2 หน้าใน `site/line/`; Netlify Functions 2 ตัว (`line-me`, `line-register`) ตรวจ LIFF ID token กับ LINE แล้วอ่าน/เขียน Blob store `line-area-registrations` และเรียก `linkRichMenu`. ไม่แตะโค้ดแดชบอร์ดเดิม

**Tech Stack:** Node 22 ESM, `@netlify/blobs` 11.0.1, LIFF SDK v2 (CDN `https://static.line-scdn.net/liff/edge/2/sdk.js`), HTML/JS ล้วน

**Spec:** `docs/superpowers/specs/2026-11-20-line-oa-area-richmenu-design.md`

## Revision 2 (spec หัวข้อ 0) — แทนที่ Task 0, 3 (linkRichMenu), 5 (contract), 6, 7, 8

Task 1, 2, 4 คงเดิม (เสร็จแล้ว). งานเพิ่ม:

- **R1 API** — `netlify/lib/line-handlers.mjs`, `line-registrations.mjs`, `line-runtime.mjs`, `line-client.mjs`; test `tests/line_handlers_test.mjs`, `line_registrations_test.mjs`, `line_client_test.mjs`
  - deps = `{verify, registrations, codes}` (ไม่มี `link`, menu ids)
  - `registrations.set(userId, {mode:'staff', type, slug, code} | {mode:'general'})` + `updatedAt`
  - `me` → `{registered:false}` | `{registered:true, mode:'staff', type, slug, name, url}` | `{registered:true, mode:'general', name:'ภาพรวมจังหวัดพะเยา', url: DASHBOARD_ORIGIN + '/'}`; record staff ที่ slug ไม่อยู่ใน 33 หรือ mode ไม่รู้จัก → `{registered:false}`
  - `register` `{code}` → set staff → 200 `{ok:true, mode:'staff', name, url}`; `{mode:'general'}` → set general → 200 `{ok:true, mode:'general', name, url}`; 400/401/500/503 เหมือนเดิม; ไม่มี 502
  - ลบ `linkRichMenu` และเทสต์ของมัน; env เหลือ `LINE_LOGIN_CHANNEL_ID`, `LINE_AREA_CODES`
- **R2 หน้า `/line/my/`** — `site/line/my/index.html`, `site/line/line-config.js` (`{myId:'2011020414-b0taNEeB'}`); test `tests/line_pages_test.mjs`
  - มุมมอง `choose` (ฟอร์มรหัส + ปุ่ม "ใช้งานทั่วไป (ดูภาพรวมจังหวัด)" + "พื้นที่ปัจจุบัน" ถ้ามี) และ `wait` ("กำลังเปิด: <name>" แถบนับถอยหลัง `WAIT_MS = 2000` + ปุ่ม "เปลี่ยนพื้นที่ / ประเภทผู้ใช้" ที่ยกเลิก timer แล้วไป `choose`)
  - footer `รหัสผู้ใช้: U1a2…9f` จาก `liff.getDecodedIDToken().sub` (4 ตัวแรก + `…` + 2 ตัวท้าย)
  - 401 → relogin ครั้งเดียว (`?relogin=1`); error/timeout 8 วิ ที่ `me` → `location.replace('/')`
- **R3 ลบ** — `site/line/register/`, `scripts/line/`, `tests/line_richmenu_script_test.mjs`; คง `line/richmenu/richmenu-register.jpg` (ไม่ใช้)
- **เปิดใช้งาน (ผู้ใช้)** — Netlify env 2 ตัว → deploy → เปิด `https://liff.line.me/2011020414-b0taNEeB` ทดสอบ → แก้ลิงก์ปุ่ม "แดชบอร์ด" ใน OA Manager

## Revision 3 (spec หัวข้อ 0.1)

- R2 แก้: ตัดมุมมอง `wait`/`WAIT_MS`; registered และไม่มี `?change=1` → `location.replace(url)` ทันที; `?change=1` → มุมมอง `choose`; บันทึกสำเร็จ → `go(result.body.url)` — test `tests/line_pages_test.mjs`
- ผู้ใช้: เทมเพลต 5 ช่องใน OA Manager + ภาพใหม่ + ปุ่ม "ตั้งค่าพื้นที่" → `https://liff.line.me/2011020414-b0taNEeB?change=1`

## Global Constraints

- เพิ่มไฟล์ใหม่เท่านั้น ยกเว้น `netlify.toml` (เพิ่ม redirect 2 บล็อก ก่อนบล็อก `/api/waterresources`) — ห้ามแก้ `site/index.html`, `site/assets/*`, `netlify/lib/water-store.mjs`, functions เดิม
- ห้ามมี token/secret ใน repo หรือ frontend; ความลับอ่านจาก `process.env` เท่านั้น
- env (rev 2): `LINE_LOGIN_CHANNEL_ID` (=`2011020414`), `LINE_AREA_CODES` — ไม่ใช้ `LINE_CHANNEL_ACCESS_TOKEN`/`LINE_RICHMENU_*_ID` แล้ว
- Blob store `line-area-registrations` (`consistency: 'strong'`), key = LINE userId (`sub`), value `{mode:'staff', type, slug, code, updatedAt}` | `{mode:'general', updatedAt}`
- รหัส: เทียบแบบ uppercase และตัดช่องว่าง/`-` ออก; `LINE_AREA_CODES` = JSON `{"TT-MAEKA":"authority:tt-mae-ka", ...}`
- URL ปลายทาง: `https://dashboard-waterresources1.netlify.app/district/<slug>/` หรือ `/authority/<slug>/` สร้างฝั่ง server จากรายการ 33 พื้นที่เท่านั้น
- เทสต์ทุกตัว mock `fetch` ของ `api.line.me` และ Blob — ห้ามยิง LINE/Netlify จริง
- Claude รันได้: `node tests/line_*.mjs`, `node --check`, `git diff --check`; Playwright/การทดสอบบนมือถือ = ผู้ใช้รัน
- Commit: Claude ไม่ commit — ทุกขั้น "Commit" ให้คำสั่งผู้ใช้รัน ไม่มี `Co-Authored-By`
- ข้อความ UI ภาษาไทย

## Review Focus

1. ผู้ใช้ไม่มี record หรือ record ค้าง (slug ถูกถอด) → ต้องเห็นมุมมองเลือก ไม่ค้างหน้าว่าง — Task 5 `me returns registered:false when no record`, Task 6 ตรวจ fallback
2. Blob ล่ม → JSON 503 `storage`; ID token หมดอายุ → relogin ครั้งเดียว ไม่ค้าง — Task 5 `register does not save when link fails`
3. รหัสพิมพ์เล็ก/มีช่องว่าง/มีขีด (`tt maeka`, `ttmaeka`) → ต้องผ่าน — Task 2 `normalizes case, spaces and hyphens`
4. `LINE_AREA_CODES` ตั้งผิด (JSON พัง, slug ไม่มีจริง, map พื้นที่ซ้ำ) → 500 ไม่ผูกผิดพื้นที่ — Task 2 `rejects invalid config`
5. ID token หมดอายุ/ปลอม หรือไม่มี header → 401 ไม่แตะ Blob/LINE — Task 5 `rejects missing or invalid token`

---

### Task 0: ผู้ใช้เตรียมฝั่ง LINE (manual, ไม่มีโค้ด)

- [ ] **Step 1:** LINE Developers → provider → ช่องทาง Messaging API "กว๊านกักเก็บ" → Messaging API tab → Issue **Channel access token (long-lived)** → เก็บไว้ (ยังไม่ใส่ที่ไหน)
- [ ] **Step 2:** ช่องทาง LINE Login "KwanKakKeb" → LIFF → Add 2 ตัว: `register` endpoint `https://dashboard-waterresources1.netlify.app/line/register/`, `my` endpoint `https://dashboard-waterresources1.netlify.app/line/my/`; Size Full; Scope `openid` (+`profile` ไม่จำเป็น); จด LIFF ID ทั้งสอง
- [ ] **Step 3:** Export ภาพ 4 ช่องจาก Canva (`DAHSEDyRxwM` หน้า 1) เป็น PNG 2500×1686 ≤ 1 MB → `line/richmenu/richmenu-main.png` (ถ้าเกิน 1 MB ใช้ JPG → `richmenu-main.jpg`)
- [ ] **Step 4:** แจ้ง LIFF ID 2 ตัวให้ Claude (ค่าสาธารณะ) — **ห้ามส่ง token มาในแชต**

### Task 1: รายการ 33 พื้นที่ฝั่ง server + drift test

**Files:**
- Create: `netlify/lib/line-areas.mjs`
- Test: `tests/line_areas_test.mjs`

**Interfaces:**
- Produces: `LINE_AREAS: ReadonlyArray<{type:'district'|'authority', slug:string, name:string}>` (33 รายการ, อำเภอ 4 ตามลำดับ `district-routes.js` แล้ว อปท. 29 ตามลำดับ `authority-routes.js`); `findArea(type, slug) -> area|null`; `areaUrl(area) -> string`; `DASHBOARD_ORIGIN = 'https://dashboard-waterresources1.netlify.app'`

- [ ] **Step 1: เขียนเทสต์** — `drift: matches route modules` โหลด `site/assets/area-responsibility.js`, `district-routes.js`, `authority-routes.js` ด้วย `node:vm` (sandbox `{window: sandbox}` ตั้ง `sandbox.window = sandbox`, มี `location`/`document` stub ถ้าจำเป็น) แล้ว assert `LINE_AREAS` ตรงกับ `DistrictRoutes.entries`+`AuthorityRoutes.entries` ทั้ง slug และชื่อ; `areaUrl(findArea('authority','tt-mae-ka')) === 'https://dashboard-waterresources1.netlify.app/authority/tt-mae-ka/'`; `findArea('authority','nope') === null`; `LINE_AREAS.length === 33`
- [ ] **Step 2:** `node tests/line_areas_test.mjs` → FAIL (module not found)
- [ ] **Step 3:** เขียน `line-areas.mjs` (ชื่อ อปท. ตาม `authority-routes.js`, ชื่ออำเภอขึ้นต้น "อำเภอ" ใน `name`)
- [ ] **Step 4:** รันเทสต์ → PASS
- [ ] **Step 5: Commit (ผู้ใช้)** `git add netlify/lib/line-areas.mjs tests/line_areas_test.mjs` · `git commit -m "feat(line): server-side area list with drift test"`

### Task 2: รหัสพื้นที่

**Files:** Create `netlify/lib/line-codes.mjs` · Test `tests/line_codes_test.mjs`

**Interfaces:**
- Consumes: `findArea` (Task 1)
- Produces: `normalizeCode(input:string) -> string`; `parseAreaCodes(json:string) -> Map<normalizedCode, {code, area}>` (throws `Error('LINE_AREA_CODES invalid: ...')`); `lookupCode(map, input) -> {code, area}|null`

- [ ] **Step 1: เขียนเทสต์** — `normalizes case, spaces and hyphens`: `normalizeCode(' tt maeka ') === normalizeCode('TT-MAEKA') === 'TTMAEKA'`; `lookupCode` คืน area `tt-mae-ka`; รหัสไม่มี → `null`; `rejects invalid config`: JSON พัง / ค่า `authority:nope` / `"x":"bad"` / สองรหัส normalize แล้วชนกัน → throw; 33 รหัสจริงจาก spec ตัวอย่าง (`AMP-MUEANGPHAYAO`, `TM-PHAYAO`, `TT-RUAMCHAIPHATTHANA`) parse ผ่าน
- [ ] **Step 2:** รัน → FAIL
- [ ] **Step 3:** implement (พื้นที่เดียวกันมีได้รหัสเดียวไม่บังคับ — ยอมหลายรหัสต่อพื้นที่)
- [ ] **Step 4:** รัน → PASS
- [ ] **Step 5: Commit (ผู้ใช้)** `feat(line): area code parsing`

### Task 3: LINE client

**Files:** Create `netlify/lib/line-client.mjs` · Test `tests/line_client_test.mjs`

**Interfaces:**
- Produces: `verifyIdToken(idToken, {channelId, fetchImpl=fetch}) -> Promise<string|null>` (คืน `sub` เมื่อ 200 และ `aud===channelId`, ไม่งั้น `null`); `linkRichMenu(userId, richMenuId, {token, fetchImpl=fetch}) -> Promise<void>` (throw `Error('linkRichMenu failed: <status>')` เมื่อไม่ ok)
- Endpoints: verify = `POST https://api.line.me/oauth2/v2.1/verify` body `application/x-www-form-urlencoded` `id_token`,`client_id`; link = `POST https://api.line.me/v2/bot/user/{userId}/richmenu/{richMenuId}` header `Authorization: Bearer <token>`

- [ ] **Step 1: เขียนเทสต์** ด้วย `fetchImpl` ปลอมที่บันทึก URL/body: verify 200 `{sub:'U123',aud:'2011020414'}` → `'U123'`; 400 → `null`; aud ไม่ตรง → `null`; link 200 → resolve และ URL/headers ถูก; link 500 → reject; userId ที่ไม่ขึ้นต้น `U` → reject โดยไม่เรียก fetch
- [ ] **Step 2:** รัน → FAIL · **Step 3:** implement · **Step 4:** รัน → PASS
- [ ] **Step 5: Commit (ผู้ใช้)** `feat(line): LINE verify and linkRichMenu client`

### Task 4: Registration store

**Files:** Create `netlify/lib/line-registrations.mjs` · Test `tests/line_registrations_test.mjs`

**Interfaces:**
- Produces: `createRegistrations(store) -> {get(userId), set(userId, {type, slug, code}), remove(userId)}` (`set` เติม `updatedAt` ISO); `defaultRegistrations() -> createRegistrations(getStore({name:'line-area-registrations', consistency:'strong'}))`
- store ที่ใช้: `get(key,{type:'json'})`, `setJSON`, `delete`

- [ ] **Step 1: เขียนเทสต์** ด้วย Map-backed fake store: set → get คืนค่าพร้อม `updatedAt`; remove → get `null`
- [ ] **Step 2–4:** FAIL → implement → PASS
- [ ] **Step 5: Commit (ผู้ใช้)** `feat(line): registration store`

### Task 5: Functions `line-me`, `line-register` + redirects

**Files:**
- Create: `netlify/lib/line-handlers.mjs`, `netlify/functions/line-me.mjs`, `netlify/functions/line-register.mjs`
- Modify: `netlify.toml` — เพิ่มก่อนบล็อก `from = "/api/waterresources"`:
  `/api/line/me` → `/.netlify/functions/line-me`, `/api/line/register` → `/.netlify/functions/line-register` (status 200, force true)
- Test: `tests/line_handlers_test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces: `createMeHandler(deps)`, `createRegisterHandler(deps)` — `deps = {verify(idToken)->sub|null, registrations, link(userId, menuId), codes: ()=>Map, staffMenuId, generalMenuId}`; functions default-export handler ที่ wire deps จริงจาก env
- Contract:
  - ทุก request: อ่าน `Authorization: Bearer <idToken>`; ไม่มี/verify null → 401 `{ok:false, error:'unauthorized'}`
  - `GET /api/line/me` → 200 `{registered:false}` หรือ `{registered:true, type, slug, name, url}`; record ที่ slug ไม่อยู่ใน 33 → `{registered:false}`
  - `POST /api/line/register` body `{code}` → รหัสไม่พบ 400 `{ok:false, error:'invalid_code'}`; พบ → `link(staff)` แล้ว `set` → 200 `{ok:true, mode:'staff', name, url}`
  - body `{mode:'general'}` → `link(general)` แล้ว `remove` → 200 `{ok:true, mode:'general', url: DASHBOARD_ORIGIN + '/'}`
  - link throw → 502 `{ok:false, error:'link_failed'}` ไม่เขียน/ลบ Blob
  - config รหัสผิด (parse throw) → 500 `{ok:false, error:'config'}` + `console.error`
  - method อื่น → 405; ทุก response `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8`

- [ ] **Step 1: เขียนเทสต์** ครอบ contract ทั้งหมด รวม Review Focus 1, 2, 4, 5: `rejects missing or invalid token` (ไม่มีการเรียก link/registrations), `register does not save when link fails`, `me returns registered:false when no record`, `general removes record and links general menu`, `invalid config returns 500`
- [ ] **Step 2:** รัน → FAIL · **Step 3:** implement handlers + 2 function files + netlify.toml
- [ ] **Step 4:** `node tests/line_handlers_test.mjs` → PASS; `node tests/netlify_function_test.mjs` และ `python tests/static_integrity_test.py` → ผ่านเหมือนเดิม; `git diff --check` สะอาด
- [ ] **Step 5: Commit (ผู้ใช้)** `feat(line): me/register API`

### Task 6: หน้า LIFF

**Files:**
- Create: `site/line/line-config.js` (`window.LINE_LIFF = {registerId:'<จาก Task 0>', myId:'<จาก Task 0>'}`), `site/line/register/index.html`, `site/line/my/index.html`
- Test: `tests/line_pages_test.mjs` (static: ไม่มีคำว่า `LINE_CHANNEL_ACCESS_TOKEN`/รูปแบบ token, โหลด SDK จาก `static.line-scdn.net`, เรียก `/api/line/me`/`/api/line/register`, มีปุ่ม "ใช้งานทั่วไป (ไม่มีรหัส)")

**Interfaces:** Consumes contract ของ Task 5

- หน้า register: `liff.init({liffId: registerId})` → ถ้า `!liff.isLoggedIn()` → `liff.login()`; โหลด `/api/line/me` แสดง "พื้นที่ปัจจุบัน: <name>" ถ้ามี; ฟอร์มรหัส + ปุ่ม "ยืนยัน" + ปุ่ม "ใช้งานทั่วไป (ไม่มีรหัส)" ขนาดเท่ากัน; สำเร็จ → แสดง "ลงทะเบียนพื้นที่ <name> แล้ว" 1.5 วิ แล้ว `liff.closeWindow()`; `invalid_code` → "ไม่พบรหัสพื้นที่นี้ กรุณาตรวจสอบหรือติดต่อทีมจังหวัด"; `link_failed`/อื่น → "เกิดข้อผิดพลาด กรุณาลองใหม่"
- หน้า my: init/login เหมือนกัน → `/api/line/me` (timeout 8 วิ ด้วย `AbortController`) → registered → `location.replace(url)`; ไม่ registered → `location.replace('https://liff.line.me/' + registerId)`; error/timeout → `location.replace('/')`; ระหว่างรอแสดง "กำลังเปิดแดชบอร์ดของคุณ…"
- สไตล์: inline CSS เล็ก ๆ ฟอนต์ Sarabun สีเขียว `#236b00`/ส้ม `#d15a00` ตามภาพเมนู; ห้ามแก้ไฟล์ใน `site/assets/`

- [ ] **Step 1:** เขียนเทสต์ static → FAIL · **Step 2:** สร้าง 3 ไฟล์ · **Step 3:** เทสต์ → PASS; `python tests/static_integrity_test.py` ผ่าน
- [ ] **Step 4 (ผู้ใช้, Playwright ถ้าต้องการ):** Claude เขียนคำสั่งให้ — ไม่บังคับ เพราะ LIFF ต้องทดสอบบนแอป LINE จริงใน Task 8
- [ ] **Step 5: Commit (ผู้ใช้)** `feat(line): LIFF register and my-dashboard pages`

### Task 7: สคริปต์สร้าง rich menu

**Files:** Create `scripts/line/create-rich-menus.mjs` · Test `tests/line_richmenu_script_test.mjs`

**Interfaces:**
- Produces: `buildMenus({registerLiffId, myLiffId}) -> {register, general, staff}` (rich menu JSON); CLI `node scripts/line/create-rich-menus.mjs --dry-run` พิมพ์ JSON; ไม่มี `--dry-run` → อ่าน `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_LIFF_REGISTER_ID`, `LINE_LIFF_MY_ID` จาก env ของเชลล์, (1) `GET /v2/bot/richmenu/list` พิมพ์เมนูที่มีอยู่, (2) สร้าง 3 ชุด `POST /v2/bot/richmenu`, (3) อัปโหลดภาพ `POST https://api-data.line.me/v2/bot/richmenu/{id}/content`, (4) พิมพ์ ID ทั้งสาม; ตั้ง default เฉพาะเมื่อมี `--set-default` (`POST /v2/bot/user/all/richmenu/{registerId}`)
- ค่าเมนู (size 2500×1686 ทุกชุด):
  - register: `name 'ลงทะเบียน'`, `chatBarText 'ลงทะเบียน'`, area เต็ม `{0,0,2500,1686}` → `https://liff.line.me/<registerLiffId>`, ภาพ `line/richmenu/richmenu-register.jpg`
  - general: `chatBarText 'เมนู'`, 4 area: TL `{0,0,1250,843}`→`https://liff.line.me/2011020414-6k3clTwr`; TR `{1250,0,1250,843}`→`https://dashboard-waterresources1.netlify.app/`; BL `{0,843,1250,843}`→`https://script.google.com/macros/s/AKfycbzYUmqGc2JfHD4n8f6Y8hf-h5RoXVI9Y1IZkUCJrk7NaJ1DrqGRV5q9Pe_BJz0JRgk8wQ/exec?openExternalBrowser=1`; BR `{1250,843,1250,843}`→`https://liff.line.me/2011020414-MGeiCo8P`; ภาพ `line/richmenu/richmenu-main.(png|jpg)`
  - staff: เหมือน general ยกเว้น TR → `https://liff.line.me/<myLiffId>`; ภาพเดียวกัน

- [ ] **Step 1: เขียนเทสต์** `buildMenus`: chatBarText ≤ 14, bounds ไม่เกินภาพและไม่ทับกัน, ทุก uri เป็น https, staff ต่างจาก general เฉพาะ TR; รัน CLI `--dry-run` ด้วย `child_process` → exit 0 และไม่เรียกเครือข่าย
- [ ] **Step 2–4:** FAIL → implement → PASS (สคริปต์ตรวจขนาดไฟล์ภาพ ≤ 1 MB ก่อนอัปโหลด)
- [ ] **Step 5: Commit (ผู้ใช้)** `feat(line): rich menu creation script`

### Task 8: เปิดใช้งาน (ผู้ใช้ทำตามลำดับ, Claude ให้คำสั่ง)

- [ ] **Step 1:** Netlify → Site settings → Environment variables: ตั้ง `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_LOGIN_CHANNEL_ID=2011020414`, `LINE_AREA_CODES` (JSON จากไฟล์รหัส) — scope Functions
- [ ] **Step 2:** push + deploy (ผู้ใช้) → เมนูเดิมยังทำงาน
- [ ] **Step 3:** รันสคริปต์ในเครื่อง (ไม่ใส่ `--set-default`) → ได้ 3 ID → ตั้ง `LINE_RICHMENU_STAFF_ID`, `LINE_RICHMENU_GENERAL_ID` ใน Netlify → redeploy
- [ ] **Step 4:** ทดสอบกับบัญชีตัวเอง: link เมนู register ให้ userId ตัวเอง (คำสั่ง curl ที่ Claude ให้) → ลงทะเบียน `TT-MAEKA` → กดแดชบอร์ด → ต้องเปิด `/authority/tt-mae-ka/`; ลองรหัสผิด; ลอง "ใช้งานทั่วไป" → แดชบอร์ดเปิด `/`
- [ ] **Step 5:** ตั้ง default (`--set-default` หรือ curl) → ปิดเมนูใน OA Manager → ตั้ง auto-reply คำว่า "ลงทะเบียน" + greeting ให้ส่ง `https://liff.line.me/<registerLiffId>`
