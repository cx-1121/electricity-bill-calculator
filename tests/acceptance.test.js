// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../src/calc');
const Store = require('../src/store');

function codes(res) {
  return res.errors.map((e) => e.code);
}

function bySen(result) {
  const out = {};
  result.residents.forEach((r) => { out[r.name] = r.paySen; });
  return out;
}

// ---------- Test 1: basic ----------

test('Test 1: basic split from the proposal', () => {
  const res = Calc.calculate({
    totalKwh: 400,
    totalAmount: 200,
    residents: [
      { id: 'a', name: 'A', previous: 1000, current: 1100, present: true },
      { id: 'b', name: 'B', previous: 500, current: 580, present: true },
      { id: 'c', name: 'C', previous: 0, current: 60, present: true },
      { id: 'd', name: 'D', previous: 20, current: 60, present: false },
    ],
  });
  assert.equal(res.ok, true);
  const r = res.result;
  assert.equal(Calc.formatRate(r.effectiveRate), '0.5000');
  assert.equal(r.commonKwh, 120);
  assert.equal(r.commonCostSen, 6000);
  assert.equal(r.shareSen, 2000);
  assert.deepEqual(bySen(r), { A: 7000, B: 6000, C: 5000, D: 2000 });
  assert.equal(r.totalPaidSen, 20000);
  assert.equal(r.roundingResidentId, null);

  const d = r.residents[3];
  assert.equal(d.steps[1].text, 'Not present, no common share');
  assert.equal(r.residents[0].steps[0].text, '100 kWh × 0.5000 = RM 50.00');
  assert.equal(r.residents[0].steps.at(-1).text, 'RM 70.00');
});

// ---------- Test 2: rounding ----------

test('Test 2: uneven split still sums exactly to the bill', () => {
  const res = Calc.calculate({
    totalKwh: 300,
    totalAmount: '100.00',
    residents: [
      { id: 'a', name: 'A', previous: 0, current: 50, present: true },
      { id: 'b', name: 'B', previous: 0, current: 70, present: true },
      { id: 'c', name: 'C', previous: 0, current: 30, present: true },
    ],
  });
  assert.equal(res.ok, true);
  const r = res.result;
  assert.equal(r.totalPaidSen, 10000);
  assert.equal(r.roundingResidentId, 'a');
  assert.notEqual(r.roundingAdjustmentSen, 0);
  const a = r.residents[0];
  assert.ok(a.steps.some((s) => s.label === 'Rounding adjustment'));
  assert.equal(a.roomCostSen + a.shareSen + a.adjustmentSen, a.paySen);
  // others have no adjustment line
  assert.ok(!r.residents[1].steps.some((s) => s.label === 'Rounding adjustment'));
});

test('Test 2b: randomised bills always sum exactly', () => {
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 7);
    const residents = [];
    let used = 0;
    for (let j = 0; j < n; j++) {
      const prev = Math.round(rand() * 50000) / 10;
      const usage = Math.round(rand() * 2000) / 10;
      used += usage;
      residents.push({ id: 'r' + j, name: 'R' + j, previous: prev, current: Calc.roundKwh(prev + usage), present: rand() > 0.3 });
    }
    residents[Math.floor(rand() * n)].present = true;
    const totalKwh = Calc.roundKwh(used + rand() * 300 + 0.1);
    const totalAmount = Math.round(rand() * 100000) / 100;
    const res = Calc.calculate({ totalKwh, totalAmount, residents });
    assert.equal(res.ok, true, JSON.stringify(res.errors));
    assert.equal(res.result.totalPaidSen, Calc.toSen(totalAmount));
    res.result.residents.forEach((r) => {
      assert.equal(r.roomCostSen + r.shareSen + r.adjustmentSen, r.paySen);
    });
  }
});

test('single present resident pays all common cost', () => {
  const res = Calc.calculate({
    totalKwh: 100, totalAmount: 50,
    residents: [
      { id: 'a', name: 'A', previous: 0, current: 20, present: true },
      { id: 'b', name: 'B', previous: 0, current: 30, present: false },
    ],
  });
  assert.equal(res.ok, true);
  assert.deepEqual(bySen(res.result), { A: 1000 + 2500, B: 1500 });
});

test('money helpers', () => {
  assert.equal(Calc.toSen(1.005), 101);
  assert.equal(Calc.toSen(200), 20000);
  assert.equal(Calc.formatRM(7), '0.07');
  assert.equal(Calc.formatRM(-1), '-0.01');
  assert.equal(Calc.liveCommonUsage('400', [{ previous: 0, current: 100 }, { previous: 10, current: 190 }]), 120);
  assert.equal(Calc.liveCommonUsage('400', [{ previous: 0, current: '' }]), null);
});

// ---------- Test 3: validation ----------

const base = () => ({
  totalKwh: 400,
  totalAmount: 200,
  residents: [
    { id: 'a', name: 'A', previous: 100, current: 200, present: true },
    { id: 'b', name: 'B', previous: 100, current: 150, present: true },
  ],
});

test('Test 3: each validation rule fires', () => {
  let i = base(); i.totalKwh = 0;
  assert.ok(codes(Calc.validate(i)).includes('INVALID_TOTAL_KWH'));
  i = base(); i.totalKwh = '';
  assert.ok(codes(Calc.validate(i)).includes('INVALID_TOTAL_KWH'));
  i = base(); i.totalAmount = -1;
  assert.ok(codes(Calc.validate(i)).includes('INVALID_TOTAL_AMOUNT'));
  i = base(); i.totalAmount = 0;
  assert.equal(Calc.validate(i).ok, true);

  i = base(); i.residents[1].current = '';
  assert.deepEqual(codes(Calc.validate(i)), ['MISSING_READING']);

  i = base(); i.residents[1].current = 99;
  const below = Calc.validate(i);
  assert.deepEqual(codes(below), ['READING_BELOW_PREVIOUS']);
  assert.equal(below.errors[0].residentId, 'b');

  i = base(); i.totalKwh = 100;
  assert.deepEqual(codes(Calc.validate(i)), ['USAGE_EXCEEDS_TOTAL']);

  i = base(); i.residents.forEach((r) => { r.present = false; });
  assert.deepEqual(codes(Calc.validate(i)), ['NO_PRESENT']);
});

