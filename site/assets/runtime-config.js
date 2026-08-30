(function (global) {
  'use strict';

  const DEFAULT_PRODUCTION_ORIGIN = 'https://dashboard-waterresources-phayao-test.netlify.app';
  const STORAGE_KEY = 'water-dashboard-production-origin';

  function normalizeOrigin(value) {
    const text = String(value || '').trim().replace(/\/+$/, '');
    if (!text) return '';
    try {
      const url = new URL(text);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      return url.origin;
    } catch (_) {
      return '';
    }
  }

  function safeStorageGet() {
    try { return normalizeOrigin(global.localStorage && global.localStorage.getItem(STORAGE_KEY)); }
    catch (_) { return ''; }
  }

  function safeStorageSet(value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(STORAGE_KEY, value);
      return true;
    } catch (_) { return false; }
  }

  function queryOverride() {
    try {
      const value = new URLSearchParams(global.location.search || '').get('apiOrigin');
      return normalizeOrigin(value);
    } catch (_) { return ''; }
  }

  const userConfig = global.WATER_DASHBOARD_CONFIG || {};
  const configuredOrigin = normalizeOrigin(userConfig.productionOrigin);
  const storedOrigin = safeStorageGet();
  const productionOrigin = queryOverride() || storedOrigin || configuredOrigin || DEFAULT_PRODUCTION_ORIGIN;
  const protocol = global.location && global.location.protocol ? global.location.protocol : '';
  const hostname = global.location && global.location.hostname ? global.location.hostname : '';
  const isFile = protocol === 'file:';
  const isLocalhost = !isFile && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname);
  const forcedMode = ['file','development','hosted'].includes(userConfig.forceMode) ? userConfig.forceMode : '';
  const mode = forcedMode || (isFile ? 'file' : (isLocalhost ? 'development' : 'hosted'));

  function apiUrl(path) {
    const p = String(path || '').startsWith('/') ? String(path) : '/' + String(path || '');
    if (mode === 'file') return productionOrigin + p;
    return p;
  }

  function productionUrl(path) {
    const p = String(path || '').startsWith('/') ? String(path) : '/' + String(path || '');
    return productionOrigin + p;
  }

  function setProductionOrigin(value) {
    const normalized = normalizeOrigin(value);
    if (!normalized) throw new Error('Production origin ต้องเป็น URL http/https ที่ถูกต้อง');
    safeStorageSet(normalized);
    return normalized;
  }

  global.WaterDashboardRuntime = Object.freeze({
    mode,
    isFile,
    isLocalhost,
    productionOrigin,
    defaultProductionOrigin: DEFAULT_PRODUCTION_ORIGIN,
    apiUrl,
    productionUrl,
    setProductionOrigin,
    storageKey: STORAGE_KEY
  });
})(window);
