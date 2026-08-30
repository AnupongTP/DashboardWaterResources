import {
  getDatasetMetadata,
  getDatasetWithMetadata,
  seedFromStaticRequest,
  datasetVersion,
  jsonResponse
} from '../lib/water-store.mjs';
const READ_CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag, X-Water-Data-Version',
  'Access-Control-Max-Age': '86400'
});

function withReadCors(headers = {}) {
  return { ...READ_CORS_HEADERS, ...headers };
}


export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withReadCors() });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: withReadCors({ Allow: 'GET, HEAD, OPTIONS' }) });
  }

  try {
    const ifNoneMatch = request.headers.get('if-none-match') || undefined;
    let metaEntry = await getDatasetMetadata();

    if (!metaEntry) {
      await seedFromStaticRequest(request);
      metaEntry = await getDatasetMetadata();
    }

    if (!metaEntry) {
      return jsonResponse({ success: false, error: 'Dataset is not initialized' }, 503, withReadCors({
        'Cache-Control': 'no-store'
      }));
    }

    const metadata = metaEntry.metadata || {};
    const version = datasetVersion(metaEntry);
    if (!version) {
      return jsonResponse({ success: false, error: 'Dataset version unavailable' }, 503, withReadCors({
        'Cache-Control': 'no-store'
      }));
    }

    const commonHeaders = withReadCors({
      ETag: version,
      'Cache-Control': 'private, no-cache, must-revalidate',
      'X-Water-Data-Version': version
    });

    // Compare our stable dataset version before downloading the full Blob.
    // This also works in Netlify Dev sandbox environments where Blob ETags
    // may be unavailable but sourceHash metadata is present.
    if (ifNoneMatch && ifNoneMatch === version) {
      return new Response(null, { status: 304, headers: commonHeaders });
    }

    const entry = await getDatasetWithMetadata();
    if (!entry || !Array.isArray(entry.data)) {
      return jsonResponse({ success: false, error: 'Dataset is not initialized' }, 503, withReadCors({
        'Cache-Control': 'no-store'
      }));
    }

    const payload = {
      success: true,
      version,
      updatedAt: metadata.updatedAt || null,
      count: entry.data.length,
      data: entry.data
    };

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: commonHeaders });
    }

    return jsonResponse(payload, 200, commonHeaders);
  } catch (error) {
    console.error('waterresources GET failed', error);
    return jsonResponse({ success: false, error: 'WaterResources API unavailable' }, 503, withReadCors({
      'Cache-Control': 'no-store'
    }));
  }
};
