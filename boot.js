/* Boot: house passcode gate -> Firestore shared storage -> startApp. */
(function () {
  'use strict';

  const HOUSE_KEY = 'dormElectricitySplit.house';
  const LOCAL_KEY = 'dormElectricitySplit.v1';
  const Cloud = window.CloudSync;
  const gate = document.getElementById('view-gate');
  const sync = document.getElementById('sync');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  const STATUS = {
    saved: 'Synced',
    saving: 'Saving…',
    offline: 'Offline · will sync',
    error: 'Not saved',
    local: 'This device only',
  };
  function setStatus(s, e) {
    sync.textContent = STATUS[s] || '';
    sync.dataset.state = s;
    if (s === 'error' && e) console.error('Sync failed:', e);
  }

  const markIcon = '<svg viewBox="0 0 20 20" class="ico mark" aria-hidden="true" style="stroke-width:2.2"><path d="M10.4 3c-.3 3.9-.4 7.2-.6 10.4"/><path d="M9.7 16.6l.1.2"/></svg>';
  function errLine(msg) {
    return msg ? '<div class="line err-line" role="alert">' + markIcon + '<span class="err-text">' + esc(msg) + '</span></div>' : '';
  }

  // ---------- local-only fallback (no Firebase config) ----------

  function startLocal() {
    setStatus('local');
    window.startApp(null, { cloud: false });
  }

  // ---------- cloud ----------

  async function startCloud(houseId) {
    setStatus('saving');
    let api = null;
    try {
      const conn = await Cloud.connect(houseId, {
        onRemote: function () { if (api) api.refresh(); },
        onStatus: setStatus,
      });
      api = window.startApp(conn.storage, {
        cloud: true,
        onLeave: function () {
          conn.stop();
          lsDel(HOUSE_KEY);
          location.reload();
        },
      });
    } catch (e) {
      console.error(e);
      setStatus('error');
      renderGate({ error: 'Couldn’t reach the shared notebook. Check the connection and try again.' });
    }
  }

  // ---------- passcode gate ----------

  let gateState = { error: '', notFound: false, busy: false, houseId: null };

  function renderGate(patch) {
    gateState = Object.assign({}, gateState, patch || {});
    const s = gateState;
    ['view-entry', 'view-results', 'view-settings'].forEach(function (id) {
      document.getElementById(id).hidden = true;
    });
    let h = '<header class="page-head">';
    h += '<div class="head-row"><h1 class="title" id="gate-title" tabindex="-1">Electric Bill</h1></div>';
    h += '<div class="head-sub"><span class="pencil">The house notebook, shared by passcode.</span></div>';
    h += '</header><div class="ruled">';
    h += '<div class="line"><h2 class="sec">Open your house</h2></div>';
    h += '<form id="gate-form" autocomplete="off">';
    h += '<div class="line"><label class="label grow" for="gate-pass">House passcode</label>';
    h += '<span class="field' + (s.error ? ' err' : '') + '"><input class="ink-in" id="gate-pass" type="password" placeholder="passcode" autocomplete="current-password" minlength="4" aria-invalid="' + !!s.error + '"></span></div>';
    h += errLine(s.error);
    if (s.notFound) {
      h += '<div class="line"><span class="pencil truncate">No house uses this passcode yet.</span></div>';
      h += '<div class="line"><button class="pen-btn" type="button" data-gate="create"' + (s.busy ? ' disabled' : '') + '>Start a new house with it</button>';
      h += '<button class="pen-btn quiet" type="button" data-gate="retry">Try again</button></div>';
    } else {
      h += '<div class="line tall"><button class="stamp" type="submit"' + (s.busy ? ' disabled' : '') + '>Open</button></div>';
    }
    h += '</form>';
    h += '<div class="line"><span class="pencil truncate">Everyone in the house uses the same passcode.</span></div>';
    h += '</div>';
    gate.innerHTML = h;
    gate.hidden = false;
    const input = document.getElementById('gate-pass');
    if (s.pass) input.value = s.pass;
    input.focus();
  }

  async function tryOpen(pass) {
    pass = String(pass || '').trim();
    if (pass.length < 4) {
      renderGate({ error: 'Use at least 4 characters.', notFound: false, pass: pass });
      return;
    }
    renderGate({ busy: true, error: '', pass: pass });
    try {
      const houseId = await Cloud.hashPasscode(pass);
      const exists = await Cloud.houseExists(houseId);
      if (!exists) {
        renderGate({ busy: false, notFound: true, houseId: houseId, pass: pass });
        return;
      }
      lsSet(HOUSE_KEY, houseId);
      gate.hidden = true;
      startCloud(houseId);
    } catch (e) {
      console.error(e);
      renderGate({ busy: false, error: 'Couldn’t check the passcode. Check the connection.', pass: pass });
    }
  }

  async function createHouse() {
    const s = gateState;
    renderGate({ busy: true });
    try {
      // Carry over anything already saved on this device.
      await Cloud.createHouse(s.houseId, lsGet(LOCAL_KEY));
      lsSet(HOUSE_KEY, s.houseId);
      gate.hidden = true;
      startCloud(s.houseId);
    } catch (e) {
      console.error(e);
      renderGate({ busy: false, error: 'Couldn’t create the house. Check the connection.' });
    }
  }

  gate.addEventListener('submit', function (ev) {
    ev.preventDefault();
    tryOpen(document.getElementById('gate-pass').value);
  });
  gate.addEventListener('click', function (ev) {
    const t = ev.target.closest('[data-gate]');
    if (!t) return;
    if (t.dataset.gate === 'create') createHouse();
    if (t.dataset.gate === 'retry') renderGate({ notFound: false, error: '', pass: '' });
  });

  // ---------- go ----------

  if (!Cloud || !Cloud.isConfigured()) {
    startLocal();
    return;
  }
  const saved = lsGet(HOUSE_KEY);
  if (saved && /^[0-9a-f]{64}$/.test(saved)) startCloud(saved);
  else renderGate();
})();
