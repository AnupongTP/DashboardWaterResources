(function (global) {
  'use strict';

  /**
   * กติกาพื้นที่รับผิดชอบสำหรับ DashboardWaterResources
   *
   * หลักการ:
   * - ข้อมูลชุดนี้เป็น "กติกาการกรอง" จากโจทย์ อปท./เทศบาลที่ผู้ใช้ส่งให้
   * - ไม่แก้ไข Google Sheet ต้นทาง
   * - ไม่ใช้ WaterOwner ตัดสินเขตการปกครอง
   * - เขตที่ซ้อนกันหรือเป็นเพียงบางส่วนของหมู่ จะไม่เดา อปท.
   * - ชื่อมาตรฐานที่ใช้แสดงผลคือ "บ้านปิน"
   */
  const RULESET_VERSION = '2026-08-25.2';

  // 18 ตำบล/พื้นที่เดิมจากชุด CONFIG ของระบบ + 11 ตำบลตามโจทย์ อปท. = 29 รายการ
  // ลำดับนี้เป็น Master List เดียวกับที่ใช้ในช่องค้นหาตำบลของทุกหน้าจอ
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

  const AUTHORITY_ORDER = Object.freeze([
    'ทม.ดอกคำใต้',
    'อบต.คือเวียง',
    'อบต.บ้านปิน',
    'อบต.ดอกคำใต้',
    'อบต.จำป่าหวาย',
    'ทต.บ้านถ้ำ',
    'อบต.ดอนศรีชุม',
    'อบต.แม่อิง',
    'ทต.ดงเจน',
    'อบต.สันโค้ง'
  ]);

  const UNRESOLVED_VALUE = '__UNRESOLVED__';
  const UNRESOLVED_LABEL = '⚠️ ต้องยืนยันเขต อปท.';

  /*
   * ชื่อมาตรฐานคือ "บ้านปิน" เท่านั้น
   * ค่า "บ้านปิ่น" เก็บเป็น legacy-input compatibility เพราะพบอยู่ในข้อมูลเดิมบางแถว
   * การ normalize นี้เกิดเฉพาะในสำเนาที่ส่งเข้า Dashboard ไม่ได้เขียนกลับ Google Sheet
   */
  const LEGACY_INPUT_ALIASES = new Map([
    ['บ้านปิ่น', 'บ้านปิน'],
    ['เทศบาลเมืองพะเยา', 'เทศบาลเมือง']
  ]);

  /**
   * full          = รับผิดชอบทั้งตำบล
   * moos          = รับผิดชอบเฉพาะหมู่ที่ระบุ
   * partialMoos   = รับผิดชอบเพียงบางส่วนของหมู่ จึงห้ามตัดสินจากเลขหมู่อย่างเดียว
   * overlappingMoos = หมู่เดียวกันปรากฏในมากกว่าหนึ่ง อปท. จึงห้ามเดา
   * villageByMoo  = ชื่อหมู่บ้านจากโจทย์เพื่อช่วยอ่าน dropdown (ไม่ใช้เป็นตัวตัดสินเขต)
   */
  const AUTHORITY_RULES = Object.freeze({
    'ทม.ดอกคำใต้': Object.freeze({
      tambons: Object.freeze({
        'สว่างอารมณ์': Object.freeze({ full: true }),
        'บุญเกิด': Object.freeze({ full: true }),
        'ดอกคำใต้': Object.freeze({ moos: [1, 2, 7], overlappingMoos: [1, 2] }),
        'ดอนศรีชุม': Object.freeze({ moos: [1, 5, 7, 10], partialMoos: [8, 9] })
      })
    }),
    'อบต.คือเวียง': Object.freeze({ tambons: Object.freeze({ 'คือเวียง': Object.freeze({ full: true }) }) }),
    'อบต.บ้านปิน': Object.freeze({ tambons: Object.freeze({ 'บ้านปิน': Object.freeze({ full: true }) }) }),
    'อบต.ดอกคำใต้': Object.freeze({
      tambons: Object.freeze({
        'ดอกคำใต้': Object.freeze({
          moos: [1, 2, 3, 4, 5, 6, 8, 9, 10],
          overlappingMoos: [1, 2]
        })
      })
    }),
    'อบต.จำป่าหวาย': Object.freeze({ tambons: Object.freeze({ 'จำป่าหวาย': Object.freeze({ full: true }) }) }),
    'ทต.บ้านถ้ำ': Object.freeze({ tambons: Object.freeze({ 'บ้านถ้ำ': Object.freeze({ full: true }) }) }),
    'อบต.ดอนศรีชุม': Object.freeze({
      tambons: Object.freeze({
        'ดอนศรีชุม': Object.freeze({ moos: [2, 3, 4, 6], partialMoos: [8, 9] })
      })
    }),
    'อบต.แม่อิง': Object.freeze({
      tambons: Object.freeze({ 'แม่อิง': Object.freeze({ moos: [4, 5, 6, 8] }) })
    }),
    'ทต.ดงเจน': Object.freeze({
      tambons: Object.freeze({
        'แม่อิง': Object.freeze({ moos: [1, 2, 3, 7] }),
        'ดงเจน': Object.freeze({
          moos: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 16],
          villageByMoo: Object.freeze({
            1: 'บ้านกว๊านกลาง',
            2: 'บ้านสันป่าสัก',
            3: 'บ้านกว๊านใต้',
            4: 'บ้านกว๊านเหนือ',
            5: 'บ้านเจน',
            8: 'บ้านเจน',
            9: 'บ้านสันป่ากอก',
            10: 'บ้านเชียงหมัน',
            11: 'บ้านสันป่าสัก',
            12: 'บ้านกว๊านใต้ร่วมใจ',
            13: 'บ้านกว๊านสันติสุข',
            16: 'บ้านเจน'
          })
        })
      })
    }),
    'อบต.สันโค้ง': Object.freeze({ tambons: Object.freeze({ 'สันโค้ง': Object.freeze({ full: true }) }) })
  });

  function cleanText(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  function canonicalTambon(value) {
    const text = cleanText(value);
    return LEGACY_INPUT_ALIASES.get(text) || text;
  }

  function normalizeMoo(value) {
    if (value === null || value === undefined || value === '') return null;
    const match = String(value).trim().match(/\d+/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  }

  function authoritiesForTambon(tambon) {
    const t = canonicalTambon(tambon);
    return AUTHORITY_ORDER.filter((authority) => {
      const rule = AUTHORITY_RULES[authority];
      return !!(rule && rule.tambons && rule.tambons[t]);
    });
  }

  function tambonsForAuthority(authority) {
    if (!authority || authority === UNRESOLVED_VALUE) return TAMBON_ORDER.slice();
    const rule = AUTHORITY_RULES[authority];
    return rule ? Object.keys(rule.tambons) : [];
  }

  function configuredMoos(authority, tambon) {
    const t = canonicalTambon(tambon);
    const rule = AUTHORITY_RULES[authority] && AUTHORITY_RULES[authority].tambons[t];
    if (!rule || rule.full) return [];
    return Array.from(new Set([].concat(rule.moos || [], rule.partialMoos || [])))
      .sort((a, b) => a - b);
  }

  function ambiguousMoos(authority, tambon) {
    const t = canonicalTambon(tambon);
    const rule = AUTHORITY_RULES[authority] && AUTHORITY_RULES[authority].tambons[t];
    if (!rule || rule.full) return [];
    return Array.from(new Set([].concat(rule.overlappingMoos || [], rule.partialMoos || [])))
      .sort((a, b) => a - b);
  }

  function configuredVillageForMoo(authority, tambon, moo) {
    const t = canonicalTambon(tambon);
    const m = normalizeMoo(moo);
    const rule = AUTHORITY_RULES[authority] && AUTHORITY_RULES[authority].tambons[t];
    if (!rule || !rule.villageByMoo || m === null) return null;
    return rule.villageByMoo[m] || null;
  }

  /**
   * ระบุ อปท. จากกติกาที่ได้รับเท่านั้น
   * WaterOwner ถูกละไว้โดยเจตนา เพราะเป็นเจ้าของ/หน่วยงานของแหล่งน้ำ ไม่ใช่ polygon เขต อปท.
   */
  function resolveAuthority(record) {
    const tambon = canonicalTambon(record && record.tambon);
    const moo = normalizeMoo(record && record.moo);
    const candidates = authoritiesForTambon(tambon);

    if (!candidates.length) {
      return {
        authority: null,
        confidence: 'out-of-brief',
        candidates: [],
        reason: 'ตำบลนี้ยังไม่มีขอบเขต อปท. จากโจทย์ชุดนี้'
      };
    }

    const matches = [];
    const ambiguous = [];

    for (const authority of candidates) {
      const rule = AUTHORITY_RULES[authority].tambons[tambon];
      if (rule.full) {
        matches.push(authority);
        continue;
      }
      if (moo === null) continue;
      if ((rule.partialMoos || []).includes(moo) || (rule.overlappingMoos || []).includes(moo)) {
        ambiguous.push(authority);
        continue;
      }
      if ((rule.moos || []).includes(moo)) matches.push(authority);
    }

    if (matches.length === 1 && ambiguous.length === 0) {
      return {
        authority: matches[0],
        confidence: 'boundary-rule',
        candidates: matches.slice(),
        reason: 'ระบุได้จากตำบลและเลขหมู่ตามขอบเขตที่ได้รับ'
      };
    }

    const candidateSet = Array.from(new Set(matches.concat(ambiguous)));
    if (candidateSet.length > 1 || ambiguous.length) {
      return {
        authority: null,
        confidence: 'ambiguous',
        candidates: candidateSet.length ? candidateSet : candidates,
        reason: 'พื้นที่หมู่นี้ซ้อน/แบ่งบางส่วนระหว่าง อปท. ต้องใช้พิกัดขอบเขตหรือข้อมูลยืนยันเพิ่ม'
      };
    }

    return {
      authority: null,
      confidence: 'unresolved',
      candidates,
      reason: moo === null
        ? 'ยังไม่มีเลขหมู่เพียงพอสำหรับตัดสินเขต อปท.'
        : 'เลขหมู่นี้ไม่อยู่ในรายการขอบเขตที่ได้รับ'
    };
  }

  function decorateRecord(record) {
    if (!record || typeof record !== 'object') return record;
    const rawTambon = record.tambon;
    record.tambonRaw = rawTambon;
    record.tambon = canonicalTambon(rawTambon);
    record.moo = normalizeMoo(record.moo);
    const resolved = resolveAuthority(record);
    record.localAuthority = resolved.authority;
    record.authorityConfidence = resolved.confidence;
    record.authorityCandidates = resolved.candidates;
    record.authorityReason = resolved.reason;
    return record;
  }

  function decorateRecords(records) {
    return Array.isArray(records) ? records.map(decorateRecord) : [];
  }

  function recordMatchesAuthority(record, authority) {
    if (!authority) return true;
    if (authority === UNRESOLVED_VALUE) {
      return authoritiesForTambon(record && record.tambon).length > 0 && !record.localAuthority;
    }
    return !!(record && record.localAuthority === authority);
  }

  function authorityOptionLabel(authority) {
    return authority === UNRESOLVED_VALUE ? UNRESOLVED_LABEL : authority;
  }

  global.AreaResponsibility = Object.freeze({
    RULESET_VERSION,
    OLD_TAMBONS,
    NEW_TAMBONS,
    TAMBON_ORDER,
    AUTHORITY_ORDER,
    AUTHORITY_RULES,
    UNRESOLVED_VALUE,
    UNRESOLVED_LABEL,
    canonicalTambon,
    normalizeMoo,
    authoritiesForTambon,
    tambonsForAuthority,
    configuredMoos,
    ambiguousMoos,
    configuredVillageForMoo,
    resolveAuthority,
    decorateRecord,
    decorateRecords,
    recordMatchesAuthority,
    authorityOptionLabel
  });
})(window);
