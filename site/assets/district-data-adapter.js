(function (global) {
  'use strict';

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function coordinate(value, limit) {
    const number = finiteNumber(value);
    return number !== null && Math.abs(number) <= limit ? number : null;
  }

  function fromWaterRecords(records, district) {
    const area = global.AreaResponsibility;
    const maeka = global.MaekaDataAdapter;
    if (!area || !maeka || !Array.isArray(records) || !area.DISTRICT_ORDER.includes(district)) {
      throw new Error('District adapter is unavailable');
    }
    // District scope depends only on the canonical Tambon mapping. Unresolved,
    // ambiguous, or invalid LocalAuthority values must not remove district rows.
    const scoped = records.filter(record => area.recordMatchesDistrict(record, district));
    const adapted = scoped.map(record => {
      const row = maeka.toMaekaRecord(record);
      const volume = finiteNumber(record.volume !== undefined ? record.volume : record.volumn);
      const width = finiteNumber(record.width), length = finiteNumber(record.length);
      const depth = finiteNumber(record.depthnet !== undefined ? record.depthnet : record.depthNet) ?? finiteNumber(record.depth);
      row.tambon = area.canonicalTambon(record.tambon);
      row.lat = coordinate(record.lat, 90);
      row.lng = coordinate(record.lng, 180);
      if (row.lat === 0 && row.lng === 0) { row.lat = null; row.lng = null; }
      row.volumeKnown = (volume !== null && volume > 0) ||
        (width !== null && width > 0 && length !== null && length > 0 && depth !== null && depth > 0);
      return row;
    });
    return {records:adapted};
  }

  global.DistrictDataAdapter = Object.freeze({fromWaterRecords});
})(window);
