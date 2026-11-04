/* m06-estimators.js — meeting 6 animations on estimators and uncertainty.
 *
 * Five demos, each registered as M06.demos.NAME and built by M06.init() into
 * <div class="m06" data-demo="NAME" ...></div>:
 *
 *   tanks         the German tank problem: three estimators, bias and SD.
 *                 data-total (300), data-k (5), data-ks ("5,20,80" adds a
 *                 toggle), data-impossible ("true" adds a readout item)
 *   leastsquares  residuals drawn as squares; their sum against the slope
 *   likelihood    the probability of the observed data at each candidate p.
 *                 data-mode ("a", "b" or "both"; default "a")
 *   bootstrap     bootstrap samples from an observed sample of 30 customers.
 *                 data-stat ("median" or "max"), data-stats ("median,max"
 *                 adds a toggle)
 *   permutation   a permutation test: permute the page labels
 *
 * Seeds: tanks 606; leastsquares 707; bootstrap 808 (the sample), 823 (the
 * bootstrap samples), 810 (the true standard error); permutation 928 (9091 moves
 * the decorative strip only). Reset re-seeds, so the same clicks replay the
 * same numbers.
 *
 * The simulation logic has no DOM in it and lives in M06.sims.*. Each demo
 * calls the same functions with the same seeds in the same order, so the
 * numbers on screen can be checked under Node and quoted in the notes:
 *
 *   node -e "global.window = global; require('./m06-core.js');
 *            require('./m06-estimators.js');
 *            console.log(M06.sims.tanks.run({ k: 5, n: 1000 }).summary)"
 *
 * Nothing here touches the document until a demo is built. m06-core.js must
 * be loaded before M06.init() runs.
 */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var M06 = (G.M06 = G.M06 || {});
  M06.demos = M06.demos || {};
  M06.sims = M06.sims || {};

  // ---- small helpers ----------------------------------------------------------------
  var SEP = '<span class="sep">\u00b7</span>';
  var MINUS = '\u2212';
  var uid = 0;

  function toInt(v, d) { var x = parseInt(v, 10); return isFinite(x) ? x : d; }
  function toList(v) {
    if (v == null) return [];
    return String(v).split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; });
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function bold(s) { return '<b>' + s + '</b>'; }
  function byNum(a, b) { return a - b; }
  function attrs(el, o) { for (var k in o) el.setAttribute(k, o[k]); return el; }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function visible(node, on) { node.setAttribute('visibility', on ? 'visible' : 'hidden'); }
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
  // A white outline behind text, so a label stays legible over bars and lines.
  function halo(t, w) {
    return attrs(t, { stroke: '#fff', 'stroke-width': w || 5, 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    var x = hexRgb(a), y = hexRgb(b);
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(lerp(x[i], y[i], t)); }).join(',') + ')';
  }

  // One running animation per demo. run() first settles the previous one:
  // settle() jumps it to its end state (end() runs exactly once), stop()
  // drops it without its end state (for Reset and for sliders).
  function Runner() {
    var cur = null;
    var self = {
      run: function (ms, step, end) {
        self.settle();
        var job = { live: true };
        function complete() {
          if (!job.live) return;
          job.live = false;
          if (cur === job) cur = null;
          if (end) end();
        }
        job.anim = M06.animate(ms, function (p) { if (job.live) step(p); }, complete);
        job.finish = function () { job.anim.cancel(); complete(); };
        job.cancel = function () { job.anim.cancel(); job.live = false; if (cur === job) cur = null; };
        cur = job;
        return job;
      },
      settle: function () { if (cur) cur.finish(); },
      stop: function () { if (cur) cur.cancel(); }
    };
    return self;
  }

  // Histogram bars on [lo, hi] in nbins bins, baseline y0, full height h.
  // render(top) draws `top` counts at full height, so several histograms can
  // share one vertical scale. o.fill: a colour or function(bin) -> colour.
  // o.right: bins closed on the right, (a, b], so a value of exactly 300
  // sits left of a line drawn at 300.
  function Bars(parent, sx, y0, h, lo, hi, nbins, o) {
    o = o || {};
    var g = M06.g(parent), w = (hi - lo) / nbins, bins = new Array(nbins).fill(0), rects = [], n = 0;
    for (var i = 0; i < nbins; i++) {
      var x0 = sx(lo + i * w), x1 = sx(lo + (i + 1) * w);
      rects.push(M06.el('rect', {
        x: x0 + 0.5, width: Math.max(0.5, x1 - x0 - 1), y: y0, height: 0,
        fill: typeof o.fill === 'function' ? o.fill(i) : (o.fill || M06.col.axis),
        'fill-opacity': o.opacity == null ? 0.9 : o.opacity
      }, g));
    }
    var self = {
      g: g, bins: bins, rects: rects, width: w,
      index: function (v) {
        var k = o.right ? Math.ceil((v - lo) / w) - 1 : Math.floor((v - lo) / w);
        return k < 0 ? 0 : k >= nbins ? nbins - 1 : k;
      },
      add: function (v) { var k = self.index(v); bins[k]++; n++; return k; },
      addBin: function (k) { bins[k]++; n++; return k; },
      count: function () { return n; },
      max: function () { var m = 0; for (var j = 0; j < nbins; j++) if (bins[j] > m) m = bins[j]; return m; },
      center: function (k) { return sx(lo + (k + 0.5) * w); },
      clear: function () { bins.fill(0); n = 0; self.render(1); return self; },
      render: function (top) {
        for (var j = 0; j < nbins; j++) {
          var hh = top > 0 ? bins[j] / top * h : 0;
          rects[j].setAttribute('y', y0 - hh);
          rects[j].setAttribute('height', hh);
        }
        return self;
      }
    };
    return self;
  }

  // Standard normal density and CDF. erfc is the Numerical Recipes Chebyshev
  // fit (erfcc), with relative error below 1.2e-7 everywhere.
  function erfc(x) {
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function dnorm(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function pnorm(x) { return 0.5 * erfc(-x / Math.SQRT2); }

  // =====================================================================================
  // Simulations (no DOM). Each demo calls exactly these, in this order.
  // =====================================================================================

  // ---- tanks: serial numbers 1..N, k captured without replacement -----------------
  var tanks = M06.sims.tanks = {
    // k distinct serials from 1..N by a partial Fisher–Yates shuffle (k draws
    // from the generator), returned sorted.
    capture: function (r, N, k) {
      var a = new Array(N), i;
      for (i = 0; i < N; i++) a[i] = i + 1;
      for (i = 0; i < k; i++) {
        var j = i + r.int(N - i), t = a[i];
        a[i] = a[j]; a[j] = t;
      }
      return a.slice(0, k).sort(byNum);
    },
    // The three estimators, m = the sample maximum:
    // (1) m, (2) 2 x mean - 1, (3) m + m/k - 1. below: estimator 2 fell below
    // m, tested in whole numbers (2 x sum < k(m + 1)).
    estimates: function (s) {
      var k = s.length, m = 0, sum = 0;
      for (var i = 0; i < k; i++) { sum += s[i]; if (s[i] > m) m = s[i]; }
      return { m: m, est: [m, 2 * sum / k - 1, m + m / k - 1], below: 2 * sum < k * (m + 1) };
    },
    summary: function (v) { return { mean: M06.mean(v), sd: v.length > 1 ? M06.sd(v) : NaN }; },
    // n samples from a fresh generator: what the demo shows after Reset and
    // n samples in any mix of "Draw one sample" and "Draw 1,000 samples".
    run: function (o) {
      o = o || {};
      var N = o.total || 300, k = o.k || 5, n = o.n == null ? 1000 : o.n;
      var r = M06.rng(o.seed == null ? 606 : o.seed), est = [[], [], []], below = 0;
      for (var c = 0; c < n; c++) {
        var e = tanks.estimates(tanks.capture(r, N, k));
        for (var j = 0; j < 3; j++) est[j].push(e.est[j]);
        if (e.below) below++;
      }
      return { n: n, k: k, total: N, est: est, below: below, summary: est.map(tanks.summary) };
    }
  };

  // ---- least squares: 12 houses ----------------------------------------------------
  var ls = M06.sims.leastsquares = {
    // Size in hundreds of sq ft, uniform on 12-30 rounded to 0.5; price in
    // $ thousands = 60 + 10 size + normal(0, 28), rounded. Per house: one
    // uniform draw, then one normal draw.
    data: function (seed) {
      var r = M06.rng(seed == null ? 707 : seed), x = [], y = [];
      for (var i = 0; i < 12; i++) {
        var s = Math.round((12 + 18 * r()) * 2) / 2;
        x.push(s);
        y.push(Math.round(60 + 10 * s + 28 * r.normal()));
      }
      return { x: x, y: y };
    },
    // Sum of squared errors of the line through the two means with slope b.
    sse: function (d, b) {
      var xb = M06.mean(d.x), yb = M06.mean(d.y), s = 0;
      for (var i = 0; i < d.x.length; i++) { var e = d.y[i] - (yb + b * (d.x[i] - xb)); s += e * e; }
      return s;
    },
    fit: function (d) {
      var xb = M06.mean(d.x), yb = M06.mean(d.y), sxx = 0, sxy = 0;
      for (var i = 0; i < d.x.length; i++) {
        sxx += (d.x[i] - xb) * (d.x[i] - xb);
        sxy += (d.x[i] - xb) * (d.y[i] - yb);
      }
      var b = sxy / sxx;
      return { xbar: xb, ybar: yb, slope: b, intercept: yb - b * xb, sse: ls.sse(d, b) };
    }
  };

  // ---- likelihood: k purchases in n visits -----------------------------------------
  var lik = M06.sims.likelihood = {
    logChoose: function (n, k) { var s = 0; for (var i = 1; i <= k; i++) s += Math.log((n - k + i) / i); return s; },
    // The binomial chance of exactly k in n at rate p, computed in logs.
    prob: function (n, k, p) {
      if (p <= 0) return k === 0 ? 1 : 0;
      if (p >= 1) return k === n ? 1 : 0;
      return Math.exp(lik.logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
    },
    peak: function (n, k) { return k / n; },
    // Standard error from the curvature of the log likelihood at its peak.
    se: function (n, k) { var p = k / n; return Math.sqrt(p * (1 - p) / n); }
  };

  // ---- bootstrap: 30 customers ------------------------------------------------------
  var boot = M06.sims.bootstrap = {
    // 30 customers from the population, seed 808. The same on every reset.
    sample: function () { return M06.draw(M06.customers().values, 30, M06.rng(808)); },
    stat: function (v, which) { return which === 'max' ? M06.max(v) : M06.median(v); },
    // Indices of one bootstrap sample: n draws of r.int(n), the same draws as
    // M06.draw(sample, n, r).
    resampleIdx: function (r, n) { var out = new Array(n); for (var i = 0; i < n; i++) out[i] = r.int(n); return out; },
    resample: function (s, r) { return boot.resampleIdx(r, s.length).map(function (i) { return s[i]; }); },
    // The true standard error of the median: its SD across 1,000 new samples
    // of 30 from the population, seed 810.
    benchmark: function (reps, seed) {
      var pop = M06.customers().values, r = M06.rng(seed == null ? 810 : seed), med = [];
      for (var i = 0; i < (reps || 1000); i++) med.push(M06.median(M06.draw(pop, 30, r)));
      return M06.sd(med);
    },
    // n bootstrap samples from a fresh generator (seed 823), as the demo runs them.
    run: function (o) {
      o = o || {};
      var which = o.stat === 'max' ? 'max' : 'median', n = o.n == null ? 1000 : o.n;
      var s = boot.sample(), smax = M06.max(s), r = M06.rng(o.seed == null ? 823 : o.seed), v = [], atMax = 0;
      for (var i = 0; i < n; i++) {
        var t = boot.stat(boot.resample(s, r), which);
        v.push(t);
        if (t === smax) atMax++;
      }
      return {
        n: n, stat: which, values: v, sampleStat: boot.stat(s, which),
        se: n > 1 ? M06.sd(v) : NaN, atMax: atMax, shareAtMax: n ? atMax / n : NaN
      };
    }
  };

  // ---- permutation: 250 of 5,000 against 300 of 5,000 -------------------------------
  var perm = M06.sims.permutation = {
    PER: 5000, OLD: 250, NEW: 300, BUYERS: 550,
    // One exact random permutation of the page labels, keeping the purchases:
    // each buyer in turn goes to the new page with chance (new-page slots
    // left) / (slots left). 550 draws. Returns a, the buyers on the new page.
    shuffle: function (r) {
      var slotsNew = perm.PER, left = 2 * perm.PER, a = 0;
      for (var i = 0; i < perm.BUYERS; i++) {
        if (r() < slotsNew / left) { a++; slotsNew--; }
        left--;
      }
      return a;
    },
    // Difference in purchase rates in percentage points, new minus old.
    gap: function (a) { return (a - (perm.BUYERS - a)) / perm.PER * 100; },
    // At least as far from zero as the observed difference, in whole numbers.
    extreme: function (a) { return Math.abs(2 * a - perm.BUYERS) >= perm.NEW - perm.OLD; },
    // The textbook two-proportion test.
    formula: function () {
      var pbar = perm.BUYERS / (2 * perm.PER);
      var se = Math.sqrt(pbar * (1 - pbar) * (2 / perm.PER)) * 100;
      var z = ((perm.NEW - perm.OLD) / perm.PER * 100) / se;
      return { pbar: pbar, se: se, z: z, p: 2 * (1 - pnorm(z)) };
    },
    normalCdf: pnorm,
    normalPdf: dnorm,
    // n permutations from a fresh generator (seed 928), as the demo runs them.
    run: function (o) {
      o = o || {};
      var n = o.n == null ? 10000 : o.n, r = M06.rng(o.seed == null ? 928 : o.seed), count = 0, a = [];
      for (var i = 0; i < n; i++) {
        var x = perm.shuffle(r);
        a.push(x);
        if (perm.extreme(x)) count++;
      }
      return { n: n, count: count, share: n ? count / n : NaN, a: a };
    }
  };

  // =====================================================================================
  // 1. tanks — the German tank problem. viewBox 960 x 440.
  // =====================================================================================
  M06.demos.tanks = function (root, opts) {
    var C = M06.col, T = M06.sims.tanks;
    var N = Math.max(10, toInt(opts.total, 300));
    var ks = toList(opts.ks).map(Number).filter(function (v) { return v >= 1 && v <= N && v === Math.round(v); });
    var k = clamp(toInt(opts.k, ks.length ? ks[0] : 5), 1, N);
    if (ks.length && ks.indexOf(k) < 0) k = ks[0];
    var impossible = String(opts.impossible).toLowerCase() === 'true';
    var SEED = 606, BULK = 1000, BULK_MS = 2000, XMAX = 2 * N, NBINS = 60;
    var W = 960, H = 440, X0 = 50, X1 = 720, XS = 742;
    var TOPS = [72, 176, 280], BARH = 76;
    var BASE = TOPS.map(function (t) { return t + 100; });
    var NAMES = ['1. Sample maximum', '2. Twice the sample mean, minus 1', '3. Maximum plus average gap, minus 1'];
    var FILLS = [C.mid, C.axis, C.blue];

    var svg = M06.svg(root, W, H, 'The German tank problem: three estimators of the number of tanks, ' +
      'each drawn as a histogram of its estimates over many samples');
    var sx = M06.scale(0, XMAX, X0, X1);
    M06.axisX(svg, sx, BASE[2], ticks(0, XMAX, niceStep(XMAX, 6)), function (t) { return M06.fmt.num(t); },
      { title: 'Estimate of N' });
    [0, 1].forEach(function (i) {
      M06.el('line', { x1: X0, x2: X1, y1: BASE[i], y2: BASE[i], stroke: C.light, 'stroke-width': 1.5 }, svg);
    });
    var rows = FILLS.map(function (f, i) {
      return Bars(svg, sx, BASE[i], BARH, 0, XMAX, NBINS, { fill: f, right: true });
    });
    M06.vline(svg, sx(N), 66, BASE[2], { label: 'true N = ' + M06.fmt.num(N) });
    NAMES.forEach(function (s, i) { halo(M06.text(svg, X0, TOPS[i] + 16, s, { size: 17, fill: C.grey })); });
    var statText = BASE.map(function (b) { return M06.text(svg, XS, b - 32, '', { size: 17, fill: C.ink }); });
    // This sample's estimate on each row.
    var marks = BASE.map(function (b) {
      var g = M06.g(svg, { visibility: 'hidden' });
      return {
        g: g, x: null,
        line: M06.el('line', { x1: 0, x2: 0, y1: b, y2: b - 40, stroke: C.red, 'stroke-width': 3 }, g),
        dot: M06.el('circle', { cx: 0, cy: b, r: 5.5, fill: C.red }, g),
        text: halo(M06.text(g, 0, b - 47, '', { size: 18, fill: C.red, anchor: 'middle', weight: 700 }))
      };
    });
    var strip = M06.g(svg), toks = [];

    var bar = M06.controls(root);
    M06.button(bar, 'Draw one sample', captureOnce);
    M06.button(bar, 'Draw ' + M06.fmt.num(BULK) + ' samples', repeatMany);
    if (ks.length > 1) {
      M06.toggle(bar, ks.map(function (v) { return 'n = ' + v; }), ks, k,
        function (v) { if (v !== k) { k = v; clearAll(); } });
    }
    M06.button(bar, 'Reset', clearAll);
    var out = M06.readout(root);

    var run = Runner(), r, est, below;

    function placeMark(i, x, value, alpha) {
      var m = marks[i];
      m.x = x;
      attrs(m.line, { x1: x, x2: x });
      m.dot.setAttribute('cx', x);
      m.text.setAttribute('x', x);
      m.text.textContent = M06.fmt.num(value);
      m.g.setAttribute('opacity', alpha);
      visible(m.g, true);
    }
    function hideMarks() { marks.forEach(function (m) { visible(m.g, false); m.x = null; }); }

    // The sampled serial numbers as tokens (n <= 20), the maximum filled in.
    function drawStrip(s) {
      empty(strip);
      toks = [];
      var m = s[s.length - 1], tw = 10 * String(N).length + 8, gap = 6;
      if (s.length <= 20 && s.length * (tw + gap) <= 900) {
        s.forEach(function (v, j) {
          var x = X0 + j * (tw + gap), big = v === m, g = M06.g(strip, { visibility: 'hidden' });
          M06.el('rect', { x: x, y: 8, width: tw, height: 28, rx: 7, fill: big ? C.red : '#fff', stroke: C.red, 'stroke-width': 2 }, g);
          M06.text(g, x + tw / 2, 28, String(v), { size: 16, fill: big ? '#fff' : C.red, anchor: 'middle', weight: 600 });
          toks.push(g);
        });
        var xe = X0 + s.length * (tw + gap);
        if (xe + 240 < W) toks.push(M06.text(strip, xe + 4, 28, 'serial numbers in this sample', { size: 17, fill: C.grey, visibility: 'hidden' }));
      } else {
        var t = M06.text(strip, X0, 28, 'Sample of ' + M06.fmt.num(s.length) + ' serial numbers, maximum ', { size: 17, fill: C.grey });
        var sp = M06.el('tspan', { fill: C.red, 'font-weight': 700 }, t);
        sp.textContent = String(m);
      }
    }

    function record(e) {
      for (var i = 0; i < 3; i++) { est[i].push(e.est[i]); rows[i].add(e.est[i]); }
      if (e.below) below++;
    }
    function refresh() {
      var top = Math.max(10, rows[0].max(), rows[1].max(), rows[2].max());
      rows.forEach(function (b) { b.render(top); });
      var n = est[0].length;
      for (var i = 0; i < 3; i++) {
        var sd = n >= 2 ? M06.sd(est[i]) : 0;
        statText[i].textContent = n >= 2 ?
          'mean ' + M06.fmt.num(M06.mean(est[i])) + ' \u00b7 SD ' + M06.fmt.num(sd, sd < 9.95 ? 1 : 0) : '';
      }
      var s = 'Samples: ' + M06.fmt.num(n);
      if (impossible && n > 0) {
        s += SEP + 'Estimator 2 fell below the sample maximum in ' + bold(M06.fmt.num(below)) +
          ' of ' + M06.fmt.num(n) + (n === 1 ? ' sample' : ' samples');
      }
      out.innerHTML = s;
    }

    function captureOnce() {
      run.settle();
      var s = T.capture(r, N, k), e = T.estimates(s);
      drawStrip(s);
      var nt = toks.length, dt = nt ? Math.min(90, 600 / nt) : 0, T1 = nt * dt, T2 = 380, TT = T1 + T2;
      var from = marks.map(function (m) { return m.x; });
      var to = e.est.map(function (v) { return sx(clamp(v, 0, XMAX)); });
      run.run(TT, function (p) {
        var t = p * TT;
        toks.forEach(function (g, j) { visible(g, t >= j * dt); });
        if (t >= T1) {
          var q = M06.ease(clamp((t - T1) / T2, 0, 1));
          for (var i = 0; i < 3; i++) {
            placeMark(i, from[i] == null ? to[i] : lerp(from[i], to[i], q), e.est[i], from[i] == null ? q : 1);
          }
        }
      }, function () {
        toks.forEach(function (g) { visible(g, true); });
        for (var i = 0; i < 3; i++) placeMark(i, to[i], e.est[i], 1);
        record(e);
        refresh();
      });
    }

    function repeatMany() {
      run.settle();
      empty(strip);
      toks = [];
      hideMarks();
      var done = 0;
      function upTo(n) { for (; done < n; done++) record(T.estimates(T.capture(r, N, k))); }
      run.run(BULK_MS, function (p) { upTo(Math.round(BULK * M06.ease(p))); refresh(); },
        function () { upTo(BULK); refresh(); });
    }

    function clearAll() {
      run.stop();
      r = M06.rng(SEED);
      est = [[], [], []];
      below = 0;
      rows.forEach(function (b) { b.clear(); });
      empty(strip);
      toks = [];
      hideMarks();
      refresh();
    }

    clearAll();
  };

  // =====================================================================================
  // 2. leastsquares — each residual drawn as a square. viewBox 960 x 420.
  // =====================================================================================
  M06.demos.leastsquares = function (root) {
    var C = M06.col, L = M06.sims.leastsquares;
    var SEED = 707, B0 = 3, W = 960, H = 420;
    var X0 = 80, X1 = 560, YB = 350, YT = 30;     // the scatter
    var PX0 = 690, PX1 = 920, PT = 60;             // sum of squared residuals against the slope
    var d = L.data(SEED), f = L.fit(d), n = d.x.length, b = B0, i;

    var svg = M06.svg(root, W, H, 'Least squares: twelve houses and a candidate line, each residual drawn as a square, ' +
      'and the sum of squared residuals against the slope');
    var sx = M06.scale(10, 32, X0, X1);
    var ylo = Math.floor((Math.min.apply(null, d.y) - 10) / 50) * 50;
    var yhi = Math.ceil((Math.max.apply(null, d.y) + 10) / 50) * 50;
    var sy = M06.scale(ylo, yhi, YB, YT);
    M06.axisX(svg, sx, YB, ticks(10, 30, 5), null, { title: 'Size (hundreds of sq ft)' });
    M06.axisY(svg, sy, X0, ticks(ylo, yhi, 50), null, { title: 'Price ($ thousands)' });

    // Squares, residuals and the line are clipped to the panel, so the huge
    // squares of a bad slope fill it rather than the whole slide.
    var cid = 'm06-ls-clip-' + (++uid);
    var clip = M06.el('clipPath', { id: cid }, M06.el('defs', null, svg));
    M06.el('rect', { x: X0, y: YT, width: X1 - X0, height: YB - YT }, clip);
    var gc = M06.g(svg, { 'clip-path': 'url(#' + cid + ')' });
    var squares = [], errs = [];
    for (i = 0; i < n; i++) {
      squares.push(M06.el('rect', { fill: C.blue, 'fill-opacity': 0.2, stroke: C.blue, 'stroke-width': 1.2 }, gc));
    }
    for (i = 0; i < n; i++) errs.push(M06.el('line', { stroke: C.blue, 'stroke-width': 2 }, gc));
    var line = M06.el('line', { stroke: C.red, 'stroke-width': 3, 'stroke-linecap': 'round' }, gc);
    for (i = 0; i < n; i++) M06.el('circle', { cx: sx(d.x[i]), cy: sy(d.y[i]), r: 6, fill: C.ink }, svg);

    // The sum of squared residuals against the slope: a parabola.
    var sb = M06.scale(0, 20, PX0, PX1);
    var eTop = Math.max(L.sse(d, 0), L.sse(d, 20)) * 1.06;
    var se = M06.scale(0, eTop, YB, PT);
    M06.text(svg, PX0 - 50, 36, 'Sum of squared residuals', { size: 17, fill: C.grey });
    M06.axisX(svg, sb, YB, ticks(0, 20, 5), null, { title: 'Slope ($ thousands per 100 sq ft)' });
    M06.axisY(svg, se, PX0, ticks(0, eTop, niceStep(eTop, 3)), function (t) { return M06.fmt.num(t); });
    var pts = [];
    for (i = 0; i <= 200; i++) { var bb = 20 * i / 200; pts.push(sb(bb).toFixed(1) + ',' + se(L.sse(d, bb)).toFixed(1)); }
    M06.el('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: C.axis, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, svg);
    var mx = sb(f.slope), my = se(f.sse);
    M06.el('circle', { cx: mx, cy: my, r: 4.5, fill: '#fff', stroke: C.axis, 'stroke-width': 2 }, svg);
    // Centred under the minimum, but kept clear of the panel's y-axis.
    M06.text(svg, clamp(mx, PX0 + 124, W - 124), my + 26, 'least squares estimate: ' + M06.fmt.num(f.slope, 1),
      { size: 16, fill: C.axis, anchor: 'middle' });
    var dot = M06.el('circle', { r: 7, fill: C.red, stroke: '#fff', 'stroke-width': 2 }, svg);

    var bar = M06.controls(root);
    var sl = M06.slider(bar, 'Slope', 0, 20, 0.1, B0, function (v) { run.stop(); b = v; draw(); });
    M06.button(bar, 'Sweep', function () { glide([b, 0, 20, f.slope], 4000); });
    M06.button(bar, 'Best fit', function () { glide([b, f.slope], 600); });
    M06.button(bar, 'Reset', function () {
      run.stop();
      d = L.data(SEED);
      f = L.fit(d);
      setB(B0);
    });
    var out = M06.readout(root);
    var run = Runner();

    function draw() {
      var xb = f.xbar, yb = f.ybar;
      attrs(line, { x1: sx(10), y1: sy(yb + b * (10 - xb)), x2: sx(32), y2: sy(yb + b * (32 - xb)) });
      for (var j = 0; j < n; j++) {
        var px = sx(d.x[j]), py = sy(d.y[j]), pf = sy(yb + b * (d.x[j] - xb)), side = Math.abs(py - pf);
        attrs(errs[j], { x1: px, x2: px, y1: py, y2: pf });
        // A true square on screen: its side is the residual's length in pixels.
        attrs(squares[j], { x: px + side <= X1 ? px : px - side, y: Math.min(py, pf), width: side, height: side });
      }
      var e = L.sse(d, b);
      attrs(dot, { cx: sb(b), cy: se(e) });
      out.innerHTML = 'Slope: ' + bold('$' + M06.fmt.num(b, 1) + 'k') + ' per 100 sq ft' + SEP +
        'Sum of squared residuals: ' + bold(M06.fmt.num(e));
    }
    function setB(v) { b = v; sl.value = String(Math.round(v * 10) / 10); draw(); }
    // Move the slope through a list of values, easing each leg, in ms total.
    // A new glide starts from wherever the slope is now.
    function glide(path, ms) {
      run.stop();
      var legs = [], total = 0, last = path[path.length - 1];
      for (var j = 1; j < path.length; j++) {
        var len = Math.abs(path[j] - path[j - 1]);
        if (len > 1e-9) { legs.push({ a: path[j - 1], b: path[j], s: total, len: len }); total += len; }
      }
      if (!legs.length) { setB(last); return; }
      run.run(ms, function (p) {
        var t = p * total;
        for (var j = 0; j < legs.length; j++) {
          var g = legs[j];
          if (t <= g.s + g.len || j === legs.length - 1) {
            setB(lerp(g.a, g.b, M06.ease(clamp((t - g.s) / g.len, 0, 1))));
            return;
          }
        }
      }, function () { setB(last); });
    }

    setB(B0);
  };

  // =====================================================================================
  // 3. likelihood — the probability of the observed data, by p. viewBox 960 x 400.
  // =====================================================================================
  M06.demos.likelihood = function (root, opts) {
    var C = M06.col, K = M06.sims.likelihood;
    var W = 960, H = 400, X0 = 90, X1 = 900, YB = 336, YT = 100, XL = 40, CAPX = 536;
    var P0 = 0.2, GRID = 400;
    var SETS = { a: { k: 7, n: 20 }, b: { k: 70, n: 200 } };
    var AX = {
      a: { max: 0.2, ticks: [0, 0.05, 0.1, 0.15, 0.2], title: 'Likelihood: probability of the observed data' },
      b: { max: 0.07, ticks: [0, 0.02, 0.04, 0.06], title: 'Likelihood: probability of the observed data' },
      both: { max: 1.1, ticks: [0, 0.5, 1], title: 'Likelihood relative to its maximum' }
    };
    var CAPTION = {
      a: 'What we saw: 7 purchases in 20 visits',
      b: 'What we saw: 70 purchases in 200 visits',
      both: 'What we saw: 7 purchases in 20 visits, or 70 in 200'
    };
    var m0 = String(opts.mode).toLowerCase(), mode0 = AX[m0] ? m0 : 'a';
    var mode = mode0, p = P0, sy, i;
    var peakA = K.prob(20, 7, K.peak(20, 7)), peakB = K.prob(200, 70, K.peak(200, 70));
    var curA = [], curB = [];
    for (i = 0; i <= GRID; i++) { curA.push(K.prob(20, 7, i / GRID)); curB.push(K.prob(200, 70, i / GRID)); }

    var svg = M06.svg(root, W, H, 'Maximum likelihood: the probability of the observed purchases at each candidate purchase probability');
    var sx = M06.scale(0, 1, X0, X1);
    // The observed data: 20 visits, 7 of them purchases (a fixed, made-up order).
    var gDots = M06.g(svg), BOUGHT = [1, 4, 5, 9, 12, 16, 18];
    for (i = 0; i < 20; i++) {
      var on = BOUGHT.indexOf(i) >= 0;
      M06.el('circle', { cx: XL + 9 + i * 24, cy: 26, r: 9, fill: on ? C.red : '#fff', stroke: on ? C.red : C.mid, 'stroke-width': 2 }, gDots);
    }
    var caption = M06.text(svg, CAPX, 32, '', { size: 18, fill: C.ink });
    var yTitle = M06.text(svg, XL, 84, '', { size: 17, fill: C.grey });
    var gAxY = M06.g(svg);
    M06.axisX(svg, sx, YB, [0, 0.2, 0.4, 0.6, 0.8, 1], function (t) { return String(t); }, { title: 'Purchase probability p' });
    var pathA = M06.el('path', { fill: 'none', stroke: C.axis, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    var pathB = M06.el('path', { fill: 'none', stroke: C.blue, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    // The candidate line, then the direct labels over it ("20 visits" outside
    // the wide curve's right flank, "200 visits" under the narrow peak), so
    // the line passes behind the labels, then the dots on top.
    var iA = Math.round(K.peak(20, 7) * GRID);
    while (iA < GRID && curA[iA] / peakA > 0.45) iA++;
    var cand = M06.el('line', { y1: YB, y2: YT - 8, stroke: C.red, 'stroke-width': 2.5 }, svg);
    var labA = halo(M06.text(svg, 0, 0, '20 visits', { size: 17, fill: C.axis, weight: 600 }), 4);
    var labB = halo(M06.text(svg, sx(K.peak(200, 70)), YB - 10, '200 visits', { size: 17, fill: C.blue, weight: 600, anchor: 'middle' }), 4);
    var dots = [0, 1].map(function () { return M06.el('circle', { r: 6.5, fill: C.red, stroke: '#fff', 'stroke-width': 2 }, svg); });
    var vals = [0, 1].map(function () { return halo(M06.text(svg, 0, 0, '', { size: 17, fill: C.red, weight: 700 })); });

    var bar = M06.controls(root);
    var sl = M06.slider(bar, 'Candidate purchase probability', 0.01, 0.99, 0.01, P0, function (v) { run.stop(); p = v; drawCand(); });
    M06.button(bar, 'Find the peak', function () {
      run.stop();
      var from = p, target = K.peak(20, 7);
      run.run(1200, function (q) { setP(lerp(from, target, M06.ease(q))); }, function () { setP(target); });
    });
    var tog = M06.toggle(bar, ['7 of 20', '70 of 200', 'Both'], ['a', 'b', 'both'], mode0,
      function (m) { if (m !== mode) setMode(m); });
    M06.button(bar, 'Reset', function () {
      run.stop();
      tog.set(mode0);
      p = P0;
      sl.value = P0.toFixed(2);
      setMode(mode0);
    });
    var out = M06.readout(root);
    var run = Runner();

    function fmtP(v, short) { return v >= 0.0005 ? v.toFixed(3) : (short ? '< 0.001' : 'less than 0.001'); }
    function curvePath(v, norm) {
      var s = '';
      for (var j = 0; j <= GRID; j++) s += (j ? 'L' : 'M') + sx(j / GRID).toFixed(1) + ',' + sy(v[j] / norm).toFixed(1);
      return s;
    }
    function setMode(m) {
      mode = m;
      var ax = AX[m], both = m === 'both';
      sy = M06.scale(0, ax.max, YB, YT);
      empty(gAxY);
      M06.axisY(gAxY, sy, X0, ax.ticks, function (t) { return both || t === 0 ? String(t) : t.toFixed(2); });
      yTitle.textContent = ax.title;
      visible(pathA, m !== 'b');
      visible(pathB, m !== 'a');
      if (m !== 'b') pathA.setAttribute('d', curvePath(curA, both ? peakA : 1));
      if (m !== 'a') pathB.setAttribute('d', curvePath(curB, both ? peakB : 1));
      attrs(labA, { x: sx(iA / GRID) + 10, y: sy(0.45) + 6 });
      visible(labA, both);
      visible(labB, both);
      visible(gDots, m === 'a');
      caption.setAttribute('x', m === 'a' ? CAPX : XL);
      caption.textContent = CAPTION[m];
      drawCand();
    }
    function setP(v) { p = v; sl.value = v.toFixed(2); drawCand(); }
    function drawCand() {
      var x = sx(p), vA = K.prob(20, 7, p), vB = K.prob(200, 70, p), both = mode === 'both';
      attrs(cand, { x1: x, x2: x });
      var pts = mode === 'a' ? [[vA, 1]] : mode === 'b' ? [[vB, 1]] : [[vA, peakA], [vB, peakB]];
      for (var j = 0; j < 2; j++) {
        var on = j < pts.length;
        visible(dots[j], on);
        visible(vals[j], on && !both);
        if (!on) continue;
        var y = sy(pts[j][0] / pts[j][1]);
        attrs(dots[j], { cx: x, cy: y });
        if (!both) {
          var right = x < X1 - 90;
          attrs(vals[j], { x: right ? x + 11 : x - 11, y: y - 10, 'text-anchor': right ? 'start' : 'end' });
          vals[j].textContent = fmtP(pts[j][0], true);
        }
      }
      if (both) {
        out.innerHTML = 'Maximum at ' + K.peak(20, 7).toFixed(2) + ' in both' + SEP + 'Standard error from the curvature: ' +
          bold(K.se(20, 7).toFixed(3)) + ' (n = 20), ' + bold(K.se(200, 70).toFixed(3)) + ' (n = 200)';
      } else {
        var s = SETS[mode], v = mode === 'a' ? vA : vB;
        out.innerHTML = 'At p = ' + bold(p.toFixed(2)) + ', the probability of exactly ' + s.k + ' purchases in ' +
          s.n + ' visits is ' + bold(fmtP(v)) + SEP + 'Maximum likelihood estimate: ' + bold(K.peak(s.n, s.k).toFixed(2));
      }
    }

    setMode(mode0);
  };

  // =====================================================================================
  // 4. bootstrap — bootstrap samples from 30 customers. viewBox 960 x 420.
  // =====================================================================================
  M06.demos.bootstrap = function (root, opts) {
    var C = M06.col, B = M06.sims.bootstrap;
    var SEED = 823, BULK = 1000, BULK_MS = 2000, DT = 35, W = 960, H = 420;
    var X0 = 60, X1 = 900, BINW = 6, R = 7;
    var TOPY = { title: 16, label: 38, base: 100, axis: 110 };
    var MID = { title: 160, label: 182, base: 246, line: 254, room: 49 };
    var BOT = { title: 284, base: 372, h: 76 };
    var NAMES = { median: 'Median', max: 'Maximum' };
    function which(s) {
      s = String(s).toLowerCase();
      return s === 'median' ? 'median' : (s === 'max' || s === 'maximum') ? 'max' : null;
    }
    var choices = toList(opts.stats).map(which).filter(function (s, j, a) { return s && a.indexOf(s) === j; });
    var stat0 = which(opts.stat) || (choices.length ? choices[0] : 'median');
    if (choices.length && choices.indexOf(stat0) < 0) stat0 = choices[0];
    var stat = stat0;
    var sample = B.sample(), n = sample.length, sorted = sample.slice().sort(byNum), smax = sorted[n - 1];
    var bench = B.benchmark();
    // One axis for all three panels, wide enough for the population value:
    // the population median for the median, the population maximum for the
    // maximum. The true value is a solid line and the sample statistic a
    // dashed line, both running through every panel.
    var popVals = M06.customers().values;
    var popV = stat0 === 'max' ? M06.max(popVals) : M06.customers().median;
    var hiT = stat0 === 'max' ? Math.ceil((popV + 7) / 50) * 50 : Math.max(300, Math.ceil(smax / 50) * 50);
    BINW = hiT / 50;

    var svg = M06.svg(root, W, H, 'The bootstrap: an observed sample of 30 customers, one bootstrap sample drawn with replacement, ' +
      'and a histogram of the statistic across bootstrap samples');
    var sx = M06.scale(0, hiT, X0, X1);
    function binX(v) { return sx(Math.floor(v / BINW) * BINW + BINW / 2); }
    function statLabel(g, x, y, str) {
      var right = x + 210 < W;
      return halo(M06.text(g, right ? x + 6 : x - 6, y, str, { size: 17, fill: C.red, weight: 600, anchor: right ? 'start' : 'end' }));
    }

    // Top: the observed sample, as a dot plot in $6 bins.
    M06.text(svg, X0, TOPY.title, 'Observed sample: ' + n + ' customers', { size: 17, fill: C.grey });
    M06.axisX(svg, sx, TOPY.axis, ticks(0, hiT, 50), function (t) { return '$' + t; });
    var gTopStat = M06.g(svg), gTopDots = M06.g(svg), topDots = [], lv = {};
    sample.forEach(function (v) {
      var bi = Math.floor(v / BINW);
      lv[bi] = (lv[bi] || 0) + 1;
      topDots.push(M06.el('circle', { cx: binX(v), cy: TOPY.base - (lv[bi] - 1) * 14, r: R, fill: C.ink }, gTopDots));
    });
    // Middle: one bootstrap sample.
    M06.text(svg, X0, MID.title, 'One bootstrap sample: ' + n + ' draws with replacement', { size: 17, fill: C.grey });
    M06.el('line', { x1: X0, x2: X1, y1: MID.line, y2: MID.line, stroke: C.light, 'stroke-width': 1.5 }, svg);
    var gMidStat = M06.g(svg), gMid = M06.g(svg);
    // Bottom: the statistic across bootstrap samples.
    var gHist = M06.g(svg), hist = null, hot = -1;
    var gLines = M06.g(svg);
    var drop = M06.el('circle', { r: 6, fill: C.red, visibility: 'hidden' }, svg);

    var bar = M06.controls(root);
    M06.button(bar, 'Draw one bootstrap sample', resampleOnce);
    M06.button(bar, 'Draw ' + M06.fmt.num(BULK) + ' bootstrap samples', resampleMany);
    if (choices.length > 1) {
      M06.toggle(bar, choices.map(function (c) { return NAMES[c]; }), choices, stat0,
        function (v) { if (v !== stat) { stat = v; clearAll(); } });
    }
    M06.button(bar, 'Reset', clearAll);
    var out = M06.readout(root);
    var run = Runner(), r, vals, atMax;

    function buildHist() {
      empty(gHist);
      // The same axis as the panels above, so every line runs straight down.
      var lo = 0, hi = hiT, w = stat === 'max' ? 5 : 1, step = 50;
      var sxH = sx;
      M06.text(gHist, X0, BOT.title, stat === 'max' ? 'Maximum of each bootstrap sample' : 'Median of each bootstrap sample',
        { size: 17, fill: C.grey });
      M06.axisX(gHist, sxH, BOT.base, ticks(lo, hi, step), function (t) { return '$' + t; });
      hist = Bars(gHist, sxH, BOT.base, BOT.h, lo, hi, Math.round((hi - lo) / w), { fill: C.axis });
    }
    function histTop() { return Math.max(10, hist.max()); }
    // The latest bootstrap statistic stays as a dot resting on its bar.
    function renderHist() {
      var top = histTop();
      hist.render(top);
      visible(drop, hot >= 0);
      if (hot >= 0) attrs(drop, { cx: hist.center(hot), cy: BOT.base - hist.bins[hot] / top * BOT.h - 6 });
    }
    function drawTopStat() {
      empty(gTopStat);
      empty(gLines);
      var v = B.stat(sample, stat), x = sx(v), xp = sx(popV), max = stat === 'max';
      // The true value: solid. The sample statistic: dashed. Labels sit on
      // opposite sides of their lines so they never collide.
      M06.el('line', { x1: xp, x2: xp, y1: TOPY.label + 6, y2: BOT.base, stroke: C.red, 'stroke-width': 2.5 }, gLines);
      M06.el('line', { x1: x, x2: x, y1: TOPY.label + 6, y2: BOT.base, stroke: C.red, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, gLines);
      var popRight = xp >= x;
      halo(M06.text(gLines, popRight ? xp + 6 : xp - 6, TOPY.label, (max ? 'population maximum ' : 'population median ') + M06.fmt.money(popV, 2),
        { size: 17, fill: C.red, weight: 700, anchor: popRight ? 'start' : 'end' }));
      halo(M06.text(gLines, popRight ? x - 6 : x + 6, TOPY.label, (max ? 'sample maximum ' : 'sample median ') + M06.fmt.money(v, 2),
        { size: 17, fill: C.red, weight: 600, anchor: popRight ? 'end' : 'start' }));
    }
    function paintTop(seen, current) {
      topDots.forEach(function (c, j) {
        c.setAttribute('fill-opacity', !seen || seen[j] ? 1 : 0.22);
        c.setAttribute('fill', j === current ? C.red : C.ink);
      });
    }
    function clearMid() { empty(gMid); empty(gMidStat); visible(drop, false); }
    function record(v) { vals.push(v); if (v === smax) atMax++; return hist.add(v); }
    function readout() {
      var m = vals.length, s = 'Bootstrap samples: ' + M06.fmt.num(m);
      if (stat === 'median') {
        if (m >= 2) {
          s += SEP + 'Bootstrap standard error of the median: ' + bold(M06.fmt.money(M06.sd(vals), 2)) +
            SEP + 'True standard error: ' + bold(M06.fmt.money(bench, 2));
        }
      } else if (m >= 1) {
        s += SEP + 'Bootstrap samples whose maximum equals the sample maximum: ' + bold(M06.fmt.pct(atMax / m, 0));
      }
      out.innerHTML = s;
    }

    function resampleOnce() {
      run.settle();
      var idx = B.resampleIdx(r, n), rs = idx.map(function (j) { return sample[j]; }), v = B.stat(rs, stat);
      clearMid();
      hot = -1;
      renderHist();
      // Stack the draws in $6 bins, so a customer drawn twice makes a tower;
      // squeeze the spacing if a tower would not fit.
      var cnt = {}, lev = [], tallest = 1;
      rs.forEach(function (x, j) {
        var bi = Math.floor(x / BINW);
        cnt[bi] = (cnt[bi] || 0) + 1;
        lev[j] = cnt[bi];
        if (cnt[bi] > tallest) tallest = cnt[bi];
      });
      var gap = tallest > 1 ? Math.min(14, MID.room / (tallest - 1)) : 14;
      var dots = rs.map(function (x, j) {
        return M06.el('circle', { cx: binX(x), cy: MID.base - (lev[j] - 1) * gap, r: R, fill: C.ink, visibility: 'hidden' }, gMid);
      });
      var xs = sx(v), mk = M06.g(gMidStat, { visibility: 'hidden' });
      M06.el('line', { x1: xs, x2: xs, y1: MID.label + 6, y2: MID.line, stroke: C.red, 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }, mk);
      statLabel(mk, xs, MID.label, (stat === 'max' ? 'bootstrap maximum ' : 'bootstrap median ') + M06.fmt.money(v, 2));
      // Where the dot lands: the top of its bar once it is counted.
      var kb = hist.index(v), hb = hist.bins[kb] + 1, top = Math.max(histTop(), hb);
      var x1 = hist.center(kb), y1 = BOT.base - hb / top * BOT.h - 6;
      var T1 = n * DT, T2 = 250, T3 = 400, TT = T1 + T2 + T3;
      run.run(TT, function (p) {
        var t = p * TT, shown = Math.min(n, Math.floor(t / DT) + 1), drawing = t < T1, seen = [];
        for (var j = 0; j < n; j++) {
          var on = j < shown;
          visible(dots[j], on);
          if (!on) continue;
          seen[idx[j]] = true;
          dots[j].setAttribute('fill', drawing && j === shown - 1 ? C.red : C.ink);
        }
        paintTop(seen, drawing ? idx[shown - 1] : -1);
        visible(mk, t >= T1);
        if (t >= T1 + T2) {
          var q = clamp((t - T1 - T2) / T3, 0, 1);
          visible(drop, true);
          attrs(drop, { cx: lerp(xs, x1, q), cy: lerp(MID.line, y1, q * q) });
        }
      }, function () {
        var seen = [];
        dots.forEach(function (c) { visible(c, true); c.setAttribute('fill', C.ink); });
        idx.forEach(function (j) { seen[j] = true; });
        paintTop(seen, -1);
        visible(mk, true);
        visible(drop, false);
        hot = record(v);
        renderHist();
        readout();
      });
    }

    function resampleMany() {
      run.settle();
      clearMid();
      paintTop(null, -1);
      hot = -1;
      var done = 0;
      function upTo(m) { for (; done < m; done++) record(B.stat(B.resample(sample, r), stat)); }
      run.run(BULK_MS, function (p) { upTo(Math.round(BULK * M06.ease(p))); renderHist(); readout(); },
        function () { upTo(BULK); renderHist(); readout(); });
    }

    function clearAll() {
      run.stop();
      r = M06.rng(SEED);
      vals = [];
      atMax = 0;
      hot = -1;
      buildHist();
      drawTopStat();
      clearMid();
      paintTop(null, -1);
      renderHist();
      readout();
    }

    clearAll();
  };

  // =====================================================================================
  // 5. permutation — a permutation test. viewBox 960 x 420.
  // =====================================================================================
  M06.demos.permutation = function (root) {
    var C = M06.col, P = M06.sims.permutation;
    var SEED = 928, DECOR = 9091, BULK = 10000, BULK_MS = 2500, W = 960, H = 420;
    var X0 = 80, X1 = 880, YB = 344, HB = 196, YL = 132;
    var NC = 40, CX0 = 60, DX = 19, CY = 34, CR = 7, LX = 838;
    var RING = [3, 11, 16, 24, 29, 35];
    // The differences a permutation can produce are multiples of 0.04 points
    // ((a - 275) / 25), so the bins are 0.04 wide and centred on them:
    // 75 bins, centres -1.48 .. +1.48, bin 37 is zero.
    var NB = 75, MID0 = 37, EDGE = Math.round((P.NEW - P.OLD) / 2);
    var BINW = 3 / NB, F = P.formula();

    var svg = M06.svg(root, W, H, 'A permutation test: the difference in purchase rates after each permutation of the page labels, ' +
      'against the observed difference');
    // Top strip, decorative: 40 visitors, page by colour, purchases ringed.
    var circles = [], page = [], i;
    for (i = 0; i < NC; i++) circles.push(M06.el('circle', { cx: CX0 + i * DX, cy: CY, r: CR }, svg));
    RING.forEach(function (j) {
      M06.el('circle', { cx: CX0 + j * DX, cy: CY, r: CR + 3, fill: 'none', stroke: C.red, 'stroke-width': 2.2 }, svg);
    });
    M06.el('circle', { cx: LX, cy: 16, r: CR, fill: C.mid }, svg);
    M06.text(svg, LX + 14, 22, 'old page', { size: 16, fill: C.grey });
    M06.el('circle', { cx: LX, cy: 38, r: CR, fill: C.blue }, svg);
    M06.text(svg, LX + 14, 44, 'new page', { size: 16, fill: C.grey });
    M06.el('circle', { cx: LX, cy: 60, r: CR, fill: 'none', stroke: C.red, 'stroke-width': 2.2 }, svg);
    M06.text(svg, LX + 14, 66, 'purchased', { size: 16, fill: C.grey });
    M06.text(svg, CX0 - CR, 78, 'Permute the page labels. Keep the purchases.', { size: 17, fill: C.grey });

    // Main histogram of the differences under permutation.
    var sx = M06.scale(-1.5, 1.5, X0, X1);
    M06.axisX(svg, sx, YB, [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
      function (t) { return t === 0 ? '0' : (t > 0 ? '+' : MINUS) + Math.abs(t).toFixed(1); },
      { title: 'Difference in purchase rates under the null (percentage points)' });
    var hist = Bars(svg, sx, YB, HB, -1.5, 1.5, NB, {
      fill: function (j) { return Math.abs(j - MID0) >= EDGE ? C.red : C.axis; }
    });
    M06.vline(svg, sx(1), YL, YB, { label: 'observed difference +1.0', anchor: 'end', dash: '7 5' });
    M06.vline(svg, sx(-1), YL, YB, { dash: '7 5' });
    var curve = M06.el('path', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linejoin': 'round', visibility: 'hidden' }, svg);
    var curveLab = halo(M06.text(svg, 0, 0, 'normal approximation', { size: 17, fill: C.ink, weight: 600, anchor: 'end', visibility: 'hidden' }), 4);
    var mark = M06.g(svg, { visibility: 'hidden' });
    var markTri = M06.el('path', { fill: C.red }, mark);
    var markTxt = halo(M06.text(mark, 0, 0, '', { size: 17, fill: C.red, weight: 700, anchor: 'middle' }));

    var bar = M06.controls(root);
    M06.button(bar, 'One permutation', shuffleOnce);
    M06.button(bar, M06.fmt.num(BULK) + ' permutations', shuffleMany);
    var fBtn = M06.button(bar, 'Show normal approximation', function () {
      showF = !showF;
      fBtn.classList.toggle('on', showF);
      render();
      readout();
    });
    M06.button(bar, 'Reset', clearAll);
    var out = M06.readout(root);
    var run = Runner(), r, deco, ext, hotBin, hotGap, showF = false;

    function pageColor(pg) { return pg ? C.blue : C.mid; }
    function paintStrip() { circles.forEach(function (c, j) { c.setAttribute('fill', pageColor(page[j])); }); }
    function record(a) {
      if (P.extreme(a)) ext++;
      return hist.addBin(clamp(a - P.BUYERS / 2, -MID0, MID0) + MID0);
    }
    // Expected permutations per bin under the normal approximation.
    function expected(g, m) { return m * BINW * dnorm(g / F.se) / F.se; }
    function render() {
      var m = hist.count(), mEff = m > 0 ? m : BULK, top = Math.max(10, hist.max());
      if (showF) top = Math.max(top, expected(0, mEff));
      hist.render(top);
      if (showF) {
        var s = '';
        for (var j = 0; j <= 150; j++) {
          var g = -1.5 + 3 * j / 150;
          s += (j ? 'L' : 'M') + sx(g).toFixed(1) + ',' + (YB - expected(g, mEff) / top * HB).toFixed(1);
        }
        curve.setAttribute('d', s);
        // Left of the curve's upper flank, clear of the dashed line at -1.0.
        attrs(curveLab, { x: sx(-0.25) - 10, y: YB - expected(-0.25, mEff) / top * HB - 4 });
      }
      visible(curve, showF);
      visible(curveLab, showF);
      visible(mark, hotBin >= 0);
      if (hotBin >= 0) {
        var cx = hist.center(hotBin), ty = YB - hist.bins[hotBin] / top * HB - 6;
        markTri.setAttribute('d', 'M' + (cx - 7) + ',' + (ty - 10) + 'L' + (cx + 7) + ',' + (ty - 10) + 'L' + cx + ',' + ty + 'Z');
        attrs(markTxt, { x: cx, y: ty - 15 });
        markTxt.textContent = Math.abs(hotGap) < 1e-9 ? '0' : M06.fmt.signed(hotGap, 2);
      }
    }
    function readout() {
      var m = hist.count(), s = 'Permutations: ' + M06.fmt.num(m);
      if (m > 0) {
        s += SEP + 'With |difference| \u2265 1.0 point: ' + bold(M06.fmt.num(ext)) + SEP + 'p-value: ' + bold((ext / m).toFixed(3));
      }
      if (showF) s += '<br>Normal approximation: z = ' + bold(F.z.toFixed(2)) + ', p = ' + bold(F.p.toFixed(3));
      out.innerHTML = s;
    }

    function shuffleOnce() {
      run.settle();
      var a = P.shuffle(r), from = page.slice(), to = deco.shuffle(page.slice());
      hotBin = -1;
      render();
      run.run(500, function (q) {
        var e = M06.ease(q);
        circles.forEach(function (c, j) {
          c.setAttribute('fill', from[j] === to[j] ? pageColor(to[j]) : mix(pageColor(from[j]), pageColor(to[j]), e));
        });
      }, function () {
        page = to;
        paintStrip();
        hotBin = record(a);
        hotGap = P.gap(a);
        render();
        readout();
      });
    }

    function shuffleMany() {
      run.settle();
      hotBin = -1;
      var done = 0;
      function upTo(m) { for (; done < m; done++) record(P.shuffle(r)); }
      run.run(BULK_MS, function (q) { upTo(Math.round(BULK * M06.ease(q))); render(); readout(); },
        function () { upTo(BULK); render(); readout(); });
    }

    function clearAll() {
      run.stop();
      r = M06.rng(SEED);
      deco = M06.rng(DECOR);
      hist.clear();
      ext = 0;
      hotBin = -1;
      showF = false;
      fBtn.classList.remove('on');
      page = [];
      for (var j = 0; j < NC; j++) page.push(j < NC / 2 ? 0 : 1);
      paintStrip();
      render();
      readout();
    }

    clearAll();
  };
})();
