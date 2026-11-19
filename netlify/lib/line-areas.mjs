// รายการ 33 พื้นที่ฝั่ง server สำหรับระบบ LINE OA
// ต้องตรงกับ site/assets/district-routes.js และ authority-routes.js (ตรวจโดย tests/line_areas_test.mjs)

export const DASHBOARD_ORIGIN = 'https://dashboard-waterresources1.netlify.app';

const DISTRICTS = [
  ['เมืองพะเยา', 'mueang-phayao'],
  ['แม่ใจ', 'mae-chai'],
  ['ดอกคำใต้', 'dok-kham-tai'],
  ['ภูกามยาว', 'phu-kam-yao']
];

const AUTHORITIES = [
  ['ทม.พะเยา', 'tm-phayao'],
  ['ทต.แม่กา', 'tt-mae-ka'],
  ['อบต.แม่นาเรือ', 'obt-mae-na-ruea'],
  ['อบต.แม่ใส', 'obt-mae-sai'],
  ['อบต.บ้านตุ่น', 'obt-ban-tun'],
  ['ทต.บ้านสาง', 'tt-ban-sang'],
  ['ทต.สันป่าม่วง', 'tt-san-pa-muang'],
  ['ทต.บ้านต๋อม', 'tt-ban-tom'],
  ['ทต.บ้านต๊ำ', 'tt-ban-tam'],
  ['ทต.ท่าจำปี', 'tt-tha-cham-pi'],
  ['ทต.แม่ปืม', 'tt-mae-puem'],
  ['ทต.บ้านใหม่', 'tt-ban-mai'],
  ['ทต.แม่ใจ', 'tt-mae-chai'],
  ['ทต.รวมใจพัฒนา', 'tt-ruam-chai-phatthana'],
  ['ทต.ศรีถ้อย', 'tt-si-thoi'],
  ['อบต.แม่สุก', 'obt-mae-suk'],
  ['ทต.ป่าแฝก', 'tt-pa-faek'],
  ['ทต.บ้านเหล่า', 'tt-ban-lao'],
  ['ทต.เจริญราษฎร์', 'tt-charoen-rat'],
  ['ทม.ดอกคำใต้', 'tm-dok-kham-tai'],
  ['อบต.คือเวียง', 'obt-khue-wiang'],
  ['อบต.บ้านปิน', 'obt-ban-pin'],
  ['อบต.ดอกคำใต้', 'obt-dok-kham-tai'],
  ['อบต.จำป่าหวาย', 'obt-cham-pa-wai'],
  ['ทต.บ้านถ้ำ', 'tt-ban-tham'],
  ['อบต.ดอนศรีชุม', 'obt-don-si-chum'],
  ['อบต.สันโค้ง', 'obt-san-khong'],
  ['อบต.แม่อิง', 'obt-mae-ing'],
  ['ทต.ดงเจน', 'tt-dong-chen']
];

export const LINE_AREAS = Object.freeze([
  ...DISTRICTS.map(([name, slug]) => Object.freeze({ type: 'district', slug, name: 'อำเภอ' + name })),
  ...AUTHORITIES.map(([name, slug]) => Object.freeze({ type: 'authority', slug, name }))
]);

const byKey = new Map(LINE_AREAS.map((area) => [area.type + ':' + area.slug, area]));

export function findArea(type, slug) {
  return byKey.get(String(type) + ':' + String(slug)) || null;
}

export function areaUrl(area) {
  return `${DASHBOARD_ORIGIN}/${area.type}/${area.slug}/`;
}
