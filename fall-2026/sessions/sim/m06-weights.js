/* m06-weights.js — weighting by precision, two demos for meeting 6.
 *
 *   gmm   Two surveys give two moment conditions for one parameter, mean
 *         monthly spend μ: E[ȳ_A − μ] = 0 and E[ȳ_B − μ] = 0. GMM with weight
 *         w on survey A and 1 − w on survey B gives
 *           μ̂(w) = w·ȳ_A + (1 − w)·ȳ_B,  SE(w) = √(w²SE_A² + (1 − w)²SE_B²),
 *         treating the two independent surveys' standard errors as known.
 *         The inverse-variance weight w* = (1/SE_A²) / (1/SE_A² + 1/SE_B²)
 *         gives the smallest standard error.
 *         data-na (50), data-nb (400), data-seed-a (1201), data-seed-b (1202),
 *         data-w (the starting weight, 0.5).
 *   wls   OLS against WLS when the error SD grows with store size x:
 *         x ~ U(1, 10), y = 20 + 5x + u, u ~ N(0, (1.5x)²), 25 stores a
 *         sample. WLS weights each store by w = 1/x², the inverse of its
 *         error variance up to scale. Both slopes in closed form.
 *         data-n (25), data-seed (1301).
 *
 * The math lives in M06.sims.gmm and M06.sims.wls and touches no DOM:
 *   node -e "global.window = global; require('./m06-core.js');
 *            require('./m06-sampling.js'); require('./m06-weights.js'); ..."
 * Reset rebuilds from the seeds, so the same clicks show the same numbers.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06 || !M06.rng) throw new Error('Load m06-core.js before m06-weights.js');
  M06.sims = M06.sims || {};
  var col = M06.col, fmt = M06.fmt;

  // ---- small helpers ------------------------------------------------------------
  var SEP = '<span class="sep">·</span>', DASH = '—';
  function bold(s) { return '<b>' + s + '</b>'; }
  function money(x, d) { return fmt.money(x, d == null ? 2 : d); }
  function money0(x) { return fmt.money(x, 0); }
  function num(x, d) { return fmt.num(x, d); }
  function num0(x) { return fmt.num(x, 0); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ticks(a, b, step) {
    var out = [];
    for (var v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function intOpt(v, dflt) { var n = parseInt(v, 10); return n > 0 ? n : dflt; }
  function numOpt(v, dflt, lo, hi) { var x = parseFloat(v); return isFinite(x) ? clamp(x, lo, hi) : dflt; }
  function attrs(el, o) { for (var k in o) el.setAttribute(k, o[k]); return el; }
  function show(el, on) { el.setAttribute('visibility', on ? 'visible' : 'hidden'); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function tallest(bins) { return Math.max.apply(null, bins); }
  var uidN = 0;
  function uid(p) { uidN += 1; return 'm06w-' + p + '-' + uidN; }
  // Mean and SD (n − 1) of a list; null until defined.
  function summary(v) {
    return { count: v.length, mean: v.length ? M06.mean(v) : null, sd: v.length >= 2 ? M06.sd(v) : null };
  }
  // Values off the axis stay out of the bars but still count in the readout.
  function binOf(v, lo, hi, nb) {
    if (!(v >= lo && v <= hi)) return -1;
    return Math.min(nb - 1, Math.floor((v - lo) / ((hi - lo) / nb)));
  }

  // ---- one animation at a time -----------------------------------------------------
  // run() first finishes whatever is running (its end state is drawn at
  // once), so a click never leaves a half-drawn state. cancel() just stops.
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

  // ---- simulations (no DOM) ----------------------------------------------------------
  // gmm: the two surveys and the GMM estimate and its standard error at any
  // weight w on survey A.
  M06.sims.gmm = function (o) {
    o = o || {};
    var pop = M06.customers();
    function survey(n, seed) {
      var v = M06.draw(pop.values, n, M06.rng(seed)), sd = M06.sd(v);
      return { n: n, seed: seed, mean: M06.mean(v), sd: sd, se: sd / Math.sqrt(n) };
    }
    var a = survey(o.nA || 50, o.seedA == null ? 1201 : o.seedA);
    var b = survey(o.nB || 400, o.seedB == null ? 1202 : o.seedB);
    var pa = 1 / (a.se * a.se), pb = 1 / (b.se * b.se);
    return {
      truth: pop.mean, a: a, b: b,
      wStar: pa / (pa + pb),
      est: function (w) { return w * a.mean + (1 - w) * b.mean; },
      se: function (w) { return Math.sqrt(w * w * a.se * a.se + (1 - w) * (1 - w) * b.se * b.se); }
    };
  };

  // wls: the data-generating process and the two fits.
  var DGP = { intercept: 20, slope: 5, sdPerX: 1.5, xLo: 1, xHi: 10, n: 25, seed: 1301 };
  // Least squares line through (x, y). With weights w, weighted least
  // squares: minimizes Σ w·e², so the means and sums are all weighted.
  function fitLine(x, y, w) {
    var n = x.length, sw = 0, sx = 0, sy = 0, i, wi;
    for (i = 0; i < n; i++) { wi = w ? w[i] : 1; sw += wi; sx += wi * x[i]; sy += wi * y[i]; }
    var mx = sx / sw, my = sy / sw, sxy = 0, sxx = 0;
    for (i = 0; i < n; i++) {
      wi = w ? w[i] : 1;
      sxy += wi * (x[i] - mx) * (y[i] - my);
      sxx += wi * (x[i] - mx) * (x[i] - mx);
    }
    var b = sxy / sxx;
    return { intercept: my - b * mx, slope: b };
  }
  // A stream of samples of n stores. Each next() draws the n sizes, then the
  // n errors, from one generator.
  M06.sims.wls = function (seed, n) {
    var r = M06.rng(seed == null ? DGP.seed : seed), k = 0;
    n = n || DGP.n;
    return {
      next: function () {
        var x = new Array(n), y = new Array(n), w = new Array(n), i;
        for (i = 0; i < n; i++) x[i] = DGP.xLo + (DGP.xHi - DGP.xLo) * r();
        for (i = 0; i < n; i++) {
          y[i] = DGP.intercept + DGP.slope * x[i] + DGP.sdPerX * x[i] * r.normal();
          w[i] = 1 / (x[i] * x[i]);
        }
        return { index: k++, x: x, y: y, w: w, ols: fitLine(x, y), wls: fitLine(x, y, w) };
      }
    };
  };
  M06.sims.wls.dgp = DGP;
  M06.sims.wls.fit = fitLine;
  // k samples from a fresh stream, as the demo draws them after Reset.
  M06.sims.wls.run = function (k, seed, n) {
    var s = M06.sims.wls(seed, n), bo = [], bw = [];
    for (var i = 0; i < k; i++) { var d = s.next(); bo.push(d.ols.slope); bw.push(d.wls.slope); }
    return { count: k, ols: summary(bo), wls: summary(bw) };
  };

  // ---- 1. gmm ---------------------------------------------------------------------------
  // Left: survey A, survey B and GMM as rows on one dollar axis, each a dot at
  // the estimate with its 95% interval. Right: the standard error of the GMM
  // estimate against the weight on survey A.
  M06.demos.gmm = function (root, opts) {
    var S = M06.sims.gmm({
      nA: intOpt(opts.na, 50), nB: intOpt(opts.nb, 400),
      seedA: intOpt(opts.seedA, 1201), seedB: intOpt(opts.seedB, 1202)
    });
    var w0 = numOpt(opts.w, 0.5, 0, 1), w = w0, wStar = S.wStar, seStar = S.se(wStar);
    var svg = M06.svg(root, 960, 400, 'Estimates of mean spend from survey A, survey B and GMM with weight w ' +
      'on survey A, each with a 95% interval, beside the standard error of the GMM estimate against the weight');

    // Left panel.
    var L = 40, R = 500, lo = 40, hi = 100, AX = 300;
    var sx = M06.scale(lo, hi, L, R);
    M06.text(svg, L, 22, 'Estimates of mean spend', { size: 17, weight: 700 });
    M06.el('line', { x1: L, x2: R, y1: 210, y2: 210, stroke: col.light, 'stroke-width': 1.5 }, svg);
    M06.vline(svg, r1(sx(S.truth)), 56, AX, { label: 'true mean ' + money(S.truth, 2) });

    function row(y, label, color) {
      var g = M06.g(svg);
      var lab = M06.text(g, L, y - 18, label, {
        size: 17, fill: color, weight: 600,
        stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round'
      });
      var line = M06.el('line', { y1: y, y2: y, stroke: color, 'stroke-width': 3 }, g);
      var c1 = M06.el('line', { y1: y - 8, y2: y + 8, stroke: color, 'stroke-width': 3 }, g);
      var c2 = M06.el('line', { y1: y - 8, y2: y + 8, stroke: color, 'stroke-width': 3 }, g);
      var dot = M06.el('circle', { cy: y, r: 7, fill: color }, g);
      return {
        lab: lab,
        set: function (m, se) {
          var a = r1(sx(clamp(m - 1.96 * se, lo, hi))), b = r1(sx(clamp(m + 1.96 * se, lo, hi)));
          attrs(line, { x1: a, x2: b });
          attrs(c1, { x1: a, x2: a });
          attrs(c2, { x1: b, x2: b });
          attrs(dot, { cx: r1(sx(clamp(m, lo, hi))) });
        }
      };
    }
    row(100, 'Survey A (n = ' + num(S.a.n) + ')', col.axis).set(S.a.mean, S.a.se);
    row(170, 'Survey B (n = ' + num(S.b.n) + ')', col.axis).set(S.b.mean, S.b.se);
    var rowG = row(255, '', col.red);
    M06.axisX(svg, sx, AX, ticks(lo, hi, 10), money0);
    M06.text(svg, L, AX + 52, 'Dot: estimate. Line: estimate ± 1.96 standard errors.', { size: 15, fill: col.grey });

    // Right panel.
    var PX0 = 610, PX1 = 920, PT = 60;
    var peak = Math.max(S.a.se, S.b.se) * 1.08, step = peak <= 8 ? 2 : peak <= 20 ? 5 : 10;
    var yMax = Math.ceil(peak / step) * step;
    var sw = M06.scale(0, 1, PX0, PX1), sy = M06.scale(0, yMax, AX, PT);
    M06.text(svg, PX1, 22, 'Standard error of the combined estimate', { size: 17, weight: 700, anchor: 'end' });
    M06.axisY(svg, sy, PX0, ticks(0, yMax, step), money0, { title: 'Standard error' });
    M06.axisX(svg, sw, AX, ticks(0, 1, 0.2), function (t) { return t === 0 || t === 1 ? String(t) : num(t, 1); },
      { title: 'Weight on survey A' });
    var d = '';
    for (var i = 0; i <= 200; i++) d += (i ? 'L' : 'M') + r1(sw(i / 200)) + ',' + r1(sy(S.se(i / 200)));
    M06.el('path', { d: d, fill: 'none', stroke: col.axis, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, svg);
    // The minimum, at the inverse-variance weight, labelled below the curve.
    var xs = r1(sw(wStar)), ys = r1(sy(seStar)), toRight = wStar <= 0.5;
    M06.el('line', { x1: xs, x2: xs, y1: ys, y2: AX, stroke: col.axis, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg);
    M06.el('circle', { cx: xs, cy: ys, r: 5, fill: '#fff', stroke: col.axis, 'stroke-width': 2 }, svg);
    M06.text(svg, r1(xs + (toRight ? 8 : -8)), r1(Math.min(ys + 32, AX - 12)), 'optimal weight: ' + num(wStar, 2),
      { size: 16, anchor: toRight ? 'start' : 'end', weight: 600 });
    var dot = M06.el('circle', { r: 7, fill: col.red }, svg);

    var bar = M06.controls(root), out = M06.readout(root), run = runner(), slider;

    function render() {
      var est = S.est(w), se = S.se(w);
      rowG.set(est, se);
      rowG.lab.textContent = 'GMM, weight ' + num(w, 2) + ' on A';
      attrs(dot, { cx: r1(sw(w)), cy: r1(sy(se)) });
      out.innerHTML = 'GMM estimate: ' + bold(money(est, 1)) + SEP + 'SE: ' + bold(money(se, 2)) +
        SEP + 'A alone: ' + money(S.a.mean, 1) + ' (SE ' + money(S.a.se, 2) + ')' +
        SEP + 'B alone: ' + money(S.b.mean, 1) + ' (SE ' + money(S.b.se, 2) + ')';
    }
    function setW(v) { w = clamp(v, 0, 1); slider.value = w; render(); }
    // Dragging the slider stops a running glide where it is.
    slider = M06.slider(bar, 'Weight on survey A', 0, 1, 0.01, w0, function (v) { run.cancel(); w = v; render(); });
    M06.button(bar, 'Optimal weights', function () {
      run.finish();
      var from = w;
      run.run(800, function (p) { setW(from + (wStar - from) * M06.ease(p)); }, function () { setW(wStar); });
    });
    M06.button(bar, 'Reset', function () { run.cancel(); setW(w0); });
    render();
  };

  // ---- 2. wls ----------------------------------------------------------------------------
  // An outline histogram: one path for the fill and one for the edge, drawn
  // only across the occupied bins so the empty ends leave the axis alone.
  function stepHist(parent, sx, y0, h, lo, hi, nb, color) {
    var bins = new Array(nb).fill(0), bw = (hi - lo) / nb;
    var fill = M06.el('path', { fill: color, 'fill-opacity': 0.12, stroke: 'none' }, parent);
    var edge = M06.el('path', { fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'miter' }, parent);
    return {
      bins: bins,
      add: function (v) { var k = binOf(v, lo, hi, nb); if (k >= 0) bins[k]++; },
      clear: function () { bins.fill(0); },
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
  }

  // Left: one sample, its OLS and WLS lines and the true line; point size
  // shows each store's WLS weight. Right: outline histograms of the OLS and
  // WLS slopes across samples, on one axis and one vertical scale.
  M06.demos.wls = function (root, opts) {
    var D = DGP, n = Math.max(3, intOpt(opts.n, D.n)), seed = intOpt(opts.seed, D.seed), K = 1000;
    var svg = M06.svg(root, 960, 420, 'One sample of ' + num(n) + ' stores with its OLS and WLS lines and the true ' +
      'line, point size showing the WLS weight, beside histograms of the OLS and WLS slope estimates across samples');
    var defs = M06.el('defs', null, svg);

    // Left panel.
    var X0 = 100, X1 = 430, YT = 50, AX = 330, ylo = 0, yhi = 120, LX0 = 0.5, LX1 = 10.5;
    var sxL = M06.scale(0, 11, X0, X1), syL = M06.scale(ylo, yhi, AX, YT);
    M06.text(svg, 40, 22, 'One sample', { size: 17, weight: 700 });
    M06.axisY(svg, syL, X0, ticks(ylo, yhi, 20), num0, { title: 'Sales' });
    M06.axisX(svg, sxL, AX, ticks(0, 10, 2), num0, { title: 'Store size (thousand sq ft)' });
    M06.text(svg, X0 + 12, YT + 16, 'point size = weight in WLS', { size: 15, fill: col.grey });
    var cid = uid('clip'), cp = M06.el('clipPath', { id: cid }, defs);
    M06.el('rect', { x: X0, y: YT - 10, width: X1 - X0, height: AX - YT + 10 }, cp);
    var plot = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    var ptsG = M06.g(plot);
    function lineAt(a, b, el) {
      attrs(el, { x1: r1(sxL(LX0)), x2: r1(sxL(LX1)), y1: r1(syL(a + b * LX0)), y2: r1(syL(a + b * LX1)) });
    }
    lineAt(D.intercept, D.slope, M06.el('line', { stroke: col.red, 'stroke-width': 2 }, plot));
    var fitG = M06.g(plot);
    var olsLine = M06.el('line', { stroke: col.axis, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, fitG);
    var wlsLine = M06.el('line', { stroke: col.blue, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, fitG);
    var labT = M06.text(svg, 0, 0, 'true slope ' + num(D.slope), { size: 16, fill: col.red, weight: 600 });
    var labO = M06.text(svg, 0, 0, '', { size: 16, fill: col.axis, weight: 600 });
    var labW = M06.text(svg, 0, 0, '', { size: 16, fill: col.blue, weight: 600 });
    // Point radius runs from 3 px (largest store) to 9 px (smallest) with √w.
    var rw0 = 1 / D.xHi, rw1 = 1 / D.xLo;
    function radius(x) { return 3 + 6 * clamp((1 / x - rw0) / (rw1 - rw0), 0, 1); }

    // Line labels at the right ends, pushed apart so they never overlap.
    function placeLabels(s) {
      var items = [{ el: labT, y: syL(D.intercept + D.slope * LX1) }];
      if (s) {
        items.push({ el: labO, y: syL(s.ols.intercept + s.ols.slope * LX1) });
        items.push({ el: labW, y: syL(s.wls.intercept + s.wls.slope * LX1) });
      }
      items.forEach(function (it) { it.y = clamp(it.y, YT + 6, AX - 6); });
      items.sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + 19);
      var over = items[items.length - 1].y - (AX - 6);
      if (over > 0) items.forEach(function (it) { it.y -= over; });
      items.forEach(function (it) { attrs(it.el, { x: r1(sxL(LX1) + 8), y: r1(it.y + 5) }); });
    }

    // Right panel.
    var P0 = 590, P1 = 920, blo = 2, bhi = 8, NB = 60, PB = 330, HT = 230;
    var sxR = M06.scale(blo, bhi, P0, P1);
    M06.text(svg, P0, 22, 'Slope estimates across samples', { size: 17, weight: 700 });
    var hO = stepHist(svg, sxR, PB, HT, blo, bhi, NB, col.axis);
    var hW = stepHist(svg, sxR, PB, HT, blo, bhi, NB, col.blue);
    M06.axisX(svg, sxR, PB, ticks(blo, bhi, 1), num0, { title: 'Slope estimate' });
    M06.vline(svg, r1(sxR(D.slope)), 78, PB, { label: 'true slope ' + num(D.slope), anchor: 'middle' });
    var sdO = M06.text(svg, r1(sxR(3.9)), 245, '', { size: 16, fill: col.axis, anchor: 'end', weight: 600 });
    var sdW = M06.text(svg, r1(sxR(6.1)), 245, '', { size: 16, fill: col.blue, weight: 600 });

    var bar = M06.controls(root), out = M06.readout(root);
    var run = runner(), sim, bo, bw, maxC;

    function renderHists() {
      maxC = Math.max(maxC, tallest(hO.bins), tallest(hW.bins));
      hO.render(maxC); hW.render(maxC);
    }
    function add(s) { bo.push(s.ols.slope); bw.push(s.wls.slope); hO.add(s.ols.slope); hW.add(s.wls.slope); }
    function part(name, st) {
      return name + ' slope: mean ' + (st.mean != null ? bold(num(st.mean, 2)) : DASH) +
        ', SD ' + (st.sd != null ? bold(num(st.sd, 2)) : DASH);
    }
    function update() {
      var so = summary(bo), sw = summary(bw);
      sdO.textContent = 'OLS' + (so.sd != null ? ' SD ' + num(so.sd, 2) : '');
      sdW.textContent = 'WLS' + (sw.sd != null ? ' SD ' + num(sw.sd, 2) : '');
      out.innerHTML = 'Samples: ' + num(bo.length) + SEP + part('OLS', so) + SEP + part('WLS', sw);
    }
    function fade(points, lines) {
      ptsG.setAttribute('opacity', points.toFixed(3));
      [fitG, labO, labW].forEach(function (el) { el.setAttribute('opacity', lines.toFixed(3)); });
    }
    function showSample(s) {
      clear(ptsG);
      for (var i = 0; i < s.x.length; i++) {
        M06.el('circle', {
          cx: r1(sxL(s.x[i])), cy: r1(syL(clamp(s.y[i], ylo - 5, yhi + 5))), r: r1(radius(s.x[i])),
          fill: col.mid, 'fill-opacity': 0.5, stroke: col.axis, 'stroke-width': 1
        }, ptsG);
      }
      lineAt(s.ols.intercept, s.ols.slope, olsLine);
      lineAt(s.wls.intercept, s.wls.slope, wlsLine);
      labO.textContent = 'OLS slope ' + num(s.ols.slope, 2);
      labW.textContent = 'WLS slope ' + num(s.wls.slope, 2);
      [fitG, labO, labW].forEach(function (el) { show(el, true); });
      placeLabels(s);
    }
    function hideSample() {
      clear(ptsG);
      [fitG, labO, labW].forEach(function (el) { show(el, false); });
      placeLabels(null);
    }
    // One sample: the stores fade in, then the two fitted lines, then each
    // slope joins its histogram.
    function drawOne() {
      run.finish();
      var s = sim.next();
      showSample(s);
      fade(0, 0);
      run.run(700, function (p) { fade(Math.min(1, p / 0.5), Math.max(0, (p - 0.5) / 0.5)); }, function () {
        fade(1, 1); add(s); renderHists(); update();
      });
    }
    // 1,000 samples over 2 s. The vertical scale is set ahead from the final
    // bins so the bars grow into place; the last sample is shown at the end.
    function drawMany() {
      run.finish();
      var batch = [], done = 0, i, fo = hO.bins.slice(), fw = hW.bins.slice(), k;
      for (i = 0; i < K; i++) {
        var s = sim.next();
        batch.push(s);
        k = binOf(s.ols.slope, blo, bhi, NB); if (k >= 0) fo[k]++;
        k = binOf(s.wls.slope, blo, bhi, NB); if (k >= 0) fw[k]++;
      }
      maxC = Math.max(maxC, tallest(fo), tallest(fw));
      fade(0.25, 0.25);
      function upTo(t) { while (done < t) add(batch[done++]); renderHists(); update(); }
      run.run(2000, function (p) { upTo(Math.floor(K * p)); }, function () {
        upTo(K); showSample(batch[K - 1]); fade(1, 1);
      });
    }
    function reset() {
      run.cancel();
      sim = M06.sims.wls(seed, n);
      bo = []; bw = []; maxC = 10;
      hO.clear(); hW.clear(); renderHists();
      hideSample(); fade(1, 1);
      update();
    }
    M06.button(bar, 'Draw one sample', drawOne);
    M06.button(bar, 'Draw 1,000 samples', drawMany);
    M06.button(bar, 'Reset', reset);
    reset();
  };
})();
