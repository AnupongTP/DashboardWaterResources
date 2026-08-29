(function (global) {
  'use strict';

  /**
   * กติกาพื้นที่รับผิดชอบสำหรับ DashboardWaterResources
   *
   * Contract: KebNamComplete LocalAuthority v1.2
   *
   * หลักการ:
   * - LocalAuthority (ถ้ามี) คือเขต อปท. ที่ผู้จัดเก็บข้อมูลยืนยันจากฟอร์ม
   * - Master Mapping แยก 2 ความหมายออกจากกัน:
   *     1) exact options จาก Tambon + Moo
   *     2) valid authorities ของตำบลเดียวกันสำหรับกรณี SUGGEST
   * - exact options > 1  => SELECT: LocalAuthority ต้องอยู่ใน exact options เท่านั้น
   * - exact options = 1  => SUGGEST: ค่านั้นเป็นเพียงค่าแนะนำ ผู้ใช้แก้เป็น อปท. อื่น
   *                         ที่อยู่ใน master ของตำบลเดียวกันได้
   * - exact options = 0  => TAMBON_ONLY: ไม่ยอมรับ LocalAuthority
   * - ข้อมูลเก่าที่ไม่มี LocalAuthority ใช้ exact option เดียวเป็น legacy fallback ชั่วคราว
   * - ข้อมูลเก่าที่ exact options มีหลายค่า จะไม่ถูกเดาเข้า อปท. ใด
   * - WaterOwner เป็นเจ้าของ/ผู้ดูแลแหล่งน้ำ ไม่ใช้ตัดสินเขตการปกครอง
   * - ชื่อมาตรฐานที่ใช้แสดงผลคือ "บ้านปิน"
   */
  const RULESET_VERSION = '2026-08-27.2';
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

  const AUTHORITY_SET = new Set(AUTHORITY_ORDER);

  /*
   * ชื่อมาตรฐานคือ "บ้านปิน" เท่านั้น
   * ค่า legacy ถูก normalize ในสำเนาที่ใช้บน Dashboard เท่านั้น ไม่เขียนกลับ Sheet
   */
  const LEGACY_INPUT_ALIASES = new Map([
    ['บ้านปิ่น', 'บ้านปิน'],
    ['เทศบาลเมืองพะเยา', 'เทศบาลเมือง']
  ]);

  /**
   * full            = รับผิดชอบทั้งตำบล
   * moos            = exact mapping ของหมู่ที่ระบุ
   * partialMoos     = บางส่วนของหมู่ (exact mapping ต้องมี LocalAuthority เมื่อมีหลาย candidate)
   * overlappingMoos = หมู่เดียวกันอยู่ได้มากกว่าหนึ่ง อปท.
   * villageByMoo    = label ช่วยอ่าน dropdown เท่านั้น ไม่ใช้เป็นตัวตัดสินเขต
   *
   * หมายเหตุ v1.2:
   * AUTHORITY_RULES ยังสะท้อน exact/master boundary table เดิม แต่การ validate LocalAuthority
   * ต้องผ่าน validAuthoritiesFor() ไม่ใช่อ่าน rule ของ authority เดียวโดยตรง
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
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function normalizeAuthority(value) {
    const text = cleanText(value);
    return AUTHORITY_SET.has(text) ? text : null;
  }

  function authoritiesForTambon(tambon) {
    const t = canonicalTambon(tambon);
    return AUTHORITY_ORDER.filter((authority) => {
      const rule = AUTHORITY_RULES[authority];
      return !!(rule && rule.tambons && rule.tambons[t]);
    });
  }

  function tambonsForAuthority(authority) {
    const normalized = normalizeAuthority(authority);
    if (!normalized) return TAMBON_ORDER.slice();
    const rule = AUTHORITY_RULES[normalized];
    return rule ? Object.keys(rule.tambons) : [];
  }

  function configuredMoos(authority, tambon) {
    const normalizedAuthority = normalizeAuthority(authority);
    const t = canonicalTambon(tambon);
    const rule = normalizedAuthority && AUTHORITY_RULES[normalizedAuthority] && AUTHORITY_RULES[normalizedAuthority].tambons[t];
    if (!rule || rule.full) return [];
    return Array.from(new Set([].concat(rule.moos || [], rule.partialMoos || [])))
      .sort((a, b) => a - b);
  }

  function ambiguousMoos(authority, tambon) {
    const normalizedAuthority = normalizeAuthority(authority);
    const t = canonicalTambon(tambon);
    const rule = normalizedAuthority && AUTHORITY_RULES[normalizedAuthority] && AUTHORITY_RULES[normalizedAuthority].tambons[t];
    if (!rule || rule.full) return [];
    return Array.from(new Set([].concat(rule.overlappingMoos || [], rule.partialMoos || [])))
      .sort((a, b) => a - b);
  }

  // Legacy helper: exact mapping ที่มี authority เดียว ไม่รวม overlap/partial.
  function autoConfiguredMoos(authority, tambon) {
    const ambiguous = new Set(ambiguousMoos(authority, tambon).map(String));
    return configuredMoos(authority, tambon).filter((moo) => !ambiguous.has(String(moo)));
  }

  function configuredVillageForMoo(authority, tambon, moo) {
    const normalizedAuthority = normalizeAuthority(authority);
    const t = canonicalTambon(tambon);
    const m = normalizeMoo(moo);
    const rule = normalizedAuthority && AUTHORITY_RULES[normalizedAuthority] && AUTHORITY_RULES[normalizedAuthority].tambons[t];
    if (!rule || !rule.villageByMoo || m === null) return null;
    return rule.villageByMoo[m] || null;
  }

  /**
   * exact options ตามตาราง Tambon + Moo
   * - full tambon คืน authority ได้แม้ไม่มี Moo
   * - overlap/partial อาจคืนมากกว่า 1 authority
   */
  function authorityOptionsFor(tambon, moo) {
    const t = canonicalTambon(tambon);
    const m = normalizeMoo(moo);
    const options = [];

    for (const authority of authoritiesForTambon(t)) {
      const rule = AUTHORITY_RULES[authority].tambons[t];
      if (rule.full) {
        options.push(authority);
        continue;
      }
      if (m === null) continue;
      if ((rule.moos || []).includes(m) ||
          (rule.partialMoos || []).includes(m) ||
          (rule.overlappingMoos || []).includes(m)) {
        options.push(authority);
      }
    }

    return AUTHORITY_ORDER.filter((authority) => options.includes(authority));
  }

  function recommendedAuthorityFor(tambon, moo) {
    const exact = authorityOptionsFor(tambon, moo);
    return exact.length === 1 ? exact[0] : null;
  }

  /**
   * Contract v1.2:
   * - SELECT  (exact > 1): เลือกได้เฉพาะ exact options
   * - SUGGEST (exact = 1): เลือกได้ทุก authority ที่ master ระบุว่าเกี่ยวข้องกับตำบลเดียวกัน
   * - TAMBON_ONLY (exact = 0): ไม่มี authority ที่ยอมรับได้
   */
  function validAuthoritiesFor(tambon, moo) {
    const exact = authorityOptionsFor(tambon, moo);
    if (exact.length > 1) return exact.slice();
    if (exact.length === 1) {
      const suggested = exact[0];
      const candidates = authoritiesForTambon(tambon);
      const ordered = [suggested].concat(candidates.filter((a) => a !== suggested));
      return AUTHORITY_ORDER.filter((a) => ordered.includes(a)).sort((a, b) => {
        if (a === suggested) return -1;
        if (b === suggested) return 1;
        return AUTHORITY_ORDER.indexOf(a) - AUTHORITY_ORDER.indexOf(b);
      });
    }
    return [];
  }

  function authorityModeFor(tambon, moo) {
    const exact = authorityOptionsFor(tambon, moo);
    if (exact.length > 1) return 'SELECT';
    if (exact.length === 1) return 'SUGGEST';
    return 'TAMBON_ONLY';
  }

  /**
   * หมู่ที่ authority นี้ "สามารถเป็นค่าที่ผู้กรอกยืนยันได้" ภายใต้ v1.2
   * ใช้กับ cascading filter เท่านั้น ไม่ได้หมายความว่าปัจจุบันมี record ในทุกหมู่
   */
  function validConfiguredMoos(authority, tambon) {
    const normalizedAuthority = normalizeAuthority(authority);
    const t = canonicalTambon(tambon);
    if (!normalizedAuthority || !authoritiesForTambon(t).includes(normalizedAuthority)) return [];

    const moos = new Set();
    for (const candidateAuthority of authoritiesForTambon(t)) {
      configuredMoos(candidateAuthority, t).forEach((moo) => moos.add(moo));
    }

    return Array.from(moos)
      .filter((moo) => validAuthoritiesFor(t, moo).includes(normalizedAuthority))
      .sort((a, b) => a - b);
  }

  function explicitAuthorityValidation(tambon, moo, rawAuthority) {
    const authority = normalizeAuthority(rawAuthority);
    const exactOptions = authorityOptionsFor(tambon, moo);
    const validOptions = validAuthoritiesFor(tambon, moo);
    const suggestedAuthority = recommendedAuthorityFor(tambon, moo);
    const mode = authorityModeFor(tambon, moo);

    if (!authority) {
      return {
        valid: false,
        authority: null,
        mode,
        exactOptions,
        validOptions,
        suggestedAuthority,
        overridden: false,
        reason: 'ค่า LocalAuthority ไม่อยู่ใน Master อปท. ที่ระบบรองรับ'
      };
    }

    if (!exactOptions.length) {
      return {
        valid: false,
        authority: null,
        mode,
        exactOptions,
        validOptions,
        suggestedAuthority,
        overridden: false,
        reason: 'Tambon + Moo นี้อยู่ในโหมด TAMBON_ONLY และไม่ควรมี LocalAuthority'
      };
    }

    if (!validOptions.includes(authority)) {
      return {
        valid: false,
        authority: null,
        mode,
        exactOptions,
        validOptions,
        suggestedAuthority,
        overridden: false,
        reason: mode === 'SELECT'
          ? 'ค่า LocalAuthority ไม่อยู่ในตัวเลือกของ Tambon + Moo นี้'
          : 'ค่า LocalAuthority ไม่อยู่ในรายการ อปท. ที่สัมพันธ์กับตำบลนี้'
      };
    }

    return {
      valid: true,
      authority,
      mode,
      exactOptions,
      validOptions,
      suggestedAuthority,
      overridden: !!(suggestedAuthority && authority !== suggestedAuthority),
      reason: suggestedAuthority && authority !== suggestedAuthority
        ? 'ใช้ LocalAuthority ที่ผู้กรอกยืนยันแทนค่าแนะนำของ Tambon + Moo ตามกติกา v1.2'
        : 'ใช้ LocalAuthority ที่ผ่านการตรวจสอบตามกติกา v1.2'
    };
  }

  /**
   * Resolver priority:
   * 1) LocalAuthority จากฐานข้อมูล ถ้าผ่าน policy v1.2
   * 2) legacy fallback สำหรับ record เก่าที่ไม่มี field และ exact option มีค่าเดียว
   * 3) exact options หลายค่า => null (ไม่เดา)
   * 4) ไม่มี exact mapping => null
   */
  function resolveAuthority(record) {
    const tambon = canonicalTambon(record && record.tambon);
    const moo = normalizeMoo(record && record.moo);
    const candidatesByTambon = authoritiesForTambon(tambon);
    const exactOptions = authorityOptionsFor(tambon, moo);
    const validOptions = validAuthoritiesFor(tambon, moo);
    const suggestedAuthority = recommendedAuthorityFor(tambon, moo);
    const mode = authorityModeFor(tambon, moo);

    const rawExplicit = cleanText(
      record && Object.prototype.hasOwnProperty.call(record, 'localAuthorityRaw')
        ? record.localAuthorityRaw
        : record && record.localAuthority
    );

    if (rawExplicit) {
      const checked = explicitAuthorityValidation(tambon, moo, rawExplicit);
      if (!checked.valid) {
        return {
          authority: null,
          confidence: 'invalid-explicit',
          source: 'local-authority-field',
          mode,
          candidates: validOptions,
          exactCandidates: exactOptions,
          suggestedAuthority,
          overridden: false,
          reason: checked.reason
        };
      }
      return {
        authority: checked.authority,
        confidence: checked.overridden ? 'explicit-override' : 'explicit-field',
        source: 'local-authority-field',
        mode,
        candidates: validOptions,
        exactCandidates: exactOptions,
        suggestedAuthority,
        overridden: checked.overridden,
        reason: checked.reason
      };
    }

    if (!candidatesByTambon.length) {
      return {
        authority: null,
        confidence: 'out-of-brief',
        source: 'none',
        mode: 'TAMBON_ONLY',
        candidates: [],
        exactCandidates: [],
        suggestedAuthority: null,
        overridden: false,
        reason: 'ตำบลนี้ยังไม่มี Master Mapping อปท. ในขอบเขตชุดนี้'
      };
    }

    if (exactOptions.length === 1) {
      return {
        authority: exactOptions[0],
        confidence: 'legacy-inferred',
        source: 'tambon-moo-legacy-fallback',
        mode: 'SUGGEST',
        candidates: validOptions,
        exactCandidates: exactOptions,
        suggestedAuthority: exactOptions[0],
        overridden: false,
        reason: 'ข้อมูลเก่าไม่มี LocalAuthority จึง fallback ชั่วคราวด้วยค่าแนะนำจาก Tambon + Moo'
      };
    }

    if (exactOptions.length > 1) {
      return {
        authority: null,
        confidence: 'ambiguous',
        source: 'none',
        mode: 'SELECT',
        candidates: exactOptions,
        exactCandidates: exactOptions,
        suggestedAuthority: null,
        overridden: false,
        reason: 'ข้อมูลเก่าอยู่ในพื้นที่ที่มีมากกว่า 1 อปท. และไม่มี LocalAuthority ที่ยืนยันแล้ว'
      };
    }

    return {
      authority: null,
      confidence: 'unresolved',
      source: 'none',
      mode: 'TAMBON_ONLY',
      candidates: candidatesByTambon,
      exactCandidates: [],
      suggestedAuthority: null,
      overridden: false,
      reason: moo === null
        ? 'ยังไม่มีเลขหมู่เพียงพอสำหรับ legacy fallback จาก Master Mapping'
        : 'เลขหมู่นี้ไม่อยู่ใน exact Master Mapping ที่ได้รับ'
    };
  }

  function decorateRecord(record) {
    if (!record || typeof record !== 'object') return record;

    const rawTambon = Object.prototype.hasOwnProperty.call(record, 'tambonRaw')
      ? record.tambonRaw
      : record.tambon;
    const rawAuthority = Object.prototype.hasOwnProperty.call(record, 'localAuthorityRaw')
      ? record.localAuthorityRaw
      : record.localAuthority;

    record.tambonRaw = rawTambon;
    record.tambon = canonicalTambon(rawTambon);
    record.moo = normalizeMoo(record.moo);
    record.localAuthorityRaw = cleanText(rawAuthority) || null;

    const resolved = resolveAuthority(record);
    record.resolvedLocalAuthority = resolved.authority;
    // Backward-compatible UI property. The original stored field remains in localAuthorityRaw.
    record.localAuthority = resolved.authority;
    record.recommendedAuthority = resolved.suggestedAuthority;
    record.validLocalAuthorities = resolved.candidates.slice();
    record.exactLocalAuthorities = resolved.exactCandidates.slice();
    record.authorityMode = resolved.mode;
    record.authorityOverridden = resolved.overridden;
    record.authorityConfidence = resolved.confidence;
    record.authoritySource = resolved.source;
    record.authorityCandidates = resolved.candidates.slice();
    record.authorityReason = resolved.reason;
    return record;
  }

  function decorateRecords(records) {
    return Array.isArray(records) ? records.map(decorateRecord) : [];
  }

  function recordMatchesAuthority(record, authority) {
    if (!authority) return true;
    const normalized = normalizeAuthority(authority);
    if (!normalized || !record) return false;
    const resolved = Object.prototype.hasOwnProperty.call(record, 'resolvedLocalAuthority')
      ? record.resolvedLocalAuthority
      : resolveAuthority(record).authority;
    return resolved === normalized;
  }

  function authorityCounts(records) {
    const counts = {};
    AUTHORITY_ORDER.forEach((authority) => { counts[authority] = 0; });

    (Array.isArray(records) ? records : []).forEach((record) => {
      const authority = Object.prototype.hasOwnProperty.call(record || {}, 'resolvedLocalAuthority')
        ? record.resolvedLocalAuthority
        : resolveAuthority(record).authority;
      if (authority && Object.prototype.hasOwnProperty.call(counts, authority)) {
        counts[authority] += 1;
      }
    });
    return counts;
  }

  function activeAuthorities(records) {
    const counts = authorityCounts(records);
    return AUTHORITY_ORDER.filter((authority) => counts[authority] > 0);
  }

  function resolutionStats(records) {
    const stats = {
      total: 0,
      explicit: 0,
      explicitOverride: 0,
      legacyInferred: 0,
      ambiguous: 0,
      unresolved: 0,
      outOfBrief: 0,
      invalidExplicit: 0
    };
    (Array.isArray(records) ? records : []).forEach((record) => {
      const r = resolveAuthority(record);
      stats.total += 1;
      if (r.confidence === 'explicit-field') stats.explicit += 1;
      else if (r.confidence === 'explicit-override') stats.explicitOverride += 1;
      else if (r.confidence === 'legacy-inferred') stats.legacyInferred += 1;
      else if (r.confidence === 'ambiguous') stats.ambiguous += 1;
      else if (r.confidence === 'unresolved') stats.unresolved += 1;
      else if (r.confidence === 'out-of-brief') stats.outOfBrief += 1;
      else if (r.confidence === 'invalid-explicit') stats.invalidExplicit += 1;
    });
    return stats;
  }

  function formatMooList(moos) {
    const values = Array.from(new Set((Array.isArray(moos) ? moos : [])
      .map(normalizeMoo)
      .filter((value) => value !== null)))
      .sort((a, b) => a - b);
    return values.length ? 'ม.' + values.join(', ') : '';
  }

  /**
   * ข้อความอธิบายขอบเขตตำบล/หมู่สำหรับแสดงใน dropdown หลังเลือก อปท.
   * เป็น display-only metadata: ไม่เปลี่ยน value ของตำบลและไม่ใช้ตัดสิน jurisdiction.
   * ภาษาหน้าจอเน้นให้ประชาชนอ่านง่าย: ตำบลที่ครอบคลุมเต็มพื้นที่ไม่ใส่ข้อความต่อท้าย; กรณีบางหมู่ใช้ "ทั้งหมู่" / "บางพื้นที่".
   */
  function authorityTambonScopeText(authority, tambon) {
    const normalizedAuthority = normalizeAuthority(authority);
    const t = canonicalTambon(tambon);
    if (!normalizedAuthority || !t) return '';
    const rule = AUTHORITY_RULES[normalizedAuthority] && AUTHORITY_RULES[normalizedAuthority].tambons[t];
    if (!rule) return '';
    if (rule.full) return ''; // ครอบคลุมเต็มตำบล: แสดงเฉพาะชื่อตำบลเพื่อให้ dropdown กระชับ

    const exact = formatMooList(rule.moos || []);
    const partial = formatMooList(rule.partialMoos || []);
    if (exact && partial) return exact + ' ทั้งหมู่ · ' + partial + ' บางพื้นที่';
    if (partial) return partial + ' บางพื้นที่';
    return exact;
  }

  function authorityOptionLabel(authority) {
    return normalizeAuthority(authority) || '';
  }

  global.AreaResponsibility = Object.freeze({
    RULESET_VERSION,
    POLICY_VERSION,
    OLD_TAMBONS,
    NEW_TAMBONS,
    TAMBON_ORDER,
    AUTHORITY_ORDER,
    AUTHORITY_RULES,
    canonicalTambon,
    normalizeMoo,
    normalizeAuthority,
    authoritiesForTambon,
    tambonsForAuthority,
    configuredMoos,
    ambiguousMoos,
    autoConfiguredMoos,
    validConfiguredMoos,
    configuredVillageForMoo,
    authorityOptionsFor,
    recommendedAuthorityFor,
    validAuthoritiesFor,
    authorityModeFor,
    explicitAuthorityValidation,
    resolveAuthority,
    decorateRecord,
    decorateRecords,
    recordMatchesAuthority,
    authorityCounts,
    activeAuthorities,
    resolutionStats,
    authorityTambonScopeText,
    authorityOptionLabel
  });
})(window);
