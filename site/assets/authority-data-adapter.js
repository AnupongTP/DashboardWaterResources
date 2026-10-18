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

  function fromWaterRecords(records, authority) {
    const area = global.AreaResponsibility;
    const maeka = global.MaekaDataAdapter;
    if (!area || !maeka || !Array.isArray(records) ||
        !area.AUTHORITY_ORDER.includes(authority)) throw new Error('Authority adapter is unavailable');

    // Resolution must occur before conversion: a Tambon or owner string alone cannot
    // establish which local government is responsible for a record.
    const decorated = area.decorateRecords(records);
    const scoped = decorated.filter((record) => area.recordMatchesAuthority(record, authority));
    const adapted = scoped.map((record) => {
      const row = maeka.toMaekaRecord(record);
      const volume = finiteNumber(record.volume !== undefined ? record.volume : record.volumn);
      const width = finiteNumber(record.width), length = finiteNumber(record.length);
      const depth = finiteNumber(record.depthnet !== undefined ? record.depthnet : record.depthNet) ?? finiteNumber(record.depth);
      row.tambon = record.tambon || '';
      row.localAuthority = authority;
      row.lat = coordinate(record.lat, 90);
      row.lng = coordinate(record.lng, 180);
      if (row.lat === 0 && row.lng === 0) { row.lat = null; row.lng = null; }
      row.volumeKnown = (volume !== null && volume > 0) ||
        (width !== null && width > 0 && length !== null && length > 0 && depth !== null && depth > 0);
      return row;
    });
    return {
      records: adapted,
      unresolved: decorated.filter((record) => !record.resolvedLocalAuthority).length
    };
  }

  global.AuthorityDataAdapter = Object.freeze({ fromWaterRecords });
})(window);
