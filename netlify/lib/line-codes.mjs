import { findArea } from './line-areas.mjs';

// รหัสเทียบแบบไม่สนตัวพิมพ์ และตัดช่องว่าง/ขีดออก ("tt maeka" == "TT-MAEKA")
export function normalizeCode(input) {
  return String(input ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

function invalid(reason) {
  return new Error('LINE_AREA_CODES invalid: ' + reason);
}

// json: {"TT-MAEKA":"authority:tt-mae-ka", ...} → Map<normalizedCode, {code, area}>
export function parseAreaCodes(json) {
  let raw;
  try {
    raw = JSON.parse(String(json ?? ''));
  } catch {
    throw invalid('not JSON');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('not an object');
  const map = new Map();
  for (const [code, target] of Object.entries(raw)) {
    const key = normalizeCode(code);
    if (!key) throw invalid('empty code');
    const match = /^(district|authority):([a-z0-9-]+)$/.exec(String(target));
    const area = match && findArea(match[1], match[2]);
    if (!area) throw invalid(`unknown area for ${code}`);
    if (map.has(key)) throw invalid(`duplicate code ${code}`);
    map.set(key, Object.freeze({ code, area }));
  }
  return map;
}

export function lookupCode(map, input) {
  const key = normalizeCode(input);
  return (key && map.get(key)) || null;
}
