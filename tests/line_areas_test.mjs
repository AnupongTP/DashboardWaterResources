import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { LINE_AREAS, findArea, areaUrl, DASHBOARD_ORIGIN } from '../netlify/lib/line-areas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadRouteModules() {
  const sandbox = { document: {}, location: { pathname: '/', protocol: 'https:' }, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['area-responsibility.js', 'district-routes.js', 'authority-routes.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'site', 'assets', file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox;
}

// drift: matches route modules
{
  const g = loadRouteModules();
  assert.equal(g.DistrictRoutes.masterIsValid, true);
  assert.equal(g.AuthorityRoutes.masterIsValid, true);
  const expected = [
    ...g.DistrictRoutes.entries.map((e) => ({ type: 'district', slug: e.slug, name: 'อำเภอ' + e.district })),
    ...g.AuthorityRoutes.entries.map((e) => ({ type: 'authority', slug: e.slug, name: e.authority }))
  ];
  assert.deepEqual(LINE_AREAS.map((a) => ({ ...a })), expected);
}

assert.equal(LINE_AREAS.length, 33);
assert.equal(DASHBOARD_ORIGIN, 'https://dashboard-waterresources1.netlify.app');
assert.equal(areaUrl(findArea('authority', 'tt-mae-ka')), 'https://dashboard-waterresources1.netlify.app/authority/tt-mae-ka/');
assert.equal(areaUrl(findArea('district', 'mae-chai')), 'https://dashboard-waterresources1.netlify.app/district/mae-chai/');
assert.equal(findArea('authority', 'nope'), null);
assert.equal(findArea('district', 'tt-mae-ka'), null);
assert.ok(Object.isFrozen(LINE_AREAS));

console.log('line_areas_test: all passed');