test('Test 3: blocked submit saves nothing', () => {
  const storage = Store.createMemoryStorage();
  const app = Store.createApp(storage);
  const a = app.addResident('Alex', 100).resident;
  const before = storage.getItem(Store.STORAGE_KEY);

  const res = app.submit({ totalKwh: 0, totalAmount: 10, entries: { [a.id]: { current: 150, present: true } } });
  assert.equal(res.ok, false);
  assert.equal(storage.getItem(Store.STORAGE_KEY), before);
  assert.equal(app.getHistory().length, 0);

  const res2 = app.submit({ totalKwh: 100, totalAmount: 10, entries: { [a.id]: { current: '', present: true } } });
  assert.deepEqual(codes(res2), ['MISSING_READING']);
  assert.equal(app.getHistory().length, 0);
});

// ---------- Test 4: history ----------

test('Test 4: readings carry over after reload, delete latest restores them', () => {
  const storage = Store.createMemoryStorage();
  let app = Store.createApp(storage);
  const ids = ['A', 'B', 'C', 'D'].map((n, k) => app.addResident(n, 1000 + k * 100).resident.id);

  const oct = app.submit({
    month: '2026-10', totalKwh: 400, totalAmount: 200,
    entries: {
      [ids[0]]: { current: 1100, present: true },
      [ids[1]]: { current: 1180, present: true },
      [ids[2]]: { current: 1260, present: true },
      [ids[3]]: { current: 1340, present: false },
    },
  });
  assert.equal(oct.ok, true);
  assert.equal(oct.entry.payments[ids[0]], 70);

  app = Store.createApp(storage); // simulate page reload
  assert.deepEqual(app.getMainFormRows().map((r) => r.previous), [1100, 1180, 1260, 1340]);

  const nov = app.submit({
    month: '2026-11', totalKwh: 300, totalAmount: 150,
    entries: Object.fromEntries(ids.map((id, k) => [id, { current: [1150, 1230, 1300, 1400][k] }])),
  });
  assert.equal(nov.ok, true);
  assert.deepEqual(app.getMainFormRows().map((r) => r.previous), [1150, 1230, 1300, 1400]);

  // duplicate month blocked
  const dup = app.submit({ month: '2026-11', totalKwh: 300, totalAmount: 150, entries: {} });
  assert.ok(codes(dup).includes('DUPLICATE_MONTH'));

  app = Store.createApp(storage);
  assert.equal(app.getHistory()[0].month, '2026-11');
  assert.equal(app.deleteLatestMonth().ok, true);
  app = Store.createApp(storage);
  assert.deepEqual(app.getMainFormRows().map((r) => r.previous), [1100, 1180, 1260, 1340]);
  app.deleteLatestMonth();
  assert.deepEqual(app.getMainFormRows().map((r) => r.previous), [1000, 1100, 1200, 1300]);
  assert.equal(app.deleteLatestMonth().ok, false);
});

// ---------- Settings ----------

test('Settings: add, rename, remove, override previous reading', () => {
  const storage = Store.createMemoryStorage();
  const app = Store.createApp(storage);

  assert.deepEqual(codes(app.addResident('', '')), ['NAME_REQUIRED', 'INITIAL_READING_REQUIRED']);
  const alex = app.addResident('Alex', 500).resident;
  const bo = app.addResident('Bo', 600).resident;
  assert.deepEqual(codes(app.addResident('alex', 1)), ['NAME_TAKEN']);
  assert.equal(app.renameResident(bo.id, 'Bob').ok, true);

  app.submit({ month: '2026-10', totalKwh: 100, totalAmount: 50, entries: { [alex.id]: { current: 520 }, [bo.id]: { current: 630 } } });

  assert.equal(app.removeResident(bo.id).ok, true);
  assert.deepEqual(app.getMainFormRows().map((r) => r.name), ['Alex']);
  const hist = app.getHistory()[0].residents.find((r) => r.id === bo.id);
  assert.equal(hist.name, 'Bob');
  assert.equal(hist.active, false);

  // meter replaced: override until next submit
  app.setPreviousReading(alex.id, 0);
  assert.equal(app.getMainFormRows()[0].previous, 0);
  app.submit({ month: '2026-11', totalKwh: 100, totalAmount: 50, entries: { [alex.id]: { current: 40 } } });
  assert.equal(app.getMainFormRows()[0].previous, 40);
  assert.equal(app.getState().residents.find((r) => r.id === alex.id).previousOverride, null);

  // new resident after history uses their initial reading
  const cy = app.addResident('Cy', 77).resident;
  assert.equal(app.getMainFormRows().find((r) => r.id === cy.id).previous, 77);
});

test('Storage errors are caught, not thrown', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
  };
  const app = Store.createApp(broken);
  assert.match(app.loadError, /denied/);
  const res = app.addResident('Alex', 1);
  assert.equal(res.ok, true);
  assert.match(res.saveError, /quota/);

  const garbage = Store.createMemoryStorage();
  garbage.setItem(Store.STORAGE_KEY, '{not json');
  assert.ok(Store.createApp(garbage).loadError);
});
