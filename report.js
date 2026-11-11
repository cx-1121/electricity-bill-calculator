/*
 * ReportImage.render(result, meta) -> Promise<Blob PNG>
 * Draws the month's results as a ledger page on a canvas: the same notebook
 * world as the app (feint rules, red margin, ballpoint amounts circled),
 * with every person's working on its own line so the image explains itself.
 */
(function () {
  'use strict';

  const Calc = window.BillCalc;
  const C = {
    cover: '#2443a6', paper: '#fbfcfe', rule: '#c5d3ef', margin: '#e2636b',
    ink: '#1f3fa6', inkStrong: '#142d85', print: '#1b1f2e', print2: '#4b5269',
    pencil: '#5f6679', faint: '#a9b0c0', red: '#c22a35', staple: '#eef1f6',
  };
  const W = 540, R = 44, MX = 58, GUT = 22, BIND = 26, HEAD = 128, SCALE = 2;
  const PRINT = '"Archivo", "Arial Narrow", sans-serif';
  const HAND = '"Kalam", "Segoe Print", cursive';

  function monthName(m) {
    if (!m) return 'No month given';
    const p = m.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  }
  function dateName(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function fontsReady() {
    if (!document.fonts) return;
    await Promise.all([
      document.fonts.load('800 30px Archivo'), document.fonts.load('500 15px Archivo'),
      document.fonts.load('700 22px Kalam'), document.fonts.load('400 16px Kalam'),
    ]).catch(function () {});
  }

  function buildLines(r) {
    const rate = Calc.formatRate(r.effectiveRate);
    const L = [];
    L.push({ t: 'sum', label: 'Total Bill Amount', value: Calc.formatRM(r.totalAmountSen), unit: 'RM' });
    L.push({ t: 'sum', label: 'Total Usage', value: Calc.formatKwh(r.totalKwh), unit: 'kWh' });
    L.push({ t: 'sum', label: 'Effective Rate', value: rate, unit: 'RM/kWh' });
    L.push({ t: 'sum', label: 'Common Usage', value: Calc.formatKwh(r.commonKwh), unit: 'kWh' });
    L.push({ t: 'sum', label: 'Common Cost', value: Calc.formatRM(r.commonCostSen), unit: 'RM' });
    L.push({ t: 'blank' });
    L.push({ t: 'sec', text: 'TO PAY' });
    r.residents.forEach(function (p) {
      L.push({ t: 'payee', p: p });
      let w = Calc.formatKwh(p.usageKwh) + ' kWh × ' + rate + ' = ' + Calc.formatRM(p.roomCostSen);
      w += p.present
        ? '  +  ' + Calc.formatRM(r.commonCostSen) + ' ÷ ' + r.presentCount + ' = ' + Calc.formatRM(p.shareSen)
        : '  ·  not present';
      if (p.adjustmentSen) w += '  ·  rounding ' + (p.adjustmentSen > 0 ? '+' : '−') + Calc.formatRM(Math.abs(p.adjustmentSen));
      L.push({ t: 'work', text: w });
    });
    L.push({ t: 'total' });
    L.push({ t: 'blank' });
    L.push({ t: 'foot' });
    return L;
  }

  function fit(ctx, text, max, font, minSize) {
    let size = font.size;
    ctx.font = font.weight + ' ' + size + 'px ' + font.family;
    while (ctx.measureText(text).width > max && size > minSize) {
      size -= 0.5;
      ctx.font = font.weight + ' ' + size + 'px ' + font.family;
    }
    return text;
  }

  function dots(ctx, x1, x2, y) {
    if (x2 - x1 < 10) return;
    ctx.save();
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1.6; ctx.setLineDash([1.2, 3.6]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.restore();
  }

  // The app's hand-drawn ring, mapped into a box.
  function ring(ctx, x, y, w, h) {
    const f = function (px, py) { return [x + px / 100 * w, y + py / 40 * h]; };
    const pts = [[16, 8.5], [36, 2], [79, 2.5], [93, 10], [102, 15.5], [98, 30.5], [81, 35.5],
      [59, 40.5], [23, 39.5], [10, 31], [1, 25], [3, 12.5], [24, 6.5]].map(function (p) { return f(p[0], p[1]); });
    ctx.save();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 3) {
      ctx.bezierCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function tick(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.2, y - s * 0.32, x + s * 0.32, y - s * 0.15, x + s * 0.42, y);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 0.5, x + s * 0.8, y - s * 0.8, x + s, y - s);
    ctx.stroke();
    ctx.restore();
  }

  async function render(result, meta) {
    await fontsReady();
    const lines = buildLines(result);
    const H = BIND + HEAD + lines.length * R + R;
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';

    // paper + binding
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.cover; ctx.fillRect(0, 0, W, BIND);
    ctx.fillStyle = C.staple;
    [W * 0.24, W * 0.76 - 36].forEach(function (x) { ctx.fillRect(x, BIND - 2, 36, 3); });

    // header band
    const top = BIND + HEAD;
    ctx.fillStyle = C.print;
    ctx.font = '800 32px ' + PRINT;
    if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
    ctx.fillText('WHO PAYS WHAT', MX, BIND + 58);
    if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
    ctx.fillStyle = C.print2;
    ctx.font = '600 11.5px ' + PRINT;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.2px';
    ctx.fillText('BILLING MONTH', MX, BIND + 98);
    const lw = ctx.measureText('BILLING MONTH').width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = C.ink; ctx.font = '400 20px ' + HAND;
    ctx.fillText(monthName(meta.month), MX + lw + 12, BIND + 99);
    ctx.fillStyle = C.margin;
    ctx.fillRect(0, top - 5, W, 1); ctx.fillRect(0, top - 2, W, 1);

    // rules + margin
    ctx.fillStyle = C.rule;
    for (let i = 1; i <= lines.length + 1; i++) ctx.fillRect(0, top + i * R - 1, W, 1);
    ctx.fillStyle = C.margin;
    ctx.fillRect(MX - 18, top, 1, H - top); ctx.fillRect(MX - 14, top, 1, H - top);

    const right = W - GUT;
    lines.forEach(function (ln, i) {
      const base = top + (i + 1) * R - 10;
      if (ln.t === 'sum') {
        ctx.fillStyle = C.print; ctx.font = '500 15px ' + PRINT;
        ctx.fillText(ln.label, MX, base);
        const lab = ctx.measureText(ln.label).width;
        ctx.font = '400 15px ' + HAND; const uw = ctx.measureText(ln.unit).width;
        ctx.fillStyle = C.pencil; ctx.textAlign = 'right'; ctx.fillText(ln.unit, right, base);
        ctx.font = '400 22px ' + HAND; ctx.fillStyle = C.ink;
        const vx = right - uw - 4; ctx.fillText(ln.value, vx, base);
        const vw = ctx.measureText(ln.value).width;
        ctx.textAlign = 'left';
        dots(ctx, MX + lab + 8, vx - vw - 8, base - 2);
      } else if (ln.t === 'sec') {
        ctx.fillStyle = C.print; ctx.font = '800 14px ' + PRINT;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        ctx.fillText(ln.text, MX, base - 2);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      } else if (ln.t === 'payee') {
        const p = ln.p;
        ctx.font = '700 25px ' + HAND; const amt = Calc.formatRM(p.paySen); const aw = ctx.measureText(amt).width;
        ctx.font = '400 15px ' + HAND; const rmw = ctx.measureText('RM').width;
        const ax = right - 12 - aw, rx = ax - 5 - rmw;
        ring(ctx, rx - 14, base - 30, right + 2 - (rx - 14), 40);
        ctx.fillStyle = C.pencil; ctx.fillText('RM', rx, base);
        ctx.fillStyle = C.inkStrong; ctx.font = '700 25px ' + HAND; ctx.fillText(amt, ax, base);
        ctx.fillStyle = C.ink;
        fit(ctx, p.name, rx - 120 - MX, { weight: 700, size: 24, family: HAND }, 15);
        ctx.fillText(p.name, MX, base);
        const nw = ctx.measureText(p.name).width;
        ctx.fillStyle = C.pencil; ctx.font = '400 16px ' + HAND;
        const k = Calc.formatKwh(p.usageKwh) + ' kWh';
        ctx.fillText(k, MX + nw + 10, base);
        dots(ctx, MX + nw + 10 + ctx.measureText(k).width + 8, rx - 22, base - 2);
      } else if (ln.t === 'work') {
        ctx.fillStyle = C.pencil;
        fit(ctx, ln.text, right - MX - 16, { weight: 400, size: 16, family: HAND }, 11);
        ctx.fillText(ln.text, MX + 16, base);
      } else if (ln.t === 'total') {
        ctx.fillStyle = C.print; ctx.font = '500 15px ' + PRINT; ctx.fillText('Total', MX, base);
        ctx.font = '700 25px ' + HAND; const amt = Calc.formatRM(result.totalPaidSen); const aw = ctx.measureText(amt).width;
        ctx.fillStyle = C.inkStrong; ctx.textAlign = 'right'; ctx.fillText(amt, right, base);
        ctx.font = '600 13px ' + PRINT; ctx.fillStyle = C.print2;
        const rmx = right - aw - 6; ctx.fillText('RM', rmx, base);
        ctx.textAlign = 'left';
        const ux = rmx - ctx.measureText('RM').width - 2;
        ctx.fillStyle = C.ink; ctx.fillRect(ux, base + 4, right - ux, 1.4); ctx.fillRect(ux, base + 7.5, right - ux, 1.4);
        const ok = result.totalPaidSen === result.totalAmountSen;
        ctx.font = '400 16px ' + HAND; ctx.fillStyle = ok ? C.ink : C.red;
        const msg = ok ? 'matches bill' : 'doesn’t match bill';
        const mw = ctx.measureText(msg).width;
        const mx = ux - 14 - mw; ctx.fillText(msg, mx, base);
        if (ok) tick(ctx, mx - 22, base - 2, 16);
      } else if (ln.t === 'foot') {
        ctx.fillStyle = C.pencil; ctx.font = '400 15px ' + HAND;
        ctx.fillText('Saved ' + dateName(meta.submittedAt), MX, base);
        ctx.fillStyle = C.print2; ctx.font = '600 10.5px ' + PRINT; ctx.textAlign = 'right';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1.2px';
        ctx.fillText('ELECTRICITY SPLIT', right, base);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.textAlign = 'left';
      }
    });

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('toBlob failed')); }, 'image/png');
    });
  }

  window.ReportImage = { render: render };
})();
