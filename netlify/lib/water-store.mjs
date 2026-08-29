import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'water-resources-cache';
export const DATASET_KEY = 'dataset';
export const MAX_BLOB_BYTES = 4_900_000;

export const ALLOWED_TAMBONS = new Set([
  'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง',
  'บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง','เจริญราษฎร์','แม่ปืม',
  'แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย',
  'สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน',
  'จำป่าหวาย','บ้านถ้ำ','แม่อิง','สันโค้ง','ดงเจน'
]);

export const ALLOWED_AUTHORITIES = new Set([
  'ทม.ดอกคำใต้','อบต.คือเวียง','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย',
  'ทต.บ้านถ้ำ','อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
]);

// ชื่อมาตรฐานคือ 'บ้านปิน'; alias แรกมีไว้รองรับข้อมูลเดิมที่สะกดผิดเท่านั้น
// และถูก normalize ใน snapshot ของ Dashboard โดยไม่เขียนกลับ Google Sheet
const LEGACY_TAMBON_ALIASES = new Map([
  ['บ้านปิ่น','บ้านปิน'],
  ['เทศบาลเมืองพะเยา','เทศบาลเมือง']
]);

export function normalizeTambon(value) {
  const text = textOrNull(value);
  if (!text) return null;
  return LEGACY_TAMBON_ALIASES.get(text) || text;
}

function store() {
  return getStore(STORE_NAME);
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') value = value.replace(/,/g, '').trim();
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function textOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
}

function primitiveOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function normalizeMooValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).replace(/,/g, '').trim().match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeType(value) {
  const text = textOrNull(value);
  if (!text) return null;
  if (text === 'สระน้ำ / บ่อน้ำ(มนุษย์สร้าง)') return 'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)';
  return text;
}

export function normalizeAuthority(value) {
  const text = textOrNull(value);
  if (!text) return null;
  return ALLOWED_AUTHORITIES.has(text) ? text : null;
}

// Preserve the raw LocalAuthority field from the authenticated Google Sheets snapshot.
// Do NOT silently coerce an unknown value to null here: doing that would make the browser
// mistake a bad explicit value for a legacy record and could incorrectly apply fallback.
// The browser resolver validates the preserved value against the v1.2 authority policy.
export function normalizeAuthorityField(value) {
  return textOrNull(value);
}

export function normalizeRecord(input) {
  if (!input || typeof input !== 'object') return null;
  const id = finiteNumber(input.id, null);
  const tambon = normalizeTambon(input.tambon);
  if (!Number.isInteger(id) || id <= 0 || !tambon || !ALLOWED_TAMBONS.has(tambon)) return null;

  const mooValue = normalizeMooValue(input.moo);
  return {
    id,
    dt: textOrNull(input.dt),
    lat: finiteNumber(input.lat, null),
    lng: finiteNumber(input.lng, null),
    name: textOrNull(input.name),
    owner: textOrNull(input.owner),
    phone: textOrNull(input.phone),
    type: normalizeType(input.type),
    width: finiteNumber(input.width, null),
    length: finiteNumber(input.length, null),
    depth: finiteNumber(input.depth, null),
    depthnet: finiteNumber(input.depthnet, null),
    tambon,
    village: textOrNull(input.village),
    moo: mooValue === null ? null : mooValue,
    problem: textOrNull(input.problem),
    imglink: textOrNull(input.imglink),
    volume: finiteNumber(input.volume, 0),
    note: primitiveOrNull(input.note),
    status: textOrNull(input.status),
    // Optional field from KebNamComplete LocalAuthority rollout.
    // Current legacy sync may omit it; browser resolver still validates Tambon + Moo compatibility.
    localAuthority: normalizeAuthorityField(input.localAuthority)
  };
}

export function normalizeRecords(records) {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  const byId = new Map();
  for (const raw of records) {
    const item = normalizeRecord(raw);
    if (item) byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

export function datasetHash(records) {
  return createHash('sha256').update(JSON.stringify(records)).digest('hex');
}

export function datasetByteLength(records) {
  return Buffer.byteLength(JSON.stringify(records), 'utf8');
}

export async function getDatasetMetadata() {
  return store().getMetadata(DATASET_KEY, { consistency: 'strong' });
}

export async function getDatasetWithMetadata(options = {}) {
  const opts = { consistency: 'strong', type: 'json' };
  if (options.etag) opts.etag = options.etag;
  return store().getWithMetadata(DATASET_KEY, opts);
}

export function datasetVersion(entry) {
  if (!entry) return null;
  if (entry.etag) return entry.etag;
  const sourceHash = entry.metadata && entry.metadata.sourceHash;
  return sourceHash ? `\"sha256-${sourceHash}\"` : null;
}

export async function writeDataset(records, metadata = {}) {
  const normalized = normalizeRecords(records);
  const bytes = datasetByteLength(normalized);
  if (bytes > MAX_BLOB_BYTES) {
    throw new Error(`Dataset is too large for one Netlify Blob (${bytes} bytes)`);
  }

  const sourceHash = datasetHash(normalized);
  const existing = await getDatasetMetadata();
  if (existing && existing.metadata && existing.metadata.sourceHash === sourceHash) {
    return {
      changed: false,
      version: datasetVersion(existing),
      count: normalized.length,
      bytes,
      metadata: existing.metadata
    };
  }

  const now = new Date().toISOString();
  await store().setJSON(DATASET_KEY, normalized, {
    metadata: {
      sourceHash,
      count: normalized.length,
      bytes,
      updatedAt: now,
      source: metadata.source || 'sync',
      sourceSpreadsheetId: metadata.sourceSpreadsheetId || null,
      sourceSheetName: metadata.sourceSheetName || null,
      sourceUpdatedAt: metadata.sourceUpdatedAt || null
    }
  });

  const written = await getDatasetMetadata();
  if (!written) throw new Error('Dataset write completed but metadata could not be read back');
  return {
    changed: true,
    version: datasetVersion(written),
    count: normalized.length,
    bytes,
    metadata: written.metadata
  };
}

export async function seedFromStaticRequest(request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/data/waterresources.initial.json`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Bootstrap fetch failed with ${response.status}`);
  const records = await response.json();
  return writeDataset(records, { source: 'bootstrap-static' });
}

export function isAuthorizedSyncRequest(request) {
  const expected = process.env.WATER_SYNC_SECRET;
  if (!expected || expected.length < 24) return false;

  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const header = request.headers.get('x-water-sync-secret') || '';
  const provided = bearer || header;
  if (!provided) return false;

  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}
