# LINE OA Rich Menu ตามพื้นที่ — Design

วันที่: 2026-11-20 · สถานะ: **ฉบับแก้ไข 3 — ผู้ใช้เลือกแนวทาง 2026-11-20** (ฉบับ 2 อนุมัติแล้ว) (ฉบับ 1 อนุมัติ 2026-11-20) · งานแยกจาก dashboard UI refresh

## 0.1 ฉบับแก้ไข 3 (2026-11-20) — มีผลเหนือหัวข้อ 0 ที่ขัดกัน

ผู้ใช้: หน้ารอ 2 วินาที "นานไป ยิ่งเน็ตช้า" → **ตัดหน้ารอ** และเพิ่มปุ่มในริชเมนูแทน (ผู้ใช้เลือก "แบบที่ 1: เทมเพลต 5 ช่อง")
- OA Manager ไม่มีเทมเพลต 5 ช่อง → ผู้ใช้เลือก **ริชเมนูชุดเดียวสำหรับทุกคน สร้างผ่าน Messaging API** (ตั้งเป็น default; ไม่ผูกรายคน) ด้วยสคริปต์ `scripts/line/create-rich-menu.mjs` ที่ผู้ใช้รันครั้งเดียวด้วย token ในเชลล์ แล้ว Reissue token; ปิดเมนูใน OA Manager
- ผัง 2500×1686 (ผู้ใช้กำหนด): บน `{0,0,1250,843}` กว๊านกักเก็บ → `https://liff.line.me/2011020414-6k3clTwr`; `{1250,0,1250,843}` แดชบอร์ด → `https://liff.line.me/2011020414-b0taNEeB`; ล่าง `{0,843,833,843}` รายงาน → GAS PDF (`…/exec?openExternalBrowser=1`); `{833,843,834,843}` ผู้ดูแลระบบ → `https://liff.line.me/2011020414-MGeiCo8P`; `{1667,843,833,843}` ตั้งค่าพื้นที่ → `https://liff.line.me/2011020414-b0taNEeB?change=1`
- สคริปต์: `--dry-run`, ตรวจภาพ 2500×1686 ≤ 1 MB, สร้าง+อัปโหลด+ตั้ง default แล้วลบเมนู API ชื่อเดียวกันอันเก่า; `--rollback` ยกเลิก default + ลบเมนูของสคริปต์ (เมนู OA Manager กลับมาแสดง)
- ปุ่ม "แดชบอร์ด" → `https://liff.line.me/2011020414-b0taNEeB` → เลือกแล้ว: `location.replace(url)` **ทันที**; ยังไม่เลือก: มุมมองเลือก
- `?change=1` → มุมมองเลือกเสมอ (แสดงพื้นที่ปัจจุบัน + "ไม่เปลี่ยน กลับไปที่ …")
- เลือก/บันทึกสำเร็จ → ไปแดชบอร์ดทันที
- ภาพเมนู 5 ช่องใหม่ `line/richmenu/richmenu-main.png|jpg` (คัดลอกงาน Canva เดิมมาจัดใหม่)
- ไม่แตะหน้าแดชบอร์ด; API/Blob เหมือนฉบับ 2

## 0. ฉบับแก้ไข 2 (2026-11-20) — มีผลเหนือหัวข้อ 2, 4–8 ที่ขัดกัน

ผู้ใช้เปลี่ยนแนวคิด: **ไม่มีเมนูลงทะเบียน ไม่ผูกเมนูรายคน** ทุกคนใช้ริชเมนู 4 ช่องเดิมใน LINE OA Manager แต่ปุ่ม "แดชบอร์ด" เปลี่ยนลิงก์เป็น `https://liff.line.me/<LIFF my>` ซึ่งเป็นหน้า LIFF หน้าเดียวที่ตัดสินตามสถานะผู้ใช้ (ผู้ใช้เลือก "แนวทาง 1: หน้าเดียว ใช้ API เดิม" และ "แบบ ก: หน้ารอมีปุ่มเปลี่ยน")

