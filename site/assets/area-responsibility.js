(function (global) {
  'use strict';

  /**
   * กติกาพื้นที่รับผิดชอบสำหรับ DashboardWaterResources
   * Contract: KebNamComplete LocalAuthority v1.2
   *
   * หลักการ:
   * - LocalAuthority จากฐานข้อมูล (ถ้ามี) มีลำดับความสำคัญสูงสุด แต่ต้องผ่าน master validation
   * - ข้อมูลเก่าที่ LocalAuthority ว่าง ใช้ master Tambon + Moo เป็น legacy fallback เฉพาะเมื่อได้คำตอบเดียว
   * - พื้นที่ overlap/partial ที่ได้มากกว่า 1 candidate จะไม่เดา
   * - WaterOwner ไม่ใช้ตัดสินเขตปกครอง
   * - District เป็น master แยกจาก authority เพื่อใช้ cascading filter อำเภอ -> อบต./เทศบาล -> ตำบล
   */
  const RULESET_VERSION = '2026-09-02.1';
  const POLICY_VERSION = 'KebNamComplete-LocalAuthority-v1.2';

  const OLD_TAMBONS = Object.freeze([
    'แม่กา', 'แม่นาเรือ', 'แม่ใส', 'บ้านตุ่น', 'บ้านสาง', 'สันป่าม่วง',
    'บ้านต๋อม', 'บ้านต๊ำ', 'ท่าจำปี', 'เทศบาลเมือง', 'เจริญราษฎร์',
    'แม่ปืม', 'แม่สุก', 'ป่าแฝก', 'บ้านเหล่า', 'บ้านใหม่', 'แม่ใจ', 'ศรีถ้อย'
  ]);

  const NEW_TAMBONS = Object.freeze([
    'สว่างอารมณ์', 'บุญเกิด', 'ดอกคำใต้', 'ดอนศรีชุม', 'คือเวียง',
    'บ้านปิน', 'จำป่าหวาย', 'บ้านถ้ำ', 'แม่อิง', 'สันโค้ง', 'ดงเจน'
  ]);

  const TAMBON_ORDER = Object.freeze(OLD_TAMBONS.concat(NEW_TAMBONS));

  const DISTRICT_ORDER = Object.freeze(['เมืองพะเยา', 'แม่ใจ', 'ดอกคำใต้', 'ภูกามยาว']);

  const DISTRICT_TAMBONS = Object.freeze({
    'เมืองพะเยา': Object.freeze([
      'แม่กา', 'แม่นาเรือ', 'แม่ใส', 'บ้านตุ่น', 'บ้านสาง', 'สันป่าม่วง',
      'บ้านต๋อม', 'บ้านต๊ำ', 'ท่าจำปี', 'เทศบาลเมือง', 'แม่ปืม', 'บ้านใหม่'
    ]),
    'แม่ใจ': Object.freeze(['เจริญราษฎร์', 'แม่สุก', 'ป่าแฝก', 'บ้านเหล่า', 'แม่ใจ', 'ศรีถ้อย']),
    'ดอกคำใต้': Object.freeze([
      'สว่างอารมณ์', 'บุญเกิด', 'ดอกคำใต้', 'ดอนศรีชุม', 'คือเวียง',
      'บ้านปิน', 'จำป่าหวาย', 'บ้านถ้ำ', 'สันโค้ง'
    ]),
    'ภูกามยาว': Object.freeze(['แม่อิง', 'ดงเจน'])
  });

  const AUTHORITY_ORDER = Object.freeze([
    'ทม.พะเยา', 'ทต.แม่กา', 'อบต.แม่นาเรือ', 'อบต.แม่ใส', 'อบต.บ้านตุ่น', 'ทต.บ้านสาง',
    'ทต.สันป่าม่วง', 'ทต.บ้านต๋อม', 'ทต.บ้านต๊ำ', 'ทต.ท่าจำปี', 'ทต.แม่ปืม', 'ทต.บ้านใหม่',
    'ทต.แม่ใจ', 'ทต.รวมใจพัฒนา', 'ทต.ศรีถ้อย', 'อบต.แม่สุก', 'ทต.ป่าแฝก', 'ทต.บ้านเหล่า', 'ทต.เจริญราษฎร์',
    'ทม.ดอกคำใต้', 'อบต.คือเวียง', 'อบต.บ้านปิน', 'อบต.ดอกคำใต้', 'อบต.จำป่าหวาย',
    'ทต.บ้านถ้ำ', 'อบต.ดอนศรีชุม', 'อบต.สันโค้ง',
    'อบต.แม่อิง', 'ทต.ดงเจน'
  ]);

  const AUTHORITY_SET = new Set(AUTHORITY_ORDER);
  const LEGACY_INPUT_ALIASES = new Map([
    ['บ้านปิ่น', 'บ้านปิน'],
    ['เทศบาลเมืองพะเยา', 'เทศบาลเมือง']
  ]);
  const AUTHORITY_ALIASES = new Map([
    ['เทศบาลเมืองพะเยา', 'ทม.พะเยา'],
    ['เทศบาลตำบลแม่กา', 'ทต.แม่กา'],
    ['องค์การบริหารส่วนตำบลแม่นาเรือ', 'อบต.แม่นาเรือ'],
    ['องค์การบริหารส่วนตำบลแม่ใส', 'อบต.แม่ใส'],
    ['องค์การบริหารส่วนตำบลบ้านตุ่น', 'อบต.บ้านตุ่น'],
    ['เทศบาลตำบลบ้านสาง', 'ทต.บ้านสาง'],
    ['เทศบาลตำบลสันป่าม่วง', 'ทต.สันป่าม่วง'],
    ['เทศบาลตำบลบ้านต๋อม', 'ทต.บ้านต๋อม'],
    ['เทศบาลตำบลบ้านต๊ำ', 'ทต.บ้านต๊ำ'],
    ['เทศบาลตำบลท่าจำปี', 'ทต.ท่าจำปี'],
    ['เทศบาลตำบลแม่ปืม', 'ทต.แม่ปืม'],
    ['เทศบาลตำบลบ้านใหม่', 'ทต.บ้านใหม่'],
    ['เทศบาลตำบลแม่ใจ', 'ทต.แม่ใจ'],
    ['เทศบาลตำบลรวมใจพัฒนา', 'ทต.รวมใจพัฒนา'],
    ['เทศบาลตำบลศรีถ้อย', 'ทต.ศรีถ้อย'],
    ['องค์การบริหารส่วนตำบลแม่สุก', 'อบต.แม่สุก'],
    ['เทศบาลตำบลป่าแฝก', 'ทต.ป่าแฝก'],
    ['เทศบาลตำบลบ้านเหล่า', 'ทต.บ้านเหล่า'],
    ['เทศบาลตำบลเจริญราษฎร์', 'ทต.เจริญราษฎร์']
  ]);

  const AUTHORITY_RULES = Object.freeze({
    'ทม.พะเยา': Object.freeze({ tambons: Object.freeze({ 'เทศบาลเมือง': Object.freeze({ full: true }) }) }),
    'ทต.แม่กา': Object.freeze({ tambons: Object.freeze({ 'แม่กา': Object.freeze({ full: true }) }) }),
    'อบต.แม่นาเรือ': Object.freeze({ tambons: Object.freeze({ 'แม่นาเรือ': Object.freeze({ full: true }) }) }),
    'อบต.แม่ใส': Object.freeze({ tambons: Object.freeze({ 'แม่ใส': Object.freeze({ full: true }) }) }),
    'อบต.บ้านตุ่น': Object.freeze({ tambons: Object.freeze({ 'บ้านตุ่น': Object.freeze({ full: true }) }) }),
    'ทต.บ้านสาง': Object.freeze({ tambons: Object.freeze({ 'บ้านสาง': Object.freeze({ full: true }) }) }),
    'ทต.สันป่าม่วง': Object.freeze({ tambons: Object.freeze({ 'สันป่าม่วง': Object.freeze({ full: true }) }) }),
    'ทต.บ้านต๋อม': Object.freeze({ tambons: Object.freeze({ 'บ้านต๋อม': Object.freeze({ full: true }) }) }),
    'ทต.บ้านต๊ำ': Object.freeze({ tambons: Object.freeze({ 'บ้านต๊ำ': Object.freeze({ full: true }) }) }),
    'ทต.ท่าจำปี': Object.freeze({ tambons: Object.freeze({ 'ท่าจำปี': Object.freeze({ full: true }) }) }),
    'ทต.แม่ปืม': Object.freeze({ tambons: Object.freeze({ 'แม่ปืม': Object.freeze({ full: true }) }) }),
    'ทต.บ้านใหม่': Object.freeze({ tambons: Object.freeze({ 'บ้านใหม่': Object.freeze({ full: true }) }) }),

    'ทต.แม่ใจ': Object.freeze({ tambons: Object.freeze({
      'แม่ใจ': Object.freeze({ moos: [2, 3, 10], partialMoos: [1, 5], overlappingMoos: [1, 5] }),
      'ศรีถ้อย': Object.freeze({ moos: [2, 3], partialMoos: [1, 4, 7, 11], overlappingMoos: [1, 4, 7, 11] })
    }) }),
    'ทต.รวมใจพัฒนา': Object.freeze({ tambons: Object.freeze({
      'แม่ใจ': Object.freeze({ moos: [4, 6, 7, 8, 9], partialMoos: [1, 5], overlappingMoos: [1, 5] })
    }) }),
    'ทต.ศรีถ้อย': Object.freeze({ tambons: Object.freeze({
      'ศรีถ้อย': Object.freeze({ moos: [5, 6, 8, 9, 10, 12, 13], partialMoos: [1, 4, 7, 11], overlappingMoos: [1, 4, 7, 11] })
    }) }),
    'อบต.แม่สุก': Object.freeze({ tambons: Object.freeze({ 'แม่สุก': Object.freeze({ full: true }) }) }),
    'ทต.ป่าแฝก': Object.freeze({ tambons: Object.freeze({ 'ป่าแฝก': Object.freeze({ full: true }) }) }),
    'ทต.บ้านเหล่า': Object.freeze({ tambons: Object.freeze({ 'บ้านเหล่า': Object.freeze({ full: true }) }) }),
    'ทต.เจริญราษฎร์': Object.freeze({ tambons: Object.freeze({ 'เจริญราษฎร์': Object.freeze({ full: true }) }) }),

    'ทม.ดอกคำใต้': Object.freeze({ tambons: Object.freeze({
      'สว่างอารมณ์': Object.freeze({ full: true }),
      'บุญเกิด': Object.freeze({ full: true }),
      'ดอกคำใต้': Object.freeze({ moos: [1, 2, 7], overlappingMoos: [1, 2] }),
      'ดอนศรีชุม': Object.freeze({ moos: [1, 5, 7, 10], partialMoos: [8, 9] })
    }) }),
    'อบต.คือเวียง': Object.freeze({ tambons: Object.freeze({ 'คือเวียง': Object.freeze({ full: true }) }) }),
    'อบต.บ้านปิน': Object.freeze({ tambons: Object.freeze({ 'บ้านปิน': Object.freeze({ full: true }) }) }),
    'อบต.ดอกคำใต้': Object.freeze({ tambons: Object.freeze({
      'ดอกคำใต้': Object.freeze({ moos: [1, 2, 3, 4, 5, 6, 8, 9, 10], overlappingMoos: [1, 2] })
    }) }),
    'อบต.จำป่าหวาย': Object.freeze({ tambons: Object.freeze({ 'จำป่าหวาย': Object.freeze({ full: true }) }) }),
    'ทต.บ้านถ้ำ': Object.freeze({ tambons: Object.freeze({ 'บ้านถ้ำ': Object.freeze({ full: true }) }) }),
    'อบต.ดอนศรีชุม': Object.freeze({ tambons: Object.freeze({
      'ดอนศรีชุม': Object.freeze({ moos: [2, 3, 4, 6], partialMoos: [8, 9] })
    }) }),
    'อบต.สันโค้ง': Object.freeze({ tambons: Object.freeze({ 'สันโค้ง': Object.freeze({ full: true }) }) }),

    'อบต.แม่อิง': Object.freeze({ tambons: Object.freeze({ 'แม่อิง': Object.freeze({ moos: [4, 5, 6, 8] }) }) }),
    'ทต.ดงเจน': Object.freeze({ tambons: Object.freeze({
      'แม่อิง': Object.freeze({ moos: [1, 2, 3, 7] }),
      'ดงเจน': Object.freeze({
        moos: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 16],
        villageByMoo: Object.freeze({
          1: 'บ้านกว๊านกลาง', 2: 'บ้านสันป่าสัก', 3: 'บ้านกว๊านใต้', 4: 'บ้านกว๊านเหนือ',
          5: 'บ้านเจน', 8: 'บ้านเจน', 9: 'บ้านสันป่ากอก', 10: 'บ้านเชียงหมัน',
          11: 'บ้านสันป่าสัก', 12: 'บ้านกว๊านใต้ร่วมใจ', 13: 'บ้านกว๊านสันติสุข', 16: 'บ้านเจน'
        })
      })
    }) })
  });

  function cleanText(value) { return String(value == null ? '' : value).trim().replace(/\s+/g, ' '); }
  function canonicalTambon(value) { const text = cleanText(value); return LEGACY_INPUT_ALIASES.get(text) || text; }
  function normalizeMoo(value) {
    if (value === null || value === undefined || value === '') return null;
    const match = String(value).trim().match(/\d+/); if (!match) return null;
    const n = Number(match[0]); return Number.isFinite(n) && n > 0 ? n : null;
  }
  function normalizeDistrict(value) {
    const text = cleanText(value).replace(/^อำเภอ/, '');
    return DISTRICT_ORDER.includes(text) ? text : null;
  }
  function normalizeAuthority(value) {
    const raw = cleanText(value); const text = AUTHORITY_ALIASES.get(raw) || raw;
    return AUTHORITY_SET.has(text) ? text : null;
  }
  function districtForTambon(tambon) {
    const t = canonicalTambon(tambon);
    return DISTRICT_ORDER.find((district) => DISTRICT_TAMBONS[district].includes(t)) || null;
  }
  function tambonsForDistrict(district) {
    const d = normalizeDistrict(district); return d ? DISTRICT_TAMBONS[d].slice() : TAMBON_ORDER.slice();
  }
  function recordMatchesDistrict(record, district) {
    if (!district) return true; const d = normalizeDistrict(district); if (!d || !record) return false;
    return districtForTambon(record.tambon) === d;
  }
  function authoritiesForTambon(tambon) {
    const t = canonicalTambon(tambon);
    return AUTHORITY_ORDER.filter((authority) => {
      const rule = AUTHORITY_RULES[authority]; return !!(rule && rule.tambons && rule.tambons[t]);
    });
  }
  function tambonsForAuthority(authority) {
    const normalized = normalizeAuthority(authority); if (!normalized) return TAMBON_ORDER.slice();
    const rule = AUTHORITY_RULES[normalized]; return rule ? Object.keys(rule.tambons) : [];
  }
  function authoritiesForDistrict(district) {
    const d = normalizeDistrict(district); if (!d) return AUTHORITY_ORDER.slice();
    const allowedTambons = new Set(DISTRICT_TAMBONS[d]);
    return AUTHORITY_ORDER.filter((authority) => tambonsForAuthority(authority).some((tambon) => allowedTambons.has(tambon)));
  }
  function configuredMoos(authority, tambon) {
    const a = normalizeAuthority(authority), t = canonicalTambon(tambon);
    const rule = a && AUTHORITY_RULES[a] && AUTHORITY_RULES[a].tambons[t]; if (!rule || rule.full) return [];
    return Array.from(new Set([].concat(rule.moos || [], rule.partialMoos || []))).sort((x, y) => x - y);
  }
  function ambiguousMoos(authority, tambon) {
    const a = normalizeAuthority(authority), t = canonicalTambon(tambon);
    const rule = a && AUTHORITY_RULES[a] && AUTHORITY_RULES[a].tambons[t]; if (!rule || rule.full) return [];
    return Array.from(new Set([].concat(rule.overlappingMoos || [], rule.partialMoos || []))).sort((x, y) => x - y);
  }
  function autoConfiguredMoos(authority, tambon) {
    const ambiguous = new Set(ambiguousMoos(authority, tambon).map(String));
    return configuredMoos(authority, tambon).filter((moo) => !ambiguous.has(String(moo)));
  }
  function configuredVillageForMoo(authority, tambon, moo) {
    const a = normalizeAuthority(authority), t = canonicalTambon(tambon), m = normalizeMoo(moo);
    const rule = a && AUTHORITY_RULES[a] && AUTHORITY_RULES[a].tambons[t];
    if (!rule || !rule.villageByMoo || m === null) return null; return rule.villageByMoo[m] || null;
  }
  function authorityOptionsFor(tambon, moo) {
    const t = canonicalTambon(tambon), m = normalizeMoo(moo), options = [];
    for (const authority of authoritiesForTambon(t)) {
      const rule = AUTHORITY_RULES[authority].tambons[t];
      if (rule.full) { options.push(authority); continue; }
      if (m === null) continue;
      if ((rule.moos || []).includes(m) || (rule.partialMoos || []).includes(m) || (rule.overlappingMoos || []).includes(m)) options.push(authority);
    }
    return AUTHORITY_ORDER.filter((authority) => options.includes(authority));
  }
  function recommendedAuthorityFor(tambon, moo) {
    const exact = authorityOptionsFor(tambon, moo); return exact.length === 1 ? exact[0] : null;
  }
  function validAuthoritiesFor(tambon, moo) {
    const exact = authorityOptionsFor(tambon, moo);
    if (exact.length > 1) return exact.slice();
    if (exact.length === 1) {
      const suggested = exact[0], candidates = authoritiesForTambon(tambon);
      const ordered = [suggested].concat(candidates.filter((a) => a !== suggested));
      return AUTHORITY_ORDER.filter((a) => ordered.includes(a)).sort((a, b) => {
        if (a === suggested) return -1; if (b === suggested) return 1;
        return AUTHORITY_ORDER.indexOf(a) - AUTHORITY_ORDER.indexOf(b);
      });
    }
    return [];
  }
  function authorityModeFor(tambon, moo) {
    const exact = authorityOptionsFor(tambon, moo); if (exact.length > 1) return 'SELECT'; if (exact.length === 1) return 'SUGGEST'; return 'TAMBON_ONLY';
  }
  function validConfiguredMoos(authority, tambon) {
    const a = normalizeAuthority(authority), t = canonicalTambon(tambon);
    if (!a || !authoritiesForTambon(t).includes(a)) return [];
    const moos = new Set(); for (const candidate of authoritiesForTambon(t)) configuredMoos(candidate, t).forEach((moo) => moos.add(moo));
    return Array.from(moos).filter((moo) => validAuthoritiesFor(t, moo).includes(a)).sort((x, y) => x - y);
  }
  function explicitAuthorityValidation(tambon, moo, rawAuthority) {
    const authority = normalizeAuthority(rawAuthority), exactOptions = authorityOptionsFor(tambon, moo), validOptions = validAuthoritiesFor(tambon, moo);
    const suggestedAuthority = recommendedAuthorityFor(tambon, moo), mode = authorityModeFor(tambon, moo);
    if (!authority) return { valid:false, authority:null, mode, exactOptions, validOptions, suggestedAuthority, overridden:false, reason:'ค่า LocalAuthority ไม่อยู่ใน Master อบต./เทศบาล ที่ระบบรองรับ' };
    if (!exactOptions.length) return { valid:false, authority:null, mode, exactOptions, validOptions, suggestedAuthority, overridden:false, reason:'Tambon + Moo นี้อยู่ในโหมด TAMBON_ONLY และไม่ควรมี LocalAuthority' };
    if (!validOptions.includes(authority)) return { valid:false, authority:null, mode, exactOptions, validOptions, suggestedAuthority, overridden:false, reason: mode === 'SELECT' ? 'ค่า LocalAuthority ไม่อยู่ในตัวเลือกของ Tambon + Moo นี้' : 'ค่า LocalAuthority ไม่อยู่ในรายการ อบต./เทศบาล ที่สัมพันธ์กับตำบลนี้' };
    return { valid:true, authority, mode, exactOptions, validOptions, suggestedAuthority, overridden:!!(suggestedAuthority && authority !== suggestedAuthority), reason:suggestedAuthority && authority !== suggestedAuthority ? 'ใช้ LocalAuthority ที่ผู้กรอกยืนยันแทนค่าแนะนำของ Tambon + Moo ตามกติกา v1.2' : 'ใช้ LocalAuthority ที่ผ่านการตรวจสอบตามกติกา v1.2' };
  }
  function resolveAuthority(record) {
    const tambon = canonicalTambon(record && record.tambon), moo = normalizeMoo(record && record.moo);
    const candidatesByTambon = authoritiesForTambon(tambon), exactOptions = authorityOptionsFor(tambon, moo), validOptions = validAuthoritiesFor(tambon, moo);
    const suggestedAuthority = recommendedAuthorityFor(tambon, moo), mode = authorityModeFor(tambon, moo);
    const rawExplicit = cleanText(record && Object.prototype.hasOwnProperty.call(record, 'localAuthorityRaw') ? record.localAuthorityRaw : record && record.localAuthority);
    if (rawExplicit) {
      const checked = explicitAuthorityValidation(tambon, moo, rawExplicit);
      if (!checked.valid) return { authority:null, confidence:'invalid-explicit', source:'local-authority-field', mode, candidates:validOptions, exactCandidates:exactOptions, suggestedAuthority, overridden:false, reason:checked.reason };
      return { authority:checked.authority, confidence:checked.overridden ? 'explicit-override' : 'explicit-field', source:'local-authority-field', mode, candidates:validOptions, exactCandidates:exactOptions, suggestedAuthority, overridden:checked.overridden, reason:checked.reason };
    }
    if (!candidatesByTambon.length) return { authority:null, confidence:'out-of-brief', source:'none', mode:'TAMBON_ONLY', candidates:[], exactCandidates:[], suggestedAuthority:null, overridden:false, reason:'ตำบลนี้ยังไม่มี Master Mapping อบต./เทศบาล ในขอบเขตชุดนี้' };
    if (exactOptions.length === 1) return { authority:exactOptions[0], confidence:'legacy-inferred', source:'tambon-moo-legacy-fallback', mode:'SUGGEST', candidates:validOptions, exactCandidates:exactOptions, suggestedAuthority:exactOptions[0], overridden:false, reason:'ข้อมูลเก่าไม่มี LocalAuthority จึง fallback ด้วยค่าแนะนำจาก Master Tambon + Moo' };
    if (exactOptions.length > 1) return { authority:null, confidence:'ambiguous', source:'none', mode:'SELECT', candidates:exactOptions, exactCandidates:exactOptions, suggestedAuthority:null, overridden:false, reason:'ข้อมูลเก่าอยู่ในพื้นที่ที่มีมากกว่า 1 อบต./เทศบาล และไม่มี LocalAuthority ที่ยืนยันแล้ว' };
    return { authority:null, confidence:'unresolved', source:'none', mode:'TAMBON_ONLY', candidates:candidatesByTambon, exactCandidates:[], suggestedAuthority:null, overridden:false, reason:moo === null ? 'ยังไม่มีเลขหมู่เพียงพอสำหรับ legacy fallback จาก Master Mapping' : 'เลขหมู่นี้ไม่อยู่ใน exact Master Mapping ที่ได้รับ' };
  }
  function decorateRecord(record) {
    if (!record || typeof record !== 'object') return record;
    const rawTambon = Object.prototype.hasOwnProperty.call(record, 'tambonRaw') ? record.tambonRaw : record.tambon;
    const rawAuthority = Object.prototype.hasOwnProperty.call(record, 'localAuthorityRaw') ? record.localAuthorityRaw : record.localAuthority;
    record.tambonRaw = rawTambon; record.tambon = canonicalTambon(rawTambon); record.district = districtForTambon(record.tambon); record.moo = normalizeMoo(record.moo); record.localAuthorityRaw = cleanText(rawAuthority) || null;
    const resolved = resolveAuthority(record);
    record.resolvedLocalAuthority = resolved.authority; record.localAuthority = resolved.authority; record.recommendedAuthority = resolved.suggestedAuthority;
    record.validLocalAuthorities = resolved.candidates.slice(); record.exactLocalAuthorities = resolved.exactCandidates.slice(); record.authorityMode = resolved.mode;
    record.authorityOverridden = resolved.overridden; record.authorityConfidence = resolved.confidence; record.authoritySource = resolved.source; record.authorityCandidates = resolved.candidates.slice(); record.authorityReason = resolved.reason;
    return record;
  }
  function decorateRecords(records) { return Array.isArray(records) ? records.map(decorateRecord) : []; }
  function recordMatchesAuthority(record, authority) {
    if (!authority) return true; const a = normalizeAuthority(authority); if (!a || !record) return false;
    const resolved = Object.prototype.hasOwnProperty.call(record, 'resolvedLocalAuthority') ? record.resolvedLocalAuthority : resolveAuthority(record).authority;
    return resolved === a;
  }
  function authorityCounts(records) {
    const counts = {}; AUTHORITY_ORDER.forEach((authority) => { counts[authority] = 0; });
    (Array.isArray(records) ? records : []).forEach((record) => {
      const authority = Object.prototype.hasOwnProperty.call(record || {}, 'resolvedLocalAuthority') ? record.resolvedLocalAuthority : resolveAuthority(record).authority;
      if (authority && Object.prototype.hasOwnProperty.call(counts, authority)) counts[authority] += 1;
    }); return counts;
  }
  function activeAuthorities(records) { const counts = authorityCounts(records); return AUTHORITY_ORDER.filter((authority) => counts[authority] > 0); }
  function resolutionStats(records) {
    const stats = { total:0, explicit:0, explicitOverride:0, legacyInferred:0, ambiguous:0, unresolved:0, outOfBrief:0, invalidExplicit:0 };
    (Array.isArray(records) ? records : []).forEach((record) => {
      const r = resolveAuthority(record); stats.total += 1;
      if (r.confidence === 'explicit-field') stats.explicit += 1; else if (r.confidence === 'explicit-override') stats.explicitOverride += 1;
      else if (r.confidence === 'legacy-inferred') stats.legacyInferred += 1; else if (r.confidence === 'ambiguous') stats.ambiguous += 1;
      else if (r.confidence === 'unresolved') stats.unresolved += 1; else if (r.confidence === 'out-of-brief') stats.outOfBrief += 1; else if (r.confidence === 'invalid-explicit') stats.invalidExplicit += 1;
    }); return stats;
  }
  function formatMooList(moos) {
    const values = Array.from(new Set((Array.isArray(moos) ? moos : []).map(normalizeMoo).filter((v) => v !== null))).sort((a, b) => a - b);
    return values.length ? 'ม.' + values.join(', ') : '';
  }
  function authorityTambonScopeText(authority, tambon) {
    const a = normalizeAuthority(authority), t = canonicalTambon(tambon); if (!a || !t) return '';
    const rule = AUTHORITY_RULES[a] && AUTHORITY_RULES[a].tambons[t]; if (!rule || rule.full) return '';
    const exact = formatMooList(rule.moos || []), partial = formatMooList(rule.partialMoos || []);
    if (exact && partial) return exact + ' ทั้งหมู่ · ' + partial + ' บางพื้นที่'; if (partial) return partial + ' บางพื้นที่'; return exact;
  }
  function authorityOptionLabel(authority) { return normalizeAuthority(authority) || ''; }

  global.AreaResponsibility = Object.freeze({
    RULESET_VERSION, POLICY_VERSION, OLD_TAMBONS, NEW_TAMBONS, TAMBON_ORDER,
    DISTRICT_ORDER, DISTRICT_TAMBONS, AUTHORITY_ORDER, AUTHORITY_RULES,
    canonicalTambon, normalizeMoo, normalizeDistrict, normalizeAuthority,
    districtForTambon, tambonsForDistrict, authoritiesForDistrict, recordMatchesDistrict,
    authoritiesForTambon, tambonsForAuthority, configuredMoos, ambiguousMoos, autoConfiguredMoos,
    validConfiguredMoos, configuredVillageForMoo, authorityOptionsFor, recommendedAuthorityFor,
    validAuthoritiesFor, authorityModeFor, explicitAuthorityValidation, resolveAuthority,
    decorateRecord, decorateRecords, recordMatchesAuthority, authorityCounts, activeAuthorities,
    resolutionStats, authorityTambonScopeText, authorityOptionLabel
  });
})(window);
