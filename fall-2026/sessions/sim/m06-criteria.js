/* m06-criteria.js — maximum likelihood and the method of moments on the
 * twelve houses of the least squares demo.
 *
 * One demo, registered as M06.demos.criteria and built by M06.init() into
 * <div class="m06" data-demo="criteria" data-mode="mle"></div>:
 *
 *   data-mode="mle"   (default) each house's normal density of price, drawn
 *                     sideways around the candidate line, and the
 *                     log-likelihood against the slope
 *   data-mode="mom"   each residual as a segment, coloured by its sign, and
 *                     the moment, the mean of (size − mean size) × residual,
 *                     against the slope
 *   data-key="false"  hides the two-line key in the scatter's top-left corner
 *
 * Same twelve houses as leastsquares (seed 707) and the same candidate line
 * through the two means, so all three criteria pick the same slope, 9.76.
 * With normal errors and σ profiled out, σ̂(b)² = SSR(b) / n and the
 * log-likelihood is −(n/2) log(2π σ̂(b)²) − n/2, which falls as SSR rises.
 * The moment equals Sxx (b̂ − b) / n, a straight line through zero at b̂.
 *
 * The math has no DOM in it and lives in M06.sims.criteria:
 *
 *   node -e "global.window = global; require('./m06-core.js');
 *            require('./m06-estimators.js'); require('./m06-criteria.js');
 *            var K = M06.sims.criteria, d = K.data();
 *            console.log(K.loglik(d, 3), K.sigma(d, 3), K.moment(d, 3))"
 *
 * Load after m06-estimators.js. Nothing here touches the document until the
 * demo is built.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = (G.M06 = G.M06 || {});
  M06.demos = M06.demos || {};
  M06.sims = M06.sims || {};

  // ---- small helpers ----------------------------------------------------------------
  var SEP = '<span class="sep">·</span>';
  var SIGMA_HAT = 'σ̂';
  var uid = 0;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function bold(s) { return '<b>' + s + '</b>'; }
  function attrs(el, o) { for (var k in o) el.setAttribute(k, o[k]); return el; }
  function r1(x) { return Math.round(x * 10) / 10; }
  // Ticks from lo to hi in steps, free of floating-point dust.
  function ticks(lo, hi, step) {
    var out = [], n = Math.floor((hi - lo) / step + 1e-9);
    for (var i = 0; i <= n; i++) out.push(Math.round((lo + i * step) * 1e9) / 1e9);
    return out;
  }
  // A step of 1, 2 or 5 times a power of ten, near span / target.
  function niceStep(span, target) {
    var raw = span / target, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var best = p, err = Infinity;
    [1, 2, 5, 10].forEach(function (m) {
      var e = Math.abs(Math.log(m * p / raw));
      if (e < err) { err = e; best = m * p; }
    });
    return best;
  }
  // A white outline behind text, so a label stays legible over the bells.
  function halo(t, w) {
    return attrs(t, { stroke: '#fff', 'stroke-width': w || 5, 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
  }
  function dnorm(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }
  function LS() {
    var L = M06.sims.leastsquares;
    if (!L) throw new Error('Load m06-estimators.js before m06-criteria.js');
    return L;
  }

  // =====================================================================================
  // The criteria (no DOM). The candidate line passes through the two means with slope b.
  // =====================================================================================
  var CR = M06.sims.criteria = {
    // The twelve houses of the least squares demo.
    data: function (seed) { return LS().data(seed == null ? 707 : seed); },
    // Residuals e_i(b) = price_i − (mean price + b (size_i − mean size)).
    residuals: function (d, b) {
      var xb = M06.mean(d.x), yb = M06.mean(d.y), e = new Array(d.x.length);
      for (var i = 0; i < d.x.length; i++) e[i] = d.y[i] - (yb + b * (d.x[i] - xb));
      return e;
    },
    ssr: function (d, b) { return LS().sse(d, b); },
    // σ profiled out: its maximum likelihood value given b, σ̂(b)² = SSR(b) / n.
    sigma: function (d, b) { return Math.sqrt(CR.ssr(d, b) / d.x.length); },
    // Normal log-likelihood at (b, σ̂(b)): −(n/2) log(2π σ̂²) − n/2.
    loglik: function (d, b) {
      var n = d.x.length, s2 = CR.ssr(d, b) / n;
      return -n / 2 * Math.log(2 * Math.PI * s2) - n / 2;
    },
    // Each house's normal density at its observed price, φ(e_i / σ̂) / σ̂: its
    // contribution to the likelihood. The logs of these sum to loglik(d, b).
    densities: function (d, b) {
      var s = CR.sigma(d, b);
      return CR.residuals(d, b).map(function (e) { return dnorm(e / s) / s; });
    },
    // The moment: (1/n) Σ (size_i − mean size) e_i(b). Linear in b.
    moment: function (d, b) {
      var xb = M06.mean(d.x), e = CR.residuals(d, b), s = 0;
      for (var i = 0; i < e.length; i++) s += (d.x[i] - xb) * e[i];
      return s / e.length;
    },
    // Both criteria are optimized at the least squares slope.
    best: function (d) { return LS().fit(d).slope; }
  };

  // =====================================================================================
  // criteria — maximum likelihood (mle) or the method of moments (mom). viewBox 960 x 420.
  // =====================================================================================
  M06.demos.criteria = function (root, opts) {
    opts = opts || {};
    var C = M06.col, fmt = M06.fmt, L = LS();
    var mle = String(opts.mode).toLowerCase() !== 'mom';
    var showKey = String(opts.key).toLowerCase() !== 'false';
    var SEED = 707, B0 = 3, W = 960, H = 420;
    var X0 = 80, X1 = 560, YB = 350, YT = 30;     // the scatter, as in leastsquares
    var PX0 = 690, PX1 = 920, PT = 60;             // the criterion against the slope
    var BELL = 45, NZ = 48;                        // bell width at the best fit (px); segments per bell
    var d = CR.data(SEED), f = L.fit(d), n = d.x.length, b = B0, i;
    var sBest = CR.sigma(d, f.slope);

    var svg = M06.svg(root, W, H, mle
      ? 'Maximum likelihood: twelve houses and a candidate line, the normal density of price drawn around ' +
        'the line at each house, and the log-likelihood against the slope'
      : 'Method of moments: twelve houses and a candidate line, each residual drawn as a segment, and the ' +
        'mean of size minus mean size times residual against the slope');
    var sx = M06.scale(10, 32, X0, X1);
    var ylo = Math.floor((Math.min.apply(null, d.y) - 10) / 50) * 50;
    var yhi = Math.ceil((Math.max.apply(null, d.y) + 10) / 50) * 50;
    var sy = M06.scale(ylo, yhi, YB, YT), pxPer = (YB - YT) / (yhi - ylo);
    M06.axisX(svg, sx, YB, ticks(10, 30, 5), null, { title: 'Size (hundreds of sq ft)' });
    M06.axisY(svg, sy, X0, ticks(ylo, yhi, 50), null, { title: 'Price ($ thousands)' });

    // The mean size: a subtle reference for which houses sit left and right of it.
    if (!mle) {
      var xbPx = sx(f.xbar);
      M06.el('line', { x1: xbPx, x2: xbPx, y1: YT, y2: YB, stroke: C.mid, 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }, svg);
      M06.text(svg, xbPx + 6, YT + 16, 'mean size', { size: 15, fill: C.grey });
    }

    // Bells, segments and the line are clipped to the panel.
    var cid = 'm06-cr-clip-' + (++uid);
    var clip = M06.el('clipPath', { id: cid }, M06.el('defs', null, svg));
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, clip);
    var gc = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    var fills = [], curves = [], segs = [], line;
    if (mle) {
      for (i = 0; i < n; i++) fills.push(M06.el('path', { fill: C.blue, 'fill-opacity': 0.1, stroke: 'none' }, gc));
      for (i = 0; i < n; i++) {
        curves.push(M06.el('path', { fill: 'none', stroke: C.blue, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, gc));
      }
      line = M06.el('line', { stroke: C.red, 'stroke-width': 3, 'stroke-linecap': 'round' }, gc);
      // Density at each observed price, on top of the line.
      for (i = 0; i < n; i++) segs.push(M06.el('line', { stroke: C.red, 'stroke-width': 3 }, gc));
    } else {
      for (i = 0; i < n; i++) segs.push(M06.el('line', { stroke: C.red, 'stroke-width': 3 }, gc));
      line = M06.el('line', { stroke: C.red, 'stroke-width': 3, 'stroke-linecap': 'round' }, gc);
    }
    for (i = 0; i < n; i++) M06.el('circle', { cx: sx(d.x[i]), cy: sy(d.y[i]), r: 6, fill: C.ink }, svg);

    // The key, over the bells.
    if (showKey) {
      var kx = X0 + 16, k1 = YT + 18, k2 = YT + 42, tx = kx + 24, ko = { size: 15, fill: C.axis };
      if (mle) {
        var kp = [];
        for (i = 0; i <= 24; i++) { var kz = -3 + i / 4; kp.push(r1(kx + 14 * Math.exp(-kz * kz / 2)) + ',' + r1(k1 - 3.4 * kz)); }
        M06.el('path', { d: 'M' + kx + ',' + r1(k1 + 10.2) + 'L' + kp.join('L') + 'L' + kx + ',' + r1(k1 - 10.2) + 'Z',
          fill: C.blue, 'fill-opacity': 0.1 }, svg);
        M06.el('path', { d: 'M' + kp.join('L'), fill: 'none', stroke: C.blue, 'stroke-width': 1.3 }, svg);
        M06.el('line', { x1: kx, x2: kx + 16, y1: k2, y2: k2, stroke: C.red, 'stroke-width': 3 }, svg);
        M06.el('circle', { cx: kx, cy: k2, r: 4, fill: C.ink }, svg);
        halo(M06.text(svg, tx, k1 + 5, 'normal density around the line', ko));
        halo(M06.text(svg, tx, k2 + 5, 'density at the observed price', ko));
      } else {
        M06.el('line', { x1: kx + 6, x2: kx + 6, y1: k1 - 9, y2: k1 + 9, stroke: C.red, 'stroke-width': 3 }, svg);
        M06.el('line', { x1: kx + 6, x2: kx + 6, y1: k2 - 9, y2: k2 + 9, stroke: C.blue, 'stroke-width': 3 }, svg);
        halo(M06.text(svg, tx, k1 + 5, 'positive residual', ko));
        halo(M06.text(svg, tx, k2 + 5, 'negative residual', ko));
      }
    }

    // The criterion against the slope: a hill (log-likelihood) or a straight
    // line through zero (moment).
    var sb = M06.scale(0, 20, PX0, PX1), sv, crit, top;
    if (mle) {
      crit = function (v) { return CR.loglik(d, v); };
      top = crit(f.slope);
      var lo = Math.floor(Math.min(crit(0), crit(20)) / 5) * 5;
      var hi = top + 0.2 * (top - lo);                 // headroom for the label over the peak
      sv = M06.scale(lo, hi, YB, PT);
      M06.text(svg, PX0 - 50, 36, 'Log-likelihood', { size: 17, fill: C.grey });
      M06.axisY(svg, sv, PX0, ticks(lo, hi, niceStep(hi - lo, 3)), function (t) { return fmt.num(t); });
    } else {
      crit = function (v) { return CR.moment(d, v); };
      top = 0;
      var mTop = Math.max(Math.abs(crit(0)), Math.abs(crit(20))) * 1.06;
      var st = niceStep(2 * mTop, 4), m0 = Math.floor(mTop / st) * st;
      sv = M06.scale(-mTop, mTop, YB, PT);
      // Starts left of the other panels' titles: it is long.
      M06.text(svg, PX0 - 105, 36, 'Moment: mean of (size − mean size) × residual', { size: 17, fill: C.grey });
      M06.axisY(svg, sv, PX0, ticks(-m0, m0, st), function (t) { return fmt.num(t); });
      M06.el('line', { x1: PX0, x2: PX1, y1: sv(0), y2: sv(0), stroke: C.mid, 'stroke-width': 1.5 }, svg);
    }
    M06.axisX(svg, sb, YB, ticks(0, 20, 5), null, { title: 'Slope ($ thousands per 100 sq ft)' });
    var pts = [];
    for (i = 0; i <= 200; i++) { var bb = 20 * i / 200; pts.push(r1(sb(bb)) + ',' + r1(sv(crit(bb)))); }
    M06.el('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: C.axis, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, svg);
    var mx = sb(f.slope), my = sv(top);
    M06.el('circle', { cx: mx, cy: my, r: 4.5, fill: '#fff', stroke: C.axis, 'stroke-width': 2 }, svg);
    if (mle) {
      // Centred over the maximum, but kept clear of the panel's y-axis.
      M06.text(svg, clamp(mx, PX0 + 124, W - 124), my - 16, 'maximum likelihood estimate: ' + fmt.num(f.slope, 1),
        { size: 16, fill: C.axis, anchor: 'middle' });
    } else {
      // Above the zero line, right of the crossing, where the moment is negative.
      M06.text(svg, mx + 10, my - 12, 'moment = 0 at ' + fmt.num(f.slope, 1), { size: 16, fill: C.axis });
    }
    var dot = M06.el('circle', { r: 7, fill: C.red, stroke: '#fff', 'stroke-width': 2 }, svg);

    var bar = M06.controls(root);
    var sl = M06.slider(bar, 'Slope', 0, 20, 0.1, B0, function (v) { stop(); b = v; draw(); });
    M06.button(bar, 'Sweep', function () { glide([b, 0, 20, f.slope], 4000); });
    M06.button(bar, 'Best fit', function () { glide([b, f.slope], 600); });
    M06.button(bar, 'Reset', function () { stop(); setB(B0); });
    var out = M06.readout(root);
    var job = null;

    function draw() {
      var xb = f.xbar, yb = f.ybar, e = CR.residuals(d, b), j, px;
      attrs(line, { x1: sx(10), y1: sy(yb + b * (10 - xb)), x2: sx(32), y2: sy(yb + b * (32 - xb)) });
      var head = 'Slope: ' + bold('$' + fmt.num(b, 1) + 'k') + ' per 100 sq ft' + SEP;
      if (mle) {
        // Width at price y is proportional to the density φ((y − ŷ) / σ̂) / σ̂,
        // with the same constant at every b: BELL px at the peak at the best fit.
        var s = CR.sigma(d, b), peak = BELL * sBest / s, sp = s * pxPer, ll = CR.loglik(d, b);
        for (j = 0; j < n; j++) {
          px = sx(d.x[j]);
          var cy = sy(yb + b * (d.x[j] - xb)), c = [];
          for (var q = 0; q <= NZ; q++) {
            var z = -3 + 6 * q / NZ;
            c.push(r1(px + peak * Math.exp(-z * z / 2)) + ',' + r1(cy - z * sp));
          }
          c = c.join('L');
          fills[j].setAttribute('d', 'M' + r1(px) + ',' + r1(cy + 3 * sp) + 'L' + c + 'L' + r1(px) + ',' + r1(cy - 3 * sp) + 'Z');
          curves[j].setAttribute('d', 'M' + c);
          var z0 = e[j] / s, py = sy(d.y[j]);
          attrs(segs[j], { x1: px, x2: px + peak * Math.exp(-z0 * z0 / 2), y1: py, y2: py });
        }
        attrs(dot, { cx: sb(b), cy: sv(ll) });
        out.innerHTML = head + 'Log-likelihood: ' + bold(fmt.num(ll, 1)) + SEP +
          SIGMA_HAT + ': ' + bold('$' + fmt.num(s, 1) + 'k');
      } else {
        for (j = 0; j < n; j++) {
          px = sx(d.x[j]);
          attrs(segs[j], { x1: px, x2: px, y1: sy(d.y[j]), y2: sy(d.y[j] - e[j]), stroke: e[j] >= 0 ? C.red : C.blue });
        }
        var m = CR.moment(d, b);
        attrs(dot, { cx: sb(b), cy: sv(m) });
        out.innerHTML = head + 'Moment: ' + bold(fmt.num(m, 1)) + ' (the estimate sets it to 0)';
      }
    }
    function setB(v) { b = v; sl.value = String(Math.round(v * 10) / 10); draw(); }
    function stop() { if (job) { job.cancel(); job = null; } }
    // Move the slope through a list of values, easing each leg, in ms total.
    // A new glide starts from wherever the slope is now.
    function glide(path, ms) {
      stop();
      var legs = [], total = 0, last = path[path.length - 1];
      for (var j = 1; j < path.length; j++) {
        var len = Math.abs(path[j] - path[j - 1]);
        if (len > 1e-9) { legs.push({ a: path[j - 1], b: path[j], s: total, len: len }); total += len; }
      }
      if (!legs.length) { setB(last); return; }
      var me = job = M06.animate(ms, function (p) {
        var t = p * total;
        for (var k = 0; k < legs.length; k++) {
          var g = legs[k];
          if (t <= g.s + g.len || k === legs.length - 1) {
            setB(lerp(g.a, g.b, M06.ease(clamp((t - g.s) / g.len, 0, 1))));
            return;
          }
        }
      }, function () { if (job === me) job = null; setB(last); });
    }

    setB(B0);
  };
})();