**Flow ของหน้า `/line/my/`**

```
กดปุ่มแดชบอร์ด ─► LIFF /line/my/ ─► GET /api/line/me
   ├─ ยังไม่เคยเลือก ──► มุมมอง "เลือก": [กรอกรหัสพื้นที่ → ยืนยัน] / [ใช้งานทั่วไป (ดูภาพรวมจังหวัด)]
   │                        └─ POST /api/line/register สำเร็จ ─► มุมมอง "รอ"
   └─ เลือกแล้ว ──────► มุมมอง "รอ" ~2 วิ: "กำลังเปิด: ทต.แม่กา ▓▓░" + ปุ่ม [เปลี่ยนพื้นที่ / ประเภทผู้ใช้]
                            ├─ ไม่กด ─► location.replace(url ของพื้นที่ หรือ "/" สำหรับทั่วไป)
                            └─ กด ─► มุมมอง "เลือก" (แสดงพื้นที่ปัจจุบัน)
```

- มุมล่างของทุกมุมมองแสดง `รหัสผู้ใช้: U1a2…9f` (ย่อ 4+2 ตัว) ไว้แจ้งแอดมิน
- API error / timeout 8 วิ → ไปหน้าจังหวัด `/` (เหมือนเดิม); 401 → logout+login ใหม่ 1 ครั้ง (`?relogin=1`)

**ข้อมูลใน Blob `line-area-registrations`** (key = userId)
- เจ้าหน้าที่: `{mode:"staff", type, slug, code, updatedAt}`
- ทั่วไป: `{mode:"general", updatedAt}` (ฉบับ 1 ลบ record — ฉบับ 2 เก็บไว้เพื่อไม่ถามซ้ำ)

**API**
- `GET /api/line/me` → `{registered:false}` | `{registered:true, mode:"staff", type, slug, name, url}` | `{registered:true, mode:"general", name:"ภาพรวมจังหวัดพะเยา", url:"https://dashboard-waterresources1.netlify.app/"}`
- `POST /api/line/register` `{code}` → บันทึก staff; `{mode:"general"}` → บันทึก general; **ไม่เรียก LINE Messaging API**

**ตัดออกจากฉบับ 1:** rich menu 3 ชุด, `linkRichMenu`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_RICHMENU_*_ID`, สคริปต์ `scripts/line/create-rich-menus.mjs` และเทสต์, หน้า `/line/register/`, ภาพ `richmenu-register.jpg` (เก็บไฟล์ภาพไว้เผื่อใช้ ไม่ใช้ในระบบ), ขั้นตอน auto-reply "ลงทะเบียน" (ไม่จำเป็น — เปลี่ยนได้จากหน้ารอ)

**env ที่เหลือ:** `LINE_LOGIN_CHANNEL_ID=2011020414`, `LINE_AREA_CODES`

**LIFF:** ใช้ตัว `my` = `2011020414-b0taNEeB` (endpoint `/line/my/`) ตัวเดียว; ตัว `register` = `2011020414-kFPLFeuq` ตัว `register` ที่ผู้ใช้สร้างไว้ไม่ใช้ ลบทิ้งได้

**เปิดใช้งาน:** ตั้ง env 2 ตัว → deploy → ทดสอบเปิด `https://liff.line.me/<LIFF my>` ในแชตของตัวเอง → แก้ลิงก์ปุ่ม "แดชบอร์ด" ใน OA Manager เป็นลิงก์ LIFF (ไม่ต้องสร้างเมนูใหม่ ไม่ต้องใช้ token)

**Anti-goal เพิ่ม:** คนทั่วไปต้องไม่ติดอยู่ที่หน้าเลือก — ปุ่ม "ใช้งานทั่วไป" ต้องเห็นชัดเท่ากับช่องกรอกรหัส และเลือกครั้งเดียวจำตลอด

