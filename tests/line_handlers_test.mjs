import assert from 'node:assert/strict';
import { createMeHandler, createRegisterHandler } from '../netlify/lib/line-handlers.mjs';
import { createRegistrations } from '../netlify/lib/line-registrations.mjs';
import { parseAreaCodes } from '../netlify/lib/line-codes.mjs';

const CODES = JSON.stringify({ 'TT-MAEKA': 'authority:tt-mae-ka', 'AMP-MAECHAI': 'district:mae-chai' });
const ORIGIN = 'https://dashboard-waterresources1.netlify.app';

function setup({ codesJson = CODES, registrations } = {}) {
  const map = new Map();
  const store = {
    async get(k) { return map.has(k) ? structuredClone(map.get(k)) : null; },
    async setJSON(k, v) { map.set(k, structuredClone(v)); },
    async delete(k) { map.delete(k); }
  };
  const deps = {
    verify: async (tok) => (tok === 'good' ? 'Uabc' : null),
    registrations: registrations || createRegistrations(store),
    codes: () => parseAreaCodes(codesJson)
  };
  return { map, me: createMeHandler(deps), register: createRegisterHandler(deps) };
}

const req = (method, { token, body } = {}) => new Request('https://x/api/line/test', {
  method,
  headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
  ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
});
const json = async (res) => ({ status: res.status, body: await res.json(), headers: res.headers });

// rejects missing or invalid token
{
  const t = setup();
  for (const r of [await t.me(req('GET')), await t.me(req('GET', { token: 'bad' })),
    await t.register(req('POST', { body: { code: 'TT-MAEKA' } })), await t.register(req('POST', { token: 'bad', body: { mode: 'general' } }))]) {
    const res = await json(r);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { ok: false, error: 'unauthorized' });
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(t.map.size, 0);
}

// me returns registered:false when no record
{
  const t = setup();
  const res = await json(await t.me(req('GET', { token: 'good' })));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { registered: false });
  assert.match(res.headers.get('Content-Type'), /application\/json; charset=utf-8/);
}

// register staff then me
{
  const t = setup();
  const res = await json(await t.register(req('POST', { token: 'good', body: { code: ' tt maeka ' } })));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, mode: 'staff', name: 'ทต.แม่กา', url: ORIGIN + '/authority/tt-mae-ka/' });
  assert.equal(t.map.get('Uabc').mode, 'staff');
  assert.equal(t.map.get('Uabc').slug, 'tt-mae-ka');
  assert.equal(t.map.get('Uabc').code, 'TT-MAEKA');
  const me = await json(await t.me(req('GET', { token: 'good' })));
  assert.deepEqual(me.body, { registered: true, mode: 'staff', type: 'authority', slug: 'tt-mae-ka', name: 'ทต.แม่กา', url: ORIGIN + '/authority/tt-mae-ka/' });
}

// general is remembered (not asked again)
{
  const t = setup();
  const res = await json(await t.register(req('POST', { token: 'good', body: { mode: 'general' } })));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, mode: 'general', name: 'ภาพรวมจังหวัดพะเยา', url: ORIGIN + '/' });
  assert.equal(t.map.get('Uabc').mode, 'general');
  const me = await json(await t.me(req('GET', { token: 'good' })));
  assert.deepEqual(me.body, { registered: true, mode: 'general', name: 'ภาพรวมจังหวัดพะเยา', url: ORIGIN + '/' });
}

// change: staff → other area → general → staff overwrites
{
  const t = setup();
  await t.register(req('POST', { token: 'good', body: { code: 'TT-MAEKA' } }));
  await t.register(req('POST', { token: 'good', body: { code: 'AMP-MAECHAI' } }));
  assert.equal((await json(await t.me(req('GET', { token: 'good' })))).body.url, ORIGIN + '/district/mae-chai/');
  await t.register(req('POST', { token: 'good', body: { mode: 'general' } }));
  assert.deepEqual(Object.keys(t.map.get('Uabc')).sort(), ['mode', 'updatedAt']);
  await t.register(req('POST', { token: 'good', body: { code: 'TT-MAEKA' } }));
  assert.equal((await json(await t.me(req('GET', { token: 'good' })))).body.slug, 'tt-mae-ka');
}

// invalid code keeps existing record
{
  const t = setup();
  await t.register(req('POST', { token: 'good', body: { mode: 'general' } }));
  const res = await json(await t.register(req('POST', { token: 'good', body: { code: 'NOPE' } })));
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { ok: false, error: 'invalid_code' });
  assert.equal(t.map.get('Uabc').mode, 'general');
}

// bad body → 400 invalid_request
{
  const t = setup();
  for (const body of ['{oops', { foo: 1 }, { mode: 'other' }, { mode: 'staff', code: 'TT-MAEKA' }]) {
    const res = await json(await t.register(req('POST', { token: 'good', body })));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { ok: false, error: 'invalid_request' });
  }
}

// stale or unknown records → registered:false
{
  for (const rec of [
    { mode: 'staff', type: 'authority', slug: 'tt-gone', code: 'X', updatedAt: 'x' },
    { mode: 'weird', updatedAt: 'x' },
    { type: 'authority', slug: 'tt-mae-ka', code: 'TT-MAEKA', updatedAt: 'x' }
  ]) {
    const t = setup();
    t.map.set('Uabc', rec);
    assert.deepEqual((await json(await t.me(req('GET', { token: 'good' })))).body, { registered: false });
  }
}

// invalid config returns 500 (general still works)
{
  const t = setup({ codesJson: '{broken' });
  const origError = console.error; let logged = 0; console.error = () => { logged += 1; };
  const res = await json(await t.register(req('POST', { token: 'good', body: { code: 'TT-MAEKA' } })));
  console.error = origError;
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { ok: false, error: 'config' });
  assert.equal(logged, 1);
  assert.equal((await t.register(req('POST', { token: 'good', body: { mode: 'general' } }))).status, 200);
}

// storage failure returns JSON 503
{
  const broken = { get: async () => { throw new Error('blob down'); }, set: async () => { throw new Error('blob down'); } };
  const origError = console.error; console.error = () => {};
  const t = setup({ registrations: broken });
  for (const r of [await t.me(req('GET', { token: 'good' })),
    await t.register(req('POST', { token: 'good', body: { code: 'TT-MAEKA' } })),
    await t.register(req('POST', { token: 'good', body: { mode: 'general' } }))]) {
    const res = await json(r);
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { ok: false, error: 'storage' });
  }
  console.error = origError;
}

// methods
{
  const t = setup();
  assert.equal((await t.me(req('POST', { token: 'good', body: {} }))).status, 405);
  assert.equal((await t.register(req('GET', { token: 'good' }))).status, 405);
}

console.log('line_handlers_test: all passed');
