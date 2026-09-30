/* m06-mse.js — the mean squared error of two tank estimators, drawn.
 *
 * One demo, `mse`. For each sample, each estimator's error θ̂ − θ is a red
 * segment on the axis, and its square is drawn on that segment, so the area
 * of the square is (θ̂ − θ)². Earlier squares stay as faint outlines. Above
 * them, three squares show the mean over the samples so far:
 * bias² + variance = MSE, as areas that add up.
 *
 * Same draws as the tanks demo in m06-estimators.js (seed 606, N = 300,
 * n = 5 captured), so the numbers match slides 15 to 17. The variance here
 * divides by the number of samples, so MSE = bias² + variance holds exactly.
 *
 * Attributes: data-k (tanks per sample, default 5), data-seed (606).
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06 || !M06.rng) throw new Error('Load m06-core.js before m06-mse.js');
  M06.sims = M06.sims || {};
  var col = M06.col, fmt = M06.fmt;

  function r1(x) { return Math.round(x * 10) / 10; }
  function num(x) { return fmt.num(x, 0); }
  function signed(x) {
    var a = fmt.num(Math.abs(x), 0);
    return a === '0' ? '0' : (x > 0 ? '+' : '−') + a;
  }
  function attrs(el, o) { for (var key in o) el.setAttribute(key, o[key]); return el; }
  function show(el, on) { el.setAttribute('visibility', on ? 'visible' : 'hidden'); }

  // Mean, bias, variance (divided by the count) and MSE of a set of estimates.
  M06.sims.mse = {
    summary: function (v, truth) {
      var n = v.length, m = 0, i;
      for (i = 0; i < n; i++) m += v[i];
      m /= n;
      var vr = 0, ms = 0;
      for (i = 0; i < n; i++) { vr += (v[i] - m) * (v[i] - m); ms += (v[i] - truth) * (v[i] - truth); }
      return { n: n, mean: m, bias: m - truth, variance: vr / n, mse: ms / n };
    },
    // n samples from a fresh generator, as the demo draws them.
    run: function (o) {
      o = o || {};
      var T = M06.sims.tanks, N = 300, k = o.k || 5, n = o.n == null ? 1000 : o.n;
      var r = M06.rng(o.seed == null ? 606 : o.seed), a = [], b = [];
      for (var c = 0; c < n; c++) { var e = T.estimates(T.capture(r, N, k)).est; a.push(e[0]); b.push(e[1]); }
      return [M06.sims.mse.summary(a, N), M06.sims.mse.summary(b, N)];
    }
  };

  M06.demos.mse = function (root, opts) {
    var T = M06.sims.tanks;
    if (!T) throw new Error('Load m06-estimators.js before m06-mse.js');
    var N = 300, k = parseInt(opts.k, 10) || 5, seed = parseInt(opts.seed, 10) || 606;
    var W = 960, H = 440, AX = 398, PX = 0.7, TOP = 226, RING = 40;
    var svg = M06.svg(root, W, H, 'For two estimators of N, each sample error drawn as a segment and its square, ' +
      'and the mean squared error split into bias squared plus variance');
    var defsUid = 'm06mse' + Math.floor(Math.random() * 1e9);
    var defs = M06.el('defs', {}, svg);

    M06.text(svg, W / 2, 18, 'Area of each square = (θ̂ − θ)². Top row: means over all samples so far.',
      { size: 15, fill: col.grey, anchor: 'middle' });

    var panels = [
      { L: 40, title: '1. Sample maximum', j: 0 },
      { L: 520, title: '2. Twice the sample mean, minus 1', j: 1 }
    ];

    panels.forEach(function (p, idx) {
      p.sx = M06.scale(0, 600, p.L, p.L + 420);
      var g = M06.g(svg);
      M06.text(g, p.L, 48, p.title, { size: 17, fill: col.ink, weight: 700 });

      // The trio: bias² + variance = MSE, bottom-aligned at yT.
      p.yT = 196;
      p.trio = M06.g(g, { visibility: 'hidden' });
      p.sqB = M06.el('rect', { fill: col.pale, stroke: col.red, 'stroke-width': 2 }, p.trio);
      p.sqV = M06.el('rect', { fill: col.faint, stroke: col.axis, 'stroke-width': 2 }, p.trio);
      p.sqM = M06.el('rect', { fill: '#ffffff', stroke: col.ink, 'stroke-width': 2.5 }, p.trio);
      p.plus = M06.text(p.trio, 0, p.yT - 8, '+', { size: 22, fill: col.ink, anchor: 'middle', weight: 700 });
      p.eq = M06.text(p.trio, 0, p.yT - 8, '=', { size: 22, fill: col.ink, anchor: 'middle', weight: 700 });
      p.labB = M06.text(p.trio, 0, p.yT + 18, '', { size: 14, fill: col.red, anchor: 'middle', weight: 700 });
      p.labV = M06.text(p.trio, 0, p.yT + 18, '', { size: 14, fill: col.axis, anchor: 'middle', weight: 700 });
      p.labM = M06.text(p.trio, 0, p.yT + 18, '', { size: 14, fill: col.ink, anchor: 'middle', weight: 700 });

      // Squares on the axis, clipped so a rare huge error cannot cover the trio.
      var cid = defsUid + '-' + idx;
      var cp = M06.el('clipPath', { id: cid }, defs);
      M06.el('rect', { x: p.L - 2, y: TOP, width: 424, height: AX - TOP + 2 }, cp);
      var sq = M06.g(g, { 'clip-path': 'url(#' + cid + ')' });
      p.ring = [];
      for (var i = 0; i < RING; i++) {
        p.ring.push(M06.el('rect', { fill: 'none', stroke: col.mid, 'stroke-width': 1, 'stroke-opacity': 0.55, visibility: 'hidden' }, sq));
      }
      p.cur = M06.el('rect', { fill: col.pale, 'fill-opacity': 0.85, stroke: col.red, 'stroke-width': 2, visibility: 'hidden' }, sq);

      M06.axisX(g, p.sx, AX, [0, 100, 200, 300, 400, 500, 600], function (v) { return fmt.num(v, 0); });
      var xT = p.sx(N);
      M06.el('line', { x1: r1(xT), x2: r1(xT), y1: TOP + 10, y2: AX, stroke: col.red, 'stroke-width': 2.5 }, g);
      M06.text(g, xT + 6, TOP + 20, 'θ = N = 300', { size: 15, fill: col.red, weight: 700 });

      // The mean of the estimates so far (dashed) and the bias between it and θ.
      p.meanG = M06.g(g, { visibility: 'hidden' });
      p.meanLine = M06.el('line', { y1: TOP + 40, y2: AX, stroke: col.red, 'stroke-width': 2, 'stroke-dasharray': '7 5' }, p.meanG);
      p.biasBar = M06.el('line', { y1: TOP + 44, y2: TOP + 44, stroke: col.red, 'stroke-width': 2 }, p.meanG);
      p.biasLab = M06.text(p.meanG, 0, TOP + 40, '', { size: 14, fill: col.red, anchor: 'end', weight: 700 });

      // The current sample: the error segment, the estimate and the labels.
      p.seg = M06.el('line', { y1: AX, y2: AX, stroke: col.red, 'stroke-width': 5, visibility: 'hidden' }, g);
      p.dot = M06.el('circle', { cy: AX, r: 6, fill: col.red, visibility: 'hidden' }, g);
      p.errLab = M06.text(g, 0, AX + 46, '', { size: 15, fill: col.red, anchor: 'middle', weight: 700 });
      p.sqLab = M06.text(g, 0, 0, '', { size: 15, fill: col.red, anchor: 'middle', weight: 700 });
    });

    var bar = M06.controls(root), out = M06.readout(root);
    var r, vals, count, anim = null;

    function place(p, est, grow) {
      // The error segment and its square, grown by the factor grow (0 to 1).
      var xT = p.sx(N), xE = p.sx(est), e = est - N;
      var w = Math.abs(xE - xT) * grow;
      var xs = e < 0 ? xT - w : xT;
      attrs(p.seg, { x1: r1(xT), x2: r1(e < 0 ? xT - w : xT + w) });
      attrs(p.cur, { x: r1(xs), y: r1(AX - w), width: r1(w), height: r1(w) });
      attrs(p.dot, { cx: r1(xE) });
      show(p.seg, true); show(p.cur, true); show(p.dot, true);
      if (grow >= 1) {
        p.errLab.textContent = 'θ̂ − θ = ' + signed(e);
        attrs(p.errLab, { x: r1(Math.min(Math.max((xT + xE) / 2, p.L + 60), p.L + 360)) });
        p.sqLab.textContent = '(θ̂ − θ)² = ' + num(e * e);
        var ly = Math.max(AX - Math.abs(xE - xT) - 8, TOP + 64);
        attrs(p.sqLab, { x: r1(Math.min(Math.max((xT + xE) / 2, p.L + 70), p.L + 350)), y: r1(ly) });
      } else {
        p.errLab.textContent = ''; p.sqLab.textContent = '';
      }
    }
    // Faint outlines of the most recent squares, the current one excluded.
    function ring(p) {
      var v = vals[p.j], n = v.length;
      for (var i = 0; i < RING; i++) {
        var idx = n - 2 - i, el = p.ring[i];
        if (idx < 0) { show(el, false); continue; }
        var xT = p.sx(N), xE = p.sx(v[idx]), w = Math.abs(xE - xT);
        attrs(el, { x: r1(Math.min(xT, xE)), y: r1(AX - w), width: r1(w), height: r1(w) });
        show(el, true);
      }
    }
    function trio(p) {
      var v = vals[p.j];
      if (v.length < 2) { show(p.trio, false); show(p.meanG, false); return null; }
      var s = M06.sims.mse.summary(v, N);
      var sB = Math.abs(s.bias) * PX, sV = Math.sqrt(s.variance) * PX, sM = Math.sqrt(s.mse) * PX;
      var slot = function (side) { return Math.max(side, 92); };
      var x1 = p.L + 6, w1 = slot(sB), x2 = x1 + w1 + 30, w2 = slot(sV), x3 = x2 + w2 + 30, w3 = slot(sM);
      attrs(p.sqB, { x: r1(x1 + (w1 - sB) / 2), y: r1(p.yT - sB), width: r1(sB), height: r1(sB) });
      attrs(p.sqV, { x: r1(x2 + (w2 - sV) / 2), y: r1(p.yT - sV), width: r1(sV), height: r1(sV) });
      attrs(p.sqM, { x: r1(x3 + (w3 - sM) / 2), y: r1(p.yT - sM), width: r1(sM), height: r1(sM) });
      attrs(p.plus, { x: r1(x1 + w1 + 15) }); attrs(p.eq, { x: r1(x2 + w2 + 15) });
      p.labB.textContent = 'bias² ' + num(s.bias * s.bias); attrs(p.labB, { x: r1(x1 + w1 / 2) });
      p.labV.textContent = 'variance ' + num(s.variance); attrs(p.labV, { x: r1(x2 + w2 / 2) });
      p.labM.textContent = 'MSE ' + num(s.mse); attrs(p.labM, { x: r1(x3 + w3 / 2) });
      show(p.trio, true);
      var xT = p.sx(N), xM = p.sx(s.mean);
      attrs(p.meanLine, { x1: r1(xM), x2: r1(xM) });
      attrs(p.biasBar, { x1: r1(Math.min(xT, xM)), x2: r1(Math.max(xT, xM)) });
      p.biasLab.textContent = 'bias ' + signed(s.bias);
      attrs(p.biasLab, { x: r1(Math.min(xT, xM) - 6) });
      show(p.meanG, true);
      return s;
    }
    function update() {
      var s = panels.map(trio);
      out.innerHTML = 'Samples: ' + num(count) + (s[0] ? '<span class="sep">·</span>MSE: estimator 1 <b>' + num(s[0].mse) +
        '</b>, estimator 2 <b>' + num(s[1].mse) + '</b>' : '');
    }
    function next() {
      var e = T.estimates(T.capture(r, N, k)).est;
      vals[0].push(e[0]); vals[1].push(e[1]); count++;
      return e;
    }
    function stop() { if (anim) { anim.cancel(); anim = null; } }
    function drawOne() {
      stop();
      var e = next();
      panels.forEach(ring);
      anim = M06.animate(600, function (t) {
        var g = M06.ease(t);
        panels.forEach(function (p) { place(p, e[p.j], g); });
      }, function () {
        anim = null;
        panels.forEach(function (p) { place(p, e[p.j], 1); });
        update();
      });
      update();
    }
    function drawMany(m) {
      stop();
      var target = count + m, per = Math.ceil(m / 90), last = null;
      anim = M06.frames(function () {
        for (var i = 0; i < per && count < target; i++) last = next();
        panels.forEach(function (p) { ring(p); place(p, last[p.j], 1); });
        update();
        return count < target;
      }, function () { anim = null; });
    }
    function reset() {
      stop();
      r = M06.rng(seed); vals = [[], []]; count = 0;
      panels.forEach(function (p) {
        p.ring.forEach(function (el) { show(el, false); });
        show(p.cur, false); show(p.seg, false); show(p.dot, false);
        p.errLab.textContent = ''; p.sqLab.textContent = '';
        show(p.trio, false); show(p.meanG, false);
      });
      update();
    }
    M06.button(bar, 'Draw one sample', drawOne);
    M06.button(bar, 'Draw 1,000 samples', function () { drawMany(1000); });
    M06.button(bar, 'Reset', reset);
    reset();
  };
})();
