/* m06-figs.js — the static figures for meeting 6, "Models and uncertainty".
 *
 * A slide holds <div class="m06" data-demo="NAME" data-...></div>. Each figure
 * is drawn once, when M06.init() runs, as an SVG in fixed viewBox units (width
 * 960). There are no controls. Every random draw comes from a fixed seed, so
 * the numbers printed inside a figure are the same on every load.
 *
 *   data-demo     height  seed   data attributes (all optional)
 *   outcomes        330   1101   seed
 *   curves          360   1102   seed
 *   impossible      360   1116   seed
 *   medianmean      360   1104   seed
 *   darts           380   1105   seed
 *   icons           380      -   ideas, real, power, alpha
 *   sizematters     360      -
 *   overfit         360   1279   seed
 *   digest          300      -   poll-r, poll-l, vote-r, vote-l, poll-label, vote-label
 *   ebay            320   1110   seed, recovered
 *
 * Layout uses fixed coordinates only (slides that are not showing may be
 * display:none, so nothing is measured). Text inherits the deck font.
 *
 * The pure parts (data, fits, spreads, errors) are M06.sims.figs and run
 * under Node after the core:
 *   node -e "global.window=global; require('./m06-core.js'); require('./m06-figs.js');
 *            console.log(M06.sims.figs.overfitData().rmse)"
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = G.M06;
  if (!M06) throw new Error('m06-figs.js: load m06-core.js first');
  var C = M06.col;
  M06.sims = M06.sims || {};
  var F = (M06.sims.figs = {});

  // ==========================================================================
  // Pure parts: linear algebra, fits, and the data behind each figure.
  // ==========================================================================

  function zeros(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = 0; return a; }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function logOdds(p) { return Math.log(p / (1 - p)); }
  function expit(v) { return 1 / (1 + Math.exp(-v)); }

  // Solves A x = b by Gaussian elimination with partial pivoting.
  function solve(A, b) {
    var n = b.length, M = [], i, j, k;
    for (i = 0; i < n; i++) M.push(A[i].slice().concat([b[i]]));
    for (k = 0; k < n; k++) {
      var p = k;
      for (i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      var t = M[k]; M[k] = M[p]; M[p] = t;
      for (i = k + 1; i < n; i++) {
        var f = M[i][k] / M[k][k];
        if (f !== 0) for (j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    var x = zeros(n);
    for (i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }
  F.solve = solve;

  // X'WX (w optional, one weight per row) and X'z.
  function gram(X, w) {
    var k = X[0].length, A = [], i, j, r;
    for (i = 0; i < k; i++) A.push(zeros(k));
    for (r = 0; r < X.length; r++) {
      var wr = w ? w[r] : 1, x = X[r];
      for (i = 0; i < k; i++) for (j = 0; j < k; j++) A[i][j] += wr * x[i] * x[j];
    }
    return A;
  }
  function xtz(X, z) {
    var b = zeros(X[0].length);
    for (var r = 0; r < X.length; r++) for (var i = 0; i < b.length; i++) b[i] += X[r][i] * z[r];
    return b;
  }

  // Least squares by the normal equations, X'X b = X'y. Rows of X are
  // regressors with the constant first.
  F.ols = function (X, y) { return solve(gram(X), xtz(X, y)); };

  // Logit by Newton-Raphson: each step solves X'WX d = X'(y - p), W = p(1 - p).
  F.logit = function (X, y, iters) {
    var b = zeros(X[0].length);
    for (var it = 0; it < (iters || 30); it++) {
      var p = X.map(function (x) { return expit(dot(x, b)); });
      var d = solve(gram(X, p.map(function (q) { return q * (1 - q); })),
        xtz(X, y.map(function (v, i) { return v - p[i]; })));
      for (var j = 0; j < b.length; j++) b[j] += d[j];
    }
    return b;
  };

  // Poisson regression (log link) by IRLS: each step solves
  // X'WX d = X'(y - mu), W = mu. Starts at the log of the mean.
  F.poisson = function (X, y, iters) {
    var b = zeros(X[0].length);
    b[0] = Math.log(M06.mean(y));
    for (var it = 0; it < (iters || 30); it++) {
      var mu = X.map(function (x) { return Math.exp(dot(x, b)); });
      var d = solve(gram(X, mu), xtz(X, y.map(function (v, i) { return v - mu[i]; })));
      for (var j = 0; j < b.length; j++) b[j] += d[j];
    }
    return b;
  };

  // Least squares by Householder QR, for near-singular designs such as a
  // degree-9 polynomial, where forming X'X would square the conditioning.
  F.lstsq = function (X, y) {
    var m = X.length, n = X[0].length, i, j, k, s;
    var A = X.map(function (row) { return row.slice(); }), b = y.slice();
    for (k = 0; k < n; k++) {
      var norm = 0;
      for (i = k; i < m; i++) norm += A[i][k] * A[i][k];
      norm = Math.sqrt(norm);
      if (norm === 0) continue;
      var alpha = A[k][k] > 0 ? -norm : norm, v = zeros(m), vv = 0;
      for (i = k; i < m; i++) v[i] = A[i][k];
      v[k] -= alpha;
      for (i = k; i < m; i++) vv += v[i] * v[i];
      for (j = k; j < n; j++) {
        s = 0;
        for (i = k; i < m; i++) s += v[i] * A[i][j];
        s *= 2 / vv;
        for (i = k; i < m; i++) A[i][j] -= s * v[i];
      }
      s = 0;
      for (i = k; i < m; i++) s += v[i] * b[i];
      s *= 2 / vv;
      for (i = k; i < m; i++) b[i] -= s * v[i];
    }
    var x = zeros(n);
    for (i = n - 1; i >= 0; i--) {
      s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  };

  // Root-mean-square error.
  F.rmse = function (y, yhat) {
    var s = 0;
    for (var i = 0; i < y.length; i++) s += (y[i] - yhat[i]) * (y[i] - yhat[i]);
    return Math.sqrt(s / y.length);
  };

  // A Poisson draw by multiplying uniforms (fine for small means).
  function poissonDraw(r, lam) {
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }
  F.poissonDraw = poissonDraw;

  // Gaussian kernel density on n + 1 grid points over [lo, hi]. Bandwidth
  // f min(sd, IQR / 1.34) N^(-1/5), f = 1.5 by default: with 5,000 draws the
  // usual 0.9 leaves noise bumps at the peak that read as real features. It
  // widens a curve by about 4% (the same for both curves in a panel); the
  // SDs printed in the figure come from the draws, not from the curve.
  F.kde = function (v, lo, hi, n, f) {
    var sd = M06.sd(v), iqr = M06.quantile(v, 0.75) - M06.quantile(v, 0.25);
    var h = (f || 1.5) * Math.min(sd, iqr / 1.34) * Math.pow(v.length, -0.2);
    var c = 1 / (v.length * h * Math.sqrt(2 * Math.PI)), out = [];
    for (var i = 0; i <= n; i++) {
      var x = lo + (hi - lo) * i / n, s = 0;
      for (var j = 0; j < v.length; j++) {
        var u = (x - v[j]) / h;
        if (u > -6 && u < 6) s += Math.exp(-0.5 * u * u);
      }
      out.push([x, s * c]);
    }
    return out;
  };

  // ---- 1 · outcomes ----------------------------------------------------------
  // House prices ($ thousands, a little right-skewed), loan outcomes (fixed
  // shares), complaints per store (Poisson, mean 1.2) and monthly spend
  // (about 30% exactly zero, the rest $25 and up with a long right tail).
  F.outcomesData = function (seed) {
    var r = M06.rng(seed == null ? 1101 : seed), price = [], complaints = zeros(9), spend = [], i, v;
    while (price.length < 300) {
      v = Math.exp(Math.log(260) + 0.3 * r.normal());
      if (v >= 100 && v < 600) price.push(v);
    }
    for (i = 0; i < 300; i++) complaints[Math.min(8, poissonDraw(r, 1.2))]++;
    for (i = 0; i < 300; i++) {
      if (r() < 0.3) { spend.push(0); continue; }
      do { v = 25 + Math.exp(Math.log(60) + 0.8 * r.normal()); } while (v >= 600);
      spend.push(v);
    }
    var nz = spend.filter(function (s) { return s === 0; }).length;
    return { price: price, loan: [0.92, 0.08], complaints: complaints, spend: spend, zeroShare: nz / spend.length };
  };

  // ---- 2 · curves ----------------------------------------------------------------
  // 60 houses: price = 320 - 4.2 age + 0.035 age^2 + noise(sd 30), in $ thousands.
  // Both fits use age / 100 (a well-conditioned X'X), rescaled to years.
  F.curvesData = function (seed) {
    var r = M06.rng(seed == null ? 1102 : seed), age = [], price = [];
    for (var i = 0; i < 60; i++) {
      var a = 100 * r();
      age.push(a);
      price.push(320 - 4.2 * a + 0.035 * a * a + 30 * r.normal());
    }
    var c1 = F.ols(age.map(function (a) { return [1, a / 100]; }), price);
    var c2 = F.ols(age.map(function (a) { var s = a / 100; return [1, s, s * s]; }), price);
    return { age: age, price: price, linear: [c1[0], c1[1] / 100], quadratic: [c2[0], c2[1] / 100, c2[2] / 1e4] };
  };

  // ---- 3 · impossible ------------------------------------------------------------
  // Left: 80 borrowers, credit score uniform on 450-850, P(default) logistic,
  // 0.97 at 450 and 0.02 at 850. Right: 60 store-days, staff 2-14, complaints
  // Poisson with mean exp(2.0 - 0.3 staff). These are steeper than the first
  // draft (0.9 at 450; exp(1.6 - 0.2 staff)), under which the straight lines
  // rarely leave the possible range inside the data.
  F.impossibleTruth = { pLo: 0.97, pHi: 0.02, a: 2.0, b: -0.3 };
  F.impossibleData = function (seed) {
    var r = M06.rng(seed == null ? 1116 : seed), t = F.impossibleTruth, i;
    var B = (logOdds(t.pHi) - logOdds(t.pLo)) / 400, A = logOdds(t.pLo) - B * 450;
    var score = [], def = [], jy = [];
    for (i = 0; i < 80; i++) {
      var s = 450 + 400 * r();
      score.push(s);
      def.push(r() < expit(A + B * s) ? 1 : 0);
      jy.push(0.03 * (2 * r() - 1));
    }
    // Fit on (score - 650) / 100, then rescale to points of credit score.
    var Xs = score.map(function (s) { return [1, (s - 650) / 100]; });
    var l1 = F.ols(Xs, def), g1 = F.logit(Xs, def, 30);
    var staff = [], comp = [], jx = [];
    for (i = 0; i < 60; i++) {
      var k = 2 + r.int(13);
      staff.push(k);
      comp.push(poissonDraw(r, Math.exp(t.a + t.b * k)));
      jx.push(0.25 * (2 * r() - 1));
    }
    var Xk = staff.map(function (k) { return [1, k]; });
    return {
      credit: {
        score: score, y: def, jitter: jy, truth: [A, B],
        linear: [l1[0] - 6.5 * l1[1], l1[1] / 100], logit: [g1[0] - 6.5 * g1[1], g1[1] / 100]
      },
      staff: { staff: staff, y: comp, jitter: jx, linear: F.ols(Xk, comp), poisson: F.poisson(Xk, comp, 30) }
    };
  };

  // ---- 4 · medianmean ------------------------------------------------------------
  // 5,000 samples of 25 from each population; the sample mean and the sample
  // median of each. Normal: heights, mean 170 cm, sd 7. Heavy tails: Student t
  // with 3 df, Z0 / sqrt((Z1^2 + Z2^2 + Z3^2) / 3), read as daily returns in %.
  // Its variance is finite (3), so the SD of the sample mean exists: in
  // theory sqrt(3 / 25) = 0.35, against about 0.27 for the sample median.
  F.medianMeanData = function (seed, reps, n) {
    var r = M06.rng(seed == null ? 1104 : seed), x = new Array(n || 25), h = Math.floor(x.length / 2);
    reps = reps || 5000;
    function run(draw) {
      var means = new Array(reps), medians = new Array(reps);
      for (var k = 0; k < reps; k++) {
        for (var i = 0; i < x.length; i++) x[i] = draw();
        means[k] = M06.mean(x);
        var s = x.slice().sort(function (a, b) { return a - b; });
        medians[k] = x.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
      }
      return { means: means, medians: medians, sdMean: M06.sd(means), sdMedian: M06.sd(medians) };
    }
    return {
      normal: run(function () { return 170 + 7 * r.normal(); }),
      heavy: run(function () {
        var z = r.normal(), a = r.normal(), b = r.normal(), c = r.normal();
        return z / Math.sqrt((a * a + b * b + c * c) / 3);
      })
    };
  };

  // ---- 5 · darts ---------------------------------------------------------------------
  // 20 shots per target, in units of the target radius with y pointing up.
  // Order: unbiased low variance, unbiased high, biased low, biased high.
  F.dartsData = function (seed) {
    var r = M06.rng(seed == null ? 1105 : seed), out = [];
    [[0, 0.11], [0, 0.33], [0.3, 0.11], [0.3, 0.33]].forEach(function (c) {
      var shots = [];
      for (var i = 0; i < 20; i++) shots.push([c[0] + c[1] * r.normal(), c[0] + c[1] * r.normal()]);
      out.push({ bias: c[0], sd: c[1], shots: shots });
    });
    return out;
  };

  // ---- 6 · icons ---------------------------------------------------------------------
  F.iconsCounts = function (ideas, real, power, alpha) {
    var found = Math.round(real * power), none = ideas - real, fp = Math.round(none * alpha);
    return {
      ideas: ideas, real: real, found: found, missed: real - found, none: none,
      falsePositives: fp, trueNegatives: none - fp, significant: found + fp
    };
  };

  // ---- 7 · sizematters ---------------------------------------------------------------
  // key: drawn in carnelian.
  F.sizeRows = [
    { label: 'Significant, large', est: 6, lo: 4, hi: 8, key: true },
    { label: 'Significant, negligible', est: 0.4, lo: 0.1, hi: 0.7, key: false },
    { label: 'Not significant, inconclusive', est: 3, lo: -2, hi: 8, key: true },
    { label: 'Not significant, negligible', est: 0.1, lo: -0.6, hi: 0.8, key: false }
  ];

  // ---- 8 · overfit -------------------------------------------------------------------
  // 12 points to fit and 12 new ones, x uniform on 0-10, y = 2 + 0.5 x + N(0, 1).
  // A straight line by the normal equations; a degree-9 polynomial in
  // z = (x - 5) / 5, on [-1, 1], by QR. Seed 1279 is the first from 1108 up
  // where the polynomial fits the estimation sample closely, stays inside
  // the panel, and misses the new sample clearly (the draft seed 1108 gave a
  // polynomial that shoots off the panel, RMSE 92 on the new points).
  F.overfitData = function (seed) {
    var r = M06.rng(seed == null ? 1279 : seed);
    function draw(n) {
      var x = [], y = [];
      for (var i = 0; i < n; i++) { var v = 10 * r(); x.push(v); y.push(2 + 0.5 * v + r.normal()); }
      return { x: x, y: y };
    }
    function powers(x) {
      var z = (x - 5) / 5, row = [], p = 1;
      for (var d = 0; d <= 9; d++) { row.push(p); p *= z; }
      return row;
    }
    var train = draw(12), test = draw(12);
    var line = F.ols(train.x.map(function (x) { return [1, x]; }), train.y);
    var poly = F.lstsq(train.x.map(powers), train.y);
    function fLine(x) { return line[0] + line[1] * x; }
    function fPoly(x) {
      var z = (x - 5) / 5, s = 0;
      for (var d = 9; d >= 0; d--) s = s * z + poly[d];
      return s;
    }
    return {
      train: train, test: test, line: line, poly: poly, fLine: fLine, fPoly: fPoly,
      rmse: {
        lineTrain: F.rmse(train.y, train.x.map(fLine)), polyTrain: F.rmse(train.y, train.x.map(fPoly)),
        lineTest: F.rmse(test.y, test.x.map(fLine)), polyTest: F.rmse(test.y, test.x.map(fPoly))
      }
    };
  };

  // ---- 10 · ebay ---------------------------------------------------------------------
  // A schematic index: paid 40 and organic 60 before the stop; after it paid is
  // 0 and organic recovers `recovered` of the lost paid clicks. Weekly points
  // at mid-week, weeks -8 to 8, small noise.
  F.ebayData = function (seed, recovered) {
    var r = M06.rng(seed == null ? 1110 : seed), rec = recovered == null ? 0.99 : recovered;
    var P0 = 40, O0 = 60, sd = 1, out = { week: [], paid: [], organic: [], total: [] };
    for (var w = -8; w < 8; w++) {
      var t = w + 0.5, on = t < 0;
      var p = on ? P0 + sd * r.normal() : 0;
      var o = (on ? O0 : O0 + rec * P0) + sd * r.normal();
      out.week.push(t); out.paid.push(p); out.organic.push(o); out.total.push(p + o);
    }
    out.before = P0 + O0; out.after = O0 + rec * P0;
    return out;
  };

  // ==========================================================================
  // Drawing helpers. These touch the DOM, so they only run inside figures.
  // ==========================================================================

  function num(v, d) { var x = parseFloat(v); return isFinite(x) ? x : d; }
  function r1(v) { return Math.round(v * 10) / 10; }

  var clipCount = 0;
  // A group clipped to the rectangle (x, y, w, h).
  function clipGroup(svg, x, y, w, h) {
    var id = 'm06f-clip-' + (++clipCount);
    var cp = M06.el('clipPath', { id: id }, M06.el('defs', null, svg));
    M06.el('rect', { x: r1(x), y: r1(y), width: r1(w), height: r1(h) }, cp);
    return M06.g(svg, { 'clip-path': 'url(#' + id + ')' });
  }
  // A path through pixel points [[x, y], ...]. attrs override the defaults.
  function polyline(parent, pts, attrs) {
    var d = '';
    for (var i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + r1(pts[i][0]) + ' ' + r1(pts[i][1]);
    var a = { d: d, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    for (var k in attrs) a[k] = attrs[k];
    return M06.el('path', a, parent);
  }
  // Pixel points of y = f(x) for x in [x0, x1]; far-off values are capped so
  // the path stays finite (it is clipped to the panel anyway).
  function fnPts(f, x0, x1, n, sx, sy) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var x = x0 + (x1 - x0) * i / n;
      pts.push([sx(x), Math.max(-2000, Math.min(4000, sy(f(x))))]);
    }
    return pts;
  }
  function heading(parent, x, y, str, anchor) {
    return M06.text(parent, x, y, str, { size: 19, weight: 600, anchor: anchor || 'middle' });
  }
  function note(parent, x, y, str, anchor, fill) {
    return M06.text(parent, x, y, str, { size: 16, fill: fill || C.grey, anchor: anchor || 'middle' });
  }
  // One text line made of runs: parts = [[string, {fill, weight, style}], ...].
  // Spaces are preserved as written: browsers keep a space at the edge of a
  // run anyway, but some SVG renderers drop it without xml:space="preserve".
  function runs(parent, x, y, parts, o) {
    o = o || {};
    var t = M06.el('text', {
      x: x, y: y, 'font-size': o.size || 17, fill: o.fill || C.grey, 'text-anchor': o.anchor || 'start',
      style: 'white-space: pre'
    }, parent);
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    parts.forEach(function (p) {
      var s = p[1] || {};
      M06.el('tspan', { fill: s.fill || null, 'font-weight': s.weight || null, 'font-style': s.style || null }, t)
        .textContent = p[0];
    });
    return t;
  }
  function circle(parent, x, y, r, fill, extra) {
    var a = { cx: r1(x), cy: r1(y), r: r, fill: fill };
    if (extra) for (var k in extra) a[k] = extra[k];
    return M06.el('circle', a, parent);
  }
  // Bars [{x0, x1, v}] on a baseline, the largest v reaching maxH pixels.
  function bars(parent, list, base, maxH, fill) {
    var m = 0;
    list.forEach(function (b) { if (b.v > m) m = b.v; });
    list.forEach(function (b) {
      var h = m > 0 ? b.v / m * maxH : 0;
      M06.el('rect', {
        x: r1(b.x0), y: r1(base - h), width: r1(Math.max(0.5, b.x1 - b.x0)), height: r1(h), fill: fill || C.mid
      }, parent);
    });
  }
  // Histogram bars for values on [lo, hi] in nb bins; values outside are dropped.
  function binBars(values, lo, hi, nb, sx) {
    var w = (hi - lo) / nb, counts = zeros(nb), out = [];
    values.forEach(function (v) { var k = Math.floor((v - lo) / w); if (k >= 0 && k < nb) counts[k]++; });
    for (var k = 0; k < nb; k++) out.push({ x0: sx(lo + k * w) + 0.5, x1: sx(lo + (k + 1) * w) - 0.5, v: counts[k] });
    return out;
  }
  function tickNum(v) { return M06.fmt.num(v); }
  function plural(n, one, many) { return M06.fmt.num(n) + ' ' + (n === 1 ? one : many); }

  // ==========================================================================
  // The figures.
  // ==========================================================================

  // ---- 1 · outcomes: the shape of the outcome picks the model -----------------
  M06.demos.outcomes = function (root, opts) {
    opts = opts || {};
    var d = F.outcomesData(num(opts.seed, 1101));
    var svg = M06.svg(root, 960, 330, 'Four outcome shapes and the model each calls for. ' +
      'House price, continuous: OLS. Loan default, binary: logit. Complaints per store, a count: Poisson. ' +
      'Monthly spend, non-negative with many zeros: Poisson (PPML).');
    var pw = 210, gap = 30, left = (960 - 4 * pw - 3 * gap) / 2, top = 80, base = 238, hmax = base - top;
    var heads = [
      ['House price', '(continuous)'], ['Loan default', '(binary)'],
      ['Complaints per store', '(count)'], ['Monthly spend', '(non-negative, many zeros)']
    ];
    var models = ['OLS', 'logit', 'Poisson', 'Poisson (PPML)'];
    for (var i = 0; i < 4; i++) {
      var x0 = left + i * (pw + gap), x1 = x0 + pw, cx = x0 + pw / 2, g = M06.g(svg), sx;
      heading(g, cx, 26, heads[i][0]);
      note(g, cx, 48, heads[i][1]);
      if (i === 0) {
        sx = M06.scale(100, 600, x0 + 14, x1 - 14);
        bars(g, binBars(d.price, 100, 600, 20, sx), base, hmax);
        M06.axisX(g, sx, base, [100, 350, 600], function (v) { return '$' + v + 'k'; });
      } else if (i === 1) {
        sx = M06.scale(0, 1, x0 + 14, x1 - 14);
        var pos = [0.27, 0.73], bw = 64;
        bars(g, pos.map(function (p, j) { return { x0: sx(p) - bw / 2, x1: sx(p) + bw / 2, v: d.loan[j] }; }), base, hmax);
        pos.forEach(function (p, j) {
          var h = d.loan[j] / Math.max(d.loan[0], d.loan[1]) * hmax;
          note(g, sx(p), base - h - 8, M06.fmt.pct(d.loan[j], 0));
        });
        M06.axisX(g, sx, base, pos, function (v) { return v < 0.5 ? 'repaid' : 'defaulted'; });
      } else if (i === 2) {
        sx = M06.scale(-0.5, 8.5, x0 + 14, x1 - 14);
        bars(g, d.complaints.map(function (c, k) { return { x0: sx(k - 0.4), x1: sx(k + 0.4), v: c }; }), base, hmax);
        M06.axisX(g, sx, base, [0, 4, 8], tickNum);
      } else {
        sx = M06.scale(0, 600, x0 + 14, x1 - 14);
        bars(g, binBars(d.spend, 0, 600, 24, sx), base, hmax);
        M06.axisX(g, sx, base, [0, 300, 600], function (v) { return '$' + v; });
      }
      M06.text(g, cx, 306, models[i], { size: 18, weight: 700, fill: C.red, anchor: 'middle' });
    }
  };

  // ---- 2 · curves: least squares is linear in the coefficients, not in age ----
  M06.demos.curves = function (root, opts) {
    opts = opts || {};
    var d = F.curvesData(num(opts.seed, 1102));
    var svg = M06.svg(root, 960, 360, 'House price against age for 60 houses, with two least-squares fits: ' +
      'a straight line, linear in age, and a curve that is quadratic in age.');
    var L = 110, R = 760, T = 24, B = 280;
    var sx = M06.scale(0, 100, L, R), sy = M06.scale(140, 350, B, T);
    M06.axisX(svg, sx, B, [0, 20, 40, 60, 80, 100], tickNum, { title: 'Age of house (years)' });
    M06.axisY(svg, sy, L, [150, 200, 250, 300, 350], tickNum, { title: 'Price ($ thousands)' });
    var pts = M06.g(svg);
    d.age.forEach(function (a, i) { circle(pts, sx(a), sy(d.price[i]), 5, C.mid, { stroke: '#fff', 'stroke-width': 1 }); });
    function fl(a) { return d.linear[0] + d.linear[1] * a; }
    function fq(a) { return d.quadratic[0] + d.quadratic[1] * a + d.quadratic[2] * a * a; }
    var gc = clipGroup(svg, L, T - 12, R - L + 2, B - T + 12);
    polyline(gc, fnPts(fl, 0, 100, 1, sx, sy), { stroke: C.axis, 'stroke-width': 2.5, 'stroke-dasharray': '9 6', 'stroke-linecap': 'butt' });
    polyline(gc, fnPts(fq, 0, 100, 120, sx, sy), { stroke: C.red, 'stroke-width': 3.5 });
    var yl = sy(fl(100)), yq = sy(fq(100));
    if (Math.abs(yl - yq) < 22) { var mid = (yl + yq) / 2, s = yl > yq ? 1 : -1; yl = mid + 11 * s; yq = mid - 11 * s; }
    M06.text(svg, R + 12, yl + 6, 'linear in age', { size: 17, fill: C.axis, weight: 600 });
    M06.text(svg, R + 12, yq + 6, 'quadratic in age', { size: 17, fill: C.red, weight: 600 });
  };

  // ---- 3 · impossible: straight lines predict values that cannot happen -------
  M06.demos.impossible = function (root, opts) {
    opts = opts || {};
    var d = F.impossibleData(num(opts.seed, 1116));
    var svg = M06.svg(root, 960, 360, 'Two panels. Left: default (0 or 1) against credit score, with a linear ' +
      'probability model that predicts probabilities above 1 and below 0, and a logit curve that stays between. ' +
      'Right: complaints against staff on shift, with a linear model that predicts negative counts, and a Poisson curve.');
    var T = 48, B = 280;

    // Left: default against credit score.
    var c = d.credit, L = 100, R = 440;
    var sx = M06.scale(450, 850, L, R), sy = M06.scale(-0.3, 1.3, B, T);
    heading(svg, (L + R) / 2, 24, 'Default against credit score');
    M06.el('rect', { x: L, y: T, width: R - L, height: r1(sy(1) - T), fill: C.pale }, svg);
    M06.el('rect', { x: L, y: r1(sy(0)), width: R - L, height: r1(B - sy(0)), fill: C.pale }, svg);
    note(svg, R - 8, T + 18, 'predicted probability > 1', 'end', C.red);
    note(svg, L + 8, B - 10, 'predicted probability < 0', 'start', C.red);
    M06.axisX(svg, sx, B, [450, 550, 650, 750, 850], tickNum, { title: 'Credit score' });
    M06.axisY(svg, sy, L, [0, 0.5, 1], function (v) { return M06.fmt.pct(v, 0); }, { title: 'Probability of default' });
    var pl = M06.g(svg);
    c.score.forEach(function (s, i) { circle(pl, sx(s), sy(c.y[i] + c.jitter[i]), 4, C.mid, { 'fill-opacity': 0.85 }); });
    function lpm(s) { return c.linear[0] + c.linear[1] * s; }
    function lgt(s) { return expit(c.logit[0] + c.logit[1] * s); }
    var gl = clipGroup(svg, L, T, R - L, B - T);
    polyline(gl, fnPts(lpm, 450, 850, 1, sx, sy), { stroke: C.axis, 'stroke-width': 2.5 });
    polyline(gl, fnPts(lgt, 450, 850, 120, sx, sy), { stroke: C.red, 'stroke-width': 3.5 });
    // The line's label sits right-aligned in the empty upper right, its lower
    // left corner just above the line; the logit's sits under the curve at
    // the far left, where the line runs above it.
    var yl = Math.max(sy(1) + 48, sy(lpm(657)) - 8);
    M06.text(svg, R - 8, yl - 20, 'linear', { size: 17, fill: C.axis, weight: 600, anchor: 'end' });
    M06.text(svg, R - 8, yl, 'probability model', { size: 17, fill: C.axis, weight: 600, anchor: 'end' });
    M06.text(svg, sx(458), sy(lgt(458)) + 26, 'logit', { size: 17, fill: C.red, weight: 600 });

    // Right: complaints against staff on shift.
    var k = d.staff, L2 = 590, R2 = 920, top = Math.max(7, M06.max(k.y) + 1);
    var sx2 = M06.scale(1, 15, L2, R2), sy2 = M06.scale(-1.5, top, B, T);
    heading(svg, (L2 + R2) / 2, 24, 'Complaints against staff on shift');
    M06.el('rect', { x: L2, y: r1(sy2(0)), width: R2 - L2, height: r1(B - sy2(0)), fill: C.pale }, svg);
    note(svg, L2 + 8, B - 10, 'predicted count < 0', 'start', C.red);
    var yt = [];
    for (var v = 0; v <= top; v += 2) yt.push(v);
    M06.axisX(svg, sx2, B, [2, 4, 6, 8, 10, 12, 14], tickNum, { title: 'Staff on shift' });
    M06.axisY(svg, sy2, L2, yt, tickNum, { title: 'Complaints' });
    var pr = M06.g(svg);
    k.staff.forEach(function (s, i) { circle(pr, sx2(s + k.jitter[i]), sy2(k.y[i]), 4, C.mid, { 'fill-opacity': 0.85 }); });
    function lin(s) { return k.linear[0] + k.linear[1] * s; }
    function poi(s) { return Math.exp(k.poisson[0] + k.poisson[1] * s); }
    var gr = clipGroup(svg, L2, T, R2 - L2, B - T);
    polyline(gr, fnPts(lin, 1, 15, 1, sx2, sy2), { stroke: C.axis, 'stroke-width': 2.5 });
    polyline(gr, fnPts(poi, 1, 15, 120, sx2, sy2), { stroke: C.red, 'stroke-width': 3.5 });
    // Counts are whole numbers, so the dots sit in rows and the half-way
    // lanes between rows are empty: each label runs along a lane, starting
    // just past its own curve.
    var lane = function (v) { return sy2(v) + 6; };
    var sPoi = (Math.log(4.5) - k.poisson[0]) / k.poisson[1];
    M06.text(svg, sx2(Math.max(1, sPoi)) + 8, lane(4.5), 'Poisson', { size: 17, fill: C.red, weight: 600 });
    var sLin = (k.linear[0] - 1.85) / -k.linear[1];
    M06.text(svg, sx2(Math.min(9, Math.max(3, sLin))), lane(2.5), 'linear model', { size: 17, fill: C.axis, weight: 600 });
  };

  // ---- 4 · medianmean: which estimator is more precise depends on the population
  M06.demos.medianmean = function (root, opts) {
    opts = opts || {};
    var d = F.medianMeanData(num(opts.seed, 1104));
    var svg = M06.svg(root, 960, 360, 'Sampling distributions of the sample mean and the sample median, ' +
      'from 5,000 samples of 25. Normal population: the mean is less variable. ' +
      'Heavy-tailed population: the median is less variable.');
    var panels = [
      {
        set: d.normal, L: 40, R: 460, lo: 163, hi: 177, ticks: [164, 167, 170, 173, 176], center: 170,
        head: 'Normal population', sub: [['(heights, cm)']], axis: 'Estimate from a sample of 25 (cm)'
      },
      {
        set: d.heavy, L: 500, R: 920, lo: -1.5, hi: 1.5, ticks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], dp: 1, center: 0,
        head: 'Heavy-tailed population', sub: [['('], ['t', { style: 'italic' }], [', 3 df; daily returns, %)']],
        axis: 'Estimate from a sample of 25 (%)'
      }
    ];
    var top = 126, base = 272;
    panels.forEach(function (p) {
      var cx = (p.L + p.R) / 2, sx = M06.scale(p.lo, p.hi, p.L, p.R);
      heading(svg, cx, 22, p.head);
      runs(svg, cx, 44, p.sub, { size: 16, fill: C.grey, anchor: 'middle' });
      M06.text(svg, cx, 68, 'SD of the sample mean ' + M06.fmt.num(p.set.sdMean, 2), { size: 16, fill: C.axis, anchor: 'middle', weight: 600 });
      M06.text(svg, cx, 88, 'SD of the sample median ' + M06.fmt.num(p.set.sdMedian, 2), { size: 16, fill: C.blue, anchor: 'middle', weight: 600 });
      var km = F.kde(p.set.means, p.lo, p.hi, 200), kd = F.kde(p.set.medians, p.lo, p.hi, 200);
      function peak(k) { var m = 0; k.forEach(function (q) { if (q[1] > m) m = q[1]; }); return m; }
      var sy = M06.scale(0, Math.max(peak(km), peak(kd)), base, top);
      M06.axisX(svg, sx, base, p.ticks, function (v) { return M06.fmt.num(v, p.dp || 0); }, { title: p.axis });
      M06.vline(svg, sx(p.center), base, top - 16, { color: C.red });
      note(svg, sx(p.center) + 7, top - 18, 'true value', 'start', C.red);
      function toPx(k) { return k.map(function (q) { return [sx(q[0]), sy(q[1])]; }); }
      polyline(svg, toPx(km), { stroke: C.axis, 'stroke-width': 3 });
      polyline(svg, toPx(kd), { stroke: C.blue, 'stroke-width': 3 });
      // Label the taller curve on its left flank and the wider one on its right.
      function flank(k, frac, dir) {
        var ip = 0, i;
        for (i = 1; i < k.length; i++) if (k[i][1] > k[ip][1]) ip = i;
        i = ip;
        while (i + dir >= 0 && i + dir < k.length && k[i][1] > frac * k[ip][1]) i += dir;
        return k[i];
      }
      var meanTall = peak(km) >= peak(kd);
      var a = flank(meanTall ? km : kd, 0.7, -1), b = flank(meanTall ? kd : km, 0.45, 1);
      M06.text(svg, sx(a[0]) - 8, sy(a[1]), meanTall ? 'sample mean' : 'sample median',
        { size: 17, fill: meanTall ? C.axis : C.blue, anchor: 'end', weight: 600 });
      M06.text(svg, sx(b[0]) + 8, sy(b[1]), meanTall ? 'sample median' : 'sample mean',
        { size: 17, fill: meanTall ? C.blue : C.axis, weight: 600 });
    });
  };

  // ---- 5 · darts: bias and variance as four targets ------------------------------
  M06.demos.darts = function (root, opts) {
    opts = opts || {};
    var sets = F.dartsData(num(opts.seed, 1105));
    var svg = M06.svg(root, 960, 380, 'Four targets with 20 shots each. Columns: low variance, high variance. ' +
      'Rows: unbiased, centred on the bullseye; biased, centred up and to the right of it.');
    var R = 72, cols = [430, 670], rows = [118, 290], labelX = 318;
    heading(svg, cols[0], 28, 'Low variance');
    heading(svg, cols[1], 28, 'High variance');
    heading(svg, labelX, rows[0] + 7, 'Unbiased', 'end');
    heading(svg, labelX, rows[1] + 7, 'Biased', 'end');
    var fills = [C.faint, '#e8e8e4', '#e0e0dc', C.light];
    sets.forEach(function (s, k) {
      var cx = cols[k % 2], cy = rows[Math.floor(k / 2)], g = M06.g(svg);
      for (var i = 0; i < 4; i++) circle(g, cx, cy, R * (4 - i) / 4, fills[i], { stroke: C.mid, 'stroke-width': 1 });
      circle(g, cx, cy, 7, C.red);
      s.shots.forEach(function (q) { circle(g, cx + q[0] * R, cy - q[1] * R, 4.5, C.ink, { stroke: '#fff', 'stroke-width': 1 }); });
    });
  };

  // ---- 6 · icons: how many significant results are real -------------------------
  M06.demos.icons = function (root, opts) {
    opts = opts || {};
    var n = F.iconsCounts(Math.round(num(opts.ideas, 1000)), Math.round(num(opts.real, 100)),
      num(opts.power, 0.8), num(opts.alpha, 0.05));
    var pct = n.significant ? Math.round(100 * n.falsePositives / n.significant) : 0;
    var svg = M06.svg(root, 960, 380, M06.fmt.num(n.ideas) + ' ideas as squares. ' +
      n.found + ' true effects detected, ' + n.missed + ' missed, ' + n.falsePositives + ' false positives, ' +
      n.trueNegatives + ' true negatives. ' + n.falsePositives + ' of ' + n.significant +
      ' significant results (' + pct + '%) are false positives.');
    var cols = 40, rows = Math.ceil(n.ideas / cols), left = 20, top = 16;
    var pitch = Math.min(14, (380 - 2 * top + 3) / rows), cell = pitch - 3;
    var styles = {
      found: { fill: C.red }, missed: { fill: 'none', stroke: C.red, sw: 2 },
      fp: { fill: C.ink }, tn: { fill: 'none', stroke: C.light, sw: 1.5 }
    };
    // Order: true effects (detected, then missed), then no effect (false
    // positives first, so they sit together and can be counted).
    var kinds = [];
    [['found', n.found], ['missed', n.missed], ['fp', n.falsePositives], ['tn', n.trueNegatives]].forEach(function (q) {
      for (var i = 0; i < q[1]; i++) kinds.push(q[0]);
    });
    function square(parent, x, y, size, st) {
      var inset = st.stroke ? st.sw / 2 : 0;
      M06.el('rect', {
        x: r1(x + inset), y: r1(y + inset), width: r1(size - 2 * inset), height: r1(size - 2 * inset), rx: 1.5,
        fill: st.fill, stroke: st.stroke || null, 'stroke-width': st.stroke ? st.sw : null
      }, parent);
    }
    var g = M06.g(svg);
    kinds.forEach(function (kind, i) {
      square(g, left + (i % cols) * pitch, top + Math.floor(i / cols) * pitch, cell, styles[kind]);
    });
    var lx = left + cols * pitch + 30, ly = 84;
    [
      ['found', plural(n.found, 'true effect detected', 'true effects detected')],
      ['missed', plural(n.missed, 'true effect missed', 'true effects missed')],
      ['fp', plural(n.falsePositives, 'false positive', 'false positives')],
      ['tn', plural(n.trueNegatives, 'true negative', 'true negatives')]
    ].forEach(function (e, i) {
      var y = ly + i * 40;
      square(svg, lx, y - 7, 14, styles[e[0]]);
      M06.text(svg, lx + 26, y + 6, e[1], { size: 18 });
    });
    M06.text(svg, lx, ly + 190, M06.fmt.num(n.falsePositives) + ' of ' + M06.fmt.num(n.significant) + ' significant results',
      { size: 18, weight: 700 });
    M06.text(svg, lx, ly + 214, '(' + pct + '%) are false positives', { size: 18, weight: 700 });
  };

  // ---- 7 · sizematters: read the interval against the size that matters ---------
  M06.demos.sizematters = function (root, opts) {
    var svg = M06.svg(root, 960, 360, 'Four estimates of the effect on sales with 95% confidence intervals, ' +
      'against a band from minus 1 to 1 percent that is smaller than the minimum effect that matters. ' +
      F.sizeRows.map(function (r) { return r.label + ': ' + r.est + ', from ' + r.lo + ' to ' + r.hi + '.'; }).join(' '));
    var L = 320, R = 930, B = 290, bandTop = 76, rowsY = [108, 154, 200, 246];
    var sx = M06.scale(-4, 12, L, R);
    M06.el('rect', { x: r1(sx(-1)), y: bandTop, width: r1(sx(1) - sx(-1)), height: B - bandTop, fill: C.faint }, svg);
    note(svg, sx(0), 40, 'smaller than the minimum');
    note(svg, sx(0), 60, 'effect that matters');
    M06.el('line', {
      x1: r1(sx(0)), x2: r1(sx(0)), y1: bandTop, y2: B, stroke: C.mid, 'stroke-width': 1.5, 'stroke-dasharray': '6 5'
    }, svg);
    M06.axisX(svg, sx, B, [-4, -2, 0, 2, 4, 6, 8, 10, 12], tickNum,
      { title: 'Estimated effect on sales (%) with 95% confidence interval' });
    F.sizeRows.forEach(function (r, i) {
      var y = rowsY[i], col = r.key ? C.red : C.axis;
      M06.text(svg, L - 20, y + 6, r.label, { size: 18, anchor: 'end' });
      M06.el('line', { x1: r1(sx(r.lo)), x2: r1(sx(r.hi)), y1: y, y2: y, stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
      circle(svg, sx(r.est), y, 7, col, { stroke: '#fff', 'stroke-width': 1.5 });
    });
  };

  // ---- 8 · overfit: a model that fits the old data can fail on new data ---------
  M06.demos.overfit = function (root, opts) {
    opts = opts || {};
    var d = F.overfitData(num(opts.seed, 1279));
    var svg = M06.svg(root, 960, 360, 'A linear fit and a degree-9 polynomial fit to 12 points, then shown ' +
      'against 12 new points from the same process. RMSE on the estimation sample: linear ' +
      M06.fmt.num(d.rmse.lineTrain, 1) + ', polynomial ' + M06.fmt.num(d.rmse.polyTrain, 1) +
      '. On the new sample: linear ' + M06.fmt.num(d.rmse.lineTest, 1) + ', polynomial ' + M06.fmt.num(d.rmse.polyTest, 1) + '.');
    var T = 72, B = 336;
    var panels = [
      { L: 60, R: 450, title: 'Estimation sample', pts: d.train, fill: C.mid, err: [d.rmse.lineTrain, d.rmse.polyTrain] },
      { L: 530, R: 920, title: 'New sample from the same process', pts: d.test, fill: C.blue, err: [d.rmse.lineTest, d.rmse.polyTest] }
    ];
    // Vertical range: every point, and the polynomial as far as 3 units
    // beyond the points (it is clipped past that). The polynomial's label goes
    // beside its highest peak on [1, 5], so the label fits inside the panel.
    var ys = d.train.y.concat(d.test.y), pmin = Math.min.apply(null, ys), pmax = Math.max.apply(null, ys);
    var lo = pmin, hi = pmax, xpk = 1, ypk = -Infinity;
    for (var x = 0; x <= 10.0001; x += 0.02) {
      var v = d.fPoly(x);
      lo = Math.min(lo, Math.max(v, pmin - 3)); hi = Math.max(hi, Math.min(v, pmax + 3));
      if (x >= 1 && x <= 5 && v > ypk) { ypk = v; xpk = x; }
    }
    lo = Math.floor(lo - 0.7); hi = Math.ceil(hi + 0.7);
    panels.forEach(function (p, k) {
      var sx = M06.scale(0, 10, p.L, p.R), sy = M06.scale(lo, hi, B, T), cx = (p.L + p.R) / 2;
      heading(svg, cx, 24, p.title);
      runs(svg, cx, 50, [
        ['RMSE: '], ['linear ' + M06.fmt.num(p.err[0], 1), { fill: C.axis, weight: 600 }], [' · '],
        ['degree-9 polynomial ' + M06.fmt.num(p.err[1], 1), { fill: C.red, weight: 600 }]
      ], { size: 17, fill: C.grey, anchor: 'middle' });
      M06.el('line', { x1: p.L, x2: p.R, y1: B, y2: B, stroke: C.axis, 'stroke-width': 1.5 }, svg);
      M06.el('line', { x1: p.L, x2: p.L, y1: T, y2: B, stroke: C.axis, 'stroke-width': 1.5 }, svg);
      var gc = clipGroup(svg, p.L, T, p.R - p.L, B - T);
      polyline(gc, fnPts(d.fLine, 0, 10, 1, sx, sy), { stroke: C.axis, 'stroke-width': 3 });
      polyline(gc, fnPts(d.fPoly, 0, 10, 300, sx, sy), { stroke: C.red, 'stroke-width': 3 });
      var g = M06.g(svg);
      p.pts.x.forEach(function (x, i) { circle(g, sx(x), sy(p.pts.y[i]), 5.5, p.fill, { stroke: '#fff', 'stroke-width': 1.2 }); });
      if (k === 0) {
        // The polynomial is labelled beside its highest peak, the line just
        // above itself where the polynomial has dropped below it.
        M06.text(svg, sx(xpk) + 22, sy(ypk) + 6, 'degree-9 polynomial', { size: 17, fill: C.red, weight: 600 });
        M06.text(svg, sx(7), sy(d.fLine(7)) - 12, 'linear', { size: 17, fill: C.axis, weight: 600, anchor: 'end' });
      }
    });
  };

  // ---- 9 · digest: the 1936 Literary Digest poll against the vote ----------------
  M06.demos.digest = function (root, opts) {
    opts = opts || {};
    var groups = [
      { title: opts.pollLabel || 'Literary Digest poll', r: num(opts.pollR, 43), l: num(opts.pollL, 57) },
      { title: opts.voteLabel || 'Actual vote', r: num(opts.voteR, 61), l: num(opts.voteL, 37) }
    ];
    function share(v) { return (v % 1 === 0 ? M06.fmt.num(v) : M06.fmt.num(v, 1)) + '%'; }
    var svg = M06.svg(root, 960, 300, groups.map(function (g) {
      return g.title + ': Roosevelt ' + share(g.r) + ', Landon ' + share(g.l) + '.';
    }).join(' '));
    var L = 190, R = 890, sx = M06.scale(0, 100, L, R), bh = 34;
    M06.el('line', { x1: r1(sx(50)), x2: r1(sx(50)), y1: 44, y2: 270, stroke: C.light, 'stroke-width': 1.5, 'stroke-dasharray': '5 5' }, svg);
    note(svg, sx(50), 290, '50%');
    groups.forEach(function (g, k) {
      var y0 = 36 + k * 138;
      heading(svg, L, y0, g.title, 'start');
      [['Roosevelt', g.r, C.axis], ['Landon', g.l, C.mid]].forEach(function (b, j) {
        var y = y0 + 14 + j * (bh + 8), w = Math.max(0, sx(Math.min(100, b[1])) - L);
        M06.el('rect', { x: L, y: y, width: r1(w), height: bh, fill: b[2] }, svg);
        M06.text(svg, L - 12, y + bh / 2 + 6, b[0], { size: 18, anchor: 'end' });
        M06.text(svg, L + w + 8, y + bh / 2 + 6, share(b[1]), { size: 18, weight: 600 });
      });
    });
  };

  // ---- 10 · ebay: stopping brand-keyword ads (a schematic) ---------------------------
  M06.demos.ebay = function (root, opts) {
    opts = opts || {};
    var d = F.ebayData(num(opts.seed, 1110), num(opts.recovered, 0.99));
    var svg = M06.svg(root, 960, 320, 'Schematic: clicks from searches for eBay by week. When brand-keyword ads ' +
      'stopped, paid search clicks fell to zero, organic search clicks rose by about as much, and total clicks ' +
      'stayed about flat.');
    var L = 90, R = 730, T = 44, B = 232;
    var sx = M06.scale(-8, 8, L, R), sy = M06.scale(-10, 112, B, T);
    M06.axisX(svg, sx, B, [-8, -4, 0, 4, 8], tickNum, { title: 'Weeks relative to the stop' });
    M06.el('line', { x1: L, x2: L, y1: T, y2: B, stroke: C.axis, 'stroke-width': 1.5 }, svg);
    var ty = (T + B) / 2;
    M06.text(svg, L - 20, ty, 'Clicks from searches for eBay',
      { size: 17, fill: C.grey, anchor: 'middle', transform: 'rotate(-90 ' + (L - 20) + ' ' + ty + ')' });
    M06.el('line', { x1: sx(0), x2: sx(0), y1: T - 8, y2: B, stroke: C.grey, 'stroke-width': 2, 'stroke-dasharray': '7 5' }, svg);
    M06.text(svg, sx(0) + 8, T - 12, 'brand-keyword ads stopped', { size: 17, fill: C.ink, weight: 600 });
    function pts(series) { return d.week.map(function (w, i) { return [sx(w), sy(series[i])]; }); }
    polyline(svg, pts(d.paid), { stroke: C.blue, 'stroke-width': 3 });
    polyline(svg, pts(d.organic), { stroke: C.axis, 'stroke-width': 3 });
    polyline(svg, pts(d.total), { stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '9 6', 'stroke-linecap': 'butt' });
    var n = d.week.length - 1, xl = sx(d.week[n]) + 12;
    M06.text(svg, xl, sy(d.total[n]) - 10, 'total clicks', { size: 17, fill: C.red, weight: 600 });
    M06.text(svg, xl, sy(d.organic[n]) + 22, 'organic search clicks', { size: 17, fill: C.axis, weight: 600 });
    M06.text(svg, xl, sy(d.paid[n]) - 8, 'paid search clicks', { size: 17, fill: C.blue, weight: 600 });
    note(svg, 950, 312, 'Schematic after Blake, Nosko and Tadelis (2015). Shapes, not data.', 'end');
  };
})();
