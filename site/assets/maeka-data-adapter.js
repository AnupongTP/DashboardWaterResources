(function (global) {
  'use strict';

  function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function toMaekaRecord(record) {
    return {
      id: Number(record.id),
      name: text(record.name),
      owner: text(record.owner),
      type: text(record.type),
      width: finiteOr(record.width, 0),
      length: finiteOr(record.length, 0),
      depth: finiteOr(record.depth, 0),
      depthNet: finiteOr(record.depthnet !== undefined ? record.depthnet : record.depthNet, 0),
      village: text(record.village),
      moo: record.moo === null || record.moo === undefined || record.moo === '' ? null : finiteOr(record.moo, null),
      problem: text(record.problem),
      image: text(record.imglink !== undefined ? record.imglink : record.image),
      volumn: finiteOr(record.volume !== undefined ? record.volume : record.volumn, 0),
      note: record.note === null || record.note === undefined ? '' : record.note,
      status: text(record.status),
      lat: finiteOr(record.lat, null),
      lng: finiteOr(record.lng, null)
    };
  }

  function fromWaterRecords(records) {
    if (!Array.isArray(records)) return [];
    return records
      .filter((record) => record && String(record.tambon || '').trim() === 'แม่กา')
      .map(toMaekaRecord)
      .filter((record) => Number.isInteger(record.id) && record.id > 0);
  }

  global.MaekaDataAdapter = Object.freeze({ toMaekaRecord, fromWaterRecords });
})(window);
