/**
 * DashboardWaterResources -> Netlify Blob sync
 * READS the WaterResources sheet only. It does not modify sheet cells.
 *
 * Required Script Properties:
 *   WATER_DASHBOARD_SYNC_URL    e.g. https://YOUR-SITE.netlify.app/api/waterresources/sync
 *   WATER_DASHBOARD_SYNC_SECRET same secret as Netlify WATER_SYNC_SECRET
 */

const WATER_DASHBOARD_SYNC_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1RAUVbsGrTmFx1HBDIiu1sPqz04QQoOlKZOybPGG__rU',
  SHEET_NAME: 'WaterResources',
  TIMEZONE: 'Asia/Bangkok',
  ALLOWED_TAMBONS: [
    'แม่กา', 'แม่นาเรือ', 'แม่ใส', 'บ้านตุ่น', 'บ้านสาง',
    'สันป่าม่วง', 'บ้านต๋อม', 'บ้านต๊ำ', 'ท่าจำปี', 'เทศบาลเมือง',
    'เจริญราษฎร์', 'แม่ปืม', 'แม่สุก', 'ป่าแฝก', 'บ้านเหล่า',
    'บ้านใหม่', 'แม่ใจ', 'ศรีถ้อย', 'สว่างอารมณ์', 'บุญเกิด',
    'ดอกคำใต้', 'ดอนศรีชุม', 'คือเวียง', 'บ้านปิน', 'จำป่าหวาย',
    'บ้านถ้ำ', 'แม่อิง', 'สันโค้ง', 'ดงเจน'
  ]
});

function syncWaterResourcesToDashboard() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('มีการ Sync Dashboard อีกงานกำลังทำงานอยู่');
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const endpoint = String(props.getProperty('WATER_DASHBOARD_SYNC_URL') || '').trim();
    const secret = String(props.getProperty('WATER_DASHBOARD_SYNC_SECRET') || '').trim();

    if (!/^https:\/\//i.test(endpoint)) {
      throw new Error('ยังไม่ได้ตั้ง Script Property: WATER_DASHBOARD_SYNC_URL');
    }
    if (secret.length < 24) {
      throw new Error('ยังไม่ได้ตั้ง Script Property: WATER_DASHBOARD_SYNC_SECRET หรือ Secret สั้นเกินไป');
    }

    const records = buildDashboardWaterResourcesSnapshot_();
    const payload = {
      sourceSpreadsheetId: WATER_DASHBOARD_SYNC_CONFIG.SPREADSHEET_ID,
      sourceSheetName: WATER_DASHBOARD_SYNC_CONFIG.SHEET_NAME,
      sourceUpdatedAt: new Date().toISOString(),
      records: records
    };

    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        Authorization: 'Bearer ' + secret
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true
    });

    const status = response.getResponseCode();
    const bodyText = response.getContentText();
    let body = null;
    try { body = JSON.parse(bodyText); } catch (_) {}

    if (status < 200 || status >= 300 || !body || body.success !== true) {
      throw new Error('Netlify Sync ล้มเหลว HTTP ' + status + ': ' + bodyText.slice(0, 500));
    }

    Logger.log('Dashboard Sync สำเร็จ: ' + JSON.stringify(body));
    return body;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Safe hook for existing save/update/delete functions.
 * A Netlify problem must never make the main WaterResources save fail.
 */
function trySyncWaterResourcesDashboard_() {
  try {
    return syncWaterResourcesToDashboard();
  } catch (error) {
    console.error('Dashboard sync warning: ' + (error && error.stack ? error.stack : error));
    return { success: false, error: String(error && error.message ? error.message : error) };
  }
}

function buildDashboardWaterResourcesSnapshot_() {
  const ss = SpreadsheetApp.openById(WATER_DASHBOARD_SYNC_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WATER_DASHBOARD_SYNC_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('ไม่พบชีต ' + WATER_DASHBOARD_SYNC_CONFIG.SHEET_NAME);

  const lastRow = sheet.getLastRow();
  const physicalLastColumn = sheet.getLastColumn();
  if (lastRow < 2 || physicalLastColumn < 1) return [];

  // Read the header first, then fetch only the columns that are actually part of the contract.
  // LocalAuthority is optional during rollout, so this helper works both before and after column Y exists.
  const headerRow = sheet.getRange(1, 1, 1, physicalLastColumn).getValues()[0];
  const headers = headerRow.map(function (value) { return String(value || '').trim(); });
  const headerIndex = {};
  headers.forEach(function (header, index) { if (header) headerIndex[header] = index; });

  const required = [
    'ID', 'DateTime', 'XY', 'WaterName', 'WaterOwner', 'MobilePhone', 'WaterType',
    'Width', 'Length', 'Depth', 'DepthNet', 'Tambon', 'VillageName', 'Moo',
    'Problem', 'LinkImage', 'Volumn', 'Note', 'Status'
  ];
  const missing = required.filter(function (header) { return headerIndex[header] === undefined; });
  if (missing.length) throw new Error('ชีตขาดคอลัมน์: ' + missing.join(', '));

  const contractHeaders = required.concat(headerIndex.LocalAuthority === undefined ? [] : ['LocalAuthority']);
  const maxContractIndex = Math.max.apply(null, contractHeaders.map(function (header) { return headerIndex[header]; }));
  const readColumnCount = maxContractIndex + 1;
  const values = sheet.getRange(1, 1, lastRow, readColumnCount).getValues();

  const allowedTambons = new Set(WATER_DASHBOARD_SYNC_CONFIG.ALLOWED_TAMBONS);
  const output = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id = toNumberOrNull_(row[headerIndex.ID]);
    const tambon = normalizeDashboardTambon_(row[headerIndex.Tambon]);
    if (!id || !tambon || !allowedTambons.has(tambon)) continue;

    const coord = parseXY_(row[headerIndex.XY]);
    output.push({
      id: Math.trunc(id),
      dt: normalizeDateTime_(row[headerIndex.DateTime]),
      lat: coord.lat,
      lng: coord.lng,
      name: toTextOrNull_(row[headerIndex.WaterName]),
      owner: toTextOrNull_(row[headerIndex.WaterOwner]),
      phone: toTextOrNull_(row[headerIndex.MobilePhone]),
      type: normalizeWaterType_(row[headerIndex.WaterType]),
      width: toNumberOrNull_(row[headerIndex.Width]),
      length: toNumberOrNull_(row[headerIndex.Length]),
      depth: toNumberOrNull_(row[headerIndex.Depth]),
      depthnet: toNumberOrNull_(row[headerIndex.DepthNet]),
      tambon: tambon,
      village: toTextOrNull_(row[headerIndex.VillageName]),
      moo: normalizeDashboardMoo_(row[headerIndex.Moo]),
      problem: toTextOrNull_(row[headerIndex.Problem]),
      imglink: toTextOrNull_(row[headerIndex.LinkImage]),
      volume: toNumberOrNull_(row[headerIndex.Volumn]) || 0,
      note: toPrimitiveOrNull_(row[headerIndex.Note]),
      status: toTextOrNull_(row[headerIndex.Status]),
      // Optional during rollout. Preserve the exact Sheet value; Dashboard v1.4.3 validates it.
      localAuthority: headerIndex.LocalAuthority === undefined
        ? null
        : toTextOrNull_(row[headerIndex.LocalAuthority])
    });
  }

  output.sort(function (a, b) { return a.id - b.id; });
  return output;
}

function normalizeDateTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, WATER_DASHBOARD_SYNC_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  }
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
}

function parseXY_(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return { lat: null, lng: null };
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { lat: null, lng: null };
  }
  return { lat: lat, lng: lng };
}

function normalizeWaterType_(value) {
  const text = toTextOrNull_(value);
  if (text === 'สระน้ำ / บ่อน้ำ(มนุษย์สร้าง)') return 'สระน้ำ/บ่อน้ำ(มนุษย์สร้าง)';
  return text;
}

function normalizeDashboardTambon_(value) {
  const text = toTextOrNull_(value);
  if (!text) return null;
  // ชื่อมาตรฐานที่ใช้ใน Dashboard คือ "บ้านปิน".
  // รองรับข้อมูลเดิมที่สะกด "บ้านปิ่น" โดย normalize เฉพาะ snapshot ที่ส่งออก
  // และไม่เขียนค่ากลับไปยัง Google Sheet.
  if (text === 'บ้านปิ่น') return 'บ้านปิน';
  if (text === 'เทศบาลเมืองพะเยา') return 'เทศบาลเมือง';
  return text;
}

function normalizeDashboardMoo_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const match = String(value).replace(/,/g, '').trim().match(/\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return isFinite(number) ? number : null;
}

function toNumberOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') value = value.replace(/,/g, '').trim();
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function toTextOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  return text || null;
}

function toPrimitiveOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

/** Optional helper: create a long random secret and print it in Execution log. */
function generateWaterDashboardSyncSecret() {
  const secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  Logger.log(secret);
  return secret;
}

/** Optional connectivity test. Does not read or modify the Sheet. */
function testWaterDashboardSyncEndpoint() {
  const props = PropertiesService.getScriptProperties();
  const endpoint = String(props.getProperty('WATER_DASHBOARD_SYNC_URL') || '').trim();
  if (!endpoint) throw new Error('ยังไม่ได้ตั้ง WATER_DASHBOARD_SYNC_URL');
  const versionUrl = endpoint.replace(/\/sync\/?$/, '/version');
  const response = UrlFetchApp.fetch(versionUrl, { method: 'get', muteHttpExceptions: true });
  Logger.log('HTTP ' + response.getResponseCode() + ' ' + response.getContentText());
  return response.getContentText();
}

/**
 * Optional safety net. Run once after setup.
 * - Manual edits on WaterResources -> sync immediately.
 * - Hourly reconciliation -> catches any write path that was not hooked.
 * This creates Apps Script triggers only; it does not modify Sheet data.
 */
function installWaterDashboardSyncSafetyTriggers() {
  removeWaterDashboardSyncSafetyTriggers();

  ScriptApp.newTrigger('waterDashboardManualEditSync_')
    .forSpreadsheet(WATER_DASHBOARD_SYNC_CONFIG.SPREADSHEET_ID)
    .onEdit()
    .create();

  ScriptApp.newTrigger('waterDashboardHourlyReconciliation_')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('ติดตั้ง Water Dashboard sync safety triggers แล้ว');
}

function removeWaterDashboardSyncSafetyTriggers() {
  const handlers = new Set([
    'waterDashboardManualEditSync_',
    'waterDashboardHourlyReconciliation_'
  ]);
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlers.has(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function waterDashboardManualEditSync_(e) {
  try {
    if (!e || !e.range || e.range.getSheet().getName() !== WATER_DASHBOARD_SYNC_CONFIG.SHEET_NAME) return;
    trySyncWaterResourcesDashboard_();
  } catch (error) {
    console.error('Manual edit dashboard sync warning: ' + error);
  }
}

function waterDashboardHourlyReconciliation_() {
  trySyncWaterResourcesDashboard_();
}