**งานภายหลัง (ผู้ใช้สั่งจดไว้):** แอดมินแก้/กำหนดพื้นที่ให้ userId ได้เอง — ทางเลือก ก. Netlify CLI `netlify blobs:set/list/delete line-area-registrations …` (ไม่ต้องเขียนโค้ด), ข. หน้าแอดมินบนเว็บ (ต้องมี auth), ค. ย้ายไป Google Sheet — ยังไม่ตัดสิน

## 1. เจตนาและเหตุผล

เจ้าหน้าที่ของแต่ละพื้นที่ (อำเภอ 4 + อปท. 29 = 33 พื้นที่ ที่แดชบอร์ดมีหน้าแยกอยู่แล้ว) ใช้ LINE OA "กว๊านกักเก็บ" เป็นทางเข้าแดชบอร์ด ปัจจุบันปุ่มแดชบอร์ดในริชเมนูพาไปหน้าจังหวัด `/` ทุกคน เจ้าหน้าที่ต้องหาหน้าพื้นที่ตัวเองเอง

เป้าหมาย: เจ้าหน้าที่ลงทะเบียนด้วย "รหัสพื้นที่" ครั้งเดียว หลังจากนั้นปุ่มแดชบอร์ดเปิด `https://dashboard-waterresources1.netlify.app/district/<slug>/` หรือ `/authority/<slug>/` ของตนทันที

**รหัสมีไว้เพื่อความสะดวก (เลือกพื้นที่) ไม่ใช่การควบคุมสิทธิ์** หน้าแดชบอร์ดทุกหน้ายังเป็น URL สาธารณะเหมือนเดิม

## 2. Goals / Non-goals / Anti-goals

Goals
- คนเพิ่มเพื่อน OA → เห็นเมนู "ลงทะเบียน" ก่อน
- กรอกรหัสพื้นที่ถูก → ได้เมนูเจ้าหน้าที่ 4 ช่อง ปุ่มแดชบอร์ดพาไปหน้าพื้นที่ของตน
- กด "ใช้งานทั่วไป (ไม่มีรหัส)" → ได้เมนู 4 ช่องแบบปัจจุบัน ปุ่มแดชบอร์ดไปหน้าจังหวัด
- คนทั่วไป/เจ้าหน้าที่ กลับมาลงทะเบียนใหม่ เปลี่ยนพื้นที่ หรือเปลี่ยนเป็นทั่วไปได้

Non-goals
- ไม่ล็อก/ซ่อนข้อมูลพื้นที่อื่น ไม่เพิ่ม login ให้แดชบอร์ด
- ไม่แก้ `site/index.html`, `authority-app.js`, adapters, API `/api/waterresources*` หรือ UI แดชบอร์ดใด ๆ
- ไม่ทำ webhook, push message, แจ้งเตือน หรือหน้า admin ในรอบนี้
- ไม่เก็บข้อมูลส่วนตัวนอกจาก LINE userId (ไม่เก็บชื่อ รูป เบอร์)

Anti-goals (ถือว่าล้มเหลวแม้จะทำงาน)
- เจ้าหน้าที่กดแดชบอร์ดแล้วเจอหน้าว่าง/error แทนที่จะไปหน้าจังหวัดหรือหน้าลงทะเบียน
- คนทั่วไปที่เพิ่มเพื่อนใช้ 4 ปุ่มเดิมไม่ได้เลยเพราะติดหน้าลงทะเบียน (ต้องมีปุ่ม "ใช้งานทั่วไป" เห็นชัด)
- Token/secret ของ LINE หลุดเข้า repo หรือ frontend
- การ deploy ส่วน LINE ทำให้แดชบอร์ด/การทดสอบเดิมพัง

## 3. ข้อจำกัด

