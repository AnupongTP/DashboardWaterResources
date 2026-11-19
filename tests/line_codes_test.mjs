import assert from 'node:assert/strict';
import { normalizeCode, parseAreaCodes, lookupCode } from '../netlify/lib/line-codes.mjs';

const SAMPLE = JSON.stringify({
  'AMP-MUEANGPHAYAO': 'district:mueang-phayao',
  'TM-PHAYAO': 'authority:tm-phayao',
  'TT-MAEKA': 'authority:tt-mae-ka',
  'TT-RUAMCHAIPHATTHANA': 'authority:tt-ruam-chai-phatthana'
});

// normalizes case, spaces and hyphens
assert.equal(normalizeCode(' tt maeka '), 'TTMAEKA');
assert.equal(normalizeCode('TT-MAEKA'), 'TTMAEKA');
assert.equal(normalizeCode('tt-mae-ka'), 'TTMAEKA');
assert.equal(normalizeCode(undefined), '');

const map = parseAreaCodes(SAMPLE);
assert.equal(map.size, 4);
for (const input of ['ttmaeka', 'TT MAEKA', ' tt-maeka ']) {
  const hit = lookupCode(map, input);
  assert.equal(hit.code, 'TT-MAEKA');
  assert.equal(hit.area.type, 'authority');
  assert.equal(hit.area.slug, 'tt-mae-ka');
}
assert.equal(lookupCode(map, 'AMP-MUEANGPHAYAO').area.slug, 'mueang-phayao');
assert.equal(lookupCode(map, 'TT-NOPE'), null);
assert.equal(lookupCode(map, ''), null);

// rejects invalid config
for (const bad of [
  '{not json',
  '[]',
  JSON.stringify({ X: 'authority:nope' }),
  JSON.stringify({ X: 'bad' }),
  JSON.stringify({ '': 'authority:tm-phayao' }),
  JSON.stringify({ 'TT-MAEKA': 'authority:tt-mae-ka', 'tt maeka': 'authority:tm-phayao' })
]) {
  assert.throws(() => parseAreaCodes(bad), /LINE_AREA_CODES invalid/);
}
assert.throws(() => parseAreaCodes(undefined), /LINE_AREA_CODES invalid/);

console.log('line_codes_test: all passed');
