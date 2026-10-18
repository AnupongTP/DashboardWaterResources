(function (global) {
  'use strict';

  // Keep this list in the same order as AreaResponsibility.AUTHORITY_ORDER.
  const entries = Object.freeze([
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
  ].map(([authority, slug]) => Object.freeze({ authority, slug })));

  const area = global.AreaResponsibility;
  const masterIsValid = !!(area && entries.length === area.AUTHORITY_ORDER.length &&
    new Set(entries.map((entry) => entry.slug)).size === entries.length &&
    entries.every((entry, index) => entry.authority === area.AUTHORITY_ORDER[index] &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) &&
      /^(tm|tt|obt)-/.test(entry.slug)));
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  function resolve(pathname, protocol) {
    if (protocol === 'file:' || !/^\/authority(?:\/|$)/.test(pathname || '')) return { kind: 'root' };
    const match = /^\/authority\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
    if (!masterIsValid || !match || !bySlug.has(match[1])) return { kind: 'invalid' };
    const entry = bySlug.get(match[1]);
    const districts = Array.from(new Set(area.tambonsForAuthority(entry.authority)
      .map((tambon) => area.districtForTambon(tambon))));
    if (!districts.length || districts.some((district) => !district)) return { kind: 'invalid' };
    return { kind: 'authority', authority: entry.authority, slug: entry.slug, districts };
  }

  function fullName(authority) {
    const prefix = authority.startsWith('ทม.') ? 'เทศบาลเมือง' :
      authority.startsWith('ทต.') ? 'เทศบาลตำบล' : 'องค์การบริหารส่วนตำบล';
    return prefix + authority.slice(authority.indexOf('.') + 1);
  }

  async function validateCurrentDataset(records, diagnostics, runtime, loader, location) {
    const expectedOrigin = runtime.mode === 'hosted' ? location.origin : runtime.productionOrigin;
    const endpoint = new URL(loader.constants.DATA_ENDPOINT, location.href);
    if (!expectedOrigin || endpoint.origin !== expectedOrigin ||
        loader.constants.API_ORIGIN !== expectedOrigin) return false;
    if (!Array.isArray(records) || records.some((record) => !record || typeof record !== 'object' ||
        Array.isArray(record) || !Number.isFinite(Number(record.id)) || Number(record.id) <= 0)) return false;
    if (new Set(records.map((record) => String(record.id))).size !== records.length) return false;
    if (!diagnostics || diagnostics.count !== records.length || !diagnostics.version ||
        String(diagnostics.version).startsWith('bootstrap:') || diagnostics.apiOrigin !== expectedOrigin) return false;
    if (diagnostics.reportedCount !== null && diagnostics.reportedCount !== undefined &&
        diagnostics.reportedCount !== records.length) return false;
    if (diagnostics.remoteCount !== null && diagnostics.remoteCount !== undefined &&
        diagnostics.remoteCount !== records.length) return false;
    const liveSource = runtime.mode === 'hosted' ? 'netlify-blob-api' :
      runtime.mode === 'development' ? 'production-api-development' : 'production-api-file';
    if (diagnostics.source === liveSource && diagnostics.validatedBy === 'dataset-get' &&
        diagnostics.reportedCount === records.length) return true;
    if (runtime.mode === 'file' && diagnostics.source === 'production-script-bridge-file' &&
        diagnostics.validatedBy === 'file-bridge-get' && diagnostics.reportedCount === records.length) return true;
    if (!['indexeddb-cache', 'indexeddb-cache-304'].includes(diagnostics.source)) return false;
    const expectedValidation = diagnostics.source === 'indexeddb-cache' ? 'version-get' : 'dataset-304';
    if (diagnostics.validatedBy !== expectedValidation) return false;
    const cached = await loader.cacheGet();
    return !!(cached && cached.remoteOrigin === expectedOrigin && cached.version === diagnostics.version &&
      Array.isArray(cached.data) && cached.data.length === records.length &&
      (cached.reportedCount === null || cached.reportedCount === undefined ||
        cached.reportedCount === records.length) &&
      (diagnostics.source !== 'indexeddb-cache' || diagnostics.remoteCount === records.length));
  }

  function showFailure(kind) {
    const main = document.createElement('main');
    main.id = 'authorityFailure';
    main.style.cssText = 'max-width:560px;margin:12vh auto;padding:28px;font-family:Sarabun,sans-serif;color:#17324c;text-align:center;';
    main.setAttribute('role', 'alert');
    const title = document.createElement('h1');
    title.textContent = kind === 'invalid' ? 'ไม่พบหน่วยงาน' : 'ข้อมูลหน่วยงานไม่พร้อมใช้งาน';
    const message = document.createElement('p');
    message.textContent = kind === 'invalid'
      ? 'URL หน่วยงานไม่ถูกต้องหรือไม่อยู่ในรายการที่รองรับ'
      : 'ไม่สามารถโหลดข้อมูลล่าสุดของหน่วยงานนี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    main.append(title, message);
    if (kind !== 'invalid') {
      const retry = document.createElement('button');
      retry.id = 'authorityRetry';
      retry.type = 'button';
      retry.textContent = 'ลองใหม่อีกครั้ง';
      retry.style.cssText = 'padding:10px 20px;border:0;border-radius:8px;background:#0a5fb4;color:white;cursor:pointer;';
      retry.addEventListener('click', () => global.location.reload());
      main.appendChild(retry);
    }
    document.body.replaceChildren(main);
    document.title = title.textContent;
  }

  global.AuthorityRoutes = Object.freeze({ entries, masterIsValid, resolve, fullName,
    validateCurrentDataset, showFailure });
})(window);