- ทาง A (ผู้ใช้เลือก): อยู่ใน repo และ Netlify site เดิม แต่**เพิ่มไฟล์ใหม่เท่านั้น** แยกโฟลเดอร์/ชื่อ function/Blob store
- Stack เดิม: Netlify Functions Node 22, `@netlify/blobs` 11.0.1, HTML/JS ล้วน ไม่มี build — ห้ามเพิ่ม framework; ใช้ LIFF SDK จาก CDN ของ LINE (`https://static.line-scdn.net/liff/edge/2/sdk.js`)
- Per-user rich menu ต้องสร้างผ่าน Messaging API เท่านั้น (เมนูที่สร้างใน OA Manager ผูกรายคนไม่ได้ และ API มองไม่เห็น)
- LIFF ต้องอยู่ในช่องทาง **LINE Login ภายใต้ provider "กว๊านกักเก็บ" เดียวกับ Messaging API channel** ไม่เช่นนั้น userId ไม่ตรงกัน
- ความลับ (`LINE_CHANNEL_ACCESS_TOKEN`) อยู่ใน Netlify environment variables เท่านั้น
- กฎโปรเจกต์: Claude ไม่ commit/push/deploy, ไม่รัน Playwright เอง, ไม่ยิง Production write ระหว่างทดสอบ (mock `api.line.me` ทั้งหมด)

## 4. Approaches ที่พิจารณา

ระดับเมนู (ผู้ใช้เลือก **ไอเดียที่ 2 แบบ ก.**)
- (1) เมนู 4 ช่องเดิม + ปุ่มที่ 5 "ใส่รหัส" — เมนูเดียวทุกคน ง่ายสุด แต่ผู้ใช้ไม่เลือก
- (2) เมนูลงทะเบียนก่อน แล้วสลับเป็นเมนู 4 ช่อง — **เลือก** ใช้ 3 ชุด: ลงทะเบียน / ทั่วไป / เจ้าหน้าที่
- ทำเมนูแยก 33 ชุด (ลิงก์ตรงต่อพื้นที่) — ตัดทิ้ง ดูแลยาก; ใช้หน้า redirect แทน

ที่วางระบบ (ผู้ใช้เลือก **A**)
- **A. repo/site เดิม แยกไฟล์ใหม่** — ใช้ route modules เดิมตรวจ slug, โดเมนเดียว; แลกกับการ deploy ร่วมกับแดชบอร์ดและ token อยู่ใน env ของ site นี้
- B. Netlify site/repo ใหม่ — แยกขาดแต่ต้องดูแลสองที่
- C. Google Apps Script + Sheet — cold start ช้า และตรวจ header/ลายเซ็นไม่ได้

## 5. การออกแบบ

### 5.1 ภาพรวม flow

```
เพิ่มเพื่อน OA ─► เมนู "ลงทะเบียน" (default ของ OA, เต็มจอ)
                     │ แตะ
                     ▼
            LIFF /line/register/
     ┌──────────────┴───────────────┐
 กรอกรหัสพื้นที่ → ยืนยัน          กด "ใช้งานทั่วไป (ไม่มีรหัส)"
     │ POST /api/line/register        │ POST /api/line/register {mode:"general"}
     ▼                                ▼
 บันทึก userId→พื้นที่ (Blob)      ลบ record ถ้ามี
 linkRichMenu(เจ้าหน้าที่)          linkRichMenu(ทั่วไป)
     ▼                                ▼
 เมนูเจ้าหน้าที่ 4 ช่อง             เมนูทั่วไป 4 ช่อง (= ปัจจุบัน)
 ปุ่มแดชบอร์ด → LIFF /line/my/      ปุ่มแดชบอร์ด → https://…/  (ตรง)
     │ GET /api/line/me
     ▼
 location.replace(/district/<slug>/ หรือ /authority/<slug>/)
```

