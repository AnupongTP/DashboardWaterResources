import assert from 'node:assert/strict';
import { createRegistrations } from '../netlify/lib/line-registrations.mjs';

function fakeStore() {
  const map = new Map();
  return {
    map,
    async get(key, opts) { assert.equal(opts?.type, 'json'); return map.has(key) ? structuredClone(map.get(key)) : null; },
    async setJSON(key, value) { map.set(key, structuredClone(value)); },
    async delete(key) { map.delete(key); }
  };
}

const store = fakeStore();
const regs = createRegistrations(store);
assert.equal(await regs.get('U1'), null);

await regs.set('U1', { mode: 'staff', type: 'authority', slug: 'tt-mae-ka', code: 'TT-MAEKA' });
const staff = await regs.get('U1');
assert.deepEqual(Object.keys(staff).sort(), ['code', 'mode', 'slug', 'type', 'updatedAt']);
assert.equal(staff.mode, 'staff');
assert.equal(staff.slug, 'tt-mae-ka');
assert.ok(!Number.isNaN(Date.parse(staff.updatedAt)));

await regs.set('U1', { mode: 'general' });
const general = await regs.get('U1');
assert.deepEqual(Object.keys(general).sort(), ['mode', 'updatedAt']);
assert.equal(general.mode, 'general');

await assert.rejects(regs.set('U1', { mode: 'other' }), /invalid registration/);

console.log('line_registrations_test: all passed');
