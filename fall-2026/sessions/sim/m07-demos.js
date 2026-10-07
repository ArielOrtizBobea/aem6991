/* m07-demos.js — the animations and figures for meeting 7, model failures.
 *
 * Built on m06-core.js (the M06 namespace: rng, scales, axes, controls),
 * so a slide holds <div class="m06" data-demo="NAME"></div> as in meeting 6.
 *
 *   coverage      100 intervals, three estimators: unbiased with the right
 *                 standard error, biased by 1.5 SD, and unbiased with the
 *                 standard error reported at half its true value.
 *   selection     A retention email sent to 30% of 10,000 customers, chosen
 *                 more or less on a renewal score. The email adds 2 points.
 *   attenuation   Classical measurement error in income (X) or in spend (Y).
 *   nonclassical  Mean-reverting measurement error in income (X), which
 *                 biases the slope away from zero, or in spend (Y), which
 *                 biases it toward zero.
 *   simultaneity  Weekly prices and quantities set by shifting supply and
 *                 demand (Working 1927).
 *   hetero        Placebo samples of 400 firms whose error SD grows with the
 *                 regressor. Default against heteroskedasticity-robust SEs.
 *   panel         Placebo laws in a 50-state, 21-year panel with serially
 *                 correlated outcomes. Default against SEs clustered by state.
 *   cluster       Placebo experiments: 20 stores of 50 shoppers, 10 stores
 *                 treated, no effect. Default against clustered standard errors.
 *   spatial       A placebo program on a 40 × 40 grid of counties, with
 *                 spatially correlated yields. Default against Conley SEs.
 *   subgroups     One coupon test cut into 20 subgroups, no effect in any.
 *   mde           The minimum detectable effect of a clustered design
 *                 against units per cluster, with sliders for the
 *                 intraclass correlation and the between-store variance
 *                 that strata explain.
 *   power         1,000 coupon tests with a 1-point effect: power, the
 *                 minimum detectable effect, and the exaggeration of the
 *                 significant estimates, as the sample size changes.
 *   controls      Good and bad controls on one graph, 1,000 samples.
 *   overlap       Store sizes of adopters and non-adopters (static).
 *   lalondeDesign The design of LaLonde's test: the experiment against
 *                 the same trainees compared with survey men (static).
 *   lalonde       Experimental and non-experimental estimates of one
 *                 training program (static).
 *
 * The simulations live in M06.sims.m07 and touch no DOM, so they run under
 * Node for checking the numbers quoted in the speaker notes:
 *   node -e "global.window=global; require('./m06-core.js');
 *            require('./m07-demos.js'); console.log(M06.sims.m07.controls.run(1000))"
 * Everything is seeded: Reset replays the same draws.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06 || !M06.rng) throw new Error('Load m06-core.js before m07-demos.js');
  M06.sims = M06.sims || {};
  var S = (M06.sims.m07 = {});
  var col = M06.col, fmt = M06.fmt;

  // ---- small helpers ------------------------------------------------------------
  var SEP = '<span class="sep">·</span>', DASH = '—', MINUS = '−';
  function bold(s) { return '<b>' + s + '</b>'; }
  function num(x, d) { return fmt.num(x, d); }
  function num0(x) { return fmt.num(x, 0); }
  function pct(x, d) { return fmt.pct(x, d == null ? 0 : d); }
  function signed(x, d) { return (x > 0 ? '+' : '') + fmt.num(x, d); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ticks(a, b, step) {
    var out = [];
    for (var v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function intOpt(v, dflt) { var n = parseInt(v, 10); return n > 0 ? n : dflt; }
  function attrs(el, o) { for (var k in o) el.setAttribute(k, o[k]); return el; }
  function show(el, on) { el.setAttribute('visibility', on ? 'visible' : 'hidden'); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function tallest(bins) { return Math.max.apply(null, bins); }
  var uidN = 0;
  function uid(p) { uidN += 1; return 'm07-' + p + '-' + uidN; }
  function summary(v) {
    return { count: v.length, mean: v.length ? M06.mean(v) : null, sd: v.length >= 2 ? M06.sd(v) : null };
  }
  function binOf(v, lo, hi, nb) {
    if (!(v >= lo && v <= hi)) return -1;
    return Math.min(nb - 1, Math.floor((v - lo) / ((hi - lo) / nb)));
  }
  function logistic(x) { return 1 / (1 + Math.exp(-x)); }

  // One animation at a time. run() finishes whatever is running first, so a
  // click never leaves a half-drawn state. cancel() just stops.
  function runner() {
    var cur = null;
    function stop(finish) {
      var c = cur;
      cur = null;
      if (!c) return;
      c.anim.cancel();
      if (finish) { c.step(1); if (c.end) c.end(); }
    }
    return {
      run: function (ms, step, end) {
        stop(true);
        var c = { step: step, end: end };
        cur = c;
        c.anim = M06.animate(ms, step, function () {
          if (cur !== c) return;
          cur = null;
          if (end) end();
        });
      },
      finish: function () { stop(true); },
      cancel: function () { stop(false); }
    };
  }

  // An outline histogram: one path for the fill and one for the edge, drawn
  // only across the occupied bins.
  function stepHist(parent, sx, y0, h, lo, hi, nb, color) {
    var bins = new Array(nb).fill(0), bw = (hi - lo) / nb;
    var fill = M06.el('path', { fill: color, 'fill-opacity': 0.14, stroke: 'none' }, parent);
    var edge = M06.el('path', { fill: 'none', stroke: color, 'stroke-width': 2.5 }, parent);
    var api = {
      bins: bins,
      add: function (v) { var k = binOf(v, lo, hi, nb); if (k >= 0) bins[k]++; },
      clear: function () { bins.fill(0); },
      color: function (c) { fill.setAttribute('fill', c); edge.setAttribute('stroke', c); },
      render: function (m) {
        var first = -1, last = -1, j;
        for (j = 0; j < nb; j++) if (bins[j] > 0) { if (first < 0) first = j; last = j; }
        if (first < 0) { fill.setAttribute('d', ''); edge.setAttribute('d', ''); return; }
        var p = 'M' + r1(sx(lo + first * bw)) + ',' + y0;
        for (j = first; j <= last; j++) p += 'V' + r1(y0 - bins[j] / m * h) + 'H' + r1(sx(lo + (j + 1) * bw));
        p += 'V' + y0;
        edge.setAttribute('d', p);
        fill.setAttribute('d', p + 'Z');
      }
    };
    return api;
  }

  // Least squares with a constant: y on the columns in xs. Returns the
  // coefficients (constant first) by the normal equations, solved by
  // Gaussian elimination with partial pivoting. k is at most 4 here.
  function ols(xs, y) {
    var n = y.length, k = xs.length + 1, A = [], b = new Array(k).fill(0), i, j, l;
    for (i = 0; i < k; i++) A.push(new Array(k).fill(0));
    var row = new Array(k);
    for (l = 0; l < n; l++) {
      row[0] = 1;
      for (j = 1; j < k; j++) row[j] = xs[j - 1][l];
      for (i = 0; i < k; i++) {
        b[i] += row[i] * y[l];
        for (j = i; j < k; j++) A[i][j] += row[i] * row[j];
      }
    }
    for (i = 0; i < k; i++) for (j = 0; j < i; j++) A[i][j] = A[j][i];
    for (i = 0; i < k; i++) {
      var p = i;
      for (j = i + 1; j < k; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
      var t = A[i]; A[i] = A[p]; A[p] = t; var tb = b[i]; b[i] = b[p]; b[p] = tb;
      for (j = i + 1; j < k; j++) {
        var f = A[j][i] / A[i][i];
        for (l = i; l < k; l++) A[j][l] -= f * A[i][l];
        b[j] -= f * b[i];
      }
    }
    var x = new Array(k);
    for (i = k - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < k; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }
  // Simple regression of y on x: slope, intercept and the default standard
  // error of the slope.
  function fit1(x, y) {
    var n = x.length, mx = M06.mean(x), my = M06.mean(y), sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    var b = sxy / sxx, a = my - b * mx, sse = 0;
    for (i = 0; i < n; i++) { var e = y[i] - a - b * x[i]; sse += e * e; }
    return { slope: b, intercept: a, se: Math.sqrt(sse / (n - 2) / sxx) };
  }

  // Two-line panel heading: a bold title and a grey line under it.
  function heading(svg, x, y, title, sub, anchor) {
    M06.text(svg, x, y, title, { size: 18, weight: 700, anchor: anchor || 'start' });
    if (sub) M06.text(svg, x, y + 21, sub, { size: 15, fill: col.grey, anchor: anchor || 'start' });
  }

  // An arrowhead marker in a color, defined once per svg.
  function marker(defs, color) {
    var id = uid('arr'), m = M06.el('marker', {
      id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
    }, defs);
    M06.el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color }, m);
    return 'url(#' + id + ')';
  }

  // =================================================================================
  // 1 · coverage
  // =================================================================================
  // θ = 0 and the estimator's standard deviation is 1. One estimator, such
  // as OLS, under three data-generating processes: its assumptions hold;
  // exogeneity fails, which shifts it by 1.5 SD; independence fails, which
  // leaves it centered and halves the default standard error. Each draw is
  // one z, shared across panels so the rows line up.
  var COV = { bias: 1.5, shrink: 0.5, crit: 1.96, seed: 7001 };
  S.coverage = {
    kinds: [
      { title: 'Assumptions hold', sub: 'centered on θ · correct standard error', est: function (z) { return z; }, se: 1 },
      { title: 'Exogeneity fails', sub: 'centered 1.5 SD from θ · correct standard error', est: function (z) { return z + COV.bias; }, se: 1 },
      { title: 'Independence fails', sub: 'centered on θ · standard error halved', est: function (z) { return z; }, se: COV.shrink }
    ],
    interval: function (kind, z) {
      var e = kind.est(z), h = COV.crit * kind.se;
      return { est: e, lo: e - h, hi: e + h, covers: e - h <= 0 && e + h >= 0 };
    },
    run: function (k, seed) {
      var r = M06.rng(seed == null ? COV.seed : seed), miss = [0, 0, 0];
      for (var i = 0; i < k; i++) {
        var z = r.normal();
        S.coverage.kinds.forEach(function (kd, j) { if (!S.coverage.interval(kd, z).covers) miss[j]++; });
      }
      return miss.map(function (m) { return m / k; });
    }
  };

  // data-kinds picks the panels by index into S.coverage.kinds, e.g. "0,1"
  // for correct against biased; all three by default. Every panel uses the
  // same draws, so the correct panel's counts match across slides.
  M06.demos.coverage = function (root, opts) {
    var seed = intOpt(opts.seed, COV.seed), ROWS = 40, gap = 6.6, row0 = 330;
    var pick = (opts.kinds || '0,1,2').split(',').map(function (s) { return parseInt(s, 10); });
    var kinds = pick.map(function (k) { return S.coverage.kinds[k]; }), lo = -4.2, hi = 5.4;
    var svg = M06.svg(root, 960, 400, 'Confidence intervals from repeated samples, for estimators of the same parameter: ' +
      kinds.map(function (kd) { return kd.title.toLowerCase(); }).join(' and '));
    var PW = (900 - 45 * (kinds.length - 1)) / kinds.length;
    var panels = kinds.map(function (kd, j) {
      var x0 = 30 + j * (PW + 45), x1 = x0 + PW, sx = M06.scale(lo, hi, x0, x1);
      heading(svg, (x0 + x1) / 2, 22, kd.title, kd.sub, 'middle');
      M06.el('line', { x1: x0, x2: x1, y1: 345, y2: 345, stroke: col.axis, 'stroke-width': 1.5 }, svg);
      var rowsG = M06.g(svg), pool = [];
      for (var i = 0; i < ROWS; i++) {
        var g = M06.g(rowsG, { visibility: 'hidden' });
        pool.push({ g: g, line: M06.el('line', { 'stroke-width': 3 }, g), dot: M06.el('circle', { r: 2.8 }, g) });
      }
      M06.vline(svg, sx(0), 64, 345, { color: col.red, label: 'θ', anchor: 'middle', dy: 2 });
      var cnt = M06.text(svg, (x0 + x1) / 2, 375, '', { size: 17, anchor: 'middle', fill: col.ink });
      return { sx: sx, pool: pool, cnt: cnt, kind: kd };
    });

    var bar = M06.controls(root), out = M06.readout(root);
    var run = runner(), r, recent, count, miss;

    function render() {
      panels.forEach(function (P) {
        for (var i = 0; i < ROWS; i++) {
          var z = recent[i], it = P.pool[i];
          if (z == null) { show(it.g, false); continue; }
          var iv = S.coverage.interval(P.kind, z), y = r1(row0 - i * gap), bad = !iv.covers;
          attrs(it.line, {
            x1: r1(P.sx(clamp(iv.lo, lo, hi))), x2: r1(P.sx(clamp(iv.hi, lo, hi))), y1: y, y2: y,
            stroke: bad ? col.red : col.mid, 'stroke-width': bad ? 3.4 : 2.6
          });
          attrs(it.dot, { cx: r1(P.sx(clamp(iv.est, lo, hi))), cy: y, fill: bad ? col.red : col.axis });
          show(it.g, true);
        }
      });
    }
    function update() {
      panels.forEach(function (P, j) {
        P.cnt.textContent = count ? 'Miss θ: ' + num(miss[j]) + ' of ' + num(count) + ' (' + pct(miss[j] / count) + ')' : '';
      });
      out.innerHTML = 'Intervals per panel: ' + num(count) + SEP + 'Share that miss θ: ' +
        (count ? kinds.map(function (kd, j) { return kd.title.toLowerCase() + ' ' + bold(pct(miss[j] / count)); }).join(', ') : DASH);
    }
    function add(z) {
      recent.push(z); if (recent.length > ROWS) recent.shift();
      count++;
      kinds.forEach(function (kd, j) { if (!S.coverage.interval(kd, z).covers) miss[j]++; });
    }
    function draw(k, ms) {
      run.finish();
      var batch = [], done = 0;
      for (var i = 0; i < k; i++) batch.push(r.normal());
      run.run(ms, function (p) {
        var t = Math.floor(k * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () { while (done < k) add(batch[done++]); render(); update(); });
    }
    function reset() {
      run.cancel();
      r = M06.rng(seed); recent = []; count = 0; miss = kinds.map(function () { return 0; });
      render(); update();
    }
    M06.button(bar, 'Draw one', function () { draw(1, 250); });
    M06.button(bar, 'Draw 20', function () { draw(20, 1200); });
    M06.button(bar, 'Draw 100', function () { draw(100, 2000); });
    M06.button(bar, 'Draw 1,000', function () { draw(1000, 2500); });
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // =================================================================================
  // 2 · selection
  // =================================================================================
  // 10,000 customers. A latent renewal propensity z sets the renewal
  // probability without the email, p0 = logistic(0.3 + 1.4 z). The email
  // adds 2 points for everyone. The firm emails the 30% with the highest
  // score s = t·z + √(1 − t²)·e, so t = 0 is random and t = 1 is the
  // renewal score itself. Rates are expected values, so nothing is noisy
  // except which customers the score picks.
  var SEL = { n: 10000, share: 0.3, effect: 0.02, seed: 7101 };
  S.selection = (function () {
    var r = M06.rng(SEL.seed), z = new Array(SEL.n), e = new Array(SEL.n), p0 = new Array(SEL.n), i;
    for (i = 0; i < SEL.n; i++) { z[i] = r.normal(); e[i] = r.normal(); p0[i] = logistic(0.3 + 1.4 * z[i]); }
    var idx = []; for (i = 0; i < SEL.n; i++) idx.push(i);
    return {
      at: function (t) {
        var c = Math.sqrt(Math.max(0, 1 - t * t)), s = new Array(SEL.n);
        for (var j = 0; j < SEL.n; j++) s[j] = t * z[j] + c * e[j];
        var ord = idx.slice().sort(function (a, b) { return s[b] - s[a]; });
        var k = Math.round(SEL.share * SEL.n), a0 = 0, a1 = 0, b0 = 0;
        for (j = 0; j < SEL.n; j++) {
          var q = p0[ord[j]];
          if (j < k) { a0 += q; a1 += Math.min(1, q + SEL.effect); } else b0 += q;
        }
        var y0T = a0 / k, y1T = a1 / k, y0C = b0 / (SEL.n - k);
        return { emailed: y1T, base: y0T, notEmailed: y0C, effect: y1T - y0T, bias: y0T - y0C, diff: y1T - y0C };
      }
    };
  })();

  M06.demos.selection = function (root) {
    var svg = M06.svg(root, 960, 410, 'Renewal rates of emailed and not-emailed customers, split into the rate ' +
      'without the email and the effect of the email, as the email is targeted on the renewal score');
    var B = 330, T = 40, sy = M06.scale(0, 1, B, T), X0 = 100;
    M06.axisY(svg, sy, X0, [0, 0.2, 0.4, 0.6, 0.8, 1], function (v) { return pct(v); }, { title: 'Renewal rate' });
    M06.el('line', { x1: X0, x2: 540, y1: B, y2: B, stroke: col.axis, 'stroke-width': 1.5 }, svg);
    var bx = [{ x: 170, label: 'Emailed' }, { x: 370, label: 'Not emailed' }], W = 120;
    bx.forEach(function (b) { M06.text(svg, b.x + W / 2, B + 26, b.label, { size: 17, anchor: 'middle' }); });
    var baseE = M06.el('rect', { x: bx[0].x, width: W, fill: col.mid, 'fill-opacity': 0.7 }, svg);
    var capE = M06.el('rect', { x: bx[0].x, width: W, fill: col.red }, svg);
    var baseN = M06.el('rect', { x: bx[1].x, width: W, fill: col.mid, 'fill-opacity': 0.7 }, svg);
    var guide = M06.el('line', { x1: bx[0].x - 6, x2: bx[1].x + W, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, svg);
    var brace = M06.el('path', { fill: 'none', stroke: col.blue, 'stroke-width': 2.5 }, svg);
    // Legend under the bars: what each colour on the emailed bar means.
    var LY = 392, lx = X0;
    M06.el('rect', { x: lx, y: LY - 12, width: 14, height: 14, fill: col.mid, 'fill-opacity': 0.7 }, svg);
    M06.text(svg, lx + 20, LY, 'would renew without the email', { size: 15, fill: col.ink });
    lx += 245;
    M06.el('rect', { x: lx, y: LY - 12, width: 14, height: 14, fill: col.red }, svg);
    M06.text(svg, lx + 20, LY, 'added by the email', { size: 15, fill: col.red });
    lx += 165;
    M06.el('path', { d: 'M' + (lx + 6) + ',' + (LY - 13) + 'H' + lx + 'V' + (LY + 1) + 'H' + (lx + 6), fill: 'none', stroke: col.blue, 'stroke-width': 2.5 }, svg);
    M06.text(svg, lx + 14, LY, 'selection bias', { size: 15, fill: col.blue });
    var vE = M06.text(svg, bx[0].x + W / 2, 0, '', { size: 17, anchor: 'middle', weight: 700 });
    var vN = M06.text(svg, bx[1].x + W / 2, 0, '', { size: 17, anchor: 'middle', weight: 700 });

    // The decomposition, written out on the right.
    var R0 = 600, lines = [
      { y: 110, lab: 'Difference in renewal rates', fill: col.ink },
      { y: 175, lab: '= effect of the email on the emailed', fill: col.red },
      { y: 240, lab: '+ selection bias', fill: col.blue }
    ];
    var vals = lines.map(function (L) {
      M06.text(svg, R0, L.y, L.lab, { size: 18, fill: L.fill, weight: 600 });
      return M06.text(svg, R0, L.y + 30, '', { size: 26, fill: L.fill, weight: 700 });
    });
    M06.text(svg, R0, 305, 'Selection bias: the difference in renewal', { size: 15, fill: col.grey });
    M06.text(svg, R0, 324, 'rates had nobody received the email.', { size: 15, fill: col.grey });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), tNow = 0;
    var sl = M06.slider(bar, 'Targeting on the score (0 = random, 1 = top scores)', 0, 1, 0.05, 0, function (v) { run.cancel(); draw(v); });
    function pts(x) { return signed(100 * x, 1) + ' points'; }
    function draw(t) {
      tNow = t;
      var d = S.selection.at(t);
      attrs(baseE, { y: r1(sy(d.base)), height: r1(B - sy(d.base)) });
      attrs(capE, { y: r1(sy(d.emailed)), height: r1(sy(d.base) - sy(d.emailed)) });
      attrs(baseN, { y: r1(sy(d.notEmailed)), height: r1(B - sy(d.notEmailed)) });
      attrs(guide, { y1: r1(sy(d.notEmailed)), y2: r1(sy(d.notEmailed)) });
      var xb = bx[0].x + W + 10, ya = sy(d.notEmailed), yb = sy(d.base);
      brace.setAttribute('d', Math.abs(ya - yb) < 4 ? '' :
        'M' + (xb - 6) + ',' + r1(ya) + 'H' + xb + 'V' + r1(yb) + 'H' + (xb - 6));
      attrs(vE, { y: r1(sy(d.emailed) - 10) }); vE.textContent = pct(d.emailed, 1);
      attrs(vN, { y: r1(sy(d.notEmailed) - 10) }); vN.textContent = pct(d.notEmailed, 1);
      vals[0].textContent = pts(d.diff);
      vals[1].textContent = pts(d.effect);
      vals[2].textContent = pts(d.bias);
      out.innerHTML = 'Targeting: ' + bold(num(t, 2)) + (t === 0 ? ' (emails sent at random)' : t === 1 ? ' (emails sent on the score alone)' : '') +
        SEP + 'Emailed: 3,000 of 10,000 customers';
    }
    M06.button(bar, 'Sweep', function () {
      run.run(2600, function (p) { var v = Math.round(20 * p) / 20; sl.value = v; draw(v); });
    });
    M06.button(bar, 'Reset', function () { run.cancel(); sl.value = 0; draw(0); });
    draw(0);
  };

  // =================================================================================
  // 3 · attenuation
  // =================================================================================
  // 200 households. Income x* ~ N(60, 15²) in $ thousands; monthly spend
  // y = 20 + 0.8 x* + u, u ~ N(0, 12²). Measurement error with SD s is added
  // to income (mode x) or to spend (mode y), using one fixed standard-normal
  // draw per household, so the points slide as s moves.
  var ATT = { n: 200, mx: 60, sx: 15, a: 20, b: 0.8, su: 12, seed: 7201, sMax: 30 };
  S.attenuation = (function () {
    var r = M06.rng(ATT.seed), xs = [], ys = [], ex = [], ey = [], i;
    for (i = 0; i < ATT.n; i++) {
      xs.push(ATT.mx + ATT.sx * r.normal());
      ys.push(ATT.a + ATT.b * xs[i] + ATT.su * r.normal());
      ex.push(r.normal()); ey.push(r.normal());
    }
    return {
      truthX: xs, truthY: ys,
      at: function (mode, s) {
        var x = xs.map(function (v, j) { return mode === 'x' ? v + s * ex[j] : v; });
        var y = ys.map(function (v, j) { return mode === 'y' ? v + s * ey[j] : v; });
        var f = fit1(x, y);
        return { x: x, y: y, fit: f, lambda: mode === 'x' ? ATT.sx * ATT.sx / (ATT.sx * ATT.sx + s * s) : 1 };
      }
    };
  })();

  M06.demos.attenuation = function (root) {
    var svg = M06.svg(root, 960, 400, 'Household income against monthly spend, with the true line and the fitted line, ' +
      'as measurement error is added to income or to spend');
    var defs = M06.el('defs', null, svg);
    var X0 = 90, X1 = 560, YT = 20, YB = 330, sx = M06.scale(0, 120, X0, X1), sy = M06.scale(0, 160, YB, YT);
    M06.axisY(svg, sy, X0, ticks(0, 160, 40), function (v) { return '$' + num0(v); }, { title: 'Monthly spend' });
    var xTitle = M06.axisX(svg, sx, YB, ticks(0, 120, 20), function (v) { return '$' + num0(v) + 'k'; }, { title: 'Household income' });
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    var dots = S.attenuation.truthX.map(function () {
      return M06.el('circle', { r: 3.6, fill: col.mid, 'fill-opacity': 0.55, stroke: col.axis, 'stroke-width': 0.8 }, plot);
    });
    function line(el, a, b) { attrs(el, { x1: sx(0), x2: sx(120), y1: r1(sy(a)), y2: r1(sy(a + b * 120)) }); }
    var tl = M06.el('line', { stroke: col.red, 'stroke-width': 3 }, plot);
    line(tl, ATT.a, ATT.b);
    var fl = M06.el('line', { stroke: col.ink, 'stroke-width': 3, 'stroke-dasharray': '9 6' }, plot);

    // The numbers, on the right.
    var R0 = 610;
    M06.text(svg, R0, 50, 'True slope', { size: 17, fill: col.red, weight: 600 });
    M06.text(svg, R0, 80, num(ATT.b, 2), { size: 26, fill: col.red, weight: 700 });
    M06.text(svg, R0, 125, 'Estimated slope (standard error)', { size: 17, fill: col.ink, weight: 600 });
    var vB = M06.text(svg, R0, 155, '', { size: 26, weight: 700 });
    var labL = M06.text(svg, R0, 200, '', { size: 17, fill: col.blue, weight: 600 });
    var vL = M06.text(svg, R0, 230, '', { size: 26, fill: col.blue, weight: 700 });
    var note1 = M06.text(svg, R0, 280, '', { size: 15, fill: col.grey });
    var note2 = M06.text(svg, R0, 299, '', { size: 15, fill: col.grey });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), mode = 'x', sNow = 0;
    M06.toggle(bar, ['Error in income (X)', 'Error in spend (Y)'], ['x', 'y'], 'x', function (m) { mode = m; draw(sNow); });
    var sl = M06.slider(bar, 'Error SD', 0, ATT.sMax, 1, 0, function (v) { run.cancel(); draw(v); });
    function draw(s) {
      sNow = s;
      var d = S.attenuation.at(mode, s);
      d.x.forEach(function (v, j) { attrs(dots[j], { cx: r1(sx(v)), cy: r1(sy(d.y[j])) }); });
      line(fl, d.fit.intercept, d.fit.slope);
      vB.textContent = num(d.fit.slope, 2) + ' (' + num(d.fit.se, 3) + ')';
      if (mode === 'x') {
        labL.textContent = 'Reliability ratio λ and true slope × λ';
        vL.textContent = 'λ = ' + num(d.lambda, 2) + ' · ' + num(ATT.b * d.lambda, 2);
        note1.textContent = 'λ = Var(true income) / Var(measured income)';
        note2.textContent = '= 15² / (15² + ' + num0(s) + '²)';
      } else {
        labL.textContent = 'Standard error with no error in spend';
        vL.textContent = num(S.attenuation.at('y', 0).fit.se, 3);
        note1.textContent = 'Error in Y adds to the residual variance.';
        note2.textContent = 'The slope estimator is unbiased; its standard error rises.';
      }
      out.innerHTML = (mode === 'x' ? 'Error in income' : 'Error in spend') + ': SD ' + bold('$' + num0(s) + (mode === 'x' ? 'k' : '')) +
        SEP + '200 households' + SEP + 'True income SD $15k';
    }
    M06.button(bar, 'Sweep', function () {
      run.run(2600, function (p) { var v = Math.round(ATT.sMax * p); sl.value = v; draw(v); });
    });
    M06.button(bar, 'Reset', function () { run.cancel(); sl.value = 0; draw(0); });
    draw(0);
  };


  // =================================================================================
  // 3b · nonclassical
  // =================================================================================
  // Mean-reverting error, the pattern Bound and Krueger found in survey
  // earnings: a report keeps (1 − κ) of the true deviation from the mean,
  // plus noise with SD 6κ. Same 200 households as the attenuation demo.
  // In income (X): measured = μ + (1 − κ)(x* − μ) + 6κ·e, and the slope
  // converges to β(1 − κ)Var(x*) / [(1 − κ)²Var(x*) + (6κ)²], away from zero.
  // In spend (Y): measured = μ_y + (1 − κ)(y − μ_y) + 6κ·f, and the slope
  // converges to (1 − κ)β, toward zero.
  var NCE = { kMax: 0.5, noise: 6, seed: 7251 };
  S.nonclassical = (function () {
    var xs = S.attenuation.truthX, ys = S.attenuation.truthY, r = M06.rng(NCE.seed), ex = [], ey = [], i;
    for (i = 0; i < xs.length; i++) { ex.push(r.normal()); ey.push(r.normal()); }
    var mx = ATT.mx, my = ATT.a + ATT.b * ATT.mx;
    return {
      at: function (mode, k) {
        var x = xs.map(function (v, j) { return mode === 'x' ? mx + (1 - k) * (v - mx) + NCE.noise * k * ex[j] : v; });
        var y = ys.map(function (v, j) { return mode === 'y' ? my + (1 - k) * (v - my) + NCE.noise * k * ey[j] : v; });
        var vx = ATT.sx * ATT.sx, nz = NCE.noise * k;
        var plim = mode === 'x' ? ATT.b * (1 - k) * vx / ((1 - k) * (1 - k) * vx + nz * nz) : (1 - k) * ATT.b;
        return { x: x, y: y, fit: fit1(x, y), plim: plim };
      }
    };
  })();

  M06.demos.nonclassical = function (root) {
    var svg = M06.svg(root, 960, 400, 'Household income against monthly spend, with the true line and the fitted line, ' +
      'as mean-reverting measurement error is added to income or to spend');
    var defs = M06.el('defs', null, svg);
    var X0 = 90, X1 = 560, YT = 20, YB = 330, sx = M06.scale(0, 120, X0, X1), sy = M06.scale(0, 160, YB, YT);
    M06.axisY(svg, sy, X0, ticks(0, 160, 40), function (v) { return '$' + num0(v); }, { title: 'Monthly spend' });
    M06.axisX(svg, sx, YB, ticks(0, 120, 20), function (v) { return '$' + num0(v) + 'k'; }, { title: 'Household income' });
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    var dots = S.attenuation.truthX.map(function () {
      return M06.el('circle', { r: 3.6, fill: col.mid, 'fill-opacity': 0.55, stroke: col.axis, 'stroke-width': 0.8 }, plot);
    });
    function line(el, a, b) { attrs(el, { x1: sx(0), x2: sx(120), y1: r1(sy(a)), y2: r1(sy(a + b * 120)) }); }
    var tl = M06.el('line', { stroke: col.red, 'stroke-width': 3 }, plot);
    line(tl, ATT.a, ATT.b);
    var fl = M06.el('line', { stroke: col.ink, 'stroke-width': 3, 'stroke-dasharray': '9 6' }, plot);

    var R0 = 610;
    M06.text(svg, R0, 50, 'True slope', { size: 17, fill: col.red, weight: 600 });
    M06.text(svg, R0, 80, num(ATT.b, 2), { size: 26, fill: col.red, weight: 700 });
    M06.text(svg, R0, 125, 'Estimated slope (standard error)', { size: 17, fill: col.ink, weight: 600 });
    var vB = M06.text(svg, R0, 155, '', { size: 26, weight: 700 });
    M06.text(svg, R0, 200, 'Slope the estimator converges to', { size: 17, fill: col.blue, weight: 600 });
    var vL = M06.text(svg, R0, 230, '', { size: 26, fill: col.blue, weight: 700 });
    var note1 = M06.text(svg, R0, 280, '', { size: 15, fill: col.grey });
    var note2 = M06.text(svg, R0, 299, '', { size: 15, fill: col.grey });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), mode = 'x', kNow = 0;
    M06.toggle(bar, ['Error in income (X)', 'Error in spend (Y)'], ['x', 'y'], 'x', function (m) { if (m === mode) return; mode = m; draw(kNow); });
    var sl = M06.slider(bar, 'Mean reversion κ', 0, NCE.kMax, 0.05, 0, function (v) { run.cancel(); draw(v); });
    function draw(k) {
      kNow = k;
      var d = S.nonclassical.at(mode, k);
      d.x.forEach(function (v, j) { attrs(dots[j], { cx: r1(sx(v)), cy: r1(sy(d.y[j])) }); });
      line(fl, d.fit.intercept, d.fit.slope);
      vB.textContent = num(d.fit.slope, 2) + ' (' + num(d.fit.se, 3) + ')';
      var dir = k === 0 ? '' : mode === 'x' ? ', away from zero' : ', toward zero';
      vL.textContent = num(d.plim, 2) + dir;
      if (mode === 'x') {
        note1.textContent = 'Reported income keeps (1 − κ) of each deviation.';
        note2.textContent = 'Smaller swings in X for the same swings in Y.';
      } else {
        note1.textContent = 'Reported spend keeps (1 − κ) of each deviation.';
        note2.textContent = 'Smaller swings in Y for the same swings in X.';
      }
      out.innerHTML = (mode === 'x' ? 'Error in income' : 'Error in spend') + ': κ = ' + bold(num(k, 2)) +
        SEP + 'The same 200 households as the classical error slide';
    }
    M06.button(bar, 'Sweep', function () {
      run.run(2600, function (p) { var v = Math.round(20 * NCE.kMax * p) / 20; sl.value = v; draw(v); });
    });
    M06.button(bar, 'Reset', function () { run.cancel(); sl.value = 0; draw(0); });
    draw(0);
  };

  // =================================================================================
  // 4 · simultaneity
  // =================================================================================
  // Demand: Q = 100 − 2P + u_d. Supply: Q = 10 + P + u_s. Shocks have SD 8
  // when that curve shifts and 0 otherwise. Each week is one equilibrium,
  // P = (90 + u_d − u_s) / 3, Q = 10 + P + u_s. The fitted line is the least
  // squares regression of quantity on price.
  var SIM = { ad: 100, bd: 2, as: 10, bs: 1, sd: 8, seed: 7301 };
  S.simultaneity = function (mode, seed) {
    var r = M06.rng(seed == null ? SIM.seed : seed);
    var sdD = mode === 'supply' ? 0 : SIM.sd, sdS = mode === 'demand' ? 0 : SIM.sd;
    return {
      next: function () {
        var ud = sdD * r.normal(), us = sdS * r.normal();
        var P = (SIM.ad - SIM.as + ud - us) / (SIM.bd + SIM.bs);
        return { ud: ud, us: us, P: P, Q: SIM.as + SIM.bs * P + us };
      }
    };
  };
  S.simultaneity.slope = function (weeks) {
    if (weeks.length < 3) return null;
    return fit1(weeks.map(function (w) { return w.P; }), weeks.map(function (w) { return w.Q; })).slope;
  };

  M06.demos.simultaneity = function (root, opts) {
    var seed = intOpt(opts.seed, SIM.seed);
    var svg = M06.svg(root, 960, 400, 'Weekly prices and quantities generated by shifting supply and demand curves, ' +
      'with the true demand curve and the fitted regression line');
    var defs = M06.el('defs', null, svg);
    var X0 = 90, X1 = 560, YT = 20, YB = 330, sxQ = M06.scale(10, 70, X0, X1), syP = M06.scale(10, 50, YB, YT);
    M06.axisY(svg, syP, X0, ticks(10, 50, 10), function (v) { return '$' + num0(v); }, { title: 'Price' });
    M06.axisX(svg, sxQ, YB, ticks(10, 70, 10), num0, { title: 'Quantity sold per week' });
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    // A curve Q = a + b·P, drawn across the price range.
    function curve(el, a, b) {
      attrs(el, { x1: r1(sxQ(a + b * 10)), y1: r1(syP(10)), x2: r1(sxQ(a + b * 50)), y2: r1(syP(50)) });
    }
    var dNow = M06.el('line', { stroke: col.red, 'stroke-width': 1.5, 'stroke-opacity': 0.45 }, plot);
    var sNow = M06.el('line', { stroke: col.axis, 'stroke-width': 1.5, 'stroke-opacity': 0.45 }, plot);
    var dTrue = M06.el('line', { stroke: col.red, 'stroke-width': 3 }, plot);
    var sTrue = M06.el('line', { stroke: col.axis, 'stroke-width': 3 }, plot);
    curve(dTrue, SIM.ad, -SIM.bd); curve(sTrue, SIM.as, SIM.bs);
    var ptsG = M06.g(plot), last = M06.el('circle', { r: 6, fill: col.red, stroke: '#fff', 'stroke-width': 1.5 }, plot);
    var fitL = M06.el('line', { stroke: col.ink, 'stroke-width': 3, 'stroke-dasharray': '9 6' }, plot);
    M06.text(svg, sxQ(SIM.ad - SIM.bd * 17), syP(17) - 12, 'demand', { size: 16, fill: col.red, weight: 700, anchor: 'middle' });
    M06.text(svg, sxQ(SIM.as + SIM.bs * 47) + 8, syP(47) + 5, 'supply', { size: 16, fill: col.axis, weight: 700 });

    var R0 = 610;
    M06.text(svg, R0, 50, 'Slope of the demand curve, ΔQ/ΔP', { size: 17, fill: col.red, weight: 600 });
    M06.text(svg, R0, 80, MINUS + num(SIM.bd, 0), { size: 26, fill: col.red, weight: 700 });
    M06.text(svg, R0, 125, 'Slope of the supply curve', { size: 17, fill: col.axis, weight: 600 });
    M06.text(svg, R0, 155, '+' + num(SIM.bs, 0), { size: 26, fill: col.axis, weight: 700 });
    M06.text(svg, R0, 200, 'Slope of the regression of quantity on price', { size: 17, fill: col.ink, weight: 600 });
    var vS = M06.text(svg, R0, 230, DASH, { size: 26, weight: 700 });
    var note = M06.text(svg, R0, 280, '', { size: 15, fill: col.grey });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), mode = 'both', sim, weeks;
    M06.toggle(bar, ['Demand shifts', 'Supply shifts', 'Both shift'], ['demand', 'supply', 'both'], 'both',
      function (m) { if (m === mode) return; mode = m; reset(); });
    var notes = { demand: 'The weeks trace out the supply curve.', supply: 'The weeks trace out the demand curve.',
      both: 'The fitted slope matches neither curve.' };
    function render() {
      clear(ptsG);
      weeks.forEach(function (w) {
        M06.el('circle', { cx: r1(sxQ(w.Q)), cy: r1(syP(w.P)), r: 4, fill: col.mid, 'fill-opacity': 0.6, stroke: col.axis, 'stroke-width': 0.8 }, ptsG);
      });
      var w = weeks[weeks.length - 1];
      show(last, !!w); show(dNow, !!w); show(sNow, !!w);
      if (w) {
        attrs(last, { cx: r1(sxQ(w.Q)), cy: r1(syP(w.P)) });
        curve(dNow, SIM.ad + w.ud, -SIM.bd); curve(sNow, SIM.as + w.us, SIM.bs);
      }
      var b = S.simultaneity.slope(weeks);
      show(fitL, b != null);
      if (b != null) {
        var mp = M06.mean(weeks.map(function (v) { return v.P; })), mq = M06.mean(weeks.map(function (v) { return v.Q; }));
        attrs(fitL, { x1: r1(sxQ(mq + b * (10 - mp))), y1: r1(syP(10)), x2: r1(sxQ(mq + b * (50 - mp))), y2: r1(syP(50)) });
      }
      vS.textContent = b == null ? DASH : signed(b, 2);
      note.textContent = weeks.length >= 20 ? notes[mode] : '';
      out.innerHTML = 'Weeks: ' + num(weeks.length) + SEP + 'Shock SD: demand ' + bold(mode === 'supply' ? '0' : '8') +
        ', supply ' + bold(mode === 'demand' ? '0' : '8');
    }
    function draw(k, ms) {
      run.finish();
      var batch = [], done = 0;
      for (var i = 0; i < k; i++) batch.push(sim.next());
      run.run(ms, function (p) {
        var t = Math.floor(k * p);
        while (done < t) weeks.push(batch[done++]);
        render();
      }, function () { while (done < k) weeks.push(batch[done++]); render(); });
    }
    function reset() { run.cancel(); sim = S.simultaneity(mode, seed); weeks = []; render(); }
    M06.button(bar, 'Draw one week', function () { draw(1, 200); });
    M06.button(bar, 'Draw 100 weeks', function () { draw(100, 2200); });
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // =================================================================================
  // 5 · placebo tests: heteroskedasticity, serial correlation, clustering,
  //     spatial correlation
  // =================================================================================
  // Four sources of false precision, one layout. Each simulation has no true
  // effect. Its next() returns one sample with the estimate b, the default
  // and corrected standard errors, both t-statistics and whether each test
  // rejects at 5%. The left panel draws that sample; the right panel
  // collects the estimates across samples and compares where they fall
  // with the 95% intervals the two standard errors report.

  // Simple regression of y on x: slope, residuals and the centered x.
  function fitRes(x, y) {
    var n = x.length, mx = M06.mean(x), my = M06.mean(y), sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    var b = sxy / sxx, a = my - b * mx, e = new Array(n), xc = new Array(n), sse = 0;
    for (i = 0; i < n; i++) { e[i] = y[i] - a - b * x[i]; xc[i] = x[i] - mx; sse += e[i] * e[i]; }
    return { b: b, a: a, e: e, xc: xc, sxx: sxx, seD: Math.sqrt(sse / (n - 2) / sxx) };
  }
  function packT(b, seD, seC, critC) {
    return { b: b, seD: seD, seC: seC, tD: b / seD, tC: b / seC,
      rejD: Math.abs(b / seD) > 1.96, rejC: Math.abs(b / seC) > critC };
  }

  // 5a · heteroskedasticity. 400 firms. Marketing spend x = 10·exp(0.5 z)
  // in $ thousands; the change in revenue y = x·ε, ε ~ N(0, 1), so spend has
  // no effect and the error SD is proportional to spend. The corrected
  // standard error is White's, with the HC1 small-sample factor n/(n − 2)
  // that Stata's "robust" and R fixest's "hetero" use.
  // Three settings, chosen by mode: 0 (or false), a constant error SD of 11,
  // where the default standard error is right; 1 (or true), an SD equal to
  // spend, so the noisiest firms are the ones with extreme spend and the
  // default is too small; 2, an SD of 14 up to median spend ($10k) that then
  // falls as 14·(10/x)², so the firms with extreme spend are the steadiest
  // and the default is too large.
  var HET = { n: 400, seed: 7451, flatSD: 11 };
  function hetSD(mode, x) {
    if (mode === 1) return x;
    if (mode === 2) return x <= 10 ? 14 : 14 * (10 / x) * (10 / x);
    return HET.flatSD;
  }
  S.hetero = function (seed, dep) {
    var r = M06.rng(seed == null ? HET.seed : seed);
    var mode = dep === false || dep === 0 ? 0 : dep === 2 ? 2 : 1;
    return {
      next: function () {
        var x = [], y = [], i;
        for (i = 0; i < HET.n; i++) { x.push(10 * Math.exp(0.5 * r.normal())); y.push(hetSD(mode, x[i]) * r.normal()); }
        var f = fitRes(x, y), v = 0;
        for (i = 0; i < HET.n; i++) v += f.xc[i] * f.xc[i] * f.e[i] * f.e[i];
        v = v / (f.sxx * f.sxx) * HET.n / (HET.n - 2);
        var o = packT(f.b, f.seD, Math.sqrt(v), 1.96);
        o.x = x; o.y = y; o.a = f.a;
        return o;
      }
    };
  };

  // 5b · serial correlation in a state panel, after Bertrand, Duflo and
  // Mullainathan. 50 states over 21 years; each state's outcome follows an
  // AR(1) with coefficient 0.8. A placebo law starts in 25 random states, in
  // a random year from the 6th to the 16th. Two-way fixed effects (state and
  // year) by the within transformation of the balanced panel. The corrected
  // standard error clusters by state, with the factor G/(G − 1) and the
  // t distribution with 49 degrees of freedom (2.010).
  // With dep false the autocorrelation is 0 and the yearly shocks have the
  // same variance as the AR(1) outcome, 1 / (1 − 0.8²).
  var PAN = { S: 50, T: 21, rho: 0.8, y0: 1979, seed: 7471, crit: 2.010 };
  S.panel = function (seed, dep) {
    var r = M06.rng(seed == null ? PAN.seed : seed);
    dep = dep !== false;
    var rho = dep ? PAN.rho : 0, sdU = dep ? 1 : 1 / Math.sqrt(1 - PAN.rho * PAN.rho);
    return {
      next: function () {
        var St = PAN.S, T = PAN.T, n = St * T, y = new Array(n), d = new Array(n).fill(0), s, t, i;
        for (s = 0; s < St; s++) {
          var u = sdU * r.normal() / Math.sqrt(1 - rho * rho);
          for (t = 0; t < T; t++) { u = rho * u + sdU * r.normal(); y[s * T + t] = u; }
        }
        var ord = []; for (s = 0; s < St; s++) ord.push(s);
        r.shuffle(ord);
        var start = new Array(St).fill(-1);
        for (var k = 0; k < St / 2; k++) { start[ord[k]] = 5 + r.int(T - 10); for (t = start[ord[k]]; t < T; t++) d[ord[k] * T + t] = 1; }
        var ms = new Array(St).fill(0), mt = new Array(T).fill(0), ds = new Array(St).fill(0), dt = new Array(T).fill(0), m = 0, md = 0;
        for (s = 0; s < St; s++) for (t = 0; t < T; t++) {
          i = s * T + t; ms[s] += y[i] / T; mt[t] += y[i] / St; m += y[i] / n; ds[s] += d[i] / T; dt[t] += d[i] / St; md += d[i] / n;
        }
        var xt = new Array(n), yt = new Array(n), sxx = 0, sxy = 0;
        for (s = 0; s < St; s++) for (t = 0; t < T; t++) {
          i = s * T + t; xt[i] = d[i] - ds[s] - dt[t] + md; yt[i] = y[i] - ms[s] - mt[t] + m;
          sxx += xt[i] * xt[i]; sxy += xt[i] * yt[i];
        }
        var b = sxy / sxx, sse = 0, e = new Array(n);
        for (i = 0; i < n; i++) { e[i] = yt[i] - b * xt[i]; sse += e[i] * e[i]; }
        var seD = Math.sqrt(sse / (n - St - T) / sxx), vc = 0;
        for (s = 0; s < St; s++) { var g = 0; for (t = 0; t < T; t++) { i = s * T + t; g += xt[i] * e[i]; } vc += g * g; }
        vc = vc / (sxx * sxx) * St / (St - 1);
        var o = packT(b, seD, Math.sqrt(vc), PAN.crit);
        o.y = y; o.start = start; o.order = ord;
        return o;
      }
    };
  };

  // 5c · clustering. 20 stores of 50 shoppers. Basket size = 50 + store shock
  // (SD 5) + shopper noise (SD 15), so the intraclass correlation is
  // 25 / 250 = 0.1. Ten stores are treated at random and the treatment does
  // nothing. The default standard error treats the 1,000 shoppers as
  // independent. The clustered standard error is computed from the 20 store
  // means, which with equal store sizes is the cluster-robust formula up to
  // a small-sample factor; its test uses the t distribution with 18 degrees
  // of freedom (2.101).
  // With dep false there is no store shock: shoppers are independent, with
  // the same total SD, √(5² + 15²).
  var CL = { G: 20, m: 50, mu: 50, tau: 5, sigma: 15, seed: 7401, critT: 2.101 };
  S.cluster = function (seed, dep) {
    var r = M06.rng(seed == null ? CL.seed : seed);
    dep = dep !== false;
    var tau = dep ? CL.tau : 0, sigma = dep ? CL.sigma : Math.sqrt(CL.tau * CL.tau + CL.sigma * CL.sigma);
    return {
      next: function () {
        var stores = [], g, i, order = [];
        for (g = 0; g < CL.G; g++) order.push(g);
        r.shuffle(order);
        var treated = new Array(CL.G).fill(false);
        for (g = 0; g < CL.G / 2; g++) treated[order[g]] = true;
        var yT = [], yC = [], mT = [], mC = [];
        for (g = 0; g < CL.G; g++) {
          var a = tau * r.normal(), ys = [];
          for (i = 0; i < CL.m; i++) ys.push(CL.mu + a + sigma * r.normal());
          var mean = M06.mean(ys);
          stores.push({ treated: treated[g], ys: ys, mean: mean });
          if (treated[g]) { Array.prototype.push.apply(yT, ys); mT.push(mean); } else { Array.prototype.push.apply(yC, ys); mC.push(mean); }
        }
        var diff = M06.mean(yT) - M06.mean(yC);
        var seD = Math.sqrt(M06.sd(yT) * M06.sd(yT) / yT.length + M06.sd(yC) * M06.sd(yC) / yC.length);
        var seC = Math.sqrt(M06.sd(mT) * M06.sd(mT) / mT.length + M06.sd(mC) * M06.sd(mC) / mC.length);
        var o = packT(diff, seD, seC, CL.critT);
        o.stores = stores;
        return o;
      }
    };
  };

  // 5d · spatial correlation. A 40 × 40 grid of counties. Two independent
  // smooth fields: each county's value is the scaled sum of iid normals over
  // a disc of radius 2 around it. The program covers counties where the
  // first field is positive, so it comes in contiguous regions; yield is the
  // second field plus independent noise with SD 0.5. The program has no
  // effect. The corrected standard error is Conley's, with a uniform kernel
  // out to a distance of 5 counties.
  var SPA = { N: 40, R: 2, cut: 5, nugget: 0.5, seed: 7491 };
  SPA.disc = (function () {
    var o = [];
    for (var a = -SPA.R; a <= SPA.R; a++) for (var b = -SPA.R; b <= SPA.R; b++) if (a * a + b * b <= SPA.R * SPA.R + SPA.R) o.push([a, b]);
    return o;
  })();
  SPA.nbrs = null;
  function spaNbrs() {
    if (SPA.nbrs) return SPA.nbrs;
    var N = SPA.N, c = SPA.cut, out = [];
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var l = [];
      for (var a = Math.max(0, i - c); a <= Math.min(N - 1, i + c); a++)
        for (var b = Math.max(0, j - c); b <= Math.min(N - 1, j + c); b++)
          if ((a - i) * (a - i) + (b - j) * (b - j) <= c * c) l.push(a * N + b);
      out.push(l);
    }
    SPA.nbrs = out;
    return out;
  }
  function spaField(r, iid) {
    var N = SPA.N, R = SPA.R, P = N + 2 * R, z = new Array(P * P), f = new Array(N * N), i, j, k, D = iid ? [[0, 0]] : SPA.disc;
    for (i = 0; i < P * P; i++) z[i] = r.normal();
    var sc = 1 / Math.sqrt(D.length);
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      var s = 0;
      for (k = 0; k < D.length; k++) s += z[(i + R + D[k][0]) * P + (j + R + D[k][1])];
      f[i * N + j] = s * sc;
    }
    return f;
  }
  // With dep false each county's value is its own independent draw.
  S.spatial = function (seed, dep) {
    var r = M06.rng(seed == null ? SPA.seed : seed), nb = spaNbrs();
    var iid = dep === false;
    return {
      next: function () {
        var fx = spaField(r, iid), fu = spaField(r, iid), n = fx.length, i, k;
        var x = fx.map(function (v) { return v > 0 ? 1 : 0; });
        var y = fu.map(function (v) { return v + SPA.nugget * r.normal(); });
        var f = fitRes(x, y), h = new Array(n), s = 0;
        for (i = 0; i < n; i++) h[i] = f.xc[i] * f.e[i];
        for (i = 0; i < n; i++) { var L = nb[i], hi = 0; for (k = 0; k < L.length; k++) hi += h[L[k]]; s += h[i] * hi; }
        var o = packT(f.b, f.seD, Math.sqrt(Math.max(s, 1e-12)) / f.sxx, 1.96);
        o.x = x; o.y = y;
        return o;
      }
    };
  };

  // Rejection rates over k samples from a fresh stream.
  S.placeboRun = function (name, k, seed, dep) {
    var s = S[name](seed, dep), rd = 0, rc = 0;
    for (var i = 0; i < k; i++) { var e = s.next(); if (e.rejD) rd++; if (e.rejC) rc++; }
    return { default: rd / k, corrected: rc / k };
  };

  // The shared layout. cfg: sim (a name in S), seed, alt, left (title),
  // corr (the corrected standard error's name), units for the panel title
  // and readout, modes (labels for the independent and the dependent
  // data-generating process; the toggle starts on independent and each
  // switch resets), setup(svg) drawing the static left panel and returning
  // draw(group, e), and fmtB(b) for the readout.
  function placeboDemo(root, opts, cfg) {
    var seed = intOpt(opts.seed, cfg.seed), K = 1000;
    var svg = M06.svg(root, 960, 378, cfg.alt);
    heading(svg, 80, 22, cfg.left, null);
    var draw = cfg.setup(svg);
    var picG = M06.g(svg);

    // Right panel: the estimates across repeated samples, the true value,
    // and three 95% brackets centered as follows. Black: the 2.5th to
    // 97.5th percentiles of the estimates, where they actually fall. Grey:
    // 0 ± 1.96 × the average default standard error. Blue: the same with
    // the corrected standard error.
    var P0 = 540, P1 = 930, lo = cfg.bLo, hi = cfg.bHi, NB = 60, PB = 320, HT = 150, sxB = M06.scale(lo, hi, P0, P1);
    heading(svg, P0, 22, 'Estimates across repeated samples', null);
    var hB = stepHist(svg, sxB, PB, HT, lo, hi, NB, col.axis);
    M06.axisX(svg, sxB, PB, cfg.bTicks, cfg.bTick, { title: cfg.bTitle });
    M06.vline(svg, r1(sxB(0)), 160, PB, { color: col.red, width: 2.5 });
    function bracket(y, color, w) {
      var g = M06.g(svg, { visibility: 'hidden' });
      var lab = M06.text(g, 0, y - 8, '', { size: 16.5, fill: color, anchor: 'middle', weight: 700 });
      var ln = M06.el('path', { fill: 'none', stroke: color, 'stroke-width': w || 3 }, g);
      return {
        set: function (a, b, text) {
          var xa = sxB(clamp(a, lo, hi)), xb = sxB(clamp(b, lo, hi));
          ln.setAttribute('d', 'M' + r1(xa) + ',' + (y + 7) + 'V' + y + 'H' + r1(xb) + 'V' + (y + 7));
          attrs(lab, { x: r1((xa + xb) / 2) });
          lab.textContent = text;
          show(g, true);
        },
        hide: function () { show(g, false); }
      };
    }
    var brA = bracket(66, col.ink), brD = bracket(106, col.axis), brC = bracket(146, col.blue);

    var mvals = cfg.modeValues || [false, true];
    var bar = M06.controls(root), out = M06.readout(root), run = runner(), sim, est, seD, seC, rd, rc, maxC, dep = mvals[0];
    var busyUntil = 0;
    function fresh(ev) { return !ev || !(ev.timeStamp < busyUntil); }
    M06.toggle(bar, cfg.modes, mvals, mvals[0], function (v) { if (v === dep) return; dep = v; reset(); });
    function render() {
      maxC = Math.max(maxC, tallest(hB.bins));
      hB.render(maxC);
      if (est.length < 2) { brA.hide(); brD.hide(); brC.hide(); return; }
      var sd = M06.sd(est), mD = M06.mean(seD), mC = M06.mean(seC);
      brA.set(M06.quantile(est, 0.025), M06.quantile(est, 0.975), '95% of the estimates · SD ' + cfg.fmtB(sd, true));
      brD.set(-1.96 * mD, 1.96 * mD, 'default 95% interval · SE ' + cfg.fmtB(mD, true));
      brC.set(-1.96 * mC, 1.96 * mC, cfg.corr.replace(' SE', '') + ' 95% interval · SE ' + cfg.fmtB(mC, true));
    }
    function add(e) { est.push(e.b); seD.push(e.seD); seC.push(e.seC); if (e.rejD) rd++; if (e.rejC) rc++; hB.add(e.b); }
    function update() {
      var n = est.length;
      out.innerHTML = cfg.Units + ': ' + num(n) + SEP + 'Rejection rate at 5%: default SE ' +
        (n ? bold(pct(rd / n)) : DASH) + ', ' + cfg.corr + ' ' + (n ? bold(pct(rc / n)) : DASH);
    }
    function show1(e) { clear(picG); draw(picG, e); }
    function one() {
      run.finish();
      var e = sim.next();
      show1(e);
      picG.setAttribute('opacity', 0);
      run.run(500, function (p) { picG.setAttribute('opacity', p.toFixed(3)); }, function () {
        add(e); render(); update();
      });
    }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = hB.bins.slice();
      batch.forEach(function (e) { var k = binOf(e.b, lo, hi, NB); if (k >= 0) fb[k]++; });
      maxC = Math.max(maxC, tallest(fb));
      if (G.performance) busyUntil = G.performance.now();
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        render(); update();
      }, function () {
        while (done < K) add(batch[done++]);
        render(); show1(batch[K - 1]); picG.setAttribute('opacity', 1); update();
      });
    }
    function reset() {
      run.cancel();
      sim = S[cfg.sim](seed, dep); est = []; seD = []; seC = []; rd = 0; rc = 0; maxC = 8;
      hB.clear(); render(); clear(picG); update();
    }
    // "Run 1,000" computes its samples before animating, which can block the
    // page for a moment (the spatial demo most). Clicks queued during that
    // pause carry an earlier timestamp and are ignored.
    M06.button(bar, 'Run one', function (ev) { if (fresh(ev)) one(); });
    M06.button(bar, 'Run 1,000', function (ev) { if (fresh(ev)) many(); });
    M06.button(bar, 'Reset', function (ev) { if (fresh(ev)) reset(); });
    reset();
  }
  function fmt3(x) { return (x < 0 ? MINUS : '') + num(Math.abs(x), 3); }
  function fmt2s(x) { return (x < 0 ? MINUS : '') + num(Math.abs(x), 2); }
  function tick1(v) { return v < 0 ? MINUS + num(-v, 1) : num(v, 1); }
  function fmt2(x) { return (x < 0 ? MINUS : '') + num(Math.abs(x), 2); }

  M06.demos.hetero = function (root, opts) {
    var X0 = 80, X1 = 450, YT = 50, YB = 320, sx = M06.scale(0, 40, X0, X1), sy = M06.scale(-80, 80, YB, YT);
    placeboDemo(root, opts, {
      sim: 'hetero', seed: HET.seed, unit: 'sample', units: 'samples', Units: 'Samples', corr: 'robust SE',
      modes: ['Constant variance', 'Rising variance', 'Falling variance'], modeValues: [0, 1, 2],
      bLo: -0.8, bHi: 0.8, bTicks: [-0.8, -0.4, 0, 0.4, 0.8], bTick: tick1, bTitle: 'Estimated slope',
      left: 'One sample of 400 firms', fmtB: fmt2s,
      alt: 'One sample of 400 firms whose revenue variance is constant, rises or falls with marketing spend, and the estimated slopes ' +
        'from 1,000 samples against the 95% intervals implied by default and heteroskedasticity-robust standard errors',
      setup: function (svg) {
        M06.axisY(svg, sy, X0, ticks(-80, 80, 40), function (v) { return (v < 0 ? MINUS : v > 0 ? '+' : '') + '$' + num0(Math.abs(v)) + 'k'; },
          { title: 'Change in revenue' });
        M06.axisX(svg, sx, YB, ticks(0, 40, 10), function (v) { return '$' + num0(v) + 'k'; }, { title: 'Marketing spend' });
        M06.el('line', { x1: X0, x2: X1, y1: r1(sy(0)), y2: r1(sy(0)), stroke: col.red, 'stroke-width': 2.5 }, svg);
        return function (g, e) {
          for (var i = 0; i < e.x.length; i++) {
            if (e.x[i] > 40) continue;
            M06.el('circle', { cx: r1(sx(e.x[i])), cy: r1(sy(clamp(e.y[i], -80, 80))), r: 3, fill: col.mid, 'fill-opacity': 0.55, stroke: col.axis, 'stroke-width': 0.8 }, g);
          }
          M06.el('line', { x1: X0, x2: X1, y1: r1(sy(e.a)), y2: r1(sy(e.a + e.b * 40)), stroke: col.ink, 'stroke-width': 2.5, 'stroke-dasharray': '9 6' }, g);
        };
      }
    });
  };

  M06.demos.panel = function (root, opts) {
    var X0 = 80, X1 = 450, YT = 50, YB = 320, sx = M06.scale(PAN.y0, PAN.y0 + PAN.T - 1, X0, X1), sy = M06.scale(-5, 5, YB, YT);
    placeboDemo(root, opts, {
      sim: 'panel', seed: PAN.seed, unit: 'placebo law', units: 'placebo laws', Units: 'Placebo laws', corr: 'clustered SE',
      modes: ['Independent years', 'Correlated years'],
      bLo: -1.2, bHi: 1.2, bTicks: [-1.2, -0.6, 0, 0.6, 1.2], bTick: tick1, bTitle: 'Estimated effect of the law',
      left: 'One sample of 50 states (eight shown)', fmtB: fmt2s,
      alt: 'Outcomes of eight states over 21 years, with a placebo law in four of them, and the estimated effects ' +
        'of 1,000 placebo laws against the 95% intervals implied by default standard errors and standard errors clustered by state',
      setup: function (svg) {
        M06.axisY(svg, sy, X0, ticks(-4, 4, 2), function (v) { return v < 0 ? MINUS + num0(-v) : num0(v); }, { title: 'Outcome, demeaned' });
        M06.axisX(svg, sx, YB, [1979, 1984, 1989, 1994, 1999], function (v) { return String(v); }, { title: 'Year' });
        M06.text(svg, X1, YT - 8, 'red: years under the placebo law', { size: 14, fill: col.red, anchor: 'end' });
        return function (g, e) {
          var T = PAN.T, treated = [], control = [];
          e.order.forEach(function (s) { if (e.start[s] >= 0) { if (treated.length < 4) treated.push(s); } else if (control.length < 4) control.push(s); });
          treated.concat(control).forEach(function (s) {
            var pts = [], post = [];
            for (var t = 0; t < T; t++) {
              var p = r1(sx(PAN.y0 + t)) + ',' + r1(sy(clamp(e.y[s * T + t], -5, 5)));
              pts.push(p);
              if (e.start[s] >= 0 && t >= e.start[s]) post.push(p);
            }
            M06.el('polyline', { points: pts.join(' '), fill: 'none', stroke: col.mid, 'stroke-width': 2 }, g);
            if (post.length > 1) M06.el('polyline', { points: post.join(' '), fill: 'none', stroke: col.red, 'stroke-width': 3 }, g);
          });
        };
      }
    });
  };

  M06.demos.cluster = function (root, opts) {
    var X0 = 80, X1 = 450, YT = 50, YB = 320, sy = M06.scale(0, 100, YB, YT), cw = (X1 - X0 - 20) / CL.G;
    function colX(j) { return X0 + 10 + j * cw + cw / 2; }
    placeboDemo(root, opts, {
      sim: 'cluster', seed: CL.seed, unit: 'experiment', units: 'experiments', Units: 'Experiments', corr: 'clustered SE',
      modes: ['Independent shoppers', 'Correlated within stores'],
      bLo: -8, bHi: 8, bTicks: [-8, -4, 0, 4, 8], bTick: function (v) { return fmt.money(v, 0); }, bTitle: 'Estimated difference in basket size',
      left: 'One sample of 20 stores', fmtB: function (x) { return fmt.money(x, 2); },
      alt: 'One placebo experiment in 20 stores, and the estimated differences from 1,000 placebo experiments ' +
        'against the 95% intervals implied by default and clustered standard errors',
      setup: function (svg) {
        M06.axisY(svg, sy, X0, ticks(0, 100, 25), function (v) { return '$' + num0(v); }, { title: 'Basket size' });
        M06.el('line', { x1: X0, x2: X1, y1: YB, y2: YB, stroke: col.axis, 'stroke-width': 1.5 }, svg);
        M06.text(svg, X0 + 10 + cw * 5, YB + 24, '10 treated stores', { size: 16, fill: col.red, anchor: 'middle', weight: 600 });
        M06.text(svg, X0 + 10 + cw * 15, YB + 24, '10 control stores', { size: 16, fill: col.axis, anchor: 'middle', weight: 600 });
        return function (g, e) {
          var tr = e.stores.filter(function (s) { return s.treated; }), co = e.stores.filter(function (s) { return !s.treated; });
          var jr = M06.rng(99);
          tr.concat(co).forEach(function (s, j) {
            var cx = colX(j), c = s.treated ? col.red : col.axis;
            s.ys.forEach(function (y) {
              M06.el('circle', { cx: r1(cx + (jr() - 0.5) * cw * 0.7), cy: r1(sy(clamp(y, 0, 100))), r: 1.9, fill: c, 'fill-opacity': 0.35 }, g);
            });
            M06.el('line', { x1: r1(cx - cw * 0.45), x2: r1(cx + cw * 0.45), y1: r1(sy(s.mean)), y2: r1(sy(s.mean)), stroke: col.ink, 'stroke-width': 2.5 }, g);
          });
        };
      }
    });
  };

  M06.demos.spatial = function (root, opts) {
    var N = SPA.N, W = 172, cs = W / N, M1 = 80, M2 = 278, MT = 60;
    placeboDemo(root, opts, {
      sim: 'spatial', seed: SPA.seed, unit: 'sample', units: 'samples', Units: 'Samples', corr: 'Conley SE',
      modes: ['Independent counties', 'Correlated counties'],
      bLo: -0.45, bHi: 0.45, bTicks: [-0.4, -0.2, 0, 0.2, 0.4], bTick: tick1, bTitle: 'Estimated effect on yield',
      left: 'One sample of 1,600 counties', fmtB: fmt3,
      alt: 'Maps of a program that covers contiguous counties and of yields that are similar in neighboring ' +
        'counties, and the estimated effects from 1,000 samples against the 95% intervals implied by default and Conley standard errors',
      setup: function (svg) {
        M06.text(svg, M1 + W / 2, MT + W + 26, 'Program counties', { size: 16, fill: col.red, anchor: 'middle', weight: 600 });
        M06.text(svg, M2 + W / 2, MT + W + 26, 'Yield', { size: 16, fill: col.blue, anchor: 'middle', weight: 600 });
        M06.text(svg, M1, MT + W + 60, 'The program has no effect on yield.', { size: 15, fill: col.grey });
        [M1, M2].forEach(function (x0) {
          M06.el('rect', { x: x0, y: MT, width: W, height: W, fill: 'none', stroke: col.axis, 'stroke-width': 1 }, svg);
        });
        return function (g, e) {
          var i, j, lo = -2, hi = 2;
          for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
            var k = i * N + j, x = r1(j * cs), y = r1(MT + i * cs), w = r1(cs + 0.4);
            if (e.x[k]) M06.el('rect', { x: r1(M1 + j * cs), y: y, width: w, height: w, fill: col.red, 'fill-opacity': 0.8 }, g);
            var v = clamp((e.y[k] - lo) / (hi - lo), 0, 1);
            M06.el('rect', { x: r1(M2 + j * cs), y: y, width: w, height: w, fill: col.blue, 'fill-opacity': r1(100 * v) / 100 }, g);
          }
        };
      }
    });
  };

  // =================================================================================
  // 6 · subgroups
  // =================================================================================
  // One coupon test, cut into 4 regions × 5 age groups. The coupon has no
  // effect in any subgroup. Each subgroup's estimate is z·SE with z ~ N(0, 1)
  // and an SE between 1.0 and 2.2 points set by the subgroup's size.
  var SUB = {
    regions: ['Northeast', 'Midwest', 'South', 'West'],
    ages: ['18–24', '25–34', '35–44', '45–54', '55+'],
    seed: 7501, crit: { raw: 1.96, bonf: 3.023 }
  };
  SUB.groups = [];
  SUB.regions.forEach(function (rg, i) {
    SUB.ages.forEach(function (ag, j) {
      SUB.groups.push({ label: rg + ' · ' + ag, se: 1.0 + 0.3 * ((i * 5 + j * 3) % 5) });
    });
  });
  S.subgroups = function (seed) {
    var r = M06.rng(seed == null ? SUB.seed : seed);
    return { next: function () { return SUB.groups.map(function () { return r.normal(); }); } };
  };
  S.subgroups.run = function (k, seed) {
    var s = S.subgroups(seed), raw = 0, bonf = 0;
    for (var i = 0; i < k; i++) {
      var m = Math.max.apply(null, s.next().map(Math.abs));
      if (m > SUB.crit.raw) raw++;
      if (m > SUB.crit.bonf) bonf++;
    }
    return { raw: raw / k, bonf: bonf / k };
  };

  M06.demos.subgroups = function (root, opts) {
    var seed = intOpt(opts.seed, SUB.seed), K = 1000;
    var svg = M06.svg(root, 960, 390, 'Estimated effects of a coupon in 20 subgroups with their confidence intervals, ' +
      'when the true effect is zero in every subgroup');
    var L = 250, R = 930, lo = -8, hi = 8, sx = M06.scale(lo, hi, L, R), top = 22, gap = 15.5, AX = 345;
    M06.axisX(svg, sx, AX, ticks(lo, hi, 2), function (v) { return v < 0 ? MINUS + num0(-v) : (v > 0 ? '+' : '') + num0(v); },
      { title: 'Effect of the coupon on the purchase rate (percentage points)' });
    M06.vline(svg, sx(0), top - 8, AX, { color: col.red, width: 2.5 });
    var rows = SUB.groups.map(function (g, i) {
      var y = top + i * gap + 6;
      var lab = M06.text(svg, L - 14, y + 5, g.label, { size: 14.5, fill: col.grey, anchor: 'end' });
      var gg = M06.g(svg, { visibility: 'hidden' });
      return { y: y, lab: lab, g: gg, line: M06.el('line', { 'stroke-width': 3 }, gg), dot: M06.el('circle', { r: 3.4 }, gg) };
    });

    var bar = M06.controls(root), out = M06.readout(root), run = runner();
    var sim, cur, maxes, mode = 'raw';
    M06.toggle(bar, ['95% intervals', 'Bonferroni'], ['raw', 'bonf'], 'raw', function (m) { mode = m; render(); update(); });
    function render() {
      var c = SUB.crit[mode];
      rows.forEach(function (rw, i) {
        if (!cur) { show(rw.g, false); rw.lab.setAttribute('fill', col.grey); return; }
        var se = SUB.groups[i].se, e = cur[i] * se, sig = Math.abs(cur[i]) > c;
        attrs(rw.line, { x1: r1(sx(clamp(e - c * se, lo, hi))), x2: r1(sx(clamp(e + c * se, lo, hi))), y1: rw.y, y2: rw.y,
          stroke: sig ? col.red : col.mid, 'stroke-width': sig ? 3.6 : 2.6 });
        attrs(rw.dot, { cx: r1(sx(clamp(e, lo, hi))), cy: rw.y, fill: sig ? col.red : col.axis });
        rw.lab.setAttribute('fill', sig ? col.red : col.grey);
        rw.lab.setAttribute('font-weight', sig ? 700 : 400);
        show(rw.g, true);
      });
    }
    function update() {
      var c = SUB.crit[mode], k = maxes.length, hit = maxes.filter(function (m) { return m > c; }).length;
      var nowSig = cur ? cur.filter(function (z) { return Math.abs(z) > c; }).length : 0;
      out.innerHTML = 'Studies: ' + num(k) + (cur ? SEP + 'Significant subgroups in this study: ' + bold(num(nowSig)) : '') +
        SEP + 'Studies with at least one: ' + (k ? bold(pct(hit / k)) : DASH);
    }
    function one() {
      run.finish();
      cur = sim.next(); maxes.push(Math.max.apply(null, cur.map(Math.abs)));
      render(); update();
    }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      run.run(2000, function (p) {
        var t = Math.floor(K * p);
        while (done < t) { cur = batch[done++]; maxes.push(Math.max.apply(null, cur.map(Math.abs))); }
        render(); update();
      }, function () {
        while (done < K) { cur = batch[done++]; maxes.push(Math.max.apply(null, cur.map(Math.abs))); }
        render(); update();
      });
    }
    function reset() { run.cancel(); sim = S.subgroups(seed); cur = null; maxes = []; render(); update(); }
    M06.button(bar, 'Run one study', one);
    M06.button(bar, 'Run 1,000 studies', many);
    M06.button(bar, 'Reset', reset);
    reset();
  };

  // =================================================================================
  // 7 · controls
  // =================================================================================
  // Z ~ N(0, 1), X = 0.8 Z + e, M = X + e, Y = 0.5 X + 0.5 M + Z + e,
  // C = X + Y + e, every e ~ N(0, 1). The total effect of X on Y is
  // 0.5 + 0.5 × 1 = 1.0. In large samples: Y on X gives about 1.49; adding
  // Z gives 1.00; adding Z and M gives the direct effect, 0.50; adding Z and
  // C gives about −0.11.
  var CTL = { n: 200, seed: 7601, truth: 1 };
  CTL.specs = [
    { label: 'Y on X', sub: 'no controls', box: [] },
    { label: 'Y on X and Z', sub: 'controls for the confounder', box: ['Z'] },
    { label: 'Y on X, Z and M', sub: 'adds the mediator', box: ['Z', 'M'] },
    { label: 'Y on X, Z and C', sub: 'adds the collider', box: ['Z', 'C'] }
  ];
  S.controls = function (seed, n) {
    var r = M06.rng(seed == null ? CTL.seed : seed);
    n = n || CTL.n;
    return {
      next: function () {
        var Z = [], X = [], M = [], Y = [], C = [], i;
        for (i = 0; i < n; i++) {
          Z.push(r.normal());
          X.push(0.8 * Z[i] + r.normal());
          M.push(X[i] + r.normal());
          Y.push(0.5 * X[i] + 0.5 * M[i] + Z[i] + r.normal());
          C.push(X[i] + Y[i] + r.normal());
        }
        return [ols([X], Y)[1], ols([X, Z], Y)[1], ols([X, Z, M], Y)[1], ols([X, Z, C], Y)[1]];
      }
    };
  };
  S.controls.run = function (k, seed) {
    var s = S.controls(seed), est = [[], [], [], []];
    for (var i = 0; i < k; i++) s.next().forEach(function (b, j) { est[j].push(b); });
    return est.map(summary);
  };

  M06.demos.controls = function (root, opts) {
    var seed = intOpt(opts.seed, CTL.seed), K = 1000;
    var svg = M06.svg(root, 960, 410, 'A causal graph with a confounder, a mediator and a collider, and the sampling ' +
      'distributions of the coefficient on X under four sets of controls');
    var defs = M06.el('defs', null, svg);
    var mg = marker(defs, col.axis), mr = marker(defs, col.red);

    // The graph. Nodes are ellipses; edges stop at the ellipse boundary.
    var N = {
      Z: { x: 200, y: 52, name: 'Market size', role: 'Z · confounder' },
      X: { x: 72, y: 172, name: 'Ad spend', role: 'X · treatment' },
      Y: { x: 328, y: 172, name: 'Sales', role: 'Y · outcome' },
      M: { x: 200, y: 262, name: 'Store visits', role: 'M · mediator' },
      C: { x: 200, y: 366, name: 'Rating', role: 'C · collider' }
    };
    var RX = 62, RY = 27;
    function edge(a, b, causal) {
      var A = N[a], B = N[b], dx = B.x - A.x, dy = B.y - A.y;
      function cut(k) { return 1 / Math.sqrt((dx * dx) / (RX * RX) + (dy * dy) / (RY * RY)) * k; }
      var t0 = cut(1), t1 = 1 - cut(1) - 0.012;
      M06.el('line', {
        x1: r1(A.x + dx * t0), y1: r1(A.y + dy * t0), x2: r1(A.x + dx * t1), y2: r1(A.y + dy * t1),
        stroke: causal ? col.red : col.axis, 'stroke-width': causal ? 3.2 : 2.4, 'marker-end': causal ? mr : mg
      }, svg);
    }
    edge('Z', 'X'); edge('Z', 'Y'); edge('X', 'Y', true); edge('X', 'M', true); edge('M', 'Y', true);
    edge('X', 'C'); edge('Y', 'C');
    var boxes = {};
    Object.keys(N).forEach(function (k) {
      var n = N[k];
      boxes[k] = M06.el('rect', { x: n.x - RX - 8, y: n.y - RY - 8, width: 2 * RX + 16, height: 2 * RY + 16, rx: 6,
        fill: 'none', stroke: col.red, 'stroke-width': 2.5, 'stroke-dasharray': '7 4', visibility: 'hidden' }, svg);
      M06.el('ellipse', { cx: n.x, cy: n.y, rx: RX, ry: RY, fill: '#fff', stroke: col.axis, 'stroke-width': 2 }, svg);
      M06.text(svg, n.x, n.y - 2, n.name, { size: 17, weight: 600, anchor: 'middle' });
      M06.text(svg, n.x, n.y + 16, n.role, { size: 12.5, fill: col.grey, anchor: 'middle' });
    });

    // Four rows of sampling distributions.
    var P0 = 470, P1 = 930, lo = -0.75, hi = 2.25, NB = 60, sx = M06.scale(lo, hi, P0, P1), rowH = 82, base0 = 112, HT = 50;
    var rows = CTL.specs.map(function (sp, j) {
      var y0 = base0 + j * rowH;
      var lab = M06.text(svg, P0, y0 - HT - 10, sp.label, { size: 16.5, weight: 700 });
      var sub = M06.text(svg, P0 + 150, y0 - HT - 10, sp.sub, { size: 14, fill: col.grey });
      M06.el('line', { x1: P0, x2: P1, y1: y0, y2: y0, stroke: col.light, 'stroke-width': 1.5 }, svg);
      var h = stepHist(svg, sx, y0, HT, lo, hi, NB, col.axis);
      var mean = M06.text(svg, P1, y0 - HT - 10, '', { size: 15, fill: col.ink, anchor: 'end', weight: 600 });
      return { lab: lab, sub: sub, h: h, mean: mean, est: [] };
    });
    var AX = base0 + 3 * rowH + 4;
    M06.axisX(svg, sx, AX, ticks(-0.5, 2, 0.5), function (v) { return v < 0 ? MINUS + num(-v, 1) : num(v, 1); },
      { title: 'Estimated coefficient on X' });
    M06.vline(svg, r1(sx(CTL.truth)), 26, AX, { color: col.red, label: 'true effect 1.0', anchor: 'middle', dy: 2 });

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), sim, maxC, sel = 0;
    var tg = M06.toggle(bar, ['No controls', 'Z', 'Z and M', 'Z and C'], [0, 1, 2, 3], 0, function (v) { sel = v; highlight(); });
    function highlight() {
      Object.keys(boxes).forEach(function (k) { show(boxes[k], CTL.specs[sel].box.indexOf(k) >= 0); });
      rows.forEach(function (rw, j) {
        var on = j === sel;
        rw.h.color(on ? col.blue : col.mid);
        rw.lab.setAttribute('fill', on ? col.blue : col.ink);
      });
    }
    function renderH() {
      rows.forEach(function (rw) { maxC = Math.max(maxC, tallest(rw.h.bins)); });
      rows.forEach(function (rw) {
        rw.h.render(maxC);
        rw.mean.textContent = rw.est.length ? 'mean ' + (M06.mean(rw.est) < 0 ? MINUS : '') + num(Math.abs(M06.mean(rw.est)), 2) : '';
      });
    }
    function add(b) { rows.forEach(function (rw, j) { rw.est.push(b[j]); rw.h.add(b[j]); }); }
    function update(b) {
      out.innerHTML = 'Samples of 200: ' + num(rows[0].est.length) +
        (b ? SEP + 'Last sample: ' + b.map(function (v) { return bold(v < 0 ? MINUS + num(-v, 2) : num(v, 2)); }).join(', ') : '');
    }
    function one() { run.finish(); var b = sim.next(); add(b); renderH(); update(b); }
    function many() {
      run.finish();
      var batch = [], done = 0, i;
      for (i = 0; i < K; i++) batch.push(sim.next());
      var fb = rows.map(function (rw) { return rw.h.bins.slice(); });
      batch.forEach(function (b) { b.forEach(function (v, j) { var k = binOf(v, lo, hi, NB); if (k >= 0) fb[j][k]++; }); });
      fb.forEach(function (f) { maxC = Math.max(maxC, tallest(f)); });
      run.run(2200, function (p) {
        var t = Math.floor(K * p);
        while (done < t) add(batch[done++]);
        renderH(); update(null);
      }, function () { while (done < K) add(batch[done++]); renderH(); update(batch[K - 1]); });
    }
    function reset() {
      run.cancel(); sim = S.controls(seed); maxC = 6;
      rows.forEach(function (rw) { rw.est = []; rw.h.clear(); });
      renderH(); update(null);
    }
    M06.button(bar, 'Draw one sample', one);
    M06.button(bar, 'Draw 1,000 samples', many);
    M06.button(bar, 'Reset', reset);
    highlight(); reset();
  };

  // =================================================================================
  // 10 · power
  // =================================================================================
  // 1,000 coupon tests. The base purchase rate is 5% and the coupon adds 1
  // percentage point. With n customers per arm the standard error of the
  // difference is 100·√((0.05 × 0.95 + 0.06 × 0.94) / n) points, the
  // variance of each arm. Each study's estimate is θ + SE·z with one fixed z per
  // study, so moving the sample-size slider rescales the same 1,000 draws.
  // A study is significant when |estimate| > 1.96 SE. The exaggeration ratio
  // is the mean |estimate| among significant studies over θ (Gelman and
  // Carlin's Type M error); the wrong-sign share is their Type S error.
  var POW = { theta: 1, p: 0.05, ns: [500, 1000, 2000, 4000, 8000, 16000], start: 1, K: 1000, seed: 7801 };
  S.power = (function () {
    var r = M06.rng(POW.seed), z = [];
    for (var i = 0; i < POW.K; i++) z.push(r.normal());
    var q = POW.p + POW.theta / 100;
    function se(n) { return 100 * Math.sqrt((POW.p * (1 - POW.p) + q * (1 - q)) / n); }
    return {
      se: se,
      at: function (n) {
        var s = se(n), est = z.map(function (v) { return POW.theta + s * v; }), sig = [], wrong = 0, absSum = 0;
        est.forEach(function (e) { if (Math.abs(e) > 1.96 * s) { sig.push(e); absSum += Math.abs(e); if (e < 0) wrong++; } });
        return {
          n: n, se: s, mde: 2.8 * s, est: est, sig: sig.length, power: sig.length / POW.K,
          meanSig: sig.length ? M06.mean(sig) : null,
          meanAbsSig: sig.length ? absSum / sig.length : null,
          exag: sig.length ? absSum / sig.length / POW.theta : null,
          typeS: sig.length ? wrong / sig.length : null
        };
      }
    };
  })();

  M06.demos.power = function (root) {
    var svg = M06.svg(root, 960, 360, 'Estimates from 1,000 coupon tests with a true effect of 1 point, with the ' +
      'significant ones highlighted, as the sample size per arm changes');
    var X0 = 60, X1 = 640, lo = -4, hi = 6, NB = 50, BW = (hi - lo) / NB, B = 300, HT = 220, sx = M06.scale(lo, hi, X0, X1);
    heading(svg, X0, 22, 'Estimates from 1,000 studies', null);
    var barsG = M06.g(svg);
    M06.axisX(svg, sx, B, ticks(lo, hi, 1), function (v) { return v < 0 ? MINUS + num0(-v) : (v > 0 ? '+' : '') + num0(v); },
      { title: 'Estimated effect of the coupon (percentage points)' });
    var thrL = M06.el('line', { y1: 46, y2: B, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, svg);
    var thrR = M06.el('line', { y1: 46, y2: B, stroke: col.ink, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, svg);
    var thrLab = M06.text(svg, 0, 42, 'significant beyond', { size: 15, fill: col.ink, anchor: 'start' });
    M06.vline(svg, r1(sx(POW.theta)), 62, B, { color: col.red, label: 'true effect 1', anchor: 'end', dy: 0 });
    var meanL = M06.el('line', { y1: 100, y2: B, stroke: col.blue, 'stroke-width': 2.5, 'stroke-dasharray': '8 5' }, svg);
    var meanLab = M06.text(svg, 0, 96, '', { size: 15, fill: col.blue, anchor: 'start', weight: 700 });

    var R0 = 680, rows = [
      ['Sample size per arm', col.ink], ['Standard error', col.ink], ['Minimum detectable effect', col.ink],
      ['Power', col.blue], ['Mean absolute significant estimate', col.blue], ['Significant with the wrong sign', col.blue]
    ];
    var vals = rows.map(function (rw, i) {
      M06.text(svg, R0, 40 + i * 50, rw[0], { size: 15, fill: col.grey });
      return M06.text(svg, R0, 62 + i * 50, '', { size: 21, fill: rw[1], weight: 700 });
    });

    var bar = M06.controls(root), out = M06.readout(root), k = POW.start;
    var sl = M06.slider(bar, 'Sample size per arm', 0, POW.ns.length - 1, 1, POW.start, function (v) { k = v; draw(); });
    function draw() {
      var d = S.power.at(POW.ns[k]), cS = new Array(NB).fill(0), cN = new Array(NB).fill(0);
      d.est.forEach(function (e) {
        var j = binOf(e, lo, hi, NB); if (j < 0) return;
        if (Math.abs(e) > 1.96 * d.se) cS[j]++; else cN[j]++;
      });
      var m = 0; for (var j = 0; j < NB; j++) m = Math.max(m, cS[j] + cN[j]);
      clear(barsG);
      for (j = 0; j < NB; j++) {
        var x0 = sx(lo + j * BW) + 0.5, w = Math.max(0.5, sx(lo + (j + 1) * BW) - sx(lo + j * BW) - 1);
        var hN = cN[j] / m * HT, hS = cS[j] / m * HT;
        if (hN > 0) M06.el('rect', { x: r1(x0), width: r1(w), y: r1(B - hN), height: r1(hN), fill: col.mid, 'fill-opacity': 0.75 }, barsG);
        if (hS > 0) M06.el('rect', { x: r1(x0), width: r1(w), y: r1(B - hN - hS), height: r1(hS), fill: col.blue, 'fill-opacity': 0.85 }, barsG);
      }
      var t = 1.96 * d.se;
      attrs(thrL, { x1: r1(sx(Math.max(lo, -t))), x2: r1(sx(Math.max(lo, -t))) });
      attrs(thrR, { x1: r1(sx(Math.min(hi, t))), x2: r1(sx(Math.min(hi, t))) });
      attrs(thrLab, { x: r1(sx(Math.min(hi, t)) + 6) });
      thrLab.textContent = 'significant beyond ±' + num(t, 1);
      show(meanL, d.meanAbsSig != null); show(meanLab, d.meanAbsSig != null);
      if (d.meanAbsSig != null) {
        var mx = sx(clamp(d.meanAbsSig, lo, hi));
        attrs(meanL, { x1: r1(mx), x2: r1(mx) });
        attrs(meanLab, { x: r1(mx + 6) });
        meanLab.textContent = 'mean absolute value ' + num(d.meanAbsSig, 1);
      }
      vals[0].textContent = num(d.n);
      vals[1].textContent = num(d.se, 2) + ' points';
      vals[2].textContent = num(d.mde, 1) + ' points';
      vals[3].textContent = pct(d.power);
      vals[4].textContent = d.meanAbsSig == null ? DASH : num(d.meanAbsSig, 1) + ' (' + num(d.exag, 1) + '× the true effect)';
      vals[5].textContent = d.typeS == null ? DASH : pct(d.typeS, 1);
      out.innerHTML = 'Base purchase rate 5%' + SEP + 'True effect ' + bold('+1 point') + SEP + 'Significant studies: ' + bold(num(d.sig)) + ' of 1,000';
    }
    draw();
  };

  // =================================================================================
  // 11 · mde (clustered designs and strata)
  // =================================================================================
  // Minimum detectable effect, in standard deviations of the outcome, for a
  // two-arm design that randomizes G clusters of m units, half treated, at
  // 5% significance and 80% power:
  //   MDE/σ = (1.96 + 0.84) · √(4/G) · √[ρ(1 − R²) + (1 − ρ)/m],
  // with ρ the intraclass correlation and R² the share of the between-store
  // variance explained by store strata or baseline store sales. Store-level
  // strata cannot reduce the within-store variance. Normal critical values;
  // with few clusters the t distribution raises it. Duflo, Glennerster and
  // Kremer (2007), section 4.
  var MDE = { Gs: [20, 40, 80], mLo: 1, mHi: 500, rho: 0.1, r2: 0, mMark: 50 };
  S.mde = function (G, m, rho, r2) {
    return 2.8 * Math.sqrt(4 / G) * Math.sqrt(rho * (1 - r2) + (1 - rho) / m);
  };

  M06.demos.mde = function (root) {
    var svg = M06.svg(root, 960, 340, 'Minimum detectable effect against the number of units per cluster, for 20, 40 ' +
      'and 80 clusters, as the intraclass correlation and the variance explained by strata change');
    var X0 = 90, X1 = 600, YT = 30, YB = 270, yHi = 1.2;
    var lx = function (m) { return X0 + (Math.log(m) - Math.log(MDE.mLo)) / (Math.log(MDE.mHi) - Math.log(MDE.mLo)) * (X1 - X0); };
    lx.range = [X0, X1];
    var sy = M06.scale(0, yHi, YB, YT);
    M06.axisY(svg, sy, X0, ticks(0, yHi, 0.2), function (v) { return num(v, 1); }, { title: 'MDE (SD of the outcome)' });
    M06.axisX(svg, lx, YB, [1, 2, 5, 10, 20, 50, 100, 200, 500], function (v) { return num0(v); }, { title: 'Shoppers per store (log scale)' });
    var colors = [col.ink, col.blue, col.mid];
    var lines = MDE.Gs.map(function (G, i) {
      return {
        G: G,
        floor: M06.el('line', { x1: X0, x2: X1, stroke: colors[i], 'stroke-width': 1.5, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.8 }, svg),
        path: M06.el('polyline', { fill: 'none', stroke: colors[i], 'stroke-width': 3 }, svg),
        lab: M06.text(svg, X1 + 8, 0, G + ' stores', { size: 16, fill: colors[i], weight: 700 })
      };
    });
    var mk = M06.el('circle', { r: 6, fill: col.red, stroke: '#fff', 'stroke-width': 1.5 }, svg);
    var mkLab = M06.text(svg, 0, 0, '', { size: 15, fill: col.red, weight: 700, anchor: 'start' });

    var R0 = 700;
    M06.text(svg, R0, 40, 'MDE at 50 shoppers per store', { size: 15, fill: col.grey });
    var vals = MDE.Gs.map(function (G, i) {
      M06.text(svg, R0, 72 + i * 32, G + ' stores', { size: 17, fill: colors[i], weight: 600 });
      return M06.text(svg, R0 + 230, 72 + i * 32, '', { size: 19, fill: colors[i], weight: 700, anchor: 'end' });
    });
    M06.text(svg, R0, 190, 'Floor as stores grow larger', { size: 15, fill: col.grey });
    var floorV = M06.text(svg, R0, 216, '', { size: 17, fill: col.ink, weight: 600 });
    M06.text(svg, R0, 256, '1,000 independent shoppers', { size: 15, fill: col.grey });
    var indV = M06.text(svg, R0, 282, '', { size: 17, fill: col.ink, weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root), rho = MDE.rho, r2 = MDE.r2;
    M06.slider(bar, 'Intraclass correlation', 0, 0.3, 0.01, rho, function (v) { rho = v; draw(); });
    M06.slider(bar, 'Between-store variance explained by strata', 0, 0.8, 0.1, r2, function (v) { r2 = v; draw(); });
    function draw() {
      var labYs = [];
      lines.forEach(function (L) {
        var pts = [];
        for (var k = 0; k <= 80; k++) {
          var m = Math.exp(Math.log(MDE.mLo) + k / 80 * (Math.log(MDE.mHi) - Math.log(MDE.mLo)));
          pts.push(r1(lx(m)) + ',' + r1(sy(Math.min(yHi, S.mde(L.G, m, rho, r2)))));
        }
        L.path.setAttribute('points', pts.join(' '));
        var fl = S.mde(L.G, 1e9, rho, r2);
        attrs(L.floor, { y1: r1(sy(fl)), y2: r1(sy(fl)) });
        show(L.floor, rho > 0);
        labYs.push({ L: L, y: sy(Math.min(yHi, S.mde(L.G, MDE.mHi, rho, r2))) + 5 });
      });
      labYs.sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < labYs.length; i++) labYs[i].y = Math.max(labYs[i].y, labYs[i - 1].y + 18);
      labYs.forEach(function (o) { o.L.lab.setAttribute('y', r1(o.y)); });
      var v20 = S.mde(20, MDE.mMark, rho, r2);
      attrs(mk, { cx: r1(lx(MDE.mMark)), cy: r1(sy(Math.min(yHi, v20))) });
      attrs(mkLab, { x: r1(lx(MDE.mMark) + 10), y: r1(sy(Math.min(yHi, v20)) - 10) });
      mkLab.textContent = 'clustered store experiment';
      MDE.Gs.forEach(function (G, j) { vals[j].textContent = num(S.mde(G, MDE.mMark, rho, r2), 2) + ' SD'; });
      floorV.textContent = num(S.mde(20, 1e9, rho, r2), 2) + ' SD with 20 stores';
      indV.textContent = num(2.8 * Math.sqrt(4 / 1000), 2) + ' SD';
      var deff = 1 + (MDE.mMark - 1) * rho;
      out.innerHTML = 'Intraclass correlation ' + bold(num(rho, 2)) + SEP + 'Between-store variance explained ' + bold(pct(r2)) +
        SEP + 'Design effect at 50 per store: ' + bold(num(deff, 1));
    }
    draw();
  };

  // =================================================================================
  // 8 · overlap (static)
  // =================================================================================
  // 120 stores without self-checkout, sizes ~ N(14, 4²) thousand sq ft, and
  // 40 that adopted it, ~ N(21, 5²), both floored at 4. Dots stack in bins
  // of 1,000 sq ft. Adopters in bins above the largest non-adopter's bin
  // have no comparable untreated store and are drawn hollow.
  S.overlap = (function () {
    var r = M06.rng(7701), c = [], t = [], i;
    for (i = 0; i < 120; i++) c.push(Math.max(4, 14 + 4 * r.normal()));
    for (i = 0; i < 40; i++) t.push(Math.max(4, 21 + 5 * r.normal()));
    var cMax = M06.max(c), tMin = Math.min.apply(null, t);
    return { control: c, treated: t, lo: tMin, hi: cMax,
      outside: t.filter(function (v) { return v >= Math.floor(cMax) + 1; }).length };
  })();

  M06.demos.overlap = function (root) {
    var D = S.overlap, svg = M06.svg(root, 960, 390, 'Store sizes of stores with and without self-checkout, ' +
      'and the range of sizes where both kinds of store exist');
    var X0 = 60, X1 = 920, sx = M06.scale(0, 40, X0, X1), bw = 1, rad = 4.8, step = 10;
    var bC = 200, bT = 330, top = 40;
    var bandX0 = sx(Math.floor(D.lo)), bandX1 = sx(Math.floor(D.hi) + 1);
    M06.el('rect', { x: r1(bandX0), y: top, width: r1(bandX1 - bandX0), height: bT - top, fill: col.paleblue, 'fill-opacity': 0.7 }, svg);
    M06.text(svg, (bandX0 + bandX1) / 2, top - 10, 'common support', { size: 16, fill: col.blue, weight: 700, anchor: 'middle' });
    M06.text(svg, bandX1 + 10, top - 10, 'no untreated store this large', { size: 16, fill: col.red, weight: 700 });
    function stack(vals, base, color, hollowAbove) {
      var counts = {};
      vals.slice().sort(function (a, b) { return a - b; }).forEach(function (v) {
        var k = Math.floor(v / bw), h = counts[k] || 0;
        counts[k] = h + 1;
        var out = hollowAbove != null && v > hollowAbove;
        M06.el('circle', { cx: r1(sx((k + 0.5) * bw)), cy: r1(base - rad - h * step), r: rad,
          fill: out ? '#fff' : color, 'fill-opacity': out ? 1 : 0.75, stroke: color, 'stroke-width': out ? 2 : 1 }, svg);
      });
    }
    stack(D.control, bC, col.axis);
    stack(D.treated, bT, col.red, Math.floor(D.hi) + 1);
    M06.el('line', { x1: X0, x2: X1, y1: bC, y2: bC, stroke: col.light, 'stroke-width': 1.5 }, svg);
    M06.text(svg, bandX1 + 10, bC - 12, 'Stores without self-checkout (120)', { size: 16, fill: col.axis, weight: 600 });
    M06.text(svg, X0 + 4, bT - 44, 'Stores that adopted it (40)', { size: 16, fill: col.red, weight: 600 });
    M06.axisX(svg, sx, bT, ticks(0, 40, 5), function (v) { return num0(v) + 'k'; }, { title: 'Store size (sq ft)' });
  };


  // =================================================================================
  // 9b · lalondeDesign (static)
  // =================================================================================
  // The design of LaLonde's test in two rows. The experiment compares the
  // NSW trainees with a randomized control group; LaLonde's test keeps the
  // trainees and compares them with survey men, adjusting for observed
  // controls. Sample sizes for men from LaLonde (1986), Table 3 (297 treated,
  // 425 controls) and Table 5 (PSID-1, 2,493; CPS-SSA-1, 15,992).
  M06.demos.lalondeDesign = function (root) {
    var svg = M06.svg(root, 960, 300, 'Two comparisons: NSW trainees against a randomized control group, which gives ' +
      'the benchmark of $886, and the same trainees against men from national surveys with controls, which is the test');
    function box(x, y, w, l1, l2, stroke, fill) {
      M06.el('rect', { x: x, y: y, width: w, height: 70, rx: 10, fill: fill || '#fff', stroke: stroke, 'stroke-width': 2.5 }, svg);
      M06.text(svg, x + w / 2, y + (l2 ? 30 : 41), l1, { size: 19, weight: 700, anchor: 'middle' });
      if (l2) M06.text(svg, x + w / 2, y + 54, l2, { size: 15, fill: col.grey, anchor: 'middle' });
    }
    function arrow(x1, x2, y) {
      M06.el('line', { x1: x1, x2: x2 - 8, y1: y, y2: y, stroke: col.axis, 'stroke-width': 2.5 }, svg);
      M06.el('path', { d: 'M' + (x2 - 12) + ',' + (y - 7) + 'L' + x2 + ',' + y + 'L' + (x2 - 12) + ',' + (y + 7) + 'Z', fill: col.axis }, svg);
    }
    var rows = [
      { y: 40, label: 'The experiment', l2: 'random assignment', B: ['425 control men', 'chosen at random'], res: '+$886', resSub: 'the benchmark', resCol: col.red },
      { y: 190, label: "LaLonde's test", l2: 'same trainees', B: ['Men from the PSID or CPS', 'with observed controls'], res: '?', resSub: 'does it match?', resCol: col.ink }
    ];
    rows.forEach(function (r) {
      M06.text(svg, 20, r.y + 32, r.label, { size: 18, weight: 700, fill: r.resCol });
      M06.text(svg, 20, r.y + 54, r.l2, { size: 15, fill: col.grey });
      box(190, r.y, 210, '297 trainees', 'NSW men', col.red, col.pale);
      M06.text(svg, 430, r.y + 42, 'vs', { size: 18, fill: col.grey, anchor: 'middle' });
      box(460, r.y, 250, r.B[0], r.B[1], col.axis);
      arrow(725, 775, r.y + 35);
      M06.text(svg, 850, r.y + 40, r.res, { size: 30, weight: 700, fill: r.resCol, anchor: 'middle' });
      M06.text(svg, 850, r.y + 62, r.resSub, { size: 15, fill: col.grey, anchor: 'middle' });
    });
    M06.text(svg, 480, 150, 'Throw away the randomized controls and use survey respondents instead', { size: 15, fill: col.grey, anchor: 'middle', style: 'italic' });
  };

  // =================================================================================
  // 9 · lalonde (static)
  // =================================================================================
  // LaLonde (1986), Table 5, p. 610: male participants, effect on 1978
  // earnings in 1982 dollars, with standard errors. The experiment is the
  // unadjusted treatment-control difference (column 4). The others replace
  // the experimental controls with PSID-1 (n = 2,493) or CPS-SSA-1
  // (n = 15,992): the simple difference (column 4), the regression-adjusted
  // difference (column 5), and all observed variables plus pre-training
  // earnings (column 10). Intervals are ±1.96 standard errors.
  function ci(label, est, se, kind) { return { label: label, est: est, lo: est - 1.96 * se, hi: est + 1.96 * se, kind: kind }; }
  S.lalonde = {
    alt: 'The experimental estimate of a training program on earnings, with its 95% interval, against six ' +
      'non-experimental estimates that use survey comparison groups',
    axis: 'Estimated effect on 1978 earnings (1982 dollars)',
    lo: -17500, hi: 3500, ticks: [-16000, -12000, -8000, -4000, 0],
    rows: [
      ci('Randomized experiment', 886, 476, 'exp'),
      ci('PSID · difference in means', -15578, 913),
      ci('CPS · difference in means', -8870, 562),
      ci('PSID · regression-adjusted', -8067, 990),
      ci('CPS · regression-adjusted', -4416, 557),
      ci('PSID · all observed controls', -1228, 896),
      ci('CPS · all observed controls', -805, 484)
    ]
  };
  M06.demos.lalonde = function (root, opts) {
    var D = S.lalonde;
    if (!D) { root.textContent = 'LaLonde estimates not loaded.'; return; }
    var rowsN = D.rows.length, rowH = 34, top = 40;
    var H = top + rowsN * rowH + 70;
    var svg = M06.svg(root, 960, H, D.alt);
    var L = 420, R = 920, sx = M06.scale(D.lo, D.hi, L, R), AX = top + rowsN * rowH + 6;
    M06.axisX(svg, sx, AX, D.ticks, function (v) { return (v < 0 ? MINUS : '') + '$' + num0(Math.abs(v)); }, { title: D.axis });
    M06.el('line', { x1: r1(sx(0)), x2: r1(sx(0)), y1: top - 14, y2: AX, stroke: col.light, 'stroke-width': 1.5 }, svg);
    var expRow = D.rows[0];
    M06.el('line', { x1: r1(sx(expRow.est)), x2: r1(sx(expRow.est)), y1: top - 14, y2: AX, stroke: col.red, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, svg);
    D.rows.forEach(function (rw, i) {
      var y = top + i * rowH + rowH / 2, isExp = rw.kind === 'exp', c = isExp ? col.red : col.axis;
      M06.text(svg, L - 16, y + 5, rw.label, { size: 15.5, fill: isExp ? col.red : col.ink, anchor: 'end', weight: isExp ? 700 : 400 });
      if (rw.lo != null) {
        M06.el('line', { x1: r1(sx(clamp(rw.lo, D.lo, D.hi))), x2: r1(sx(clamp(rw.hi, D.lo, D.hi))), y1: y, y2: y, stroke: c, 'stroke-width': 2.5 }, svg);
      }
      var off = rw.est < D.lo || rw.est > D.hi;
      M06.el('circle', { cx: r1(sx(clamp(rw.est, D.lo, D.hi))), cy: y, r: 6, fill: off ? '#fff' : c, stroke: c, 'stroke-width': 2 }, svg);
      if (off) M06.text(svg, r1(sx(clamp(rw.est, D.lo, D.hi)) + (rw.est < D.lo ? 12 : -12)), y + 5,
        (rw.est < 0 ? MINUS : '') + '$' + num0(Math.abs(rw.est)), { size: 14, fill: col.grey, anchor: rw.est < D.lo ? 'start' : 'end' });
    });
  };
})();