กลับมาลงทะเบียน/เปลี่ยนพื้นที่: พิมพ์ "ลงทะเบียน" ในแชต → ตอบกลับอัตโนมัติที่ตั้งใน LINE OA Manager ส่งลิงก์ LIFF หน้าลงทะเบียน (ไม่ต้องเขียนโค้ด ไม่ต้องมี webhook) และใส่ลิงก์เดียวกันในข้อความทักทาย (greeting)

### 5.2 Rich menu 3 ชุด (สร้างด้วยสคริปต์ผ่าน Messaging API)

| ชุด | ภาพ | ปุ่ม | หมายเหตุ |
|---|---|---|---|
| ลงทะเบียน | ภาพที่ผู้ใช้ส่ง (เต็มจอ) | พื้นที่เดียว → `https://liff.line.me/<LIFF_REGISTER>` | ตั้งเป็น default ของ OA (`setDefaultRichMenu`) |
| ทั่วไป | ภาพ 4 ช่องปัจจุบัน | 4 ปุ่มเดิมตามลำดับ: LIFF `2011020414-6k3clTwr`, `https://dashboard-waterresources1.netlify.app/`, GAS Water_report_PDF (`…/exec?openExternalBrowser=1`), LIFF `2011020414-MGeiCo8P` | ลิงก์ตามปัจจุบันทุกประการ |
| เจ้าหน้าที่ | ภาพ 4 ช่องเดียวกับ "ทั่วไป" | เหมือน "ทั่วไป" ยกเว้นปุ่มที่ 2 → `https://liff.line.me/<LIFF_MY>` | ภาพเดียวกันได้เพราะต่างแค่ลิงก์ (ผู้ใช้จะเปลี่ยนภาพภายหลังก็ได้) |

- เมนูที่ทำใน OA Manager ตอนนี้: เมื่อตั้ง default ผ่าน API แล้ว default ของ API มีลำดับความสำคัญสูงกว่า ให้ปิดเมนูใน OA Manager หลังทดสอบผ่าน (ขั้นตอนของผู้ใช้)
- `chatBarText` ≤ 14 ตัวอักษร ภาพ ≤ 1 MB ขนาดตามมาตรฐาน (2500×1686 หรือ 2500×843) — bounds ของ 4 ช่องต้องวัดจากภาพปัจจุบัน
- สคริปต์ `scripts/line/create-rich-menus.mjs` (รันโดยผู้ใช้ในเครื่อง อ่าน token จาก environment ของเชลล์ ไม่อ่าน/เขียน `.env` ใน repo) สร้าง 3 ชุด อัปโหลดภาพ ตั้ง default และพิมพ์ rich menu ID ให้ผู้ใช้นำไปใส่ Netlify env เอง; มีโหมด `--dry-run` พิมพ์ JSON โดยไม่ยิง API

### 5.3 หน้า LIFF (static, ไฟล์ใหม่ใน `site/line/`)

- `site/line/register/index.html` — แสดงพื้นที่ปัจจุบัน (ถ้ามี จาก `/api/line/me`), ช่องกรอกรหัส, ปุ่ม "ยืนยัน", ปุ่ม "ใช้งานทั่วไป (ไม่มีรหัส)" ชัดเจนพอ ๆ กัน; สำเร็จ → แสดงชื่อพื้นที่ที่ผูก แล้ว `liff.closeWindow()`; รหัสผิด → ข้อความไทยให้ติดต่อทีมจังหวัด
- `site/line/my/index.html` — `liff.init` → `GET /api/line/me` → `location.replace(url)`; ไม่มี record → ไปหน้าลงทะเบียน; เรียก API ไม่สำเร็จ/timeout (~8 วิ) → ไปหน้าจังหวัด `/` (ไม่ปล่อยหน้าว่าง)
- ทั้งสองหน้าเรียก `liff.getIDToken()` แล้วส่งใน header `Authorization: Bearer <idToken>`; ถ้าเปิดนอกแอป LINE ให้ `liff.login()`
- ใช้ `dashboard-theme.css` ได้ (อ่านอย่างเดียว) แต่ไม่แก้ไฟล์ใด ๆ ของแดชบอร์ด
- LIFF apps 2 ตัวในช่องทาง LINE Login: register (endpoint `/line/register/`), my (endpoint `/line/my/`), scope `openid` (ใช้แค่ `sub` จาก ID token)

