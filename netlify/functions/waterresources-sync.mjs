import {
  isAuthorizedSyncRequest,
  jsonResponse,
  writeDataset
} from '../lib/water-store.mjs';

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  if (!process.env.WATER_SYNC_SECRET || process.env.WATER_SYNC_SECRET.length < 24) {
    return jsonResponse({ success: false, error: 'WATER_SYNC_SECRET is not configured' }, 503, {
      'Cache-Control': 'no-store'
    });
  }

  if (!isAuthorizedSyncRequest(request)) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, {
      'Cache-Control': 'no-store'
    });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse({ success: false, error: 'Content-Type must be application/json' }, 415);
    }

    const body = await request.json();
    if (!body || !Array.isArray(body.records)) {
      return jsonResponse({ success: false, error: 'Body must contain records[]' }, 400);
    }

    const result = await writeDataset(body.records, {
      source: 'google-sheets',
      sourceSpreadsheetId: body.sourceSpreadsheetId || null,
      sourceSheetName: body.sourceSheetName || null,
      sourceUpdatedAt: body.sourceUpdatedAt || null
    });

    return jsonResponse({
      success: true,
      changed: result.changed,
      version: result.version,
      count: result.count,
      bytes: result.bytes,
      updatedAt: result.metadata && result.metadata.updatedAt ? result.metadata.updatedAt : null
    }, 200, {
      'Cache-Control': 'no-store',
      ETag: result.version
    });
  } catch (error) {
    console.error('waterresources sync failed', error);
    const message = error && error.message ? error.message : 'Unknown sync error';
    const status = /too large/i.test(message) ? 413 : 500;
    return jsonResponse({ success: false, error: message }, status, {
      'Cache-Control': 'no-store'
    });
  }
};
