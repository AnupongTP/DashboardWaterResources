import assert from 'node:assert/strict';
import { verifyIdToken } from '../netlify/lib/line-client.mjs';

function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}

// verify ok
{
  const f = fakeFetch(200, { sub: 'U123', aud: '2011020414' });
  assert.equal(await verifyIdToken('tok', { channelId: '2011020414', fetchImpl: f }), 'U123');
  assert.equal(f.calls[0].url, 'https://api.line.me/oauth2/v2.1/verify');
  assert.equal(f.calls[0].init.method, 'POST');
  const body = new URLSearchParams(String(f.calls[0].init.body));
  assert.equal(body.get('id_token'), 'tok');
  assert.equal(body.get('client_id'), '2011020414');
}
// verify rejected / wrong aud / empty token
assert.equal(await verifyIdToken('tok', { channelId: '2011020414', fetchImpl: fakeFetch(400, { error: 'invalid_request' }) }), null);
assert.equal(await verifyIdToken('tok', { channelId: '2011020414', fetchImpl: fakeFetch(200, { sub: 'U1', aud: '999' }) }), null);
{
  const f = fakeFetch(200, { sub: 'U1', aud: '2011020414' });
  assert.equal(await verifyIdToken('', { channelId: '2011020414', fetchImpl: f }), null);
  assert.equal(f.calls.length, 0);
}
// network error → null
assert.equal(await verifyIdToken('tok', { channelId: '2011020414', fetchImpl: async () => { throw new Error('net'); } }), null);

console.log('line_client_test: all passed');