### 5.4 API (Netlify Functions ใหม่, prefix `line-`)

ทุก endpoint ตรวจ ID token กับ LINE (`POST https://api.line.me/oauth2/v2.1/verify` ด้วย `id_token` + `client_id` = Channel ID ของ LINE Login) แล้วใช้ `sub` เป็น userId — **ไม่รับ userId จาก client โดยตรง**

| Route | Function | ทำอะไร |
|---|---|---|
| `GET /api/line/me` | `line-me.mjs` | คืน `{registered:false}` หรือ `{registered:true, type, slug, name, url}` |
| `POST /api/line/register` | `line-register.mjs` | body `{code}` → หา slug, บันทึก, `linkRichMenu(STAFF)`; body `{mode:"general"}` → ลบ record, `linkRichMenu(GENERAL)` |

- redirect ใน `netlify.toml`: เพิ่ม 2 บล็อก `/api/line/me`, `/api/line/register` **ก่อน** บล็อก `/api/waterresources` (เพิ่มเท่านั้น ไม่แตะบล็อกเดิม)
- Blob store ใหม่ชื่อ `line-area-registrations` key = userId, value = `{type:"district"|"authority", slug, code, updatedAt}`
- `linkRichMenu` ล้มเหลว → ตอบ error ให้หน้า LIFF แสดง "ลองใหม่" และ**ไม่**บันทึก record ใหม่ (สถานะเมนูกับ record ต้องสอดคล้องกัน: เรียก link ก่อน แล้วค่อยเขียน Blob)
- `url` สร้างฝั่ง server จาก slug ที่ผ่านการตรวจกับรายการ 33 พื้นที่เท่านั้น (กัน open redirect)
- โค้ด lib ร่วมอยู่ที่ `netlify/lib/line-*.mjs`; รายการ slug ใช้ข้อมูลเดียวกับ `site/assets/authority-routes.js` / `district-routes.js` (builder เลือกวิธี import/อ่านที่ไม่ต้องแก้ไฟล์ทั้งสอง)

### 5.5 รหัสพื้นที่

- 1 รหัสต่อ 1 พื้นที่ (33 รหัส) ทีมจังหวัดเป็นผู้กำหนดและแจกเอง ไม่เป็นความลับระดับสูง แต่ไม่ใส่ใน repo/frontend เพื่อไม่ให้ใครก็ได้กดเป็นเจ้าหน้าที่
- เก็บใน Netlify env `LINE_AREA_CODES` เป็น JSON `{"<รหัส>":"authority:tm-phayao", …}`; ตอนโหลดตรวจว่าทุก slug มีจริงและไม่ซ้ำ (config ผิด → log + ตอบ 500 ไม่ผูกผิดพื้นที่)
- รูปแบบ (ผู้ใช้สั่ง: ให้สื่อถึงพื้นที่): **`<ประเภท>-<ชื่อ>` อิงจาก slug** — อำเภอ `AMP-` (เช่น `AMP-MUEANGPHAYAO`), อปท. ใช้คำนำหน้า slug `TM-`/`TT-`/`OBT-` (เช่น `TT-MAEKA`, `OBT-MAENARUEA`) ยาว 8–20 ตัว ไม่ซ้ำกันทั้ง 33 รหัส; รายการเต็มเก็บนอก repo
- ข้อแลกเปลี่ยนที่ยอมรับ: รหัสเดาได้จาก URL สาธารณะ ใครก็ลงทะเบียนเป็นพื้นที่ใดก็ได้ ผลคือแค่ได้เมนูที่พาไปหน้าสาธารณะ — สอดคล้องกับ "ความสะดวก ไม่ใช่การควบคุมสิทธิ์"
- เทียบรหัสแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ และตัดช่องว่าง/ขีด `-` ออกก่อนเทียบ (พิมพ์ `ttmaeka` หรือ `TT MAEKA` ก็ได้)
- เปลี่ยนรหัสต้อง redeploy (env ของ functions มีผลเมื่อ deploy) — ยอมรับได้เพราะเปลี่ยนน้อย

