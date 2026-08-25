(function (global) {
  'use strict';

  const DB_NAME = 'water-resources-dashboard-cache';
  const DB_VERSION = 1;
  const STORE_NAME = 'state';
  const DATA_KEY = 'waterresources';
  const VERSION_ENDPOINT = '/api/waterresources/version';
  const DATA_ENDPOINT = '/api/waterresources';
  const BOOTSTRAP_URL = '/data/waterresources.initial.json';
  const VERSION_TIMEOUT_MS = 3500;
  const DATA_TIMEOUT_MS = 9000;

  let dbPromise = null;

  function setDiagnostics(patch) {
    const current = global.__WATER_DATA_DIAGNOSTICS__ || {};
    global.__WATER_DATA_DIAGNOSTICS__ = Object.assign({}, current, patch, {
      timestamp: new Date().toISOString()
    });
  }

  function openDb() {
    if (!('indexedDB' in global)) {
      return Promise.resolve(null);
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
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
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeDatasetPayload(payload) {
    const data = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.data)
        ? payload.data
        : null;

    if (!data) {
      throw new Error('WaterResources payload is not an array');
    }
    return data;
  }

  async function getRemoteVersion() {
    const response = await fetchWithTimeout(
      VERSION_ENDPOINT,
      { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } },
      VERSION_TIMEOUT_MS
    );
    if (!response.ok) {
      throw new Error(`Version API returned ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || !payload.version) {
      throw new Error('Version API returned no version');
    }
    return payload;
  }

  async function getRemoteDataset(cachedVersion) {
    const headers = { Accept: 'application/json' };
    if (cachedVersion && !String(cachedVersion).startsWith('bootstrap:')) {
      headers['If-None-Match'] = cachedVersion;
    }

    const response = await fetchWithTimeout(
      DATA_ENDPOINT,
      { method: 'GET', cache: 'no-store', headers },
      DATA_TIMEOUT_MS
    );

    if (response.status === 304) {
      return { notModified: true };
    }
    if (!response.ok) {
      throw new Error(`WaterResources API returned ${response.status}`);
    }

    const payload = await response.json();
    const data = normalizeDatasetPayload(payload);
    const headerVersion = response.headers.get('ETag');
    const version = (payload && payload.version) || headerVersion || null;
    return {
      notModified: false,
      data,
      version,
      updatedAt: payload && payload.updatedAt ? payload.updatedAt : null,
      count: data.length
    };
  }

  async function getBootstrapDataset() {
    const response = await fetchWithTimeout(
      BOOTSTRAP_URL,
      { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } },
      DATA_TIMEOUT_MS
    );
    if (!response.ok) {
      throw new Error(`Bootstrap data returned ${response.status}`);
    }
    const payload = await response.json();
    return normalizeDatasetPayload(payload);
  }

  async function load() {
    const startedAt = performance.now();
    const cached = await cacheGet();
    const hasValidCache = !!(
      cached &&
      Array.isArray(cached.data) &&
      cached.data.length >= 0 &&
      cached.version
    );

    let remoteMeta = null;
    try {
      remoteMeta = await getRemoteVersion();
    } catch (error) {
      console.warn('[WaterData] version check failed:', error.message || error);
    }

    if (remoteMeta && hasValidCache && remoteMeta.version === cached.version) {
      setDiagnostics({
        source: 'indexeddb-cache',
        version: cached.version,
        count: cached.data.length,
        remoteUpdatedAt: remoteMeta.updatedAt || null,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return cached.data;
    }

    if (remoteMeta || !hasValidCache) {
      try {
        const remote = await getRemoteDataset(hasValidCache ? cached.version : null);
        if (remote.notModified && hasValidCache) {
          setDiagnostics({
            source: 'indexeddb-cache-304',
            version: cached.version,
            count: cached.data.length,
            elapsedMs: Math.round(performance.now() - startedAt)
          });
          return cached.data;
        }
        if (!remote.notModified && remote.data) {
          const version = remote.version || (remoteMeta && remoteMeta.version) || `network:${Date.now()}`;
          const cacheRecord = {
            version,
            updatedAt: remote.updatedAt || (remoteMeta && remoteMeta.updatedAt) || new Date().toISOString(),
            data: remote.data
          };
          await cacheSet(cacheRecord);
          setDiagnostics({
            source: 'netlify-blob-api',
            version,
            count: remote.data.length,
            elapsedMs: Math.round(performance.now() - startedAt)
          });
          return remote.data;
        }
      } catch (error) {
        console.warn('[WaterData] dataset API failed:', error.message || error);
      }
    }

    if (hasValidCache) {
      setDiagnostics({
        source: 'indexeddb-cache-offline',
        version: cached.version,
        count: cached.data.length,
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
        data: bootstrapData
      });
      setDiagnostics({
        source: 'static-bootstrap',
        version: bootstrapVersion,
        count: bootstrapData.length,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return bootstrapData;
    } catch (error) {
      console.error('[WaterData] all data sources failed:', error);
      setDiagnostics({
        source: 'empty-failsafe',
        version: null,
        count: 0,
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
      VERSION_ENDPOINT,
      DATA_ENDPOINT,
      BOOTSTRAP_URL
    })
  });
})(window);
