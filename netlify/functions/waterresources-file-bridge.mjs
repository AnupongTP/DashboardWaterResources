import {
  getDatasetMetadata,
  getDatasetWithMetadata,
  seedFromStaticRequest,
  datasetVersion
} from '../lib/water-store.mjs';

const CALLBACK_RE = /^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/;

function jsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

function safeJson(value) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const url = new URL(request.url);
  const callback = url.searchParams.get('callback') || '';
  if (!CALLBACK_RE.test(callback)) {
    return jsResponse('/* invalid callback */', 400);
  }

  try {
    let metaEntry = await getDatasetMetadata();
    if (!metaEntry) {
      await seedFromStaticRequest(request);
      metaEntry = await getDatasetMetadata();
    }
    if (!metaEntry) {
      return jsResponse(`${callback}(${safeJson({success:false,error:'Dataset is not initialized'})});`, 503);
    }

    const entry = await getDatasetWithMetadata();
    if (!entry || !Array.isArray(entry.data)) {
      return jsResponse(`${callback}(${safeJson({success:false,error:'Dataset is not initialized'})});`, 503);
    }

    const metadata = metaEntry.metadata || {};
    const payload = {
      success: true,
      version: datasetVersion(metaEntry),
      updatedAt: metadata.updatedAt || null,
      count: entry.data.length,
      data: entry.data
    };
    const headers = {
      'X-Water-Data-Version': payload.version || '',
      'X-Water-File-Bridge': '1'
    };
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: { ...headers, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
    return jsResponse(`${callback}(${safeJson(payload)});`, 200, headers);
  } catch (error) {
    console.error('waterresources file bridge failed', error);
    return jsResponse(`${callback}(${safeJson({success:false,error:'WaterResources file bridge unavailable'})});`, 503);
  }
};