### 5.6 Environment variables (ผู้ใช้ตั้งเองใน Netlify)

`LINE_CHANNEL_ACCESS_TOKEN`, `LINE_LOGIN_CHANNEL_ID`, `LINE_RICHMENU_STAFF_ID`, `LINE_RICHMENU_GENERAL_ID`, `LINE_AREA_CODES`; LIFF IDs ฝั่งหน้าเว็บเป็นค่าสาธารณะ ใส่ในหน้า HTML ได้

### 5.7 การทดสอบ

- `tests/line_api_test.mjs` (node, mock `fetch` ของ `api.line.me` และ Blob): token ไม่ถูก → 401; รหัสถูก → link staff + บันทึก; รหัสผิด → 400 ไม่ link; general → ลบ record + link general; link ล้มเหลว → ไม่บันทึก; `me` ไม่มี record; config `LINE_AREA_CODES` ผิด
- สคริปต์ rich menu: `--dry-run` ตรวจ JSON (bounds, URI, chatBarText ≤ 14)
- เทสต์เดิม (`static_integrity_test.py`, `netlify_function_test.mjs`) ต้องผ่านเหมือนเดิม; Playwright ของหน้า LIFF (ถ้ามี) — เขียนคำสั่งให้ผู้ใช้รัน
- ทดสอบจริงบนมือถือ (ผู้ใช้): deploy preview + LIFF endpoint ชี้ preview ก่อน แล้วค่อยสลับ Production

## 6. ลำดับการเปิดใช้ (rollout)

1. ผู้ใช้ยืนยันช่องทาง LINE Login ใน provider "กว๊านกักเก็บ" และสร้าง LIFF 2 ตัว
2. Deploy functions + หน้า LIFF (เมนูเดิมยังทำงาน ไม่มีใครเห็นของใหม่)
3. รันสคริปต์สร้างเมนู (ยังไม่ตั้ง default) → ทดสอบด้วยการ link เมนูให้บัญชีผู้ใช้เองเท่านั้น
4. ตั้ง env + default เป็นเมนูลงทะเบียน → ปิดเมนูใน OA Manager → ตั้ง auto-reply "ลงทะเบียน" + greeting

ผู้ติดตามเดิม: เมื่อเปลี่ยน default ทุกคนจะเห็นเมนูลงทะเบียน (กด "ใช้งานทั่วไป" ครั้งเดียวก็กลับมาเหมือนเดิม)

## 7. สถานะสิ่งที่ต้องจัดเตรียม

