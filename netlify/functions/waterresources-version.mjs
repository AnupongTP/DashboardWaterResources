import { getDatasetMetadata, datasetVersion, jsonResponse } from '../lib/water-store.mjs';

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  try {
    const entry = await getDatasetMetadata();
    if (!entry) {
      return jsonResponse({ success: false, initialized: false, version: null }, 404, {
        'Cache-Control': 'no-store'
      });
    }

    const metadata = entry.metadata || {};
    const version = datasetVersion(entry);
    if (!version) {
      return jsonResponse({ success: false, initialized: false, version: null, error: 'Dataset version unavailable' }, 503, {
        'Cache-Control': 'no-store'
      });
    }
    const headers = {
      ETag: version,
      'Cache-Control': 'no-store',
      'X-Water-Data-Version': version
    };

    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

    return jsonResponse({
      success: true,
      initialized: true,
      version,
      updatedAt: metadata.updatedAt || null,
      sourceUpdatedAt: metadata.sourceUpdatedAt || null,
      count: metadata.count || 0,
      bytes: metadata.bytes || 0
    }, 200, headers);
  } catch (error) {
    console.error('waterresources version failed', error);
    return jsonResponse({ success: false, error: 'Version API unavailable' }, 503, {
      'Cache-Control': 'no-store'
    });
  }
};
