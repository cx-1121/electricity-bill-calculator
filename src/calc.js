/**
 * Dorm Electricity Split: pure validation and calculation.
 *
 * No DOM, no storage. Works in the browser (window.BillCalc) and in Node (require).
 *
 * Money is handled as integer sen (RM x 100) internally.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BillCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- number helpers ----------

  /**
   * Parse user input into a number.
   * '' / null / undefined -> null (empty); unparseable -> NaN.
   */
  function parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const s = String(value).trim().replace(/,/g, '');
    if (s === '') return null;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  function isValidNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
  }

  /** RM -> integer sen, avoiding 1.005 * 100 = 100.4999 style errors. */
  function toSen(rm) {
    const s = String(rm);
    if (/e/i.test(s)) return Math.round(rm * 100);
    return Math.round(Number(s + 'e2'));
  }

  /** Integer sen -> RM number (for storage). */
  function fromSen(sen) {
    return Math.round(sen) / 100;
  }

  /** Round kWh to 3 decimals to clean up subtraction noise (1250.3 - 1150.1). */
  function roundKwh(kwh) {
    return Math.round(Number(kwh + 'e3')) / 1000;
  }

  /** Integer sen -> "70.00" (negative shown with a leading minus). */
  function formatRM(sen) {
    const sign = sen < 0 ? '-' : '';
    const abs = Math.abs(Math.round(sen));
    const ringgit = Math.floor(abs / 100);
    const cents = String(abs % 100).padStart(2, '0');
    return sign + ringgit + '.' + cents;
  }

  /** Effective rate to 4 decimals. */
  function formatRate(rmPerKwh) {
    return rmPerKwh.toFixed(4);
  }

  function formatKwh(kwh) {
    return String(roundKwh(kwh));
  }

  // ---------- validation ----------

  const MESSAGES = {
    INVALID_TOTAL_KWH: 'Total Usage (kWh) must be a number greater than 0.',
    INVALID_TOTAL_AMOUNT: 'Total Bill Amount (RM) must be a number of 0 or more.',
    NO_RESIDENTS: 'There are no residents. Add residents in Settings first.',
    MISSING_READING: 'Please fill in the Current Meter Reading for all residents.',
    INVALID_READING: 'Current Meter Reading must be a number.',
    MISSING_PREVIOUS: 'Previous Reading is missing. Set it in Settings.',
    READING_BELOW_PREVIOUS: 'Current Reading is lower than Previous Reading.',
    USAGE_EXCEEDS_TOTAL: 'Room usage exceeds bill usage, check readings.',
    NO_PRESENT: 'Common cost cannot be split, select at least one resident.',
  };

  function err(code, extra) {
    return Object.assign({ code: code, message: MESSAGES[code] }, extra || {});
  }

  /**
   * Validate the bill + per-resident readings.
   *
   * input = {
   *   totalKwh, totalAmount,                // numbers or strings
   *   residents: [{ id, name, previous, current, present }]
   * }
   * returns { ok, errors: [{ code, message, residentId? }] }
   */
  function validate(input) {
    const errors = [];
    const totalKwh = parseNumber(input.totalKwh);
    const totalAmount = parseNumber(input.totalAmount);
    const residents = input.residents || [];

    const kwhOk = isValidNumber(totalKwh) && totalKwh > 0;
    if (!kwhOk) errors.push(err('INVALID_TOTAL_KWH'));
    if (!(isValidNumber(totalAmount) && totalAmount >= 0)) errors.push(err('INVALID_TOTAL_AMOUNT'));

    if (residents.length === 0) {
      errors.push(err('NO_RESIDENTS'));
      return { ok: false, errors: errors };
    }

    let usageSum = 0;
    let allReadingsOk = true;
    let anyMissing = false;

    residents.forEach(function (r) {
      const prev = parseNumber(r.previous);
      const cur = parseNumber(r.current);
      const who = { residentId: r.id, residentName: r.name };

      if (!isValidNumber(prev)) {
        errors.push(err('MISSING_PREVIOUS', who));
        allReadingsOk = false;
        return;
      }
      if (cur === null) {
        anyMissing = true;
        allReadingsOk = false;
        return;
      }
      if (!isValidNumber(cur)) {
        errors.push(err('INVALID_READING', who));
        allReadingsOk = false;
        return;
      }
      if (cur < prev) {
        errors.push(err('READING_BELOW_PREVIOUS', who));
        allReadingsOk = false;
        return;
      }
      usageSum += cur - prev;
    });

    if (anyMissing) {
      const missingIds = residents
        .filter(function (r) { return parseNumber(r.current) === null; })
        .map(function (r) { return r.id; });
      errors.push(err('MISSING_READING', { residentIds: missingIds }));
    }

    if (kwhOk && allReadingsOk && roundKwh(usageSum) > totalKwh) {
      errors.push(err('USAGE_EXCEEDS_TOTAL', { roomKwh: roundKwh(usageSum), totalKwh: totalKwh }));
    }

    if (!residents.some(function (r) { return !!r.present; })) {
      errors.push(err('NO_PRESENT'));
    }

    return { ok: errors.length === 0, errors: errors };
  }

  // ---------- calculation ----------

  /**
   * Common usage for the live line on the main screen.
   * Returns null while inputs are incomplete or invalid.
   */
  function liveCommonUsage(totalKwh, residents) {
    const total = parseNumber(totalKwh);
    if (!isValidNumber(total)) return null;
    let sum = 0;
    for (let i = 0; i < residents.length; i++) {
      const prev = parseNumber(residents[i].previous);
      const cur = parseNumber(residents[i].current);
      if (!isValidNumber(prev) || !isValidNumber(cur)) return null;
      sum += cur - prev;
    }
    return roundKwh(total - sum);
  }

  /**
   * Validate then calculate. Pure: same input -> same output.
   *
   * Rounding approach (all integer sen):
   *  - roomCost_i is rounded to the nearest sen.
   *  - commonCost = totalAmount - sum(roomCost_i), so it is exact and absorbs room rounding.
   *  - share = commonCost / presentN rounded to the nearest sen.
   *  - diff = commonCost - share * presentN goes to the first present resident
   *    as "Rounding adjustment". Every breakdown line therefore adds up exactly,
   *    and sum(pay_i) === totalAmount always.
   *
   * returns { ok: false, errors } or { ok: true, result }
   */
  function calculate(input) {
    const v = validate(input);
    if (!v.ok) return { ok: false, errors: v.errors };

    const totalKwh = parseNumber(input.totalKwh);
    const totalSen = toSen(parseNumber(input.totalAmount));
    const unitSen = totalSen / totalKwh;          // sen per kWh (float)
    const unitRM = unitSen / 100;                 // Effective Rate, RM/kWh

    const rows = input.residents.map(function (r) {
      const previous = parseNumber(r.previous);
      const current = parseNumber(r.current);
      const usageKwh = roundKwh(current - previous);
      return {
        id: r.id,
        name: r.name,
        previous: previous,
        current: current,
        usageKwh: usageKwh,
        present: !!r.present,
        roomCostSen: Math.round(usageKwh * unitSen),
        shareSen: 0,
        adjustmentSen: 0,
        paySen: 0,
        steps: [],
      };
    });

    const roomKwh = roundKwh(rows.reduce(function (s, r) { return s + r.usageKwh; }, 0));
    const roomCostTotalSen = rows.reduce(function (s, r) { return s + r.roomCostSen; }, 0);
    const commonKwh = roundKwh(totalKwh - roomKwh);
    const commonCostSen = totalSen - roomCostTotalSen;

    const present = rows.filter(function (r) { return r.present; });
    const presentN = present.length;
    const shareSen = Math.round(commonCostSen / presentN);
    const diffSen = commonCostSen - shareSen * presentN;
    const adjusted = present[0];

    rows.forEach(function (r) {
      if (r.present) r.shareSen = shareSen;
      if (r === adjusted) r.adjustmentSen = diffSen;
      r.paySen = r.roomCostSen + r.shareSen + r.adjustmentSen;

      r.steps.push({
        label: 'Room usage',
        text: formatKwh(r.usageKwh) + ' kWh × ' + formatRate(unitRM) + ' = RM ' + formatRM(r.roomCostSen),
        amountSen: r.roomCostSen,
      });
      r.steps.push(r.present
        ? {
            label: 'Common share',
            text: 'RM ' + formatRM(commonCostSen) + ' ÷ ' + presentN + ' = RM ' + formatRM(shareSen),
            amountSen: shareSen,
          }
        : { label: 'Common share', text: 'Not present, no common share', amountSen: 0 });
      if (r.adjustmentSen !== 0) {
        r.steps.push({
          label: 'Rounding adjustment',
          text: (r.adjustmentSen > 0 ? '+' : '') + 'RM ' + formatRM(r.adjustmentSen),
          amountSen: r.adjustmentSen,
        });
      }
      r.steps.push({ label: 'Total to pay', text: 'RM ' + formatRM(r.paySen), amountSen: r.paySen });
    });

    const totalPaidSen = rows.reduce(function (s, r) { return s + r.paySen; }, 0);

    return {
      ok: true,
      result: {
        totalKwh: totalKwh,
        totalAmountSen: totalSen,
        effectiveRate: unitRM,
        roomKwh: roomKwh,
        commonKwh: commonKwh,
        commonCostSen: commonCostSen,
        presentCount: presentN,
        shareSen: shareSen,
        roundingAdjustmentSen: diffSen,
        roundingResidentId: diffSen !== 0 ? adjusted.id : null,
        totalPaidSen: totalPaidSen,
        residents: rows,
      },
    };
  }

  return {
    parseNumber: parseNumber,
    toSen: toSen,
    fromSen: fromSen,
    roundKwh: roundKwh,
    formatRM: formatRM,
    formatRate: formatRate,
    formatKwh: formatKwh,
    MESSAGES: MESSAGES,
    validate: validate,
    liveCommonUsage: liveCommonUsage,
    calculate: calculate,
  };
});
