import { findArea, areaUrl, DASHBOARD_ORIGIN } from './line-areas.mjs';
import { lookupCode } from './line-codes.mjs';

// deps = {verify(idToken)->userId|null, registrations, codes()->Map}

export const GENERAL_NAME = 'ภาพรวมจังหวัดพะเยา';
const GENERAL_URL = DASHBOARD_ORIGIN + '/';

function reply(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
  });
}

function storageFailed(error) {
  console.error('line registrations storage failed:', error.message);
  return reply({ ok: false, error: 'storage' }, 503);
}

async function authenticate(request, deps) {
  const match = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  return match ? deps.verify(match[1]) : null;
}

function describe(record) {
  if (record && record.mode === 'general') {
    return { registered: true, mode: 'general', name: GENERAL_NAME, url: GENERAL_URL };
  }
  const area = record && record.mode === 'staff' && findArea(record.type, record.slug);
  if (!area) return { registered: false };
  return { registered: true, mode: 'staff', type: area.type, slug: area.slug, name: area.name, url: areaUrl(area) };
}

export function createMeHandler(deps) {
  return async (request) => {
    if (request.method !== 'GET') return reply({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
    const userId = await authenticate(request, deps);
    if (!userId) return reply({ ok: false, error: 'unauthorized' }, 401);
    try {
      return reply(describe(await deps.registrations.get(userId)));
    } catch (error) {
      return storageFailed(error);
    }
  };
}

export function createRegisterHandler(deps) {
  return async (request) => {
    if (request.method !== 'POST') return reply({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
    const userId = await authenticate(request, deps);
    if (!userId) return reply({ ok: false, error: 'unauthorized' }, 401);

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const isGeneral = body && body.mode === 'general';
    const hasCode = body && body.mode === undefined && typeof body.code === 'string';
    if (!isGeneral && !hasCode) return reply({ ok: false, error: 'invalid_request' }, 400);

    if (isGeneral) {
      try {
        await deps.registrations.set(userId, { mode: 'general' });
      } catch (error) {
        return storageFailed(error);
      }
      return reply({ ok: true, mode: 'general', name: GENERAL_NAME, url: GENERAL_URL });
    }

    let codes;
    try {
      codes = deps.codes();
    } catch (error) {
      console.error('line-register config error:', error.message);
      return reply({ ok: false, error: 'config' }, 500);
    }
    const hit = lookupCode(codes, body.code);
    if (!hit) return reply({ ok: false, error: 'invalid_code' }, 400);

    try {
      await deps.registrations.set(userId, { mode: 'staff', type: hit.area.type, slug: hit.area.slug, code: hit.code });
    } catch (error) {
      return storageFailed(error);
    }
    return reply({ ok: true, mode: 'staff', name: hit.area.name, url: areaUrl(hit.area) });
  };
}
