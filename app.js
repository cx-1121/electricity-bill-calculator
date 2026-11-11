/* Electricity Split: UI layer. All money/validation logic lives in src/calc.js + src/store.js. */
/*
 * startApp(storage, opts) is called by boot.js once storage is ready.
 *   storage: localStorage-shaped object (cloud-backed, or localStorage itself)
 *   opts.cloud: true when the data is shared through Firestore
 *   opts.onLeave(): forget this house on this device
 * Returns { refresh } so boot.js can re-render when another device changes data.
 */
window.startApp = function (storage, opts) {
  'use strict';
  opts = opts || {};

  const Calc = window.BillCalc;
  const Store = window.BillStore;
  let app = Store.createApp(storage);
  const DRAFT_KEY = 'dormElectricitySplit.draft';

  const views = {
    entry: document.getElementById('view-entry'),
    results: document.getElementById('view-results'),
    settings: document.getElementById('view-settings'),
    gate: document.getElementById('view-gate'),
  };
  const live = document.getElementById('live');

  // ---------- icons (one stroke family) ----------

  const I = {
    settings: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M3.5 7h10.5M18.5 7h2M3.5 17h4M12.5 17h8"/><circle cx="16.2" cy="7" r="2.2"/><circle cx="10.2" cy="17" r="2.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" class="ico chev" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    arrow: '<svg viewBox="0 0 22 14" class="ico arrow" aria-hidden="true"><path d="M1 7.5c6-.6 12-.4 18-.2M14.5 2.5 19.5 7l-5 4.6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    image: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 16l5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9" r="1.6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="100" d="M3.5 13.2c2.2 1.5 3.9 3.5 5.4 5.9 2.9-6.1 6.9-11 11.6-15"/></svg>',
    checked: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true" style="stroke-width:2.4"><path d="M4 13c2 1.4 3.5 3.3 4.9 5.5C11.6 12.8 15.2 8.2 20 4.6"/></svg>',
    mark: '<svg viewBox="0 0 20 20" class="ico mark" aria-hidden="true" style="stroke-width:2.2"><path d="M10.4 3c-.3 3.9-.4 7.2-.6 10.4"/><path d="M9.7 16.6l.1.2"/></svg>',
    ring: '<svg class="ring" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="100" d="M16 8.5C36 2 79 2.5 93 10c9 5.5 5 20.5-12 25.5-22 5-58 4-71-4.5C1 25 3 12.5 24 6.5"/></svg>',
  };

  // ---------- helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  const rm = Calc.formatRM;
  function kwh(n) { return Calc.formatKwh(n); }
  function monthName(m) {
    if (!m) return '';
    const p = m.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  }
  function dateName(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------- draft (per-device convenience) ----------

  function defaultMonth() {
    const d = new Date();
    const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return app.getHistory().some(function (h) { return h.month === m; }) ? '' : m;
  }
  function freshDraft() {
    return { month: defaultMonth(), totalKwh: '', totalAmount: '', currents: {}, present: {} };
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && typeof d === 'object') {
        return {
          month: typeof d.month === 'string' ? d.month : '',
          totalKwh: d.totalKwh || '',
          totalAmount: d.totalAmount || '',
          currents: d.currents && typeof d.currents === 'object' ? d.currents : {},
          present: d.present && typeof d.present === 'object' ? d.present : {},
        };
      }
    } catch (e) { /* storage blocked: start clean */ }
    return freshDraft();
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignore */ }
  }
  function clearDraft() {
    draft = freshDraft();
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }
  function isPresent(id) { return draft.present[id] !== false; }

  let draft = loadDraft();

  // ---------- ui state ----------

  const ui = {
    view: 'entry',
    errors: [],
    notice: app.loadError || null,
    result: null,
    meta: null,
    open: new Set(),
    showAll: false,
    editing: null,
    editErrors: [],
    adding: false,
    addErrors: [],
    confirmDelete: false,
  };

  // ---------- error placement ----------

  function placeErrors(errors) {
    const at = {};
    function put(key, msg) { (at[key] = at[key] || []).push(msg); }
    errors.forEach(function (e) {
      switch (e.code) {
        case 'INVALID_TOTAL_KWH': put('totalKwh', 'Write the kWh from the bill, more than 0.'); break;
        case 'INVALID_TOTAL_AMOUNT': put('totalAmount', 'Write the amount from the bill, 0 or more.'); break;
        case 'INVALID_MONTH': put('month', e.message); break;
        case 'DUPLICATE_MONTH': put('month', 'Already saved. Pick another month, or delete it in Settings.'); break;
        case 'MISSING_READING':
          (e.residentIds || []).forEach(function (id) { put('r:' + id, 'Fill in this reading.'); });
          break;
        case 'INVALID_READING': put('r:' + e.residentId, 'That reading isn’t a number.'); break;
        case 'MISSING_PREVIOUS': put('r:' + e.residentId, 'No previous reading. Set it in Settings.'); break;
        case 'READING_BELOW_PREVIOUS': put('r:' + e.residentId, 'Lower than last month. Check the meter.'); break;
        case 'USAGE_EXCEEDS_TOTAL': put('common', 'Room usage exceeds bill usage, check readings.'); break;
        case 'NO_PRESENT': put('present', 'Common cost cannot be split, select at least one resident.'); break;
        case 'NO_RESIDENTS': put('residents', 'Add your housemates in Settings first.'); break;
        default: put('general', e.message);
      }
    });
    return at;
  }

  function errLines(list) {
    return (list || []).map(function (m) {
      return '<div class="line err-line" role="alert">' + I.mark + '<span class="err-text">' + esc(m) + '</span></div>';
    }).join('');
  }

  // ---------- ENTRY ----------

  function usageOf(row) {
    const prev = Calc.parseNumber(row.previous);
    const cur = Calc.parseNumber(draft.currents[row.id]);
    if (!Number.isFinite(prev) || cur === null || !Number.isFinite(cur)) return null;
    return Calc.roundKwh(cur - prev);
  }

  function usageText(row) {
    const u = usageOf(row);
    if (u === null) return { text: '', bad: false };
    return { text: '= ' + kwh(u) + ' kWh', bad: u < 0 };
  }

  function commonText(rows) {
    const total = Calc.parseNumber(draft.totalKwh);
    const sum = rows.reduce(function (s, r) {
      const u = usageOf(r);
      return u === null || s === null ? null : s + u;
    }, 0);
    if (rows.length === 0) return { html: 'waiting for housemates', bad: false };
    if (!Number.isFinite(total)) return { html: 'waiting for Total Usage', bad: false };
    if (sum === null) {
      const missing = rows.filter(function (r) { return usageOf(r) === null; });
      return {
        html: missing.length === 1
          ? 'waiting for ' + esc(missing[0].name) + '’s reading'
          : missing.length + ' readings to go',
        bad: false,
      };
    }
    const common = Calc.roundKwh(total - sum);
    return {
      html: kwh(total) + ' − ' + kwh(sum) + ' = <b>' + kwh(common) + ' kWh</b>',
      bad: common < 0,
    };
  }

  function renderEntry() {
    const rows = app.getMainFormRows();
    const at = placeErrors(ui.errors);
    const cmn = commonText(rows);

    let h = '';
    h += '<header class="page-head">';
    h += '<div class="head-row"><h1 class="title" id="entry-title" tabindex="-1">Electric Bill</h1>';
    h += '<button class="icon-btn" type="button" data-action="settings" aria-label="Settings">' + I.settings + '</button></div>';
    h += '<div class="head-sub"><label class="printed" for="f-month">Billing Month</label>';
    h += '<span class="field' + (at.month ? ' err' : '') + '"><input class="ink-in" type="month" id="f-month" value="' + esc(draft.month) + '" aria-invalid="' + !!at.month + '"></span></div>';
    h += '</header>';

    h += '<div class="ruled">';
    if (ui.notice) h += errLines([ui.notice]);
    h += errLines(at.month);
    h += errLines(at.general);

    h += '<div class="line"><h2 class="sec">The bill</h2></div>';
    h += fieldLine('totalKwh', 'Total Usage (kWh)', 'kWh', at.totalKwh);
    h += errLines(at.totalKwh);
    h += fieldLine('totalAmount', 'Total Bill Amount (RM)', 'RM', at.totalAmount);
    h += errLines(at.totalAmount);
    h += '<div class="line" aria-hidden="true"></div>';

    h += '<div class="line"><h2 class="sec">Rooms</h2></div>';
    if (rows.length === 0) {
      h += '<div class="line"><span class="pencil">No housemates written in yet.</span></div>';
      h += '<div class="line"><button class="pen-btn" type="button" data-action="settings-add">' + I.plus + 'Add housemates</button></div>';
      h += errLines(at.residents);
    }
    rows.forEach(function (r) {
      const key = 'r:' + r.id;
      const u = usageText(r);
      const bad = !!at[key];
      h += '<div class="line">';
      h += '<span class="room-name grow truncate">' + esc(r.name) + '</span>';
      h += '<label class="tick"><input type="checkbox" data-present="' + esc(r.id) + '"' + (isPresent(r.id) ? ' checked' : '') + '>';
      h += '<span class="box">' + I.tick + '</span><span class="printed">Present</span></label>';
      h += '</div>';
      h += '<div class="line">';
      h += '<span class="pencil prev"><span class="printed">Prev </span>' + (r.previous == null ? '—' : esc(kwh(r.previous))) + '</span>';
      h += I.arrow;
      h += '<span class="field' + (bad ? ' err' : '') + '"><input class="ink-in num" id="cur-' + esc(r.id) + '" data-current="' + esc(r.id) + '" inputmode="decimal" autocomplete="off" placeholder="reading" aria-label="Current Meter Reading for ' + esc(r.name) + '" aria-invalid="' + bad + '" value="' + esc(draft.currents[r.id] || '') + '"></span>';
      h += '<span class="pencil usage-out right' + (u.bad ? ' bad' : '') + '" data-usage="' + esc(r.id) + '">' + esc(u.text) + '</span>';
      h += '</div>';
      h += errLines(at[key]);
    });
    h += errLines(at.present);
    h += '<div class="line" aria-hidden="true"></div>';

    h += '<div class="line sum-line"><span class="label">Common Usage</span>';
    h += '<span class="pencil right' + (cmn.bad ? ' bad' : '') + '" id="common-out" aria-live="polite">' + cmn.html + '</span></div>';
    h += errLines(at.common);

    h += '<div class="line tall"><button class="stamp" type="button" data-action="submit"' + (rows.length ? '' : ' disabled') + '>Submit</button></div>';
    h += '<div class="line"><span class="pencil truncate">Submit also saves these readings.</span></div>';
    h += '</div>';

    views.entry.innerHTML = h;
  }

  function fieldLine(key, label, unit, err) {
    const id = 'f-' + key;
    return '<div class="line"><label class="label grow" for="' + id + '">' + esc(label) + '</label>' +
      '<span class="field' + (err ? ' err' : '') + '"><input class="ink-in num" id="' + id + '" data-bill="' + key + '" inputmode="decimal" autocomplete="off" placeholder="' + unit + '" aria-invalid="' + !!err + '" value="' + esc(draft[key]) + '"></span></div>';
  }

  function refreshLive() {
    const rows = app.getMainFormRows();
    rows.forEach(function (r) {
      const out = views.entry.querySelector('[data-usage="' + CSS.escape(r.id) + '"]');
      if (!out) return;
      const u = usageText(r);
      out.textContent = u.text;
      out.classList.toggle('bad', u.bad);
    });
    const c = commonText(rows);
    const out = document.getElementById('common-out');
    if (out) { out.innerHTML = c.html; out.classList.toggle('bad', c.bad); }
  }

  function clearFieldError(input) {
    const field = input.closest('.field');
    if (!field || !field.classList.contains('err')) return;
    field.classList.remove('err');
    input.setAttribute('aria-invalid', 'false');
    let line = input.closest('.line').nextElementSibling;
    while (line && line.classList.contains('err-line')) {
      const next = line.nextElementSibling;
      line.remove();
      line = next;
    }
  }

  function submit(btn) {
    const rows = app.getMainFormRows();
    const entries = {};
    rows.forEach(function (r) {
      entries[r.id] = { current: draft.currents[r.id], present: isPresent(r.id) };
    });
    const res = app.submit({
      month: draft.month,
      totalKwh: draft.totalKwh,
      totalAmount: draft.totalAmount,
      entries: entries,
    });

    if (!res.ok) {
      ui.errors = res.errors;
      ui.notice = null;
      renderEntry();
      const first = views.entry.querySelector('[aria-invalid="true"]') || views.entry.querySelector('.err-line');
      if (first) {
        first.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        if (first.focus) first.focus({ preventScroll: true });
      }
      say(res.errors.length === 1 ? '1 thing to fix: ' + res.errors[0].message : res.errors.length + ' things to fix.');
      return;
    }

    if (btn && !reduceMotion.matches) btn.classList.add('thump');
    ui.errors = [];
    ui.notice = res.saveError || null;
    ui.result = res.result;
    ui.meta = { month: res.entry.month, submittedAt: res.entry.submittedAt, fromHistory: false };
    ui.open = new Set();
    ui.showAll = false;
    clearDraft();
    setTimeout(function () { show('results'); }, btn && !reduceMotion.matches ? 260 : 0);
  }

  // ---------- RESULTS ----------

  function renderResults() {
    const r = ui.result;
    const m = ui.meta || {};
    if (!r) { views.results.innerHTML = ''; return; }
    const rate = Calc.formatRate(r.effectiveRate);

    let h = '<header class="page-head">';
    h += '<div class="head-row"><div class="back-row"><button class="icon-btn" type="button" data-action="' + (m.fromHistory ? 'settings' : 'entry') + '" aria-label="' + (m.fromHistory ? 'Back to Settings' : 'Back to the bill') + '">' + I.back + '</button>';
    h += '<h1 class="title" id="results-title" tabindex="-1">Who pays what</h1></div></div>';
    h += '<div class="head-sub"><span class="printed">Billing Month</span><span class="head-note">' + esc(m.month ? monthName(m.month) : 'Not given') + '</span>';
    if (m.fromHistory && m.submittedAt) h += '<span class="pencil right">saved ' + esc(dateName(m.submittedAt)) + '</span>';
    h += '</div></header>';

    h += '<div class="ruled">';
    if (ui.notice) h += errLines([ui.notice]);
    h += summaryLine('Total Bill Amount', rm(r.totalAmountSen), 'RM');
    h += summaryLine('Total Usage', kwh(r.totalKwh), 'kWh');
    h += summaryLine('Effective Rate', rate, 'RM/kWh');
    h += summaryLine('Common Usage', kwh(r.commonKwh), 'kWh');
    h += summaryLine('Common Cost', rm(r.commonCostSen), 'RM');
    h += '<div class="line" aria-hidden="true"></div>';

    h += '<div class="line"><h2 class="sec grow">To pay</h2>';
    h += '<button class="pen-btn quiet" type="button" data-action="toggle-all" aria-pressed="' + ui.showAll + '">' + (ui.showAll ? 'Hide working' : 'Show all working') + '</button></div>';

    r.residents.forEach(function (p, i) {
      const open = ui.showAll || ui.open.has(p.id);
      h += '<button class="line payee" type="button" data-payee="' + esc(p.id) + '" aria-expanded="' + open + '" aria-controls="work-' + esc(p.id) + '">';
      h += I.chev + '<span class="pay-name truncate">' + esc(p.name) + '</span>';
      h += '<span class="pencil num pay-kwh">' + esc(kwh(p.usageKwh)) + ' kWh</span><span class="leader" aria-hidden="true"></span>';
      h += '<span class="amount num" style="--i:' + i + '"><span class="rm">RM</span>' + rm(p.paySen) + I.ring + '</span>';
      h += '</button>';
      h += '<div id="work-' + esc(p.id) + '"' + (open ? '' : ' hidden') + '>';
      h += workLine(kwh(p.usageKwh) + ' kWh × ' + rate + ' = <b>' + rm(p.roomCostSen) + '</b>', 'Room usage');
      if (p.present) {
        h += workLine('Common share ' + rm(r.commonCostSen) + ' ÷ ' + r.presentCount + ' = <b>' + rm(p.shareSen) + '</b>');
      } else {
        h += workLine('Not present, no common share');
      }
      if (p.adjustmentSen !== 0) {
        h += workLine('Rounding adjustment ' + (p.adjustmentSen > 0 ? '+' : '−') + rm(Math.abs(p.adjustmentSen)), null, 'adj');
      }
      h += workLine('Total to pay = <b>RM ' + rm(p.paySen) + '</b>', null, 'total');
      h += '</div>';
    });

    const matches = r.totalPaidSen === r.totalAmountSen;
    h += '<div class="line grand"><span class="label">Total</span>';
    h += '<span class="' + (matches ? 'checked' : 'check-bad') + '">' + (matches ? I.checked + '<span class="pencil" style="color:inherit">matches bill</span>' : '<span class="pencil" style="color:inherit">doesn’t match bill</span>') + '</span>';
    h += '<span class="val num"><small>RM</small> ' + rm(r.totalPaidSen) + '</span></div>';
    h += '<div class="line" aria-hidden="true"></div>';

    h += '<div class="line"><button class="pen-btn" type="button" data-action="save-image">' + I.image + 'Save report image</button>';
    h += '<span class="pencil right" id="image-status" aria-live="polite"></span></div>';
    h += '<div class="line">';
    if (m.fromHistory) {
      h += '<button class="pen-btn" type="button" data-action="settings">' + I.back + 'Back to history</button>';
    } else {
      h += '<button class="pen-btn" type="button" data-action="entry">' + I.plus + 'Next month</button>';
      h += '<span class="pencil right">Saved ' + esc(dateName(m.submittedAt)) + '</span>';
    }
    h += '</div>';
    h += '</div>';

    views.results.innerHTML = h;
  }

  function summaryLine(label, value, unit) {
    return '<div class="line"><span class="label">' + esc(label) + '</span><span class="leader" aria-hidden="true"></span>' +
      '<span class="val num">' + esc(value) + '<small>' + esc(unit) + '</small></span></div>';
  }

  function workLine(html, label, cls) {
    return '<div class="line work' + (cls ? ' ' + cls : '') + '"><span class="pencil">' + (label ? esc(label) + ': ' : '') + html + '</span></div>';
  }

  // ---------- SETTINGS ----------

  function renderSettings() {
    const state = app.getState();
    const active = state.residents.filter(function (r) { return r.active; });
    const gone = state.residents.filter(function (r) { return !r.active; });
    const history = app.getHistory();

    let h = '<header class="page-head">';
    h += '<div class="head-row"><div class="back-row"><button class="icon-btn" type="button" data-action="entry" aria-label="Back to the bill">' + I.back + '</button>';
    h += '<h1 class="title" id="settings-title" tabindex="-1">Settings</h1></div></div>';
    h += '<div class="head-sub"><span class="pencil">Housemates and past months.</span></div>';
    h += '</header>';

    h += '<div class="ruled">';
    if (ui.notice) h += errLines([ui.notice]);

    // housemates
    h += '<div class="line"><h2 class="sec grow">Housemates</h2><span class="printed">' + active.length + ' living here</span></div>';
    if (active.length === 0 && !ui.adding) {
      h += '<div class="line"><span class="pencil">Nobody yet. Add each room’s housemate.</span></div>';
    }
    active.forEach(function (r) {
      const prev = Store.getPreviousReading(state, r.id);
      if (ui.editing === r.id) {
        h += '<div class="line"><label class="printed inline-label" for="ed-name">Name</label>';
        h += '<input class="ink-in wide grow" id="ed-name" value="' + esc(r.name) + '" autocomplete="off" maxlength="40"></div>';
        h += '<div class="line"><label class="printed inline-label" for="ed-prev">Previous reading</label>';
        h += '<input class="ink-in num grow" id="ed-prev" inputmode="decimal" autocomplete="off" value="' + esc(prev == null ? '' : prev) + '"></div>';
        h += '<div class="line"><span class="pencil">Only change the reading if the meter was reset or replaced.</span></div>';
        h += errLines(ui.editErrors);
        h += '<div class="line"><button class="pen-btn" type="button" data-action="save-edit" data-id="' + esc(r.id) + '">Save</button>';
        h += '<button class="pen-btn quiet" type="button" data-action="cancel-edit">Cancel</button>';
        h += '<button class="pen-btn danger right" type="button" data-action="remove" data-id="' + esc(r.id) + '">Move out</button></div>';
      } else {
        h += '<div class="line"><span class="hand bold grow truncate">' + esc(r.name) + '</span>';
        h += '<span class="pencil">prev ' + (prev == null ? '—' : esc(kwh(prev))) + (typeof r.previousOverride === 'number' ? ' (reset)' : '') + '</span>';
        h += '<button class="icon-btn sm" type="button" data-action="edit" data-id="' + esc(r.id) + '" aria-label="Edit ' + esc(r.name) + '">' + I.edit + '</button></div>';
      }
    });

    if (ui.adding) {
      h += '<div class="line"><label class="printed inline-label" for="add-name">Name</label>';
      h += '<input class="ink-in wide grow" id="add-name" autocomplete="off" maxlength="40" placeholder="housemate"></div>';
      h += '<div class="line"><label class="printed inline-label" for="add-reading">Initial meter reading</label>';
      h += '<input class="ink-in num grow" id="add-reading" inputmode="decimal" autocomplete="off" placeholder="reading"></div>';
      h += errLines(ui.addErrors);
      h += '<div class="line"><button class="pen-btn" type="button" data-action="add">' + I.plus + 'Add</button>';
      h += '<button class="pen-btn quiet" type="button" data-action="cancel-add">Cancel</button></div>';
    } else {
      h += '<div class="line"><button class="pen-btn" type="button" data-action="start-add">' + I.plus + 'Add housemate</button></div>';
    }

    if (gone.length) {
      h += '<div class="line" aria-hidden="true"></div>';
      h += '<div class="line"><h2 class="sec">Moved out</h2></div>';
      gone.forEach(function (r) {
        h += '<div class="line"><span class="struck grow truncate">' + esc(r.name) + '</span>';
        h += '<button class="pen-btn quiet" type="button" data-action="restore" data-id="' + esc(r.id) + '">Move back in</button></div>';
      });
    }

    // history
    h += '<div class="line" aria-hidden="true"></div>';
    h += '<div class="line"><h2 class="sec grow">History</h2><span class="printed">' + history.length + (history.length === 1 ? ' month' : ' months') + '</span></div>';
    if (history.length === 0) {
      h += '<div class="line"><span class="pencil">Nothing submitted yet.</span></div>';
    }
    history.forEach(function (m, i) {
      const title = m.month ? monthName(m.month) : 'No month · ' + dateName(m.submittedAt);
      h += '<button class="line hist-row" type="button" data-history="' + i + '">';
      h += '<span class="hand grow truncate' + (i === 0 && ui.confirmDelete ? ' strike-out' : '') + '">' + esc(title) + '</span>';
      h += '<span class="pencil num">' + esc(kwh(m.totalKwh)) + ' kWh</span>';
      h += '<span class="val num"><small>RM</small> ' + esc(rm(Calc.toSen(m.totalAmount))) + '</span>';
      h += I.chev + '</button>';
      if (i === 0) {
        if (ui.confirmDelete) {
          const before = history[1];
          h += '<div class="line err-line">' + I.mark + '<span class="err-text">Delete? Readings roll back to ' + esc(before ? (before.month ? monthName(before.month) : 'the month before') : 'the start') + '.</span></div>';
          h += '<div class="line"><button class="pen-btn danger" type="button" data-action="confirm-delete">Delete this month</button>';
          h += '<button class="pen-btn quiet" type="button" data-action="cancel-delete">Keep it</button></div>';
        } else {
          h += '<div class="line"><button class="pen-btn danger" type="button" data-action="ask-delete">Delete latest month</button>';
          h += '<span class="pencil right">if it was a mistake</span></div>';
        }
      }
    });

    // this device
    h += '<div class="line" aria-hidden="true"></div>';
    h += '<div class="line"><h2 class="sec">This device</h2></div>';
    if (opts.cloud) {
      h += '<div class="line"><span class="pencil truncate">Shared: every phone with the passcode sees this.</span></div>';
      h += '<div class="line"><button class="pen-btn quiet" type="button" data-action="leave-house">Leave this house on this device</button></div>';
    } else {
      h += '<div class="line"><span class="pencil truncate">Saved on this device only.</span></div>';
    }
    h += '</div>';

    views.settings.innerHTML = h;
  }

  function saveEdit(id) {
    const state = app.getState();
    const r = state.residents.find(function (x) { return x.id === id; });
    const name = document.getElementById('ed-name').value;
    const prevRaw = document.getElementById('ed-prev').value;
    const errors = [];
    if (name.trim() !== r.name) {
      const res = app.renameResident(id, name);
      if (!res.ok) errors.push.apply(errors, res.errors.map(function (e) { return e.message; }));
      else if (res.saveError) ui.notice = res.saveError;
    }
    const oldPrev = Store.getPreviousReading(app.getState(), id);
    const newPrev = Calc.parseNumber(prevRaw);
    if (newPrev !== oldPrev) {
      const res = app.setPreviousReading(id, prevRaw);
      if (!res.ok) errors.push.apply(errors, res.errors.map(function (e) { return e.message; }));
      else if (res.saveError) ui.notice = res.saveError;
    }
    if (errors.length) {
      ui.editErrors = errors;
    } else {
      ui.editing = null;
      ui.editErrors = [];
      say('Saved.');
    }
    renderSettings();
    focusFirst(views.settings, errors.length ? '#ed-name' : '[data-action="edit"][data-id="' + CSS.escape(id) + '"]');
    return errors.length === 0;
  }

  function addResident() {
    const res = app.addResident(document.getElementById('add-name').value, document.getElementById('add-reading').value);
    if (!res.ok) {
      ui.addErrors = res.errors.map(function (e) { return e.message; });
      renderSettings();
      focusFirst(views.settings, '#add-name');
      return false;
    }
    if (res.saveError) ui.notice = res.saveError;
    ui.addErrors = [];
    ui.adding = true; // keep the add lines open for the next housemate
    renderSettings();
    const n = document.getElementById('add-name');
    if (n) n.focus();
    say(res.resident.name + ' added.');
    return true;
  }

  // ---------- report image ----------

  async function saveReportImage(btn) {
    const status = document.getElementById('image-status');
    if (!ui.result || !window.ReportImage) return;
    btn.disabled = true;
    status.textContent = 'Drawing…';
    try {
      const blob = await window.ReportImage.render(ui.result, ui.meta || {});
      const name = 'electric-bill-' + ((ui.meta && ui.meta.month) || 'report') + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      // Phones: open the share sheet (WhatsApp, Photos…). Elsewhere: download.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Electric bill ' + monthName((ui.meta || {}).month) });
          status.textContent = 'Shared';
        } catch (e) {
          status.textContent = e && e.name === 'AbortError' ? '' : 'Couldn’t share';
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        status.textContent = 'Saved ' + name;
      }
    } catch (e) {
      console.error(e);
      status.textContent = 'Couldn’t make the image';
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- unsaved changes guard ----------

  function unsavedWork() {
    if (ui.view !== 'settings') return null;
    if (ui.editing) {
      const nameEl = document.getElementById('ed-name');
      const prevEl = document.getElementById('ed-prev');
      const state = app.getState();
      const r = state.residents.find(function (x) { return x.id === ui.editing; });
      if (!r || !nameEl || !prevEl) return null;
      const prev = Store.getPreviousReading(state, r.id);
      const changed = nameEl.value.trim() !== r.name || Calc.parseNumber(prevEl.value) !== prev;
      return changed ? { kind: 'edit', id: r.id, name: r.name } : null;
    }
    if (ui.adding) {
      const n = document.getElementById('add-name');
      const v = document.getElementById('add-reading');
      if (n && v && (n.value.trim() || v.value.trim())) return { kind: 'add', name: n.value.trim() };
    }
    return null;
  }

  // Controls that resolve the edit themselves never trigger the guard.
  const GUARD_SAFE = new Set(['save-edit', 'cancel-edit', 'remove', 'add', 'cancel-add']);
  const dlg = document.getElementById('unsaved');
  let dlgProceed = null;
  let dlgWork = null;

  function askUnsaved(work, proceed) {
    dlgWork = work;
    dlgProceed = proceed;
    document.getElementById('unsaved-text').textContent = work.kind === 'edit'
      ? 'You changed ' + work.name + ' but didn’t save.'
      : (work.name || 'This housemate') + ' hasn’t been added yet.';
    dlg.querySelector('[data-unsaved="save"]').textContent = work.kind === 'edit' ? 'Save changes' : 'Add now';
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else if (window.confirm(document.getElementById('unsaved-text').textContent + ' Save it?')) resolveUnsaved('save');
    else resolveUnsaved('discard');
  }

  function resolveUnsaved(choice) {
    if (dlg.open) dlg.close();
    const work = dlgWork, proceed = dlgProceed;
    dlgWork = dlgProceed = null;
    if (!work) return;
    if (choice === 'save') {
      const ok = work.kind === 'edit' ? saveEdit(work.id) : addResident();
      if (!ok) return; // errors are now shown in red pen; stay here
      if (work.kind === 'add') ui.adding = false;
      proceed();
    } else if (choice === 'discard') {
      ui.editing = null; ui.editErrors = [];
      ui.adding = false; ui.addErrors = [];
      proceed();
    } else {
      focusFirst(views.settings, work.kind === 'edit' ? '#ed-prev' : '#add-name');
    }
  }

  dlg.addEventListener('click', function (ev) {
    const b = ev.target.closest('[data-unsaved]');
    if (b) resolveUnsaved(b.dataset.unsaved);
  });
  dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); resolveUnsaved('keep'); });

  window.addEventListener('beforeunload', function (ev) {
    if (unsavedWork()) { ev.preventDefault(); ev.returnValue = ''; }
  });

  function openHistory(i) {
    const m = app.getHistory()[i];
    if (!m) return;
    const res = Calc.calculate({
      totalKwh: m.totalKwh,
      totalAmount: m.totalAmount,
      residents: m.residents.map(function (r) {
        return { id: r.id, name: r.name, previous: r.previous, current: r.reading, present: r.present };
      }),
    });
    if (!res.ok) {
      ui.notice = 'This month’s saved numbers could not be recalculated.';
      renderSettings();
      return;
    }
    ui.result = res.result;
    ui.meta = { month: m.month, submittedAt: m.submittedAt, fromHistory: true };
    ui.open = new Set();
    ui.showAll = false;
    show('results');
  }

  function focusFirst(root, sel) {
    const el = root.querySelector(sel);
    if (el) el.focus();
  }

  // ---------- navigation ----------

  function render(view) {
    if (view === 'entry') renderEntry();
    else if (view === 'results') renderResults();
    else renderSettings();
  }

  function show(view, opts) {
    const from = ui.view;
    ui.view = view;
    render(view);
    ['entry', 'results', 'settings'].forEach(function (k) { views[k].hidden = k !== view; });
    views.gate.hidden = true;
    const page = views[view];
    page.classList.remove('turn');
    if (!reduceMotion.matches && from !== view) {
      void page.offsetWidth;
      page.classList.add('turn');
    }
    window.scrollTo(0, 0);
    if (!(opts && opts.noFocus)) {
      const t = page.querySelector('.title');
      if (t) t.focus({ preventScroll: true });
    }
  }

  // ---------- events ----------

  document.addEventListener('click', function (ev) {
    const t = ev.target.closest('[data-action], [data-payee], [data-history]');
    if (!t || t.closest('#unsaved')) return;
    const work = unsavedWork();
    if (work && !GUARD_SAFE.has(t.dataset.action)) {
      askUnsaved(work, function () { handle(t); });
      return;
    }
    handle(t);
  });

  function handle(t) {
    if (t.dataset.payee) {
      const id = t.dataset.payee;
      const open = t.getAttribute('aria-expanded') !== 'true';
      if (open) ui.open.add(id); else ui.open.delete(id);
      t.setAttribute('aria-expanded', String(open));
      document.getElementById('work-' + id).hidden = !open;
      return;
    }
    if (t.dataset.history) { openHistory(Number(t.dataset.history)); return; }

    switch (t.dataset.action) {
      case 'settings':
        ui.notice = null; ui.editing = null; ui.confirmDelete = false;
        show('settings'); break;
      case 'settings-add':
        ui.notice = null; ui.adding = true; ui.addErrors = [];
        show('settings', { noFocus: true });
        focusFirst(views.settings, '#add-name');
        break;
      case 'entry':
        ui.notice = null; ui.adding = false; ui.editing = null; ui.confirmDelete = false;
        if (!draft.month) draft.month = defaultMonth();
        show('entry'); break;
      case 'submit': submit(t); break;
      case 'toggle-all':
        ui.showAll = !ui.showAll;
        if (!ui.showAll) ui.open = new Set();
        renderResults();
        views.results.classList.remove('turn');
        focusFirst(views.results, '[data-action="toggle-all"]');
        break;
      case 'edit':
        ui.editing = t.dataset.id; ui.editErrors = []; ui.adding = false;
        renderSettings(); focusFirst(views.settings, '#ed-name'); break;
      case 'cancel-edit':
        const was = ui.editing;
        ui.editing = null; ui.editErrors = [];
        renderSettings();
        focusFirst(views.settings, '[data-action="edit"][data-id="' + CSS.escape(was || '') + '"]');
        break;
      case 'save-edit': saveEdit(t.dataset.id); break;
      case 'remove': {
        const res = app.removeResident(t.dataset.id);
        if (res.saveError) ui.notice = res.saveError;
        ui.editing = null;
        renderSettings();
        say('Moved out. Their history is kept.');
        break;
      }
      case 'restore': {
        const res = app.restoreResident(t.dataset.id);
        if (!res.ok) ui.notice = res.errors[0].message;
        else if (res.saveError) ui.notice = res.saveError;
        renderSettings();
        break;
      }
      case 'start-add':
        ui.adding = true; ui.addErrors = []; ui.editing = null;
        renderSettings(); focusFirst(views.settings, '#add-name'); break;
      case 'cancel-add':
        ui.adding = false; ui.addErrors = [];
        renderSettings(); focusFirst(views.settings, '[data-action="start-add"]'); break;
      case 'add': addResident(); break;
      case 'ask-delete':
        ui.confirmDelete = true;
        renderSettings(); focusFirst(views.settings, '[data-action="cancel-delete"]'); break;
      case 'cancel-delete':
        ui.confirmDelete = false;
        renderSettings(); focusFirst(views.settings, '[data-action="ask-delete"]'); break;
      case 'leave-house':
        if (opts.onLeave) opts.onLeave();
        break;
      case 'confirm-delete': {
        const res = app.deleteLatestMonth();
        ui.confirmDelete = false;
        if (res.saveError) ui.notice = res.saveError;
        if (!draft.month) draft.month = defaultMonth();
        renderSettings();
        say('Latest month deleted. Previous readings restored.');
        break;
      }
      case 'save-image': saveReportImage(t); break;
    }
  }

  document.addEventListener('input', function (ev) {
    const el = ev.target;
    if (el.dataset.bill) {
      draft[el.dataset.bill] = el.value;
      clearFieldError(el);
      saveDraft(); refreshLive();
    } else if (el.dataset.current) {
      draft.currents[el.dataset.current] = el.value;
      clearFieldError(el);
      saveDraft(); refreshLive();
    } else if (el.id === 'f-month') {
      draft.month = el.value;
      clearMonthErrors(el);
      saveDraft();
    }
  });

  function clearMonthErrors(el) {
    const f = el.closest('.field');
    if (f && f.classList.contains('err')) {
      f.classList.remove('err');
      el.setAttribute('aria-invalid', 'false');
      ui.errors = ui.errors.filter(function (e) { return e.code !== 'INVALID_MONTH' && e.code !== 'DUPLICATE_MONTH'; });
      views.entry.querySelectorAll('.ruled > .err-line').forEach(function (n) {
        if (/month|Already saved/i.test(n.textContent)) n.remove();
      });
    }
  }

  document.addEventListener('change', function (ev) {
    const el = ev.target;
    if (el.dataset.present) {
      draft.present[el.dataset.present] = el.checked;
      saveDraft();
      if (ui.errors.some(function (e) { return e.code === 'NO_PRESENT'; }) && el.checked) {
        ui.errors = ui.errors.filter(function (e) { return e.code !== 'NO_PRESENT'; });
        views.entry.querySelectorAll('.err-line').forEach(function (n) {
          if (/select at least one/.test(n.textContent)) n.remove();
        });
      }
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    const el = ev.target;
    if (el.id === 'add-name' || el.id === 'add-reading') { ev.preventDefault(); addResident(); }
    else if (el.id === 'ed-name' || el.id === 'ed-prev') { ev.preventDefault(); saveEdit(ui.editing); }
    else if (el.dataset && (el.dataset.current || el.dataset.bill)) {
      ev.preventDefault();
      const inputs = Array.prototype.slice.call(views.entry.querySelectorAll('input.ink-in'));
      const next = inputs[inputs.indexOf(el) + 1];
      if (next) next.focus(); else views.entry.querySelector('.stamp').focus();
    }
  });

  // ---------- boot ----------

  views.gate.hidden = true;
  const hasResidents = app.getMainFormRows().length > 0;
  if (!hasResidents && app.getHistory().length === 0) {
    ui.adding = true;
    show('settings', { noFocus: true });
    views.settings.classList.remove('turn');
  } else {
    show('entry', { noFocus: true });
    views.entry.classList.remove('turn');
  }

  // ---------- another device changed the data ----------

  // Re-render at once, but keep whatever this person has typed and where the caret is.
  function refresh() {
    app = Store.createApp(storage);
    if (ui.view === 'results') return; // a results page is a snapshot of one month
    const page = views[ui.view];
    const typed = {};
    page.querySelectorAll('input[id]:not([type="checkbox"])').forEach(function (el) { typed[el.id] = el.value; });
    const a = document.activeElement;
    const focus = a && a.id && page.contains(a)
      ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
    render(ui.view);
    Object.keys(typed).forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.type !== 'month') el.value = typed[id];
    });
    if (focus) {
      const el = document.getElementById(focus.id);
      if (el) {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(focus.s, focus.e); } catch (e) { /* month inputs */ }
      }
    }
    say('Updated from another device.');
  }

  return { refresh: refresh };
};
