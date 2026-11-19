/* Shared per-authority visitor counter (phase 2). Copied verbatim from site/assets/authority-app.js
   (visitorCounterIdentity + initVisitorCounter) so namespaces, daily keys and the production-host guard are identical.
   Usage: VisitorCounter.init(window.__AUTHORITY_CONTEXT__) on a scoped page that contains the #visitorCounter markup. */
(function (global) {
  'use strict';
function visitorCounterIdentity(context){
  if(context.kind==='district'){
    const known = window.DistrictRoutes?.masterIsValid && window.DistrictRoutes.entries.some(entry=>
      entry.slug===context.slug && entry.district===context.district);
    return known ? {namespace:`pyo-water-district-${context.slug}`,visitKey:`pyoDistrictVisitDate:${context.slug}`} : null;
  }
  const known = window.AuthorityRoutes?.entries.some(entry=>
    entry.slug===context.slug && entry.authority===context.authority);
  if(!known) return null;
  return context.slug==='tt-mae-ka'
    ? {namespace:'pyo-water-maeka-dashboard',visitKey:'pyoMaeKaVisitDate'}
    : {namespace:`pyo-water-authority-${context.slug}`,visitKey:`pyoAuthorityVisitDate:${context.slug}`};
}
function initVisitorCounter(AUTHORITY){
  const identity = visitorCounterIdentity(AUTHORITY);
  if(!identity) return;
  const VC_NAMESPACE = identity.namespace;
  const VC_VISIT_KEY = identity.visitKey;
  // รายชื่อประเทศที่ติดตามแยกยอด (ประเทศนอกลิสต์นี้จะถูกนับรวมในกลุ่ม "อื่นๆ")
  const VC_COUNTRIES = [
    ['TH','ไทย'],['US','สหรัฐอเมริกา'],['CN','จีน'],['JP','ญี่ปุ่น'],['KR','เกาหลีใต้'],
    ['SG','สิงคโปร์'],['MY','มาเลเซีย'],['VN','เวียดนาม'],['LA','ลาว'],['MM','เมียนมา'],
    ['KH','กัมพูชา'],['PH','ฟิลิปปินส์'],['ID','อินโดนีเซีย'],['IN','อินเดีย'],['GB','สหราชอาณาจักร'],
    ['DE','เยอรมนี'],['FR','ฝรั่งเศส'],['AU','ออสเตรเลีย'],['CA','แคนาดา'],['RU','รัสเซีย'],
    ['TW','ไต้หวัน'],['HK','ฮ่องกง'],['NL','เนเธอร์แลนด์'],['AE','สหรัฐอาหรับเอมิเรตส์'],['BR','บราซิล'],
    ['OTHER','อื่นๆ'],
  ];
  function vcFlag(code){
    if(code==='OTHER') return '🌐';
    return code.replace(/./g, c=>String.fromCodePoint(127397 + c.charCodeAt(0)));
  }
  function vcUrl(action, key){ return `https://abacus.jasoncameron.dev/${action}/${VC_NAMESPACE}/${key}`; }

  const vcToggle = document.getElementById('vcToggle'), vcPanel = document.getElementById('vcPanel');

  // เปิด/ปิดแผงแบบเดียวกับหน้าหลัก (index.html initVisitorCounter) — ใช้ CSS .vc-panel ของหน้าหลักวางเหนือปุ่ม
  if(vcToggle&&vcPanel){
    vcToggle.addEventListener('click',()=>vcPanel.classList.toggle('open'));
    document.addEventListener('click',e=>{
      if(!vcToggle.contains(e.target)&&!vcPanel.contains(e.target)) vcPanel.classList.remove('open');
    });
  }

  (async function(){
    const elTotal = document.getElementById('vcTotal');
    const elList = document.getElementById('vcCountryList');
    const elCount = document.getElementById('vcCountryCount');
    const elStatus = document.getElementById('vcStatus');
    try{
      // นับ 1 ครั้ง/ผู้เข้าชม/วัน (กันไม่ให้กดรีเฟรชหน้าซ้ำๆ แล้วยอดเพิ่มรัวๆ) โดยจำวันที่เข้าชมล่าสุดไว้ใน localStorage ของเบราว์เซอร์ผู้เข้าชมเอง
      const today = new Date().toISOString().slice(0,10);
      const isLiveProduction = location.protocol === 'https:' &&
        location.hostname === 'dashboard-waterresources1.netlify.app' &&
        (location.pathname === `/${AUTHORITY.kind==='district'?'district':'authority'}/${AUTHORITY.slug}` ||
          location.pathname === `/${AUTHORITY.kind==='district'?'district':'authority'}/${AUTHORITY.slug}/`);
      const isNewVisitToday = isLiveProduction && localStorage.getItem(VC_VISIT_KEY) !== today;
      if(isNewVisitToday){
        let countryCode = 'OTHER';
        try{
          const geoResp = await fetch('https://ipwho.is/', {cache:'no-store'});
          const geo = await geoResp.json();
          if(geo && geo.success !== false && geo.country_code && VC_COUNTRIES.some(c=>c[0]===geo.country_code)){
            countryCode = geo.country_code;
          }
        }catch(geoErr){ /* หาประเทศไม่ได้ก็ยังนับยอดรวมได้ตามปกติ จัดเข้ากลุ่ม "อื่นๆ" แทน */ }
        const totalHit = await fetch(vcUrl('hit','total-views'));
        if(!totalHit.ok) throw new Error('Visitor total increment failed: '+totalHit.status);
        // A confirmed total hit must not be repeated if the separate country hit fails.
        localStorage.setItem(VC_VISIT_KEY, today);
        const countryHit = await fetch(vcUrl('hit','country-'+countryCode));
        if(!countryHit.ok) throw new Error('Visitor country increment failed: '+countryHit.status);
      }
      const totalResp = await fetch(vcUrl('get','total-views'));
      if(!totalResp.ok) throw new Error('Visitor total request failed: '+totalResp.status);
      const totalData = await totalResp.json();
      if(!totalData || !Number.isFinite(totalData.value)) throw new Error('Visitor total is unavailable');
      const totalVal = totalData.value;
      if(elTotal) elTotal.textContent = totalVal.toLocaleString('th-TH');

      const results = await Promise.all(VC_COUNTRIES.map(async c=>{
        try{
          const r = await fetch(vcUrl('get','country-'+c[0]));
          if(!r.ok) throw new Error('Country count request failed: '+r.status);
          const d = await r.json();
          if(!d || !Number.isFinite(d.value)) throw new Error('Country count is unavailable');
          return {code:c[0], name:c[1], value:d.value, available:true};
        }catch(e){ return {code:c[0], name:c[1], value:0, available:false}; }
      }));
      const withData = results.filter(r=>r.available && r.value>0).sort((a,b)=>b.value-a.value);
      if(results.every(r=>!r.available)) {
        if(elList) elList.innerHTML = '';
        if(elStatus){ elStatus.textContent = 'ไม่สามารถโหลดข้อมูลแยกตามประเทศได้ในขณะนี้'; elStatus.style.display = 'block'; }
        return;
      }
      if(results.some(r=>!r.available) && elStatus){
        elStatus.textContent = 'ข้อมูลบางประเทศไม่พร้อมใช้งาน'; elStatus.style.display = 'block';
      }
      if(elCount) elCount.textContent = withData.length;
      if(elList){
        elList.innerHTML = withData.map(r=>`<div class="vc-country-row"><span class="vc-flag">${vcFlag(r.code)}</span><span class="vc-cname">${r.name}</span><span class="vc-cval">${r.value.toLocaleString('th-TH')}</span></div>`).join('') || '<div class="vc-empty">ยังไม่มีข้อมูล</div>';
      }
    }catch(err){
      console.warn('Visitor counter unavailable:', err);
      if(elTotal) elTotal.textContent = '—';
      if(elList) elList.innerHTML = '';
      if(elStatus){ elStatus.textContent = 'ไม่สามารถโหลดข้อมูลผู้เข้าชมได้ในขณะนี้ (ต้องเปิดผ่านเว็บที่มีอินเทอร์เน็ต)'; elStatus.style.display = 'block'; }
    }
  })();
}

  global.VisitorCounter = Object.freeze({identity: visitorCounterIdentity, init: initVisitorCounter});
})(window);
