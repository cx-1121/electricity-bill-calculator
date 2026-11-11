/**
 * Dorm Electricity Split: data model, localStorage helpers, settings and history.
 *
 * State functions are pure (take a state, return a new state).
 * createApp(storage) wraps them with load/save so a frontend only calls app.* methods.
 *
 * Browser: load calc.js first, then this file -> window.BillStore.
 * Node:    require('./store').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./calc'));
  } else {
    root.BillStore = factory(root.BillCalc);
  }
})(typeof self !== 'undefined' ? self : this, function (Calc) {
  'use strict';

  const STORAGE_KEY = 'dormElectricitySplit.v1';
  const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

  // ---------- state shape ----------
  //
  // {
  //   residents: [{ id, name, active, initialReading, previousOverride }],
  //   history:   [{ month, totalKwh, totalAmount, previous, readings, present, payments, submittedAt }]
  // }
  //
  // previousOverride: set from Settings when a meter is reset or replaced.
  // It wins over history until the next Submit, which clears it.

  function createEmptyState() {
    return { residents: [], history: [] };
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function normalizeState(raw) {
    const s = createEmptyState();
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw.residents)) {
      s.residents = raw.residents
        .filter(function (r) { return r && typeof r.id === 'string'; })
        .map(function (r) {
          return {
            id: r.id,
            name: String(r.name || ''),
            active: r.active !== false,
            initialReading: typeof r.initialReading === 'number' ? r.initialReading : null,
            previousOverride: typeof r.previousOverride === 'number' ? r.previousOverride : null,
          };
        });
    }
    if (Array.isArray(raw.history)) {
      s.history = raw.history.filter(function (h) { return h && h.readings && typeof h.readings === 'object'; });
    }
    return s;
  }

  // ---------- storage ----------

  /** Returns { state, error }. Never throws. */
  function loadState(storage, key) {
    try {
      const text = storage.getItem(key || STORAGE_KEY);
      if (!text) return { state: createEmptyState(), error: null };
      return { state: normalizeState(JSON.parse(text)), error: null };
    } catch (e) {
      return { state: createEmptyState(), error: 'Could not read saved data: ' + e.message };
    }
  }

  /** Returns { ok, error }. Never throws. */
  function saveState(storage, state, key) {
    try {
      storage.setItem(key || STORAGE_KEY, JSON.stringify(state));
      return { ok: true, error: null };
    } catch (e) {
      return { ok: false, error: 'Could not save data: ' + e.message };
    }
  }

  /** In-memory stand-in for localStorage (tests, or when localStorage is blocked). */
  function createMemoryStorage() {
    const data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
    };
  }

  // ---------- queries ----------

  function findResident(state, id) {
    return state.residents.find(function (r) { return r.id === id; }) || null;
  }

  function getActiveResidents(state) {
    return state.residents.filter(function (r) { return r.active; });
  }

  function getLatestEntry(state) {
    return state.history.length ? state.history[state.history.length - 1] : null;
  }

  /**
   * Previous reading = override, else the most recent history entry that has
   * this resident's reading, else the initial reading from Settings.
   */
  function getPreviousReading(state, id) {
    const r = findResident(state, id);
    if (!r) return null;
    if (typeof r.previousOverride === 'number') return r.previousOverride;
    for (let i = state.history.length - 1; i >= 0; i--) {
      const v = state.history[i].readings[id];
      if (typeof v === 'number') return v;
    }
    return r.initialReading;
  }

  /** Rows for the main screen: active residents with their previous reading. */
  function getMainFormRows(state) {
    return getActiveResidents(state).map(function (r) {
      return { id: r.id, name: r.name, previous: getPreviousReading(state, r.id) };
    });
  }

  /** History newest first, with resident names resolved (including removed residents). */
  function getHistory(state) {
    return state.history.slice().reverse().map(function (h) {
      const rows = Object.keys(h.readings).map(function (id) {
        const r = findResident(state, id);
        return {
          id: id,
          name: r ? r.name : id,
          active: r ? r.active : false,
          previous: h.previous ? h.previous[id] : null,
          reading: h.readings[id],
          present: h.present ? !!h.present[id] : true,
          payment: h.payments ? h.payments[id] : null,
        };
      });
      return {
        month: h.month,
        totalKwh: h.totalKwh,
        totalAmount: h.totalAmount,
        submittedAt: h.submittedAt || null,
        residents: rows,
      };
    });
  }

  // ---------- settings: residents ----------

  function fail(errors) {
    return { ok: false, errors: errors };
  }

  function nextId(state) {
    let max = 0;
    state.residents.forEach(function (r) {
      const m = /^r(\d+)$/.exec(r.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'r' + (max + 1);
  }

  function checkName(state, name, exceptId) {
    const n = String(name || '').trim();
    if (!n) return { error: { code: 'NAME_REQUIRED', message: 'Name is required.' } };
    const clash = getActiveResidents(state).some(function (r) {
      return r.id !== exceptId && r.name.toLowerCase() === n.toLowerCase();
    });
    if (clash) return { error: { code: 'NAME_TAKEN', message: 'Another resident already has this name.' } };
    return { name: n };
  }

  function checkReading(value, code, label) {
    const v = Calc.parseNumber(value);
    if (v === null || !Number.isFinite(v) || v < 0) {
      return { error: { code: code, message: label + ' must be a number of 0 or more.' } };
    }
    return { value: v };
  }

  /** Add a resident. initialReading is required. */
  function addResident(state, name, initialReading) {
    const errors = [];
    const n = checkName(state, name);
    if (n.error) errors.push(n.error);
    const rd = checkReading(initialReading, 'INITIAL_READING_REQUIRED', 'Initial meter reading');
    if (rd.error) errors.push(rd.error);
    if (errors.length) return fail(errors);

    const next = clone(state);
    const resident = {
      id: nextId(next),
      name: n.name,
      active: true,
      initialReading: rd.value,
      previousOverride: null,
    };
    next.residents.push(resident);
    return { ok: true, state: next, resident: resident };
  }

  function renameResident(state, id, name) {
    const r = findResident(state, id);
    if (!r) return fail([{ code: 'NOT_FOUND', message: 'Resident not found.' }]);
    const n = checkName(state, name, id);
    if (n.error) return fail([n.error]);
    const next = clone(state);
    findResident(next, id).name = n.name;
    return { ok: true, state: next };
  }

  /** Soft delete: history keeps the name and numbers. */
  function removeResident(state, id) {
    const r = findResident(state, id);
    if (!r) return fail([{ code: 'NOT_FOUND', message: 'Resident not found.' }]);
    const next = clone(state);
    findResident(next, id).active = false;
    return { ok: true, state: next };
  }

  /** Bring a removed resident back (uses their last known reading as previous). */
  function restoreResident(state, id) {
    const r = findResident(state, id);
    if (!r) return fail([{ code: 'NOT_FOUND', message: 'Resident not found.' }]);
    const n = checkName(state, r.name, id);
    if (n.error) return fail([n.error]);
    const next = clone(state);
    findResident(next, id).active = true;
    return { ok: true, state: next };
  }

  /** Meter reset / replaced: manually set the previous reading used next Submit. */
  function setPreviousReading(state, id, value) {
    const r = findResident(state, id);
    if (!r) return fail([{ code: 'NOT_FOUND', message: 'Resident not found.' }]);
    const rd = checkReading(value, 'INVALID_PREVIOUS_READING', 'Previous reading');
    if (rd.error) return fail([rd.error]);
    const next = clone(state);
    const nr = findResident(next, id);
    if (state.history.length === 0) {
      nr.initialReading = rd.value;
      nr.previousOverride = null;
    } else {
      nr.previousOverride = rd.value;
    }
    return { ok: true, state: next };
  }

  // ---------- submit and history ----------

  /**
   * Validate, calculate and append the month to history.
   *
   * input = {
   *   month: '2026-11' | '' (optional),
   *   totalKwh, totalAmount,
   *   entries: { [residentId]: { current, present } }
   * }
   * returns { ok: false, errors } or { ok: true, state, result, entry }
   * On failure the given state is untouched.
   */
  function submitMonth(state, input, now) {
    const month = String(input.month || '').trim();
    const preErrors = [];
    if (month && !MONTH_RE.test(month)) {
      preErrors.push({ code: 'INVALID_MONTH', message: 'Billing Month must look like 2026-11.' });
    } else if (month && state.history.some(function (h) { return h.month === month; })) {
      preErrors.push({ code: 'DUPLICATE_MONTH', message: 'Billing Month ' + month + ' is already in history. Delete it first to resubmit.' });
    }

    const entries = input.entries || {};
    const residents = getMainFormRows(state).map(function (row) {
      const e = entries[row.id] || {};
      return {
        id: row.id,
        name: row.name,
        previous: row.previous,
        current: e.current,
        present: e.present === undefined ? true : !!e.present,
      };
    });

    const calc = Calc.calculate({
      totalKwh: input.totalKwh,
      totalAmount: input.totalAmount,
      residents: residents,
    });

    const errors = preErrors.concat(calc.ok ? [] : calc.errors);
    if (errors.length) return fail(errors);

    const res = calc.result;
    const entry = {
      month: month || null,
      totalKwh: res.totalKwh,
      totalAmount: Calc.fromSen(res.totalAmountSen),
      previous: {},
      readings: {},
      present: {},
      payments: {},
      submittedAt: (now || new Date()).toISOString(),
    };
    res.residents.forEach(function (r) {
      entry.previous[r.id] = r.previous;
      entry.readings[r.id] = r.current;
      entry.present[r.id] = r.present;
      entry.payments[r.id] = Calc.fromSen(r.paySen);
    });

    const next = clone(state);
    next.history.push(entry);
    next.residents.forEach(function (r) {
      if (entry.readings[r.id] !== undefined) r.previousOverride = null;
    });
    return { ok: true, state: next, result: res, entry: entry };
  }

  /** Remove the most recent month (submitted by mistake). */
  function deleteLatestMonth(state) {
    if (state.history.length === 0) {
      return fail([{ code: 'NO_HISTORY', message: 'There is no history to delete.' }]);
    }
    const next = clone(state);
    const removed = next.history.pop();
    return { ok: true, state: next, removed: removed };
  }

  // ---------- app wrapper (load -> change -> save) ----------

  /**
   * const app = BillStore.createApp(window.localStorage);
   * Every mutating method returns the pure function's result plus { saveError }.
   * If saving fails, the in-memory state still updates so the session keeps working.
   */
  function createApp(storage, key) {
    let store = storage;
    if (!store) {
      try { store = window.localStorage; } catch (e) { store = null; }
    }
    if (!store) store = createMemoryStorage();

    const loaded = loadState(store, key);
    let state = loaded.state;

    function commit(res) {
      if (!res.ok) return res;
      state = res.state;
      const saved = saveState(store, state, key);
      return Object.assign({}, res, { saveError: saved.error });
    }

    return {
      loadError: loaded.error,
      getState: function () { return clone(state); },

      // main screen
      getMainFormRows: function () { return getMainFormRows(state); },
      liveCommonUsage: function (totalKwh, currents) {
        const rows = getMainFormRows(state).map(function (r) {
          return { previous: r.previous, current: (currents || {})[r.id] };
        });
        return Calc.liveCommonUsage(totalKwh, rows);
      },
      submit: function (input) { return commit(submitMonth(state, input)); },

      // settings
      getResidents: function () { return clone(state.residents); },
      addResident: function (name, initialReading) { return commit(addResident(state, name, initialReading)); },
      renameResident: function (id, name) { return commit(renameResident(state, id, name)); },
      removeResident: function (id) { return commit(removeResident(state, id)); },
      restoreResident: function (id) { return commit(restoreResident(state, id)); },
      setPreviousReading: function (id, value) { return commit(setPreviousReading(state, id, value)); },

      // history
      getHistory: function () { return getHistory(state); },
      deleteLatestMonth: function () { return commit(deleteLatestMonth(state)); },
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    createEmptyState: createEmptyState,
    loadState: loadState,
    saveState: saveState,
    createMemoryStorage: createMemoryStorage,
    getActiveResidents: getActiveResidents,
    getPreviousReading: getPreviousReading,
    getMainFormRows: getMainFormRows,
    getLatestEntry: getLatestEntry,
    getHistory: getHistory,
    addResident: addResident,
    renameResident: renameResident,
    removeResident: removeResident,
    restoreResident: restoreResident,
    setPreviousReading: setPreviousReading,
    submitMonth: submitMonth,
    deleteLatestMonth: deleteLatestMonth,
    createApp: createApp,
  };
});