- ✅ ช่องทาง LINE Login "KwanKakKeb" (Channel ID `2011020414`) อยู่ใน provider เดียวกับ Messaging API "กว๊านกักเก็บ" (ผู้ใช้ยืนยันด้วยภาพหน้าจอ) → สร้าง LIFF register/my ในช่องทางนี้; `LINE_LOGIN_CHANNEL_ID=2011020414`
- ✅ รหัสพื้นที่ 33 รหัส สร้างแล้ว (ดู 5.5) อยู่นอก repo
- ✅ ภาพเมนูลงทะเบียน: ผู้ใช้ทำเอง → `line/richmenu/richmenu-register.jpg` (2500×1686 JPEG ≈ 457 KB, ขยายจากต้นฉบับ 2000×1349) แตะได้ทั้งภาพ — ตัวละครถือป้าย "ลงทะเบียน" + กล่อง "เจ้าหน้าที่ กรอกรหัสพื้นที่ · บุคคลทั่วไป ใช้งานได้ทันที · แตะเพื่อเริ่มต้น"
- ภาพ 4 ช่องปัจจุบัน (ผู้ใช้ส่งภาพ): ตาราง 2×2 อัตราส่วน ≈ 2500×1686 ลำดับปุ่ม ซ้ายบน "กว๊านกักเก็บ" → LIFF `6k3clTwr` (KwanKakKebliff), ขวาบน "แดชบอร์ด" → หน้าเว็บ, ซ้ายล่าง "รายงาน" → GAS PDF, ขวาล่าง "ผู้ดูแลระบบ" → LIFF `MGeiCo8P` (LIFFDashboard Engineering) — ทั้งสอง LIFF อยู่ในช่องทาง `2011020414`
- ⏳ ไฟล์ภาพ 4 ช่องต้นฉบับ: อยู่ใน Canva ของผู้ใช้ → ผู้ใช้ export PNG มาให้ (ต้องรู้ขนาดจริงเพื่อวัด bounds) วางไว้ที่ `line/richmenu/` ใน repo (นอก `site/` จึงไม่ถูก deploy)
- ⏳ เมนูเจ้าหน้าที่ใช้ภาพเดียวกับเมนูทั่วไป หรือทำภาพแยก (ค่าเริ่มต้น: ใช้ภาพเดียวกัน)

## 8. การตัดสินใจของผู้ออกแบบ (หลัง builder check — ผู้ใช้ตรวจได้)

- **ผู้ติดตามเดิม/ย้ายระบบ:** ไม่ทำ migration รายคน อาศัย `setDefaultRichMenu` อย่างเดียว เพราะปัจจุบันเมนูทำใน OA Manager จึงไม่มีใครถูก link เมนูรายคนผ่าน API; สคริปต์ตรวจก่อนเปิดใช้ได้ด้วย `GET /v2/bot/richmenu/list` ว่าไม่มีเมนู API เก่าค้าง เจ้าหน้าที่เดิมทุกคนต้องลงทะเบียนครั้งแรกหนึ่งครั้ง (ยอมรับได้) ไม่ทำ rollout แบบเป็นกลุ่ม
- **รายการ 33 slug ฝั่ง server:** เก็บเป็นรายการใน `netlify/lib/line-areas.mjs` (type, slug, ชื่อไทย) + เทสต์กันคลาดเคลื่อน (drift test) ที่โหลด `authority-routes.js`/`district-routes.js` ด้วย `node:vm` แล้วเทียบให้ตรงทุกตัว — ไม่แก้ route modules
- **การเดารหัส:** ไม่ทำ rate limit/lockout เพราะรหัสไม่ใช่การควบคุมสิทธิ์ เดาถูกได้แค่เมนูที่พาไปหน้าสาธารณะ; แนะนำให้รหัสไม่เรียงลำดับง่ายเกินไป
- **record ค้าง (slug ถูกถอดภายหลัง):** `/api/line/me` ถือว่า `registered:false` → หน้า my พาไปหน้าลงทะเบียน
- **path หน้า LIFF:** `/line/register/` และ `/line/my/` เป็นไฟล์ static จริง Netlify เสิร์ฟก่อน redirect rule จึงไม่ชนกับ `/authority/*`, `/district/*`
- **ขนาด env:** `LINE_AREA_CODES` 33 รายการ ราว 1.2 KB อยู่ในขีดจำกัด env ของ functions (4 KB รวม) — ถ้าเกิน builder ย้ายไปเก็บใน Blob ได้โดยไม่เปลี่ยนพฤติกรรม

## 9. ปล่อยให้ builder ตัดสิน

โครงสร้างโค้ดภายใน functions/lib, วิธีอ่านรายการ slug โดยไม่แก้ route modules, ข้อความ/สไตล์หน้า LIFF ภายใต้ธีมเดิม, รูปแบบ log, รายละเอียด mock ในเทสต์
