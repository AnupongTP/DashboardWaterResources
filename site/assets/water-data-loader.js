(function (global) {
  'use strict';

  const runtime = global.WaterDashboardRuntime || {
    mode: global.location && global.location.protocol === 'file:' ? 'file' : 'hosted',
    isFile: global.location && global.location.protocol === 'file:',
    productionOrigin: '',
    apiUrl: (path) => path
  };
  const DB_NAME = 'water-resources-dashboard-cache';
  const DB_VERSION = 1;
  const STORE_NAME = 'state';
  const DATA_KEY = 'waterresources';
  const VERSION_ENDPOINT = runtime.apiUrl('/api/waterresources/version');
  const DATA_ENDPOINT = runtime.apiUrl('/api/waterresources');
  const FILE_BRIDGE_ENDPOINT = runtime.mode === 'file'
    ? ((runtime.productionUrl ? runtime.productionUrl('/api/waterresources/file-bridge') : (runtime.productionOrigin + '/api/waterresources/file-bridge')))
    : null;
  const SCRIPT_URL = (() => {
    try { return document.currentScript && document.currentScript.src ? document.currentScript.src : global.location.href; }
    catch (_) { return ''; }
  })();
  function assetUrl(relativePath, hostedFallback) {
    try { return new URL(relativePath, SCRIPT_URL || global.location.href).href; }
    catch (_) { return hostedFallback; }
  }
  const BOOTSTRAP_URL = assetUrl('../data/waterresources.initial.json', '/data/waterresources.initial.json');
  const BOOTSTRAP_SCRIPT_URL = assetUrl('../data/waterresources.initial.js', '/data/waterresources.initial.js');
  const VERSION_TIMEOUT_MS = 3500;
  const DATA_TIMEOUT_MS = 9000;

  let dbPromise = null;
  let bootstrapScriptPromise = null;
  let fileBridgeSequence = 0;

  function setDiagnostics(patch) {
    const current = global.__WATER_DATA_DIAGNOSTICS__ || {};
    global.__WATER_DATA_DIAGNOSTICS__ = Object.assign({}, current, patch, {
      runtimeMode: runtime.mode,
      productionOrigin: runtime.productionOrigin || null,
      timestamp: new Date().toISOString()
    });
  }

  function openDb() {
    if (!('indexedDB' in global)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    }).catch((error) => {
      console.warn('[WaterData] IndexedDB unavailable:', error);
      return null;
    });
    return dbPromise;
  }

  async function cacheGet() {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(DATA_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (error) {
        console.warn('[WaterData] cache read failed:', error);
        resolve(null);
      }
    });
  }

  async function cacheSet(value) {
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, DATA_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (error) {
        console.warn('[WaterData] cache write failed:', error);
        resolve(false);
      }
    });
  }

  async function clearCache() {
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(DATA_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    } finally { clearTimeout(timeout); }
  }

  function normalizeDatasetPayload(payload) {
    const data = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.data)
        ? payload.data
        : null;
    if (!data) throw new Error('WaterResources payload is not an array');
    return data;
  }

  function cacheMatchesRuntime(cached) {
    if (!cached) return false;
    if (runtime.mode !== 'file') return true;
    const currentOrigin = String(runtime.productionOrigin || '');
    const cachedOrigin = String(cached.remoteOrigin || '');
    // Older cache records had no remoteOrigin. Do not trust them in file mode because
    // they may have come from localhost/another Netlify project.
    return !!currentOrigin && cachedOrigin === currentOrigin;
  }

  async function getRemoteVersion() {
    const response = await fetchWithTimeout(
      VERSION_ENDPOINT,
      { method: 'GET', mode: runtime.mode === 'file' ? 'cors' : 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } },
      VERSION_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`Version API returned ${response.status}`);
    const payload = await response.json();
    if (!payload || !payload.version) throw new Error('Version API returned no version');
    return payload;
  }

  async function getRemoteDataset(cachedVersion) {
    const headers = { Accept: 'application/json' };
    // Cross-origin file:// requests intentionally avoid If-None-Match. That keeps the request
    // a simple CORS GET and avoids a preflight dependency. Hosted/local mode keeps 304 support.
    if (runtime.mode !== 'file' && cachedVersion && !String(cachedVersion).startsWith('bootstrap:')) {
      headers['If-None-Match'] = cachedVersion;
    }

    const response = await fetchWithTimeout(
      DATA_ENDPOINT,
      { method: 'GET', mode: runtime.mode === 'file' ? 'cors' : 'same-origin', cache: 'no-store', headers },
      DATA_TIMEOUT_MS
    );
    if (response.status === 304) return { notModified: true };
    if (!response.ok) throw new Error(`WaterResources API returned ${response.status}`);

    const payload = await response.json();
    const data = normalizeDatasetPayload(payload);
    let headerVersion = null;
    try { headerVersion = response.headers.get('ETag'); } catch (_) {}
    const version = (payload && payload.version) || headerVersion || null;
    return {
      notModified: false,
      data,
      version,
      updatedAt: payload && payload.updatedAt ? payload.updatedAt : null,
      count: data.length,
      transport: runtime.mode === 'file' ? 'fetch-cors' : 'same-origin-fetch'
    };
  }

  function safeBridgeCallbackName() {
    fileBridgeSequence += 1;
    return '__waterFileBridge_' + Date.now().toString(36) + '_' + fileBridgeSequence.toString(36);
  }

  async function getRemoteDatasetViaFileBridge() {
    if (runtime.mode !== 'file' || !FILE_BRIDGE_ENDPOINT) throw new Error('File bridge unavailable');
    return new Promise((resolve, reject) => {
      const callbackName = safeBridgeCallbackName();
      const script = document.createElement('script');
      let settled = false;
      const timer = setTimeout(() => finish(new Error('File bridge timeout')), DATA_TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timer);
        try { delete global[callbackName]; } catch (_) { global[callbackName] = undefined; }
        try { script.remove(); } catch (_) {}
      }
      function finish(error, value) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error); else resolve(value);
      }

      global[callbackName] = (payload) => {
        try {
          if (!payload || payload.success !== true) throw new Error((payload && payload.error) || 'File bridge returned an invalid payload');
          const data = normalizeDatasetPayload(payload);
          finish(null, {
            notModified: false,
            data,
            version: payload.version || null,
            updatedAt: payload.updatedAt || null,
            count: data.length,
            transport: 'script-bridge'
          });
        } catch (error) { finish(error); }
      };

      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = FILE_BRIDGE_ENDPOINT + '?callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
      script.onerror = () => finish(new Error('File bridge script failed to load'));
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function loadBootstrapScript() {
    if (Array.isArray(global.__WATER_BOOTSTRAP_DATA__)) return Promise.resolve(global.__WATER_BOOTSTRAP_DATA__);
    if (bootstrapScriptPromise) return bootstrapScriptPromise;
    bootstrapScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = BOOTSTRAP_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        if (Array.isArray(global.__WATER_BOOTSTRAP_DATA__)) resolve(global.__WATER_BOOTSTRAP_DATA__);
        else reject(new Error('Bootstrap script loaded without dataset'));
      };
      script.onerror = () => reject(new Error('Bootstrap script failed to load'));
      (document.head || document.documentElement).appendChild(script);
    });
    return bootstrapScriptPromise;
  }

  async function getBootstrapDataset() {
    if (runtime.mode === 'file') return normalizeDatasetPayload(await loadBootstrapScript());
    const response = await fetchWithTimeout(
      BOOTSTRAP_URL,
      { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } },
      DATA_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`Bootstrap data returned ${response.status}`);
    return normalizeDatasetPayload(await response.json());
  }

  async function load() {
    const startedAt = performance.now();
    const cached = await cacheGet();
    const hasValidCache = !!(
      cached && cacheMatchesRuntime(cached) && Array.isArray(cached.data) && cached.data.length >= 0 && cached.version
    );

    let remoteMeta = null;
    try { remoteMeta = await getRemoteVersion(); }
    catch (error) { console.warn('[WaterData] version check failed:', error.message || error); }

    if (remoteMeta && hasValidCache && remoteMeta.version === cached.version) {
      setDiagnostics({
        source: 'indexeddb-cache', transport: 'version-check', version: cached.version, count: cached.data.length,
        remoteUpdatedAt: remoteMeta.updatedAt || null,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return cached.data;
    }

    // File mode must always attempt a live remote read before trusting cache/bootstrap.
    // 1) Prefer the normal CORS JSON API.
    // 2) If file:// CORS is blocked by the browser/old deployment, use the read-only script bridge.
    // This bridge is a GET-only transport and does not expose the authenticated sync endpoint.
    if (runtime.mode === 'file' || remoteMeta || !hasValidCache) {
      try {
        const remote = await getRemoteDataset(hasValidCache ? cached.version : null);
        if (remote.notModified && hasValidCache) {
          setDiagnostics({
            source: 'indexeddb-cache-304', transport: 'fetch-cors', version: cached.version, count: cached.data.length,
            elapsedMs: Math.round(performance.now() - startedAt)
          });
          return cached.data;
        }
        if (!remote.notModified && remote.data) {
          const version = remote.version || (remoteMeta && remoteMeta.version) || `network:${Date.now()}`;
          const cacheRecord = {
            version,
            updatedAt: remote.updatedAt || (remoteMeta && remoteMeta.updatedAt) || new Date().toISOString(),
            remoteOrigin: runtime.mode === 'file' ? runtime.productionOrigin : global.location.origin,
            data: remote.data
          };
          await cacheSet(cacheRecord);
          setDiagnostics({
            source: runtime.mode === 'file' ? 'production-api-file' : 'netlify-blob-api',
            transport: remote.transport || (runtime.mode === 'file' ? 'fetch-cors' : 'same-origin-fetch'),
            version, count: remote.data.length,
            elapsedMs: Math.round(performance.now() - startedAt)
          });
          return remote.data;
        }
      } catch (error) {
        console.warn('[WaterData] dataset API failed:', error.message || error);
      }
    }

    if (runtime.mode === 'file') {
      try {
        const remote = await getRemoteDatasetViaFileBridge();
        if (remote && remote.data) {
          const version = remote.version || `bridge:${Date.now()}`;
          await cacheSet({
            version,
            updatedAt: remote.updatedAt || new Date().toISOString(),
            remoteOrigin: runtime.productionOrigin,
            data: remote.data
          });
          setDiagnostics({
            source: 'production-script-bridge-file', transport: 'script-bridge',
            version, count: remote.data.length,
            remoteUpdatedAt: remote.updatedAt || null,
            elapsedMs: Math.round(performance.now() - startedAt)
          });
          return remote.data;
        }
      } catch (error) {
        console.warn('[WaterData] file bridge failed:', error.message || error);
      }
    }

    if (hasValidCache) {
      setDiagnostics({
        source: 'indexeddb-cache-offline', transport: 'cache', version: cached.version, count: cached.data.length,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return cached.data;
    }

    try {
      const bootstrapData = await getBootstrapDataset();
      const bootstrapVersion = `bootstrap:${bootstrapData.length}`;
      await cacheSet({
        version: bootstrapVersion,
        updatedAt: null,
        remoteOrigin: runtime.mode === 'file' ? runtime.productionOrigin : global.location.origin,
        data: bootstrapData
      });
      setDiagnostics({
        source: runtime.mode === 'file' ? 'static-bootstrap-file' : 'static-bootstrap',
        transport: 'local-bootstrap', version: bootstrapVersion, count: bootstrapData.length,
        warning: runtime.mode === 'file' ? 'กำลังใช้ข้อมูลสำรองในไฟล์ เนื่องจากเชื่อมข้อมูล Production ไม่สำเร็จ' : null,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return bootstrapData;
    } catch (error) {
      console.error('[WaterData] all data sources failed:', error);
      setDiagnostics({
        source: 'empty-failsafe', transport: 'none', version: null, count: 0,
        error: String(error && error.message ? error.message : error),
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return [];
    }
  }

  global.WaterData = Object.freeze({
    load,
    clearCache,
    cacheGet,
    constants: Object.freeze({
      RUNTIME_MODE: runtime.mode,
      PRODUCTION_ORIGIN: runtime.productionOrigin || null,
      VERSION_ENDPOINT,
      DATA_ENDPOINT,
      FILE_BRIDGE_ENDPOINT,
      BOOTSTRAP_URL,
      BOOTSTRAP_SCRIPT_URL
    })
  });
})(window);
