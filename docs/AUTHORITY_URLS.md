# Canonical authority URLs

These are intended routes for a future deployment on the active Production site. They are **not live until this local change is deployed**. The source of truth in code is `site/assets/authority-routes.js`, checked against `AreaResponsibility.AUTHORITY_ORDER` at runtime.

| Canonical authority | Slug | Intended Production URL |
| --- | --- | --- |
| ทม.พะเยา | `tm-phayao` | https://dashboard-waterresources1.netlify.app/authority/tm-phayao/ |
| ทต.แม่กา | `tt-mae-ka` | https://dashboard-waterresources1.netlify.app/authority/tt-mae-ka/ |
| อบต.แม่นาเรือ | `obt-mae-na-ruea` | https://dashboard-waterresources1.netlify.app/authority/obt-mae-na-ruea/ |
| อบต.แม่ใส | `obt-mae-sai` | https://dashboard-waterresources1.netlify.app/authority/obt-mae-sai/ |
| อบต.บ้านตุ่น | `obt-ban-tun` | https://dashboard-waterresources1.netlify.app/authority/obt-ban-tun/ |
| ทต.บ้านสาง | `tt-ban-sang` | https://dashboard-waterresources1.netlify.app/authority/tt-ban-sang/ |
| ทต.สันป่าม่วง | `tt-san-pa-muang` | https://dashboard-waterresources1.netlify.app/authority/tt-san-pa-muang/ |
| ทต.บ้านต๋อม | `tt-ban-tom` | https://dashboard-waterresources1.netlify.app/authority/tt-ban-tom/ |
| ทต.บ้านต๊ำ | `tt-ban-tam` | https://dashboard-waterresources1.netlify.app/authority/tt-ban-tam/ |
| ทต.ท่าจำปี | `tt-tha-cham-pi` | https://dashboard-waterresources1.netlify.app/authority/tt-tha-cham-pi/ |
| ทต.แม่ปืม | `tt-mae-puem` | https://dashboard-waterresources1.netlify.app/authority/tt-mae-puem/ |
| ทต.บ้านใหม่ | `tt-ban-mai` | https://dashboard-waterresources1.netlify.app/authority/tt-ban-mai/ |
| ทต.แม่ใจ | `tt-mae-chai` | https://dashboard-waterresources1.netlify.app/authority/tt-mae-chai/ |
| ทต.รวมใจพัฒนา | `tt-ruam-chai-phatthana` | https://dashboard-waterresources1.netlify.app/authority/tt-ruam-chai-phatthana/ |
| ทต.ศรีถ้อย | `tt-si-thoi` | https://dashboard-waterresources1.netlify.app/authority/tt-si-thoi/ |
| อบต.แม่สุก | `obt-mae-suk` | https://dashboard-waterresources1.netlify.app/authority/obt-mae-suk/ |
| ทต.ป่าแฝก | `tt-pa-faek` | https://dashboard-waterresources1.netlify.app/authority/tt-pa-faek/ |
| ทต.บ้านเหล่า | `tt-ban-lao` | https://dashboard-waterresources1.netlify.app/authority/tt-ban-lao/ |
| ทต.เจริญราษฎร์ | `tt-charoen-rat` | https://dashboard-waterresources1.netlify.app/authority/tt-charoen-rat/ |
| ทม.ดอกคำใต้ | `tm-dok-kham-tai` | https://dashboard-waterresources1.netlify.app/authority/tm-dok-kham-tai/ |
| อบต.คือเวียง | `obt-khue-wiang` | https://dashboard-waterresources1.netlify.app/authority/obt-khue-wiang/ |
| อบต.บ้านปิน | `obt-ban-pin` | https://dashboard-waterresources1.netlify.app/authority/obt-ban-pin/ |
| อบต.ดอกคำใต้ | `obt-dok-kham-tai` | https://dashboard-waterresources1.netlify.app/authority/obt-dok-kham-tai/ |
| อบต.จำป่าหวาย | `obt-cham-pa-wai` | https://dashboard-waterresources1.netlify.app/authority/obt-cham-pa-wai/ |
| ทต.บ้านถ้ำ | `tt-ban-tham` | https://dashboard-waterresources1.netlify.app/authority/tt-ban-tham/ |
| อบต.ดอนศรีชุม | `obt-don-si-chum` | https://dashboard-waterresources1.netlify.app/authority/obt-don-si-chum/ |
| อบต.สันโค้ง | `obt-san-khong` | https://dashboard-waterresources1.netlify.app/authority/obt-san-khong/ |
| อบต.แม่อิง | `obt-mae-ing` | https://dashboard-waterresources1.netlify.app/authority/obt-mae-ing/ |
| ทต.ดงเจน | `tt-dong-chen` | https://dashboard-waterresources1.netlify.app/authority/tt-dong-chen/ |

`tm-` means เทศบาลเมือง, `tt-` means เทศบาลตำบล, and `obt-` means องค์การบริหารส่วนตำบล. URL scope uses the canonical resolver and can legitimately contain zero confirmed records. Unresolved and ambiguous records are never assigned by guessing.
