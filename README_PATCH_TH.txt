PATCH v1.3.1 — Local Blob version fallback

ใช้กับโฟลเดอร์ DashboardWaterResources_FINAL_29Tambons_Autocomplete เดิม
1) หยุด netlify dev (Ctrl+C)
2) สำรอง source ปัจจุบันถ้าต้องการ
3) คัดลอกไฟล์ใน patch นี้ทับตาม path เดิม:
   package.json
   netlify/lib/water-store.mjs
   netlify/functions/waterresources.mjs
   netlify/functions/waterresources-version.mjs
4) ห้ามลบ .env และ .netlify ในโปรเจกต์เดิม
5) npm install
6) netlify dev

Patch นี้เพิ่ม fallback version จาก metadata.sourceHash เมื่อ Netlify Dev sandbox ไม่คืน Blob ETag
