(function (global) {
  'use strict';

  const entries = Object.freeze([
    ['เมืองพะเยา', 'mueang-phayao'],
    ['แม่ใจ', 'mae-chai'],
    ['ดอกคำใต้', 'dok-kham-tai'],
    ['ภูกามยาว', 'phu-kam-yao']
  ].map(([district, slug]) => Object.freeze({ district, slug })));
  const area = global.AreaResponsibility;
  const masterIsValid = !!(area && entries.length === area.DISTRICT_ORDER.length &&
    new Set(entries.map(entry => entry.slug)).size === entries.length &&
    entries.every((entry, index) => entry.district === area.DISTRICT_ORDER[index] &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) &&
      area.DISTRICT_TAMBONS[entry.district]?.length > 0));
  const bySlug = new Map(entries.map(entry => [entry.slug, entry]));

  function resolve(pathname, protocol) {
    if (protocol === 'file:' || !/^\/district(?:\/|$)/.test(pathname || '')) return {kind:'root'};
    const match = /^\/district\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
    if (!masterIsValid || !match || !bySlug.has(match[1])) return {kind:'invalid'};
    return {kind:'district', ...bySlug.get(match[1])};
  }

  function showFailure(kind) {
    global.AuthorityRoutes.showFailure(kind);
    const main = document.getElementById('authorityFailure');
    main.id = 'districtFailure';
    main.querySelector('h1').textContent = kind === 'invalid' ? 'ไม่พบอำเภอ' : 'ข้อมูลอำเภอไม่พร้อมใช้งาน';
    main.querySelector('p').textContent = kind === 'invalid'
      ? 'URL อำเภอไม่ถูกต้องหรือไม่อยู่ในรายการที่รองรับ'
      : 'ไม่สามารถโหลดข้อมูลล่าสุดของอำเภอนี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    const retry = main.querySelector('#authorityRetry');
    if (retry) retry.id = 'districtRetry';
    document.title = main.querySelector('h1').textContent;
  }

  global.DistrictRoutes = Object.freeze({entries, masterIsValid, resolve, showFailure});
})(window);
